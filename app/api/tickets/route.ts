import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// GET /api/tickets — admin sees all, others see own
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role').eq('id', user.id).single()

  let query = service.from('tickets').select('*').order('created_at', { ascending: false })
  if (profile?.role !== 'admin') query = query.eq('user_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/tickets — any authenticated user
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('name, role').eq('id', user.id).single()

  const { subject, description } = await request.json()
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

  const { data, error } = await service.from('tickets').insert({
    user_id: user.id,
    user_name: profile?.name ?? user.email ?? '',
    user_role: profile?.role ?? '',
    subject,
    description: description ?? '',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
