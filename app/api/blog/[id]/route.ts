import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// GET /api/blog/[id]
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service.from('blog_posts').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/blog/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const service = createServiceClient()

  // If changing slug, check for duplicates
  if (body.slug) {
    const { data: current } = await service.from('blog_posts').select('website, slug').eq('id', id).single()
    if (current && body.slug !== current.slug) {
      const { data: existing } = await service
        .from('blog_posts')
        .select('id')
        .eq('website', current.website)
        .eq('slug', body.slug)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ error: `Slug "${body.slug}" already exists for this website` }, { status: 409 })
      }
    }
  }

  // Handle publish/unpublish timestamps
  if (body.status === 'published' && !body.published_at) {
    body.published_at = new Date().toISOString()
  } else if (body.status === 'draft') {
    body.published_at = null
  }

  body.updated_at = new Date().toISOString()

  const { data, error } = await service
    .from('blog_posts')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/blog/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('blog_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
