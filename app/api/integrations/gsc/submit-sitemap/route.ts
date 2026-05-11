import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { GscTokenRevokedError, refreshAccessToken, submitSitemap } from '@/lib/integrations/gsc'

/**
 * POST /api/integrations/gsc/submit-sitemap
 * Body: { domain: string, sitemapUrl?: string }
 *
 * Submits a sitemap to Google Search Console for the connected property.
 * Defaults to https://{domain}/sitemap.xml when sitemapUrl is omitted.
 * Requires the site to already be fully connected (property_id set in
 * website_integrations) — caller's responsibility to gate the button.
 */
const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as { domain?: string; sitemapUrl?: string } | null
  const domain = body?.domain?.trim().toLowerCase()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'You can only submit sitemaps for your assigned websites' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: integration } = await service
    .from('website_integrations')
    .select('refresh_token, property_id')
    .eq('website', domain)
    .eq('provider', 'gsc')
    .maybeSingle()

  if (!integration?.refresh_token || !integration.property_id) {
    return NextResponse.json({ error: 'GSC not connected for this site' }, { status: 400 })
  }

  let accessToken: string
  try {
    const t = await refreshAccessToken(integration.refresh_token)
    accessToken = t.access_token
  } catch (e) {
    if (e instanceof GscTokenRevokedError) {
      return NextResponse.json({ error: 'Google access expired — reconnect in Integrations' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const sitemapUrl = body?.sitemapUrl?.trim() || `https://${domain}/sitemap.xml`

  try {
    await submitSitemap({ accessToken, propertyId: integration.property_id, sitemapUrl })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sitemapUrl, propertyId: integration.property_id })
}
