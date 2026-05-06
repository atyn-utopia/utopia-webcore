import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required.
 *
 * The webcore tracker (/t.js) calls this on every page load to get the alt-text
 * overrides admins have set for the site, then walks <img> elements and applies
 * matching `alt=` values at runtime.
 *
 *   GET /api/public/seo/alts?website=DOMAIN
 *     → { overrides: [{ src, alt }, ...] }
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Short cache + SWR so the tracker stays cheap on busy pages while still
  // surfacing newly saved overrides within ~30s of an admin save.
  'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400, headers: CORS })

  const service = createServiceClient()
  const { data, error } = await service
    .from('alt_overrides')
    .select('image_src, alt')
    .eq('website', website)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })

  const overrides = (data ?? []).map(r => ({ src: r.image_src as string, alt: r.alt as string }))
  return NextResponse.json({ overrides }, { headers: CORS })
}
