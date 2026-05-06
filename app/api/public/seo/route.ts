import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required.
 *
 * Designer sites read this from their generateMetadata() / layout helper to
 * apply a per-page SEO override configured in the webcore admin.
 *
 *   GET /api/public/seo?website=DOMAIN&path=/some-page
 *     → { title, description, og_image } if an override exists for that
 *       (website, path), or 404 if not. The designer site is expected to
 *       fall back to whatever metadata it would have rendered otherwise.
 *
 *   GET /api/public/seo?website=DOMAIN
 *     → list all overrides on the site. Mostly a debug/admin convenience;
 *       designer sites usually want the per-path lookup above.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function normalizePath(p: string): string {
  let v = p.trim()
  if (!v.startsWith('/')) v = `/${v}`
  if (v.length > 1) v = v.replace(/\/+$/, '')
  return v || '/'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const path = searchParams.get('path')

  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400, headers: CORS })

  const service = createServiceClient()

  if (path) {
    const { data } = await service
      .from('seo_overrides')
      .select('title, description, og_image')
      .eq('website', website)
      .eq('path', normalizePath(path))
      .maybeSingle()
    if (!data) return NextResponse.json({ error: 'No override' }, { status: 404, headers: CORS })
    return NextResponse.json(data, { headers: CORS })
  }

  const { data, error } = await service
    .from('seo_overrides')
    .select('path, title, description, og_image, updated_at')
    .eq('website', website)
    .order('path')
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
  return NextResponse.json(data ?? [], { headers: CORS })
}
