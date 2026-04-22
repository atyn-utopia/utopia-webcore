import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const service = createServiceClient()

  const [
    { data: phoneData },
    { data: blogData },
    { data: companyWebsites },
  ] = await Promise.all([
    service.from('phone_numbers').select('website, is_active, location_slug'),
    service.from('blog_posts').select('website, status'),
    service.from('company_websites').select('domain, company_id, leads_mode_override, companies(id, name)'),
  ])

  const phoneRows = phoneData ?? []
  const blogRows = blogData ?? []
  const cwRows = companyWebsites ?? []

  const allDomains = [
    ...phoneRows.map((r: { website: string }) => r.website),
    ...blogRows.map((r: { website: string }) => r.website),
    ...cwRows.map((r: { domain: string }) => r.domain),
  ]
  let unique = [...new Set(allDomains)].sort()

  // Scope by user's assigned domains when applicable
  if (scope.isScoped) {
    const allowed = new Set(scope.domains ?? [])
    unique = unique.filter(d => allowed.has(d))
  }

  // Compute leads_mode live from active phone numbers for each domain
  function computeLeadsMode(phones: { is_active: boolean; location_slug: string }[]): string | null {
    const active = phones.filter(p => p.is_active)
    if (active.length === 0) return null
    const allLoc = active.filter(p => p.location_slug === 'all')
    const specificLoc = active.filter(p => p.location_slug !== 'all')
    if (allLoc.length > 0 && specificLoc.length > 0) return 'hybrid'
    if (specificLoc.length > 0 && allLoc.length === 0) return 'location'
    if (allLoc.length === 1) return 'single'
    return 'rotation'
  }

  const result = unique.map(domain => {
    const phones = phoneRows.filter((r: { website: string }) => r.website === domain)
    const posts = blogRows.filter((r: { website: string }) => r.website === domain)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cw = cwRows.find((r: any) => r.domain === domain)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const override = (cw as any)?.leads_mode_override as string | null | undefined
    const computed = computeLeadsMode(phones as { is_active: boolean; location_slug: string }[])
    return {
      domain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company_id: cw?.company_id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company_name: (cw as any)?.companies?.name ?? null,
      leads_mode: override ?? computed,
      leads_mode_computed: computed,
      leads_mode_override: override ?? null,
      phone_count: phones.length,
      active_phone_count: phones.filter((r: { is_active: boolean }) => r.is_active).length,
      blog_count: posts.length,
      published_blog_count: posts.filter((r: { status: string }) => r.status === 'published').length,
    }
  })

  return NextResponse.json(result)
}

/**
 * PATCH /api/websites — update leads_mode_override for a website.
 * Body: { website: string, leads_mode_override: 'single' | 'rotation' | 'location' | 'hybrid' | null }
 *
 * Scoped users can only update websites in their assigned domain list.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const body = await request.json()
  const { website, leads_mode_override } = body

  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  const allowed = ['single', 'rotation', 'location', 'hybrid']
  if (leads_mode_override !== null && !allowed.includes(leads_mode_override)) {
    return NextResponse.json({ error: 'Invalid leads_mode_override' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('company_websites')
    .update({ leads_mode_override })
    .eq('domain', website)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, leads_mode_override })
}
