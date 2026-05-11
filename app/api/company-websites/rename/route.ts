import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'
import {
  isVercelEnabled,
  findProjectIdByDomain,
  addDomainToProject,
  removeDomainFromProject,
  redeployLatestProduction,
  VercelError,
} from '@/lib/vercel'

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

  // ─── Vercel: attach new domain BEFORE the DB rename. If this fails,
  // bail without touching webcore so the operator can retry safely.
  // Skipped when VERCEL_API_TOKEN isn't configured or the domain isn't
  // owned by a project this token can see (custom domain on another team).
  const vercelReport: {
    enabled: boolean
    projectId: string | null
    addedNewDomain: boolean
    removedOldDomain: boolean
    redeployedDeploymentId: string | null
    warnings: string[]
  } = { enabled: isVercelEnabled(), projectId: null, addedNewDomain: false, removedOldDomain: false, redeployedDeploymentId: null, warnings: [] }

  if (vercelReport.enabled) {
    try {
      vercelReport.projectId = await findProjectIdByDomain(from)
    } catch (e) {
      vercelReport.warnings.push(`Project lookup: ${(e as Error).message}`)
    }
    if (!vercelReport.projectId) {
      vercelReport.warnings.push(`No Vercel project found for ${from}. Skipping Vercel attach + redeploy — webcore-side rename still ran.`)
    } else {
      try {
        await addDomainToProject(vercelReport.projectId, to)
        vercelReport.addedNewDomain = true
      } catch (e) {
        const status = e instanceof VercelError ? e.status : 500
        return NextResponse.json(
          { error: `Vercel: couldn't attach ${to} to project — ${(e as Error).message}`, vercelStage: 'add-domain', vercel: vercelReport },
          { status },
        )
      }
    }
  }

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

  // ─── Vercel: redeploy after the DB cascade so the fresh build picks up
  // any baked-in canonical-host config. Best-effort — if it fails the rename
  // is still complete, we just surface a warning.
  if (vercelReport.projectId) {
    try {
      const dep = await redeployLatestProduction(vercelReport.projectId)
      vercelReport.redeployedDeploymentId = dep.id
    } catch (e) {
      vercelReport.warnings.push(`Redeploy: ${(e as Error).message}`)
    }

    // ─── Vercel: detach the old hostname so it stops serving this project.
    // Done last because the redeploy above doesn't need it gone — but leaving
    // it attached after a rename means the old URL keeps loading the site,
    // which silently breaks GSC properties and confuses customers about
    // which hostname is canonical.
    try {
      const removed = await removeDomainFromProject(vercelReport.projectId, from)
      vercelReport.removedOldDomain = removed.removed
    } catch (e) {
      vercelReport.warnings.push(`Detach old domain: ${(e as Error).message}`)
    }
  }

  // ─── GSC integration: the row's `website` column was already moved by the
  // cascade above, but its property_id (e.g. `sc-domain:OLD`) is bound to
  // the OLD hostname on Google's side. Google won't let us mutate the
  // property URL; the user has to add + verify a new property for the new
  // hostname. We null property_id here so the Integrations UI surfaces
  // "needs reconnect" instead of pretending the link is still good.
  let gscNeedsReconnect = false
  {
    const { data: gscRows } = await service
      .from('website_integrations')
      .select('id, property_id')
      .eq('website', to)
      .eq('provider', 'gsc')
    if (gscRows && gscRows.length > 0 && gscRows.some(r => r.property_id)) {
      gscNeedsReconnect = true
      await service
        .from('website_integrations')
        .update({ property_id: null, updated_at: new Date().toISOString() })
        .eq('website', to)
        .eq('provider', 'gsc')
    }
  }

  const actor = await resolveActor(user.id)
  await writeAuditLog({
    actor,
    entityType: 'website',
    entityId: source.id,
    action: 'update',
    website: to,
    label: `${from} → ${to}`,
    metadata: { from, to, cascade: counts, vercel: vercelReport, gscNeedsReconnect },
  })

  return NextResponse.json({ ok: true, from, to, cascade: counts, vercel: vercelReport, gscNeedsReconnect })
}
