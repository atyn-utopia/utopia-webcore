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
  findGa4PropertyByDisplayName,
  Ga4QuotaError,
  listGa4AccountSummaries,
  listGa4DataStreams,
  updateGa4DataRetention,
  updateGa4EnhancedMeasurement,
} from '@/lib/integrations/ga4'
import {
  createConstantVariable,
  createConversionLinkerTag,
  createGa4EventTag,
  createGoogleTagInWorkspace,
  createGtmContainer,
  createLinkClickTrigger,
  enableGtmClickBuiltins,
  getDefaultGtmWorkspace,
  listGtmAccounts,
  listGtmContainers,
  listGtmTags,
  listGtmTriggers,
  listGtmVariables,
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

  // Keep a reference to existing meta so the orchestrator can skip work
  // already done. Not short-circuiting on "fully connected" — we want the
  // Connect button to be safe to re-run when we ship new default tags
  // (e.g. adding Conversion Linker + whatsapp_click event to setups that
  // were connected before those tags existed in our flow).
  const existingMeta = (integration.meta ?? {}) as { ga4?: { measurementId?: string }; gtm?: { publicId?: string } }

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

  // 2+3+4+5. GA4 account + property + stream + enhanced measurement + retention.
  //
  // Idempotency: a previous run may have created a Property but failed
  // partway (most often on the dataStreams write quota). On retry, reuse
  // whatever already exists named for this domain so we don't churn through
  // Google's per-project write tokens.
  let accountPath: string
  let propertyPath: string
  let streamPath: string
  let measurementId: string
  try {
    const summaries = await listGa4AccountSummaries(accessToken)
    if (summaries.length === 0) {
      return NextResponse.json({ status: 'no_account', kind: 'ga4' })
    }

    const existing = await findGa4PropertyByDisplayName({ accessToken, displayName: domain })
    if (existing) {
      accountPath = existing.accountPath
      propertyPath = existing.propertyPath

      // Reuse an existing web stream when one's there. Falls through to
      // create-a-stream when the property exists but has no web stream
      // (the common "first run hit quota mid-flow" scenario).
      const streams = await listGa4DataStreams({ accessToken, propertyPath })
      const web = streams.find(s => s.type === 'WEB_DATA_STREAM' && s.webStreamData?.measurementId)
      if (web && web.webStreamData) {
        streamPath = web.name
        measurementId = web.webStreamData.measurementId
      } else {
        const stream = await createGa4WebStream({
          accessToken,
          propertyPath,
          displayName: domain,
          defaultUri: `https://${domain}`,
        })
        streamPath = stream.name
        measurementId = stream.webStreamData.measurementId
      }
    } else {
      const match = summaries.find(s => (s.propertySummaries ?? []).some(p => p.displayName === domain))
      accountPath = (match ?? summaries[0]).account

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
    }

    // These two are best-effort — if they hit quota or Google rejects the
    // field shape on a newer property type, we still want the connection to
    // succeed with the measurement_id already in hand.
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
    if (e instanceof Ga4QuotaError) {
      return NextResponse.json({
        status: 'quota',
        kind: 'ga4',
        error: 'Google Analytics Admin write quota for this Google Cloud project is exhausted. Wait an hour and click Verify & link again — the existing property will be reused, no duplicates created.',
      }, { status: 429 })
    }
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

  // 8. Workspace + tags + trigger + click variables + publish.
  //
  // Idempotent: each tag/trigger is created only when nothing with the same
  // name already exists in the workspace. Same Connect button is safe to
  // re-run, which lets us roll out new defaults to already-connected sites
  // without anything destructive.
  let workspaceId: string
  let changed = false
  try {
    const workspace = await getDefaultGtmWorkspace({ accessToken, containerPath })
    workspaceId = workspace.workspaceId

    const [existingTags, existingTriggers, existingVariables] = await Promise.all([
      listGtmTags({ accessToken, workspacePath: workspace.path }),
      listGtmTriggers({ accessToken, workspacePath: workspace.path }),
      listGtmVariables({ accessToken, workspacePath: workspace.path }),
    ])

    // (0) Constant_Measurement ID — single source of truth for the GA4
    // measurement ID. Every tag below references {{Constant_Measurement ID}}
    // instead of hardcoding the G-XXX, so swapping the property later is
    // a one-variable edit.
    const MEASUREMENT_VAR = 'Constant_Measurement ID'
    const MEASUREMENT_REF = `{{${MEASUREMENT_VAR}}}`
    if (!existingVariables.some(v => v.name === MEASUREMENT_VAR)) {
      await createConstantVariable({
        accessToken,
        workspacePath: workspace.path,
        name: MEASUREMENT_VAR,
        value: measurementId,
      })
      changed = true
    }

    // (a) Google Tag — the base GA4 config that loads gtag.js on every page.
    if (!existingTags.some(t => t.name === 'Google Tag' || t.type === 'googtag')) {
      await createGoogleTagInWorkspace({ accessToken, workspacePath: workspace.path, measurementId: MEASUREMENT_REF })
      changed = true
    }

    // (b) Conversion Linker — Google Ads attribution preservation. Standard
    // "every site that runs Ads" boilerplate; cheap to include for sites
    // that don't run Ads yet too.
    if (!existingTags.some(t => t.name === 'Conversion Linker' || t.type === 'cl')) {
      await createConversionLinkerTag({ accessToken, workspacePath: workspace.path })
      changed = true
    }

    // (c) whatsapp_click — Link Click (Just Links) trigger + GA4 Event tag
    // pair. Matches the team SOP: customer sites route every WhatsApp button
    // through a `/redirect-whatsapp-1` URL, so the trigger filters by
    // `Click URL contains /redirect-whatsapp-1`. Catches clicks regardless
    // of which element the designer used (anchor, button-as-link, etc.)
    // without needing dataLayer pushes.
    const WC_EVENT = 'whatsapp_click'
    const WC_URL_CONTAINS = '/redirect-whatsapp-1'
    let whatsappTriggerId = existingTriggers.find(t => t.name === WC_EVENT)?.triggerId ?? null
    if (!whatsappTriggerId) {
      const created = await createLinkClickTrigger({
        accessToken,
        workspacePath: workspace.path,
        name: WC_EVENT,
        urlContains: WC_URL_CONTAINS,
      })
      whatsappTriggerId = created.triggerId
      changed = true
    }
    if (whatsappTriggerId && !existingTags.some(t => t.name === WC_EVENT)) {
      await createGa4EventTag({
        accessToken,
        workspacePath: workspace.path,
        eventName: WC_EVENT,
        measurementId: MEASUREMENT_REF,
        triggerId: whatsappTriggerId,
      })
      changed = true
    }

    await enableGtmClickBuiltins({ accessToken, workspacePath: workspace.path })

    // Only spend a version on Google when we actually added something. Avoids
    // version churn when the Connect button gets clicked on an already-
    // configured site.
    if (changed) {
      await publishGtmWorkspace({
        accessToken,
        workspacePath: workspace.path,
        containerPath,
      })
    }
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
