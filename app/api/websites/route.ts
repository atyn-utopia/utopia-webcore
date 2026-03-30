import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()

  const [{ data: phoneData }, { data: blogData }] = await Promise.all([
    supabase.from('phone_numbers').select('website'),
    supabase.from('blog_posts').select('website'),
  ])

  const all = [
    ...(phoneData ?? []).map((r: { website: string }) => r.website),
    ...(blogData ?? []).map((r: { website: string }) => r.website),
  ]

  const unique = [...new Set(all)].sort()
  return NextResponse.json(unique)
}
