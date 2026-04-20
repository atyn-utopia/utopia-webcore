import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required for reads.
 * External websites call this to fetch their registered phone numbers.
 *
 * Usage:
 *   GET /api/public/phone-numbers?website=example.com
 *   GET /api/public/phone-numbers?website=example.com&location=shah-alam
 *
 * Response: array of active phone numbers
 * [
 *   {
 *     phone_number: "60123456789",
 *     whatsapp_text: "Hi, I'm interested in...",
 *     type: "default" | "custom" | "location",
 *     label: "sales-team" | null,
 *     location_slug: "shah-alam"
 *   }
 * ]
 *
 * Note: rotation/percentage logic is intentionally not exposed. If a website
 * wants rotation picking, we'd add a separate /resolve endpoint server-side.
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

  if (!website) {
    return NextResponse.json({ error: 'website parameter is required' }, { status: 400, headers: CORS })
  }

  const service = createServiceClient()
  let query = service
    .from('phone_numbers')
    .select('phone_number, whatsapp_text, type, label, location_slug')
    .eq('website', website)
    .eq('is_active', true)
    .order('type', { ascending: true })

  if (location) query = query.eq('location_slug', location)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })

  return NextResponse.json(data ?? [], { headers: CORS })
}
