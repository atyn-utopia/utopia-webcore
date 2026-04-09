import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()

  const [
    { data: phoneData },
    { data: blogData },
    { data: companyWebsites },
  ] = await Promise.all([
    supabase.from('phone_numbers').select('website, is_active'),
    supabase.from('blog_posts').select('website, status'),
    supabase.from('company_websites').select('domain, company_id, leads_mode, companies(id, name)'),
  ])

  const phoneRows = phoneData ?? []
  const blogRows = blogData ?? []
  const cwRows = companyWebsites ?? []

  const allDomains = [
    ...phoneRows.map((r: { website: string }) => r.website),
    ...blogRows.map((r: { website: string }) => r.website),
    ...cwRows.map((r: { domain: string }) => r.domain),
  ]
  const unique = [...new Set(allDomains)].sort()

  const result = unique.map(domain => {
    const phones = phoneRows.filter((r: { website: string }) => r.website === domain)
    const posts = blogRows.filter((r: { website: string }) => r.website === domain)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cw = cwRows.find((r: any) => r.domain === domain)
    return {
      domain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company_id: cw?.company_id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company_name: (cw as any)?.companies?.name ?? null,
      leads_mode: (cw as any)?.leads_mode ?? null,
      phone_count: phones.length,
      active_phone_count: phones.filter((r: { is_active: boolean }) => r.is_active).length,
      blog_count: posts.length,
      published_blog_count: posts.filter((r: { status: string }) => r.status === 'published').length,
    }
  })

  return NextResponse.json(result)
}
