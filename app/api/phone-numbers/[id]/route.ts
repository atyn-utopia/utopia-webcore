import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { updateLeadsMode } from '@/lib/updateLeadsMode'

// PATCH /api/phone-numbers/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const service = createServiceClient()

  // Get website before update (for leads_mode recalc)
  const { data: existing } = await service.from('phone_numbers').select('website').eq('id', id).single()

  const { data, error } = await service
    .from('phone_numbers')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update leads_mode
  if (existing?.website) await updateLeadsMode(existing.website)

  return NextResponse.json(data)
}

// DELETE /api/phone-numbers/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const service = createServiceClient()

  // Get website before delete (for leads_mode recalc)
  const { data: existing } = await service.from('phone_numbers').select('website').eq('id', id).single()

  const { error } = await service.from('phone_numbers').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update leads_mode
  if (existing?.website) await updateLeadsMode(existing.website)

  return NextResponse.json({ success: true })
}
