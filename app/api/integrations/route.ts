import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

/**
 * GET /api/integrations?domain=example.com
 *   → list enabled integrations for a single website
 *
 * GET /api/integrations
 *   → list integrations across all websites the caller can see
 *
 * Secrets (refresh_token, access_token) are never returned.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const domain = url.searchParams.get('domain')

  const service = createServiceClient()
  let query = service
    .from('website_integrations')
    .select('id, website, provider, property_id, connected_at, updated_at')
    .order('connected_at', { ascending: false })

  if (domain) {
    if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
      return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
    }
    query = query.eq('website', domain)
  } else if (scope.isScoped) {
    const allowed = scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json([])
    query = query.in('website', allowed)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
