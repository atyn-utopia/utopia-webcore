import { NextResponse } from 'next/server'
import { resolveActivePhone } from '@/lib/resolveActivePhone'

/**
 * PUBLIC endpoint — no auth required.
 * Resolves ONE phone number for a given website + optional location.
 *
 *   GET /api/public/phone-numbers/resolve?website=example.com
 *   GET /api/public/phone-numbers/resolve?website=example.com&location=shah-alam
 *   GET /api/public/phone-numbers/resolve?website=example.com&fallback_default=0
 *
 * Returns the resolved phone row + a `source` field telling the caller which
 * tier (location / all / default_fallback) was used. See lib/resolveActivePhone
 * for the resolution order.
 *
 * For WhatsApp CTAs, prefer linking <a href> directly to /api/public/whatsapp-redirect
 * — that endpoint runs the same resolution server-side and 302s the user
 * straight to wa.me, so rotation happens per click without designer code.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const location = searchParams.get('location')
  const fallbackDefault = searchParams.get('fallback_default') !== '0'

  if (!website) {
    return NextResponse.json({ error: 'website parameter is required' }, { status: 400, headers: CORS })
  }

  const resolved = await resolveActivePhone({ website, location, fallbackDefault })
  if (!resolved) {
    return NextResponse.json({ error: 'No active phone numbers configured for this website' }, { status: 404, headers: CORS })
  }
  return NextResponse.json(resolved, { headers: CORS })
}
