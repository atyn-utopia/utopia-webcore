import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

/**
 * Disconnect the marketing (GA4 + GTM) integration for a website. Only
 * removes the webcore record + revokes our cached tokens — the GA4
 * property and GTM container stay in the user's Google account
 * untouched (deleting them would be destructive and is reserved for the
 * GA/GTM UIs).
 *
 * The tracker on the live site stops loading GTM on the next page load.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { domain } = await request.json().catch(() => ({}))
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('website_integrations')
    .delete()
    .eq('website', domain)
    .eq('provider', 'marketing')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
