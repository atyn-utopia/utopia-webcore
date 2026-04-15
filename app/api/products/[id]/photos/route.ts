import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// POST /api/products/[id]/photos — add a photo
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { url, alt_text } = await request.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  const service = createServiceClient()

  // Get current max sort_order
  const { data: existing } = await service
    .from('product_photos')
    .select('sort_order')
    .eq('product_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await service
    .from('product_photos')
    .insert({ product_id: id, url, alt_text: alt_text ?? null, sort_order: nextOrder })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/products/[id]/photos — delete a photo by ?photo_id=
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params // consume params
  const { searchParams } = new URL(request.url)
  const photoId = searchParams.get('photo_id')
  if (!photoId) return NextResponse.json({ error: 'photo_id is required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('product_photos').delete().eq('id', photoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
