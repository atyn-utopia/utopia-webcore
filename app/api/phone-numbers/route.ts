import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { updateLeadsMode } from '@/lib/updateLeadsMode'
import { getUserScope } from '@/lib/getUserScope'
import { assertWriteAccess } from '@/lib/assertWriteAccess'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'
import { notifyWebsite } from '@/lib/notifyWebsite'

const PHONE_WRITE_ROLES = ['admin', 'designer', 'external_designer', 'indoor_sales', 'manager'] as const

// GET /api/phone-numbers?website=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')

  const scope = await getUserScope(user.id)
  const service = createServiceClient()
  let query = service.from('phone_numbers').select('*').order('created_at', { ascending: false })

  if (website) {
    // If user is scoped, reject websites not in scope
    if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
      return NextResponse.json([])
    }
    query = query.eq('website', website)
  } else if (scope.isScoped) {
    const allowed = scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json([])
    query = query.in('website', allowed)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/phone-numbers
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const { website, location_slug, phone_number, type, whatsapp_text, percentage, label } = body

  if (typeof website !== 'string' || !website || !location_slug || !phone_number || !whatsapp_text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const denied = await assertWriteAccess(user.id, website, [...PHONE_WRITE_ROLES])
  if (denied) return denied

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

  // Auto-update leads_mode
  await updateLeadsMode(website)

  // Audit log
  const actor = await resolveActor(user.id)
  await writeAuditLog({
    actor,
    entityType: 'phone_number',
    entityId: data.id,
    action: 'create',
    website,
    label: data.phone_number,
    metadata: {
      phone_number: data.phone_number,
      location_slug: data.location_slug,
      type: data.type,
      percentage: data.percentage,
    },
  })

  void notifyWebsite(website, 'phone_number')

  return NextResponse.json(data, { status: 201 })
}
