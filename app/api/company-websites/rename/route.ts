import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'

/**
 * POST /api/company-websites/rename — change the recorded domain for a site.
 *
 * Webcore keys most rows off `website` as a plain string (no FK with ON
 * UPDATE CASCADE), so renaming has to fan out the new value across every
 * table that stores it. Order matters: company_websites is uniqued on
 * domain, so we update children first to avoid orphaned references.
 *
 * Who can use:
 *   - admin, designer  → any company
 *   - everyone else    → blocked (this is destructive enough to gate)
 *
 * Body: { from: string, to: string }
 */
const ALLOWED_ROLES = new Set(['admin', 'designer'])

// All tables that key off the website domain. Update fans out across each.
const CASCADING_TABLES = [
  'page_events',
  'phone_numbers',
  'products',
  'blog_posts',
  'seo_overrides',
  'seo_site_profile',
  'alt_overrides',
  'audit_logs',
  'website_integrations',
  'website_settings',
  'api_keys',
] as const

function normalizeDomain(d: string): string {
  return String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { from?: string; to?: string } | null
  if (!body?.from || !body?.to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  const from = normalizeDomain(body.from)
  const to = normalizeDomain(body.to)

  if (from === to) return NextResponse.json({ error: 'New domain matches current domain' }, { status: 400 })
  if (!DOMAIN_RE.test(to)) return NextResponse.json({ error: 'New domain is not a valid hostname' }, { status: 400 })

  const service = createServiceClient()

  // Confirm `from` exists and `to` is free.
  const [{ data: source }, { data: clash }] = await Promise.all([
    service.from('company_websites').select('id, company_id').eq('domain', from).maybeSingle(),
    service.from('company_websites').select('id').eq('domain', to).maybeSingle(),
  ])

  if (!source) return NextResponse.json({ error: `Source domain ${from} not found` }, { status: 404 })
  if (clash) return NextResponse.json({ error: `${to} is already linked to a company` }, { status: 409 })

  // Fan out to every dependent table. Each update returns the count of rows
  // touched so the audit trail records what moved.
  const counts: Record<string, number> = {}
  for (const table of CASCADING_TABLES) {
    const { error, count } = await service
      .from(table)
      .update({ website: to }, { count: 'exact' })
      .eq('website', from)
    if (error) {
      // A failure here leaves a partial rename. Surface the table so an admin
      // can finish the cascade manually rather than silently moving on.
      return NextResponse.json(
        { error: `Failed updating ${table}: ${error.message}`, partial: counts },
        { status: 500 },
      )
    }
    counts[table] = count ?? 0
  }

  // Finally rename the canonical row in company_websites.
  const { error: renameErr } = await service
    .from('company_websites')
    .update({ domain: to })
    .eq('domain', from)
  if (renameErr) {
    return NextResponse.json(
      { error: `Children renamed but parent row failed: ${renameErr.message}`, partial: counts },
      { status: 500 },
    )
  }

  const actor = await resolveActor(user.id)
  await writeAuditLog({
    actor,
    entityType: 'website',
    entityId: source.id,
    action: 'update',
    website: to,
    label: `${from} → ${to}`,
    metadata: { from, to, cascade: counts },
  })

  return NextResponse.json({ ok: true, from, to, cascade: counts })
}
