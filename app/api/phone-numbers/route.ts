import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// GET /api/phone-numbers?website=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')

  const service = createServiceClient()
  let query = service.from('phone_numbers').select('*').order('created_at', { ascending: false })

  if (website) query = query.eq('website', website)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/phone-numbers
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { website, location_slug, phone_number, type, whatsapp_text, percentage, label } = body

  if (!website || !location_slug || !phone_number || !whatsapp_text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('phone_numbers')
    .insert({
      website,
      location_slug,
      phone_number,
      type: type || 'custom',
      whatsapp_text,
      percentage: percentage ?? 100,
      label: type === 'default' ? 'default' : (label || null),
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
