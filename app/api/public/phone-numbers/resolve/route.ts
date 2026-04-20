import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required.
 * Resolves ONE phone number for a given website + optional location,
 * respecting the site's leads_mode (single / rotation / location / hybrid).
 *
 * Usage:
 *   GET /api/public/phone-numbers/resolve?website=example.com
 *   GET /api/public/phone-numbers/resolve?website=example.com&location=shah-alam
 *
 * Resolution order:
 *   1. If `location` param given: try phones with that exact location_slug
 *   2. Fall back to phones with location_slug = 'all'
 *   3. If multiple candidates: weighted random pick using `percentage`
 *
 * Response:
 *   { phone_number, whatsapp_text, type, label, location_slug, source: 'location' | 'all' }
 *
 * 404 if no active phones are configured for this website.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

interface PhoneRow {
  phone_number: string
  whatsapp_text: string
  type: string
  label: string | null
  location_slug: string
  percentage: number | null
}

function weightedPick(phones: PhoneRow[]): PhoneRow {
  if (phones.length === 1) return phones[0]
  const total = phones.reduce((s, p) => s + (p.percentage ?? 100), 0)
  let rand = Math.random() * total
  for (const p of phones) {
    rand -= p.percentage ?? 100
    if (rand <= 0) return p
  }
  return phones[0]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const location = searchParams.get('location')

  if (!website) {
    return NextResponse.json({ error: 'website parameter is required' }, { status: 400, headers: CORS })
  }

  const service = createServiceClient()

  // 1. Try specific location first (if requested)
  if (location && location !== 'all') {
    const { data: locPhones } = await service
      .from('phone_numbers')
      .select('phone_number, whatsapp_text, type, label, location_slug, percentage')
      .eq('website', website)
      .eq('location_slug', location)
      .eq('is_active', true)

    if (locPhones && locPhones.length > 0) {
      const chosen = weightedPick(locPhones as PhoneRow[])
      return NextResponse.json({ ...chosen, percentage: undefined, source: 'location' }, { headers: CORS })
    }
  }

  // 2. Fall back to location_slug = 'all'
  const { data: allPhones } = await service
    .from('phone_numbers')
    .select('phone_number, whatsapp_text, type, label, location_slug, percentage')
    .eq('website', website)
    .eq('location_slug', 'all')
    .eq('is_active', true)

  if (allPhones && allPhones.length > 0) {
    const chosen = weightedPick(allPhones as PhoneRow[])
    return NextResponse.json({ ...chosen, percentage: undefined, source: 'all' }, { headers: CORS })
  }

  return NextResponse.json({ error: 'No active phone numbers configured for this website' }, { status: 404, headers: CORS })
}
