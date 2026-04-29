import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { updateLeadsMode } from '@/lib/updateLeadsMode'
import { resolveActor, writeAuditLog, diffObjects, PHONE_FIELDS } from '@/lib/auditLog'
import { notifyWebsite } from '@/lib/notifyWebsite'

// PATCH /api/phone-numbers/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const service = createServiceClient()

  // Fetch full row before update so we can diff for the audit log
  const { data: before } = await service.from('phone_numbers').select('*').eq('id', id).single()

  const { data, error } = await service
    .from('phone_numbers')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update leads_mode
  if (before?.website) await updateLeadsMode(before.website)

  // Audit log
  const changes = diffObjects(before, data, PHONE_FIELDS)
  if (Object.keys(changes).length > 0) {
    const actor = await resolveActor(user.id)
    await writeAuditLog({
      actor,
      entityType: 'phone_number',
      entityId: id,
      action: 'update',
      website: data.website,
      label: data.phone_number,
      changes,
    })
  }

  if (data?.website) void notifyWebsite(data.website, 'phone_number')

  return NextResponse.json(data)
}

// DELETE /api/phone-numbers/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const service = createServiceClient()

  // Fetch full row before delete for the audit snapshot
  const { data: before } = await service.from('phone_numbers').select('*').eq('id', id).single()

  const { error } = await service.from('phone_numbers').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update leads_mode
  if (before?.website) await updateLeadsMode(before.website)

  // Audit log
  if (before) {
    const actor = await resolveActor(user.id)
    await writeAuditLog({
      actor,
      entityType: 'phone_number',
      entityId: id,
      action: 'delete',
      website: before.website,
      label: before.phone_number,
      metadata: {
        phone_number: before.phone_number,
        location_slug: before.location_slug,
        type: before.type,
        percentage: before.percentage,
        whatsapp_text: before.whatsapp_text,
      },
    })
    void notifyWebsite(before.website, 'phone_number')
  }

  return NextResponse.json({ success: true })
}
