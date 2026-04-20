import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/validateApiKey'
import { getUserScope } from '@/lib/getUserScope'

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
