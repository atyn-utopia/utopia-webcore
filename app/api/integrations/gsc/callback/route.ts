import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { exchangeCodeForTokens, listGscSites } from '@/lib/integrations/gsc'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

function redirectBack(origin: string, domain: string, params: Record<string, string>) {
  const target = new URL(`${origin}/websites`)
  target.searchParams.set('website', domain)
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v)
  return NextResponse.redirect(target)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const googleError = url.searchParams.get('error')

  if (!stateRaw) {
    return NextResponse.json({ error: 'Missing state' }, { status: 400 })
  }

  let state: { domain: string; userId: string; ts: number }
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  if (googleError) {
    return redirectBack(url.origin, state.domain, { integration_error: googleError })
  }
  if (!code) {
    return redirectBack(url.origin, state.domain, { integration_error: 'missing_code' })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (scope.isScoped && !(scope.domains ?? []).includes(state.domain)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  try {
    const tokens = await exchangeCodeForTokens({ code, origin: url.origin })

    let propertyId: string | null = null
    try {
      const sites = await listGscSites(tokens.access_token)
      const match = sites.find(s => {
        const host = s.siteUrl.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '')
        return host === state.domain
      })
      propertyId = match?.siteUrl ?? null
    } catch {
      // Non-fatal — user can pick property manually later
    }

    const service = createServiceClient()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error } = await service
      .from('website_integrations')
      .upsert({
        website: state.domain,
        provider: 'gsc',
        refresh_token: tokens.refresh_token ?? null,
        access_token: tokens.access_token,
        token_expires_at: expiresAt,
        property_id: propertyId,
        connected_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'website,provider' })

    if (error) {
      return redirectBack(url.origin, state.domain, { integration_error: error.message })
    }

    return redirectBack(url.origin, state.domain, { integration_connected: 'gsc' })
  } catch (e) {
    return redirectBack(url.origin, state.domain, { integration_error: (e as Error).message })
  }
}
