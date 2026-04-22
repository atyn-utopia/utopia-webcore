import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/validateApiKey'
import { updateLeadsMode } from '@/lib/updateLeadsMode'

/**
 * PUBLIC endpoints for phone numbers.
 *
 * Reads (no auth — just the domain):
 *   GET /api/public/phone-numbers?website=example.com
 *   GET /api/public/phone-numbers?website=example.com&location=shah-alam
 *
 * Writes (require X-API-Key header with `write` permission on the website):
 *   POST   /api/public/phone-numbers     { website, phone_number, whatsapp_text, ... }
 *   PATCH  /api/public/phone-numbers     { id, ...fields }
 *   DELETE /api/public/phone-numbers     { id }
 *
 * Notes:
 *   - Only 'custom' type can be created via API. Admins manage the 'default'
 *     number directly from the webcore UI to avoid conflicts.
 *   - After any write, the website's leads_mode is recomputed automatically.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const location = searchParams.get('location')

  if (!website) return json({ error: 'website parameter is required' }, 400)

  const service = createServiceClient()
  let query = service
    .from('phone_numbers')
    .select('phone_number, whatsapp_text, type, label, location_slug')
    .eq('website', website)
    .eq('is_active', true)
    .order('type', { ascending: true })

  if (location) query = query.eq('location_slug', location)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  return json(data ?? [])
}

/**
 * POST /api/public/phone-numbers
 * Header: X-API-Key: uwc_...
 * Body: { website, phone_number, whatsapp_text, location_slug?, percentage?, label? }
 */
export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const body = await request.json()
  const { website, phone_number, whatsapp_text, location_slug, percentage, label } = body

  if (!website || !phone_number || !whatsapp_text) {
    return json({ error: 'website, phone_number, and whatsapp_text are required' }, 400)
  }

  const keyInfo = await validateApiKey(apiKey, 'write', website)
  if (!keyInfo) return json({ error: 'Invalid or unauthorized API key' }, 401)

  const service = createServiceClient()

  // Prevent duplicates for the same (website, phone_number) pair
  const { data: existing } = await service
    .from('phone_numbers')
    .select('id')
    .eq('website', website)
    .eq('phone_number', phone_number)
    .maybeSingle()
  if (existing) return json({ error: `phone_number "${phone_number}" already exists for this website` }, 409)

  const { data, error } = await service
    .from('phone_numbers')
    .insert({
      website,
      location_slug: location_slug || 'all',
      phone_number,
      type: 'custom',
      whatsapp_text,
      percentage: typeof percentage === 'number' ? percentage : 0,
      label: label ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await updateLeadsMode(website)
  return json(data, 201)
}

/**
 * PATCH /api/public/phone-numbers
 * Header: X-API-Key: uwc_...
 * Body: { id, ...fields }
 */
export async function PATCH(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return json({ error: 'id is required' }, 400)

  const service = createServiceClient()
  const { data: existing } = await service.from('phone_numbers').select('website, type').eq('id', id).single()
  if (!existing) return json({ error: 'phone number not found' }, 404)

  const keyInfo = await validateApiKey(apiKey, 'write', existing.website)
  if (!keyInfo) return json({ error: 'Invalid or unauthorized API key' }, 401)

  // Don't let the API alter the 'default' row — that's admin-managed
  if (existing.type === 'default') return json({ error: 'The default number is admin-managed. Edit in webcore.' }, 403)

  // Whitelist updatable fields
  const allowed = ['phone_number', 'whatsapp_text', 'location_slug', 'percentage', 'label', 'is_active']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in fields) patch[k] = (fields as Record<string, unknown>)[k]
  if (Object.keys(patch).length === 0) return json({ error: 'No updatable fields provided' }, 400)

  const { data, error } = await service.from('phone_numbers').update(patch).eq('id', id).select().single()
  if (error) return json({ error: error.message }, 500)

  await updateLeadsMode(existing.website)
  return json(data)
}

/**
 * DELETE /api/public/phone-numbers
 * Header: X-API-Key: uwc_...
 * Body: { id }
 */
export async function DELETE(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const body = await request.json()
  const { id } = body

  if (!id) return json({ error: 'id is required' }, 400)

  const service = createServiceClient()
  const { data: existing } = await service.from('phone_numbers').select('website, type').eq('id', id).single()
  if (!existing) return json({ error: 'phone number not found' }, 404)

  const keyInfo = await validateApiKey(apiKey, 'write', existing.website)
  if (!keyInfo) return json({ error: 'Invalid or unauthorized API key' }, 401)

  if (existing.type === 'default') return json({ error: 'The default number is admin-managed. Delete in webcore.' }, 403)

  const { error } = await service.from('phone_numbers').delete().eq('id', id)
  if (error) return json({ error: error.message }, 500)

  await updateLeadsMode(existing.website)
  return json({ success: true })
}
