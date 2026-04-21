import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { listGscSites, refreshAccessToken } from '@/lib/integrations/gsc'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

async function getIntegrationWithFreshToken(domain: string) {
  const service = createServiceClient()
  const { data: integration } = await service
    .from('website_integrations')
    .select('refresh_token, access_token, token_expires_at, property_id')
    .eq('website', domain)
    .eq('provider', 'gsc')
    .maybeSingle()

  if (!integration) return { error: 'not_connected' as const }

  let accessToken = integration.access_token as string | null
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0
  if (!accessToken || Date.now() > expiresAt - 60_000) {
    if (!integration.refresh_token) return { error: 'no_refresh_token' as const }
    const fresh = await refreshAccessToken(integration.refresh_token)
    accessToken = fresh.access_token
    await service
      .from('website_integrations')
      .update({
        access_token: fresh.access_token,
        token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('website', domain)
      .eq('provider', 'gsc')
  }

  return { accessToken: accessToken!, propertyId: integration.property_id as string | null }
}

async function guard(domain: string | null) {
  if (!domain) return { error: NextResponse.json({ error: 'website is required' }, { status: 400 }) }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return { error: NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 }) }
  }

  return { user }
}

/**
 * GET /api/integrations/gsc/properties?domain=example.com
 * Returns all GSC properties the connected Google account has access to,
 * along with a `matched` hint per property to help users pick the right one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const domain = url.searchParams.get('domain') ?? url.searchParams.get('website')
  const gate = await guard(domain)
  if ('error' in gate) return gate.error

  try {
    const info = await getIntegrationWithFreshToken(domain!)
    if ('error' in info) return NextResponse.json({ error: info.error }, { status: 400 })

    const sites = await listGscSites(info.accessToken)
    const enriched = sites.map(s => {
      const host = s.siteUrl.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      const target = domain!.toLowerCase()
      const matched = host === target || host === `www.${target}` || `www.${host}` === target
      return { ...s, matched, selected: s.siteUrl === info.propertyId }
    }).sort((a, b) => Number(b.matched) - Number(a.matched))

    return NextResponse.json({ properties: enriched, selected: info.propertyId })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

/**
 * PATCH /api/integrations/gsc/properties
 * Body: { domain: string, property_id: string }
 * Saves the user's manual GSC property selection.
 */
export async function PATCH(request: Request) {
  const body = await request.json()
  const { domain, property_id } = body ?? {}
  const gate = await guard(domain)
  if ('error' in gate) return gate.error

  if (!property_id || typeof property_id !== 'string') {
    return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
  }

  // Sanity check — make sure the property is actually one of the user's accessible ones
  const info = await getIntegrationWithFreshToken(domain)
  if ('error' in info) return NextResponse.json({ error: info.error }, { status: 400 })

  try {
    const sites = await listGscSites(info.accessToken)
    if (!sites.some(s => s.siteUrl === property_id)) {
      return NextResponse.json({ error: 'That property is not accessible by the connected account' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('website_integrations')
    .update({ property_id, updated_at: new Date().toISOString() })
    .eq('website', domain)
    .eq('provider', 'gsc')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, property_id })
}
