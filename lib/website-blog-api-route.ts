/**
 * Website Blog API Route Template
 *
 * Copy this to each website project at:
 *   app/api/blog/route.ts
 *
 * Returns published blog posts for this website.
 * GET /api/blog?status=published
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SITE = process.env.NEXT_PUBLIC_SITE_SLUG!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'published'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, cover_image_url, published_at, meta_title, meta_description')
    .eq('website', SITE)
    .eq('status', status)
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
