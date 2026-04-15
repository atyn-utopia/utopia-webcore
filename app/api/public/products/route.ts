import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required.
 * Your front-end websites call this to fetch their products.
 *
 * Usage:
 *   GET /api/public/products?website=example.com
 *   GET /api/public/products?website=example.com&slug=wheelchair-shah-alam
 *   GET /api/public/products?website=example.com&type=main       (only main products)
 *   GET /api/public/products?website=example.com&type=all        (flat list, no nesting)
 *
 * Response (default): nested structure with main products containing sub_products array
 * [
 *   {
 *     id, name, slug, description, sale_price, rental_price, sort_order,
 *     photos: [{ url, alt_text }],
 *     sub_products: [
 *       { id, name, slug, description, sale_price, rental_price, photos: [...] }
 *     ]
 *   }
 * ]
 *
 * Single product by slug:
 *   { id, name, slug, ..., photos: [...], sub_products: [...] }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const slug = searchParams.get('slug')
  const type = searchParams.get('type') // 'main' | 'all' | null (default = nested)

  if (!website) {
    return NextResponse.json({ error: 'website parameter is required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Single product by slug
  if (slug) {
    const { data: product } = await service
      .from('products')
      .select('id, name, slug, description, sale_price, rental_price, sort_order, parent_id, product_photos(url, alt_text, sort_order)')
      .eq('website', website)
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Fetch sub-products if this is a main product
    let subProducts: typeof product[] = []
    if (!product.parent_id) {
      const { data: subs } = await service
        .from('products')
        .select('id, name, slug, description, sale_price, rental_price, sort_order, product_photos(url, alt_text, sort_order)')
        .eq('parent_id', product.id)
        .eq('is_active', true)
        .order('sort_order')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subProducts = (subs ?? []).map((s: any) => ({
        ...s,
        photos: (s.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
        product_photos: undefined,
      }))
    }

    return NextResponse.json({
      ...product,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      photos: ((product as any).product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
      product_photos: undefined,
      parent_id: undefined,
      sub_products: subProducts,
    })
  }

  // Flat list (type=all) — returns every active product regardless of hierarchy
  if (type === 'all') {
    const { data, error } = await service
      .from('products')
      .select('id, name, slug, description, sale_price, rental_price, sort_order, parent_id, product_photos(url, alt_text, sort_order)')
      .eq('website', website)
      .eq('is_active', true)
      .order('sort_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data ?? []).map((p: any) => ({
      ...p,
      photos: (p.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
      product_photos: undefined,
    }))

    return NextResponse.json(result)
  }

  // Default: nested structure — main products with sub_products embedded
  // Step 1: Fetch all main products (parent_id IS NULL)
  const { data: mainProducts, error } = await service
    .from('products')
    .select('id, name, slug, description, sale_price, rental_price, sort_order, product_photos(url, alt_text, sort_order)')
    .eq('website', website)
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Step 2: Fetch all active sub-products for this website in one query
  const mainIds = (mainProducts ?? []).map(p => p.id)
  let allSubs: Record<string, unknown[]> = {}

  if (mainIds.length > 0) {
    const { data: subs } = await service
      .from('products')
      .select('id, name, slug, description, sale_price, rental_price, sort_order, parent_id, product_photos(url, alt_text, sort_order)')
      .eq('website', website)
      .in('parent_id', mainIds)
      .eq('is_active', true)
      .order('sort_order')

    // Group by parent_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(subs ?? []).forEach((s: any) => {
      const pid = s.parent_id as string
      if (!allSubs[pid]) allSubs[pid] = []
      allSubs[pid].push({
        ...s,
        photos: (s.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
        product_photos: undefined,
        parent_id: undefined,
      })
    })
  }

  // Step 3: Combine
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (mainProducts ?? []).map((p: any) => ({
    ...p,
    photos: (p.product_photos ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
    product_photos: undefined,
    sub_products: allSubs[p.id] ?? [],
  }))

  // If type=main, strip sub_products (just return main products with photos)
  if (type === 'main') {
    return NextResponse.json(result.map(p => ({ ...p, sub_products: undefined })))
  }

  return NextResponse.json(result)
}
