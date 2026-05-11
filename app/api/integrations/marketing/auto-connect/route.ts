import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import {
  MarketingTokenRevokedError,
  refreshMarketingAccessToken,
} from '@/lib/integrations/marketing'
import {
  createGa4Property,
  createGa4WebStream,
  listGa4AccountSummaries,
  updateGa4DataRetention,
  updateGa4EnhancedMeasurement,
} from '@/lib/integrations/ga4'
import {
  createGoogleTagInWorkspace,
  createGtmContainer,
  enableGtmClickBuiltins,
  getDefaultGtmWorkspace,
  listGtmAccounts,
  listGtmContainers,
  publishGtmWorkspace,
} from '@/lib/integrations/gtm'

/**
 * POST /api/integrations/marketing/auto-connect
 * Body: { domain: string }
 *
 * The full SOP, in one call. Assumes the user has already granted the
 * marketing OAuth scopes (refresh_token in website_integrations for
 * provider='marketing').
 *
 * Flow:
 *   1. Refresh access token.
 *   2. List GA4 accounts → pick first (most users have one account).
 *   3. Create Property + Web Data Stream for the domain.
 *   4. Enable Scroll + Outbound Click enhanced measurement (only).
 *   5. Set 14-month retention.
 *   6. List GTM accounts → pick first.
 *   7. Reuse existing container if one already maps to this domain, otherwise
 *      create a new container.
 *   8. Get default workspace, drop a Google Tag pointing at the GA4
 *      measurement_id, enable click built-in variables, publish.
 *   9. Persist measurement_id + container public_id back into
 *      website_integrations.meta.
 *
 * Response shapes:
 *   { status: 'connected', measurementId, containerId, propertyPath, ... }
 *   { status: 'needs_oauth', reason? }
 *   { status: 'no_account', kind: 'ga4' | 'gtm' }   -- user must create one in Google's UI first
 *   { status: 'error', error }
 */
const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as { domain?: string } | null
  const domain = body?.domain?.trim().toLowerCase()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'You can only connect integrations for your assigned websites' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: integration } = await service
    .from('website_integrations')
    .select('refresh_token, property_id, meta')
    .eq('website', domain)
    .eq('provider', 'marketing')
    .maybeSingle()

  if (!integration?.refresh_token) {
    return NextResponse.json({ status: 'needs_oauth' })
  }

  // Already wired? Treat as no-op success.
  const existingMeta = (integration.meta ?? {}) as { ga4?: { measurementId?: string }; gtm?: { publicId?: string } }
  if (existingMeta.ga4?.measurementId && existingMeta.gtm?.publicId) {
    return NextResponse.json({
      status: 'connected',
      measurementId: existingMeta.ga4.measurementId,
      containerId: existingMeta.gtm.publicId,
      alreadyLinked: true,
    })
  }

  // 1. Refresh access token.
  let accessToken: string
  try {
    const t = await refreshMarketingAccessToken(integration.refresh_token)
    accessToken = t.access_token
  } catch (e) {
    if (e instanceof MarketingTokenRevokedError) {
      return NextResponse.json({ status: 'needs_oauth', reason: 'revoked' })
    }
    return NextResponse.json({ status: 'error', error: (e as Error).message }, { status: 500 })
  }

  // 2. GA4 account.
  let accountPath: string
  try {
    const summaries = await listGa4AccountSummaries(accessToken)
    if (summaries.length === 0) {
      return NextResponse.json({ status: 'no_account', kind: 'ga4' })
    }
    // Prefer an existing summary that already contains a property named for
    // this domain — picks the account the user has been organising sites
    // under. Otherwise fall back to the first account.
    const match = summaries.find(s => (s.propertySummaries ?? []).some(p => p.displayName === domain))
    accountPath = (match ?? summaries[0]).account
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `GA4 list accounts: ${(e as Error).message}` }, { status: 500 })
  }

  // 3+4+5. Property + stream + enhanced measurement + retention.
  let propertyPath: string
  let streamPath: string
  let measurementId: string
  try {
    const property = await createGa4Property({
      accessToken,
      accountPath,
      displayName: domain,
    })
    propertyPath = property.name

    const stream = await createGa4WebStream({
      accessToken,
      propertyPath,
      displayName: domain,
      defaultUri: `https://${domain}`,
    })
    streamPath = stream.name
    measurementId = stream.webStreamData.measurementId

    // These two are best-effort — if Google rejects the field shape on a
    // newer property type, we still want the connection to succeed with the
    // measurement_id already created. Surface the error in meta for debugging.
    try {
      await updateGa4EnhancedMeasurement({ accessToken, streamPath })
    } catch (e) {
      console.error('GA4 enhanced measurement update failed (non-fatal)', e)
    }
    try {
      await updateGa4DataRetention({ accessToken, propertyPath })
    } catch (e) {
      console.error('GA4 retention update failed (non-fatal)', e)
    }
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `GA4 setup: ${(e as Error).message}` }, { status: 500 })
  }

  // 6. GTM account.
  let gtmAccountPath: string
  try {
    const accounts = await listGtmAccounts(accessToken)
    if (accounts.length === 0) {
      return NextResponse.json({
        status: 'no_account',
        kind: 'gtm',
        // GA was already created — make sure the measurement_id isn't lost.
        ga4: { measurementId, propertyPath, streamPath, accountPath },
      })
    }
    gtmAccountPath = accounts[0].path
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `GTM list accounts: ${(e as Error).message}` }, { status: 500 })
  }

  // 7. Container (reuse-or-create).
  let containerPath: string
  let containerPublicId: string
  try {
    const existing = await listGtmContainers(accessToken, gtmAccountPath)
    const match = existing.find(c =>
      (c.domainName ?? []).includes(domain) || c.name === domain
    )
    if (match) {
      containerPath = match.path
      containerPublicId = match.publicId
    } else {
      const created = await createGtmContainer({ accessToken, accountPath: gtmAccountPath, domain })
      containerPath = created.path
      containerPublicId = created.publicId
    }
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `GTM container: ${(e as Error).message}` }, { status: 500 })
  }

  // 8. Workspace + tag + click variables + publish.
  let workspaceId: string
  try {
    const workspace = await getDefaultGtmWorkspace({ accessToken, containerPath })
    workspaceId = workspace.workspaceId

    await createGoogleTagInWorkspace({
      accessToken,
      workspacePath: workspace.path,
      measurementId,
    })
    await enableGtmClickBuiltins({ accessToken, workspacePath: workspace.path })
    await publishGtmWorkspace({
      accessToken,
      workspacePath: workspace.path,
      containerPath,
    })
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `GTM workspace setup: ${(e as Error).message}` }, { status: 500 })
  }

  // 9. Persist back to website_integrations.
  await service
    .from('website_integrations')
    .update({
      property_id: measurementId,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
      meta: {
        ga4: { measurementId, propertyPath, streamPath, accountPath },
        gtm: { publicId: containerPublicId, containerPath, workspaceId, accountPath: gtmAccountPath },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('website', domain)
    .eq('provider', 'marketing')

  return NextResponse.json({
    status: 'connected',
    measurementId,
    containerId: containerPublicId,
  })
}
