import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/validateApiKey'
import { getUserScope } from '@/lib/getUserScope'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])
const GRACE_MS = 5 * 60 * 60 * 1000 // 5 hours

type KeyStatus = 'grace' | 'active' | 'expired_unused' | 'revoked'

async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, scope }
}

/**
 * Sweep orphaned websites whose API keys were never used within the grace window.
 * Only runs when the caller is admin, and only deletes a website when:
 *   - At least one api_keys row for the domain was created > GRACE_MS ago
 *   - ALL api_keys rows for the domain are expired_unused (is_active=false, last_used=null)
 *   - No phone_numbers, products, blog_posts, OR website_integrations exist for the domain
 * On delete, writes an audit log entry with entity_type='website', action='delete'.
 */
async function sweepOrphanedWebsites(userId: string) {
  const service = createServiceClient()
  const cutoffIso = new Date(Date.now() - GRACE_MS).toISOString()

  // Candidate websites: distinct `website` values from api_keys older than the grace window
  const { data: candidateRows } = await service
    .from('api_keys')
    .select('website')
    .lt('created_at', cutoffIso)
    .neq('website', '*')

  const candidates = [...new Set((candidateRows ?? []).map(r => r.website as string))]
  if (candidates.length === 0) return

  for (const domain of candidates) {
    try {
      // Every api_key for this domain must be expired_unused
      const { data: keys } = await service
        .from('api_keys')
        .select('is_active, last_used')
        .eq('website', domain)
      if (!keys || keys.length === 0) continue
      const allExpiredUnused = keys.every(k => !k.is_active && k.last_used === null)
      if (!allExpiredUnused) continue

      // No other signals of actual use
      const [phoneRes, productRes, blogRes, integrationRes] = await Promise.all([
        service.from('phone_numbers').select('*', { count: 'exact', head: true }).eq('website', domain),
        service.from('products').select('*', { count: 'exact', head: true }).eq('website', domain),
        service.from('blog_posts').select('*', { count: 'exact', head: true }).eq('website', domain),
        service.from('website_integrations').select('*', { count: 'exact', head: true }).eq('website', domain),
      ])
      if ((phoneRes.count ?? 0) > 0) continue
      if ((productRes.count ?? 0) > 0) continue
      if ((blogRes.count ?? 0) > 0) continue
      if ((integrationRes.count ?? 0) > 0) continue

      // Fetch the company_websites row so we have the id + company context for the audit log
      const { data: cw } = await service
        .from('company_websites')
        .select('id, company_id')
        .eq('domain', domain)
        .maybeSingle()
      if (!cw) continue

      // Look up company name for the audit record (best-effort)
      const { data: company } = await service.from('companies').select('name').eq('id', cw.company_id).maybeSingle()

      // Delete the company_websites link
      const { error: delErr } = await service.from('company_websites').delete().eq('domain', domain)
      if (delErr) continue

      // Audit log — mark actor as auto-sweep so it's recognisable in /audit
      const actor = await resolveActor(userId)
      await writeAuditLog({
        actor: { ...actor, name: `${actor.name} (auto-sweep)` },
        entityType: 'website',
        entityId: cw.id,
        action: 'delete',
        website: domain,
        label: domain,
        metadata: {
          reason: 'auto-removed — no API usage within 5h grace window',
          company_id: cw.company_id,
          company_name: company?.name ?? null,
          stale_api_keys: keys.length,
        },
      })
    } catch {
      // Skip this candidate and continue with the rest
      continue
    }
  }
}

/**
 * GET /api/admin/api-keys
 *
 * Status rules:
 *   - `grace`           → created < 5h ago and never used → full key still viewable
 *   - `active`          → used at least once, still active → key is masked forever
 *   - `expired_unused`  → created ≥ 5h ago, never used → auto-deactivated, must regenerate
 *   - `revoked`         → admin/owner revoked it (was used before) → masked, disabled
 */
export async function GET() {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  const service = createServiceClient()
  const now = Date.now()
  const cutoffIso = new Date(now - GRACE_MS).toISOString()

  // Sweep: auto-expire stale unused keys
  await service
    .from('api_keys')
    .update({ is_active: false })
    .lt('created_at', cutoffIso)
    .is('last_used', null)
    .eq('is_active', true)

  // Sweep orphaned websites (admin-only — scoped users shouldn't trigger cross-company deletes)
  if (auth.scope.role === 'admin') {
    try { await sweepOrphanedWebsites(auth.user.id) } catch {}
  }

  let query = service
    .from('api_keys')
    .select('id, name, key, website, permissions, is_active, last_used, created_at')
    .order('created_at', { ascending: false })

  if (auth.scope.isScoped) {
    const allowed = auth.scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json([])
    query = query.in('website', allowed)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data ?? []).map((k: any) => {
    const createdMs = new Date(k.created_at).getTime()
    const neverUsed = k.last_used === null
    const inGrace = k.is_active && neverUsed && (now - createdMs < GRACE_MS)

    let status: KeyStatus
    if (inGrace) status = 'grace'
    else if (k.is_active) status = 'active'
    else if (neverUsed) status = 'expired_unused'
    else status = 'revoked'

    return {
      id: k.id,
      name: k.name,
      website: k.website,
      permissions: k.permissions,
      is_active: k.is_active,
      last_used: k.last_used,
      created_at: k.created_at,
      status,
      key_preview: `uwc_...${k.key.slice(-8)}`,
      // Only leak full key during the grace window
      full_key: inGrace ? k.key : null,
      grace_expires_at: inGrace ? new Date(createdMs + GRACE_MS).toISOString() : null,
    }
  })

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  const { name, website, permissions } = await request.json()
  if (!name || !website) return NextResponse.json({ error: 'Name and website are required' }, { status: 400 })

  if (auth.scope.isScoped && !(auth.scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'You can only create keys for your assigned websites' }, { status: 403 })
  }

  const validPerms = ['read', 'write', 'all']
  const perms = Array.isArray(permissions) ? permissions.filter((p: string) => validPerms.includes(p)) : ['read']

  const key = generateApiKey()
  const service = createServiceClient()

  const { data, error } = await service
    .from('api_keys')
    .insert({
      name,
      key,
      website,
      permissions: perms,
      is_active: true,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, full_key: key }, { status: 201 })
}

export async function DELETE(request: Request) {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Key id is required' }, { status: 400 })

  const service = createServiceClient()

  if (auth.scope.isScoped) {
    const { data: target } = await service.from('api_keys').select('website').eq('id', id).single()
    if (!target) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    if (!(auth.scope.domains ?? []).includes(target.website)) {
      return NextResponse.json({ error: 'You can only revoke keys for your assigned websites' }, { status: 403 })
    }
  }

  const { error } = await service.from('api_keys').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
