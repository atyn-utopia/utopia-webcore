import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// GET /api/blog?website=&status=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const status = searchParams.get('status')

  const service = createServiceClient()
  let query = service
    .from('blog_posts')
    .select('id, website, title, slug, status, published_at, created_at, updated_at, excerpt, author_id')
    .order('created_at', { ascending: false })

  if (website) query = query.eq('website', website)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/blog
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    website, title, slug, content, excerpt,
    cover_image_url, meta_title, meta_description, status,
  } = body

  if (!website || !title || !slug) {
    return NextResponse.json({ error: 'website, title, and slug are required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Check for duplicate slug within same website
  const { data: existing } = await service
    .from('blog_posts')
    .select('id')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `Slug "${slug}" already exists for website "${website}"` }, { status: 409 })
  }

  const { data, error } = await service
    .from('blog_posts')
    .insert({
      website,
      title,
      slug,
      content: content ?? null,
      excerpt: excerpt ?? null,
      cover_image_url: cover_image_url ?? null,
      meta_title: meta_title ?? null,
      meta_description: meta_description ?? null,
      status: status ?? 'draft',
      published_at: status === 'published' ? new Date().toISOString() : null,
      author_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
