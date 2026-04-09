import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// GET /api/settings?key=beta_banner
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const service = createServiceClient()
  const { data } = await service.from('app_settings').select('value').eq('key', key).maybeSingle()
  return NextResponse.json({ key, value: data?.value ?? '' })
}

// PATCH /api/settings — admin only
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { key, value } = await request.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const { error } = await service.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ key, value })
}
