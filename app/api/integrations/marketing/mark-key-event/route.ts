import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { MarketingTokenRevokedError, refreshMarketingAccessToken } from '@/lib/integrations/marketing'
import { createGa4KeyEvent } from '@/lib/integrations/ga4'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

/**
 * POST /api/integrations/marketing/mark-key-event
 * Body: { domain: string; eventName: string }
 *
 * Marks a GA4 event as a Key Event (formerly "Conversion"). Useful for the
 * whatsapp_click event the SOP highlights — has to be run after the event
 * has fired at least once, because GA4 won't let you mark an unseen event.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as { domain?: string; eventName?: string } | null
  const domain = body?.domain?.trim().toLowerCase()
  const eventName = body?.eventName?.trim()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })
  if (!eventName) return NextResponse.json({ error: 'eventName required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'You can only edit integrations for your assigned websites' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: integration } = await service
    .from('website_integrations')
    .select('refresh_token, meta')
    .eq('website', domain)
    .eq('provider', 'marketing')
    .maybeSingle()

  const meta = (integration?.meta ?? {}) as { ga4?: { propertyPath?: string } }
  const propertyPath = meta.ga4?.propertyPath
  if (!integration?.refresh_token || !propertyPath) {
    return NextResponse.json({ error: 'GA4 not connected for this site' }, { status: 400 })
  }

  let accessToken: string
  try {
    const t = await refreshMarketingAccessToken(integration.refresh_token)
    accessToken = t.access_token
  } catch (e) {
    if (e instanceof MarketingTokenRevokedError) {
      return NextResponse.json({ error: 'Google access expired — reconnect Marketing' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  try {
    await createGa4KeyEvent({ accessToken, propertyPath, eventName })
  } catch (e) {
    const msg = (e as Error).message
    // GA4 returns "Cannot mark event ... as a key event because it has not
    // been observed" — surface a friendlier error so the user knows to wait.
    if (/has not been observed|not yet seen|NOT_FOUND/i.test(msg)) {
      return NextResponse.json({
        error: `${eventName} hasn't fired yet. GA4 needs at least one occurrence before it can be marked as a key event. Try again after the next visit that triggers the click.`,
      }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, eventName })
}
