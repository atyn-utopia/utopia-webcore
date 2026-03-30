import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()

  const [
    { data: phoneData },
    { data: blogData },
  ] = await Promise.all([
    supabase.from('phone_numbers').select('website, is_active'),
    supabase.from('blog_posts').select('website, status'),
  ])

  const phoneRows = phoneData ?? []
  const blogRows = blogData ?? []

  const allDomains = [
    ...phoneRows.map((r: { website: string }) => r.website),
    ...blogRows.map((r: { website: string }) => r.website),
  ]
  const unique = [...new Set(allDomains)].sort()

  const result = unique.map(domain => {
    const phones = phoneRows.filter((r: { website: string }) => r.website === domain)
    const posts = blogRows.filter((r: { website: string }) => r.website === domain)
    return {
      domain,
      phone_count: phones.length,
      active_phone_count: phones.filter((r: { is_active: boolean }) => r.is_active).length,
      blog_count: posts.length,
      published_blog_count: posts.filter((r: { status: string }) => r.status === 'published').length,
    }
  })

  return NextResponse.json(result)
}
