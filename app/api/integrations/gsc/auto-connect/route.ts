import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import {
  addDomainPropertyToSearchConsole,
  getDomainVerificationToken,
  refreshAccessToken,
  verifyDomain,
} from '@/lib/integrations/gsc'
import { addDnsTxtRecord, findManagingApex, isVercelEnabled } from '@/lib/vercel'

/**
 * POST /api/integrations/gsc/auto-connect
 * Body: { domain: string }
 *
 * The one-click connect path. Assumes the user has already granted OAuth
 * once for this domain (their refresh_token is stored in
 * website_integrations). On success the domain is verified with Google,
 * added as a Domain property in Search Console, and the property_id is
 * persisted back into website_integrations.
 *
 * Flow:
 *   1. Refresh the access token from the stored refresh_token.
 *   2. Ask Google for a DNS_TXT verification token for the domain.
 *   3. Resolve the apex Vercel manages DNS for. When it matches the
 *      target domain, drop the TXT record via Vercel and let Google
 *      verify automatically.
 *   4. When the apex doesn't match (external DNS), return the TXT value
 *      so the UI can show 'paste this then click verify' — the designer
 *      adds it manually and we retry verify on the next click.
 *   5. After verifySite succeeds, call sites.add to attach the domain
 *      property to the user's Search Console and persist property_id.
 *
 * Response shapes:
 *   { status: 'connected', propertyId }
 *   { status: 'awaiting_dns', txt: { name, value }, reason }
 *   { status: 'needs_oauth' }            -- no stored refresh token
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
    .select('refresh_token, property_id')
    .eq('website', domain)
    .eq('provider', 'gsc')
    .maybeSingle()

  if (!integration?.refresh_token) {
    return NextResponse.json({ status: 'needs_oauth' })
  }

  // Already verified + linked? Treat as no-op success.
  if (integration.property_id) {
    return NextResponse.json({ status: 'connected', propertyId: integration.property_id, alreadyLinked: true })
  }

  // 1. Refresh access token.
  let accessToken: string
  try {
    const t = await refreshAccessToken(integration.refresh_token)
    accessToken = t.access_token
  } catch (e) {
    return NextResponse.json({ status: 'needs_oauth', error: (e as Error).message })
  }

  // 2. Get verification token.
  let txtValue: string
  try {
    const t = await getDomainVerificationToken({ accessToken, domain })
    txtValue = t.token
  } catch (e) {
    return NextResponse.json({ status: 'error', error: (e as Error).message }, { status: 500 })
  }

  // 3. Auto-add DNS TXT if Vercel manages the apex.
  let dnsAuto: 'added' | 'skipped' = 'skipped'
  let apex: string | null = null
  if (isVercelEnabled()) {
    apex = await findManagingApex(domain).catch(() => null)
    if (apex) {
      // Name component is the subdomain relative to the apex. '@' for apex itself.
      const name = domain === apex ? '@' : domain.slice(0, domain.length - apex.length - 1)
      const add = await addDnsTxtRecord({ apex, name, value: txtValue })
      if (add.ok) dnsAuto = 'added'
      else if (/already exists|duplicate/i.test(add.error)) dnsAuto = 'added'
      // Anything else we treat as 'skipped' — fall back to manual paste UI.
    }
  }

  if (dnsAuto === 'skipped') {
    // External DNS — let the UI show the TXT value for manual paste, then
    // the designer clicks retry which hits this endpoint again. At that
    // point Google will see the record and the next attempt will verify.
    return NextResponse.json({
      status: 'awaiting_dns',
      txt: { name: domain, value: txtValue },
      reason: apex ? 'dns-add-failed' : 'no-vercel-apex',
    })
  }

  // 4. Verify. DNS propagation can take a moment after add — retry a few times.
  let verified = false
  let lastErr = ''
  for (let attempt = 0; attempt < 4 && !verified; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 4000))
    try {
      await verifyDomain({ accessToken, domain })
      verified = true
    } catch (e) {
      lastErr = (e as Error).message
    }
  }
  if (!verified) {
    return NextResponse.json({
      status: 'awaiting_dns',
      txt: { name: domain, value: txtValue },
      reason: 'verify-pending',
      error: lastErr,
    })
  }

  // 5. Add domain property to Search Console.
  try {
    await addDomainPropertyToSearchConsole({ accessToken, domain })
  } catch (e) {
    return NextResponse.json({ status: 'error', error: (e as Error).message }, { status: 500 })
  }

  const propertyId = `sc-domain:${domain}`
  await service
    .from('website_integrations')
    .update({
      property_id: propertyId,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('website', domain)
    .eq('provider', 'gsc')

  return NextResponse.json({ status: 'connected', propertyId, dnsAuto, apex })
}
