import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { querySearchAnalytics, refreshAccessToken } from '@/lib/integrations/gsc'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])
const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const domain = url.searchParams.get('website') ?? url.searchParams.get('domain')
  const period = url.searchParams.get('period') ?? '7d'

  if (!domain) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: integration } = await service
    .from('website_integrations')
    .select('refresh_token, access_token, token_expires_at, property_id')
    .eq('website', domain)
    .eq('provider', 'gsc')
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ connected: false, rows: [], summary: null })
  }
  if (!integration.property_id) {
    return NextResponse.json({ connected: true, rows: [], summary: null, error: 'property_not_selected' })
  }

  let accessToken = integration.access_token as string | null
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0
  if (!accessToken || Date.now() > expiresAt - 60_000) {
    if (!integration.refresh_token) {
      return NextResponse.json({ connected: true, rows: [], summary: null, error: 'no_refresh_token' })
    }
    try {
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
    } catch (e) {
      return NextResponse.json({ connected: true, rows: [], summary: null, error: (e as Error).message }, { status: 502 })
    }
  }

  const days = PERIOD_DAYS[period] ?? 7
  const end = new Date()
  const start = new Date(Date.now() - days * 86400_000)

  try {
    const rows = await querySearchAnalytics({
      accessToken: accessToken!,
      propertyId: integration.property_id,
      startDate: ymd(start),
      endDate: ymd(end),
      dimensions: ['query'],
    })
    const summary = rows.reduce(
      (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
      { clicks: 0, impressions: 0 },
    )
    return NextResponse.json({ connected: true, rows, summary })
  } catch (e) {
    return NextResponse.json({ connected: true, rows: [], summary: null, error: (e as Error).message }, { status: 502 })
  }
}
