import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required.
 *
 * The webcore tracker (/t.js) calls this once on page load to discover any
 * third-party tags the admin has wired up for this site (currently: GTM
 * container ID, with GA4 firing through GTM). When a `gtmId` is returned,
 * the tracker injects gtm.js into the host page.
 *
 *   GET /api/public/config?website=DOMAIN
 *     → { gtmId: 'GTM-XXXXXX' | null, ga4Id: 'G-XXXXXX' | null }
 *
 * Both fields can be null — the tracker still functions for first-party
 * analytics on its own.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // 5-minute cache. Tag IDs are stable once configured — a longer cache
  // keeps the public surface cheap, and the tracker re-fetches on every
  // fresh tab anyway.
  'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400, headers: CORS })

  const service = createServiceClient()
  const { data } = await service
    .from('website_integrations')
    .select('meta, property_id')
    .eq('website', website)
    .eq('provider', 'marketing')
    .maybeSingle()

  const meta = (data?.meta ?? {}) as { ga4?: { measurementId?: string }; gtm?: { publicId?: string } }
  return NextResponse.json(
    {
      gtmId: meta.gtm?.publicId ?? null,
      ga4Id: meta.ga4?.measurementId ?? data?.property_id ?? null,
    },
    { headers: CORS },
  )
}
