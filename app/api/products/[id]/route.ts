import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { resolveActor, writeAuditLog, diffObjects, PRODUCT_FIELDS } from '@/lib/auditLog'

// GET /api/products/[id] — single product with photos + sub-products
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service
    .from('products')
    .select('*, product_photos(id, url, alt_text, sort_order)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Fetch sub-products
  const { data: subs } = await service
    .from('products')
    .select('*, product_photos(id, url, alt_text, sort_order)')
    .eq('parent_id', id)
    .order('sort_order')

  return NextResponse.json({
    ...data,
    photos: (data.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
    product_photos: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sub_products: (subs ?? []).map((s: any) => ({
      ...s,
      photos: (s.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
      product_photos: undefined,
    })),
  })
}

// PATCH /api/products/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { photos: _photos, ...fields } = body

  const service = createServiceClient()
  const { data: before } = await service.from('products').select('*').eq('id', id).single()

  if (fields.slug && before && fields.slug !== before.slug) {
    const { data: dup } = await service
      .from('products').select('id').eq('website', before.website).eq('slug', fields.slug).maybeSingle()
    if (dup) return NextResponse.json({ error: `Slug "${fields.slug}" already exists` }, { status: 409 })
  }

  if (Object.keys(fields).length > 0) {
    fields.updated_at = new Date().toISOString()
    const { error } = await service.from('products').update(fields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = await service.from('products').select('*').eq('id', id).single()

  // Audit
  const changes = diffObjects(before, data, PRODUCT_FIELDS)
  if (Object.keys(changes).length > 0) {
    const actor = await resolveActor(user.id)
    await writeAuditLog({
      actor,
      entityType: 'product',
      entityId: id,
      action: 'update',
      website: data?.website,
      label: data?.name,
      changes,
    })
  }

  return NextResponse.json(data)
}

// DELETE /api/products/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()
  const { data: before } = await service.from('products').select('*').eq('id', id).single()

  const { error } = await service.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (before) {
    const actor = await resolveActor(user.id)
    await writeAuditLog({
      actor,
      entityType: 'product',
      entityId: id,
      action: 'delete',
      website: before.website,
      label: before.name,
      metadata: { slug: before.slug, sale_price: before.sale_price, rental_price: before.rental_price },
    })
  }

  return NextResponse.json({ success: true })
}
