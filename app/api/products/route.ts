import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'

// GET /api/products?website=&parent_id=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const parentId = searchParams.get('parent_id')

  const scope = await getUserScope(user.id)
  const service = createServiceClient()

  let query = service
    .from('products')
    .select('*, product_photos(id, url, alt_text, sort_order), sub_products:products!parent_id(id)')
    .order('sort_order')
    .order('created_at', { ascending: false })

  if (website) {
    if (scope.isScoped && !(scope.domains ?? []).includes(website)) return NextResponse.json([])
    query = query.eq('website', website)
  } else if (scope.isScoped) {
    const allowed = scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json([])
    query = query.in('website', allowed)
  }

  if (parentId === 'null' || parentId === '') {
    query = query.is('parent_id', null)
  } else if (parentId) {
    query = query.eq('parent_id', parentId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data ?? []).map((p: any) => ({
    ...p,
    photo_count: p.product_photos?.length ?? 0,
    sub_product_count: p.sub_products?.length ?? 0,
    photos: (p.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
    product_photos: undefined,
    sub_products: undefined,
  }))

  return NextResponse.json(result)
}

// POST /api/products
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { website, parent_id, name, slug, description, sale_price, rental_price, sort_order, photos } = body

  if (!website || !name || !slug) {
    return NextResponse.json({ error: 'website, name, and slug are required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Enforce single-level hierarchy
  if (parent_id) {
    const { data: parent } = await service.from('products').select('parent_id').eq('id', parent_id).single()
    if (parent?.parent_id) {
      return NextResponse.json({ error: 'Sub-products cannot have their own sub-products' }, { status: 400 })
    }
  }

  // Check duplicate slug
  const { data: existing } = await service
    .from('products')
    .select('id')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: `Slug "${slug}" already exists for this website` }, { status: 409 })
  }

  const { data: product, error } = await service
    .from('products')
    .insert({
      website,
      parent_id: parent_id || null,
      name,
      slug,
      description: description ?? null,
      sale_price: sale_price ?? null,
      rental_price: rental_price ?? null,
      sort_order: sort_order ?? 0,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert photos if provided
  if (Array.isArray(photos) && photos.length > 0) {
    const rows = photos.map((p: { url: string; alt_text?: string }, i: number) => ({
      product_id: product.id,
      url: p.url,
      alt_text: p.alt_text ?? null,
      sort_order: i,
    }))
    await service.from('product_photos').insert(rows)
  }

  // Audit
  const actor = await resolveActor(user.id)
  await writeAuditLog({
    actor,
    entityType: 'product',
    entityId: product.id,
    action: 'create',
    website,
    label: name,
    metadata: { slug, sale_price, rental_price, parent_id: parent_id || null },
  })

  return NextResponse.json(product, { status: 201 })
}
