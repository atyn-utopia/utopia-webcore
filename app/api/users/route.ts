import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { SCOPED_ROLES, type UserRole } from '@/lib/getUserScope'

const VALID_ROLES: UserRole[] = ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager']

// GET /api/users — list all user profiles (admin only)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const [{ data: profiles, error }, { data: assignments }] = await Promise.all([
    service.from('user_profiles').select('*').order('created_at', { ascending: true }),
    service.from('user_companies').select('user_id, company_id, companies(id, name)'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group company assignments by user_id
  const byUser: Record<string, { id: string; name: string }[]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(assignments ?? []).forEach((a: any) => {
    const uid = a.user_id
    if (!byUser[uid]) byUser[uid] = []
    if (a.companies) byUser[uid].push({ id: a.companies.id, name: a.companies.name })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (profiles ?? []).map((p: any) => ({ ...p, companies: byUser[p.id] ?? [] }))
  return NextResponse.json(enriched)
}

// POST /api/users — create a new user
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email, password, name, role, company_ids } = await request.json()
  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Scoped roles require at least one company
  if (SCOPED_ROLES.includes(role) && (!Array.isArray(company_ids) || company_ids.length === 0)) {
    return NextResponse.json({ error: 'At least one company must be assigned for this role' }, { status: 400 })
  }

  // Create auth user using admin API
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Create profile
  const { error: profileError } = await service
    .from('user_profiles')
    .insert({ id: authData.user.id, name, role })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Insert company assignments if provided
  if (Array.isArray(company_ids) && company_ids.length > 0) {
    const rows = company_ids.map((cid: string) => ({ user_id: authData.user.id, company_id: cid }))
    const { error: ucError } = await service.from('user_companies').insert(rows)
    if (ucError) return NextResponse.json({ error: ucError.message }, { status: 500 })
  }

  return NextResponse.json({ id: authData.user.id, email, name, role }, { status: 201 })
}

// PATCH /api/users — update user role and/or company assignments
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id, name, role, company_ids } = await request.json()
  if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    updates.role = role
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await service.from('user_profiles').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace company assignments if provided (array; empty array clears)
  if (Array.isArray(company_ids)) {
    const { error: delError } = await service.from('user_companies').delete().eq('user_id', id)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
    if (company_ids.length > 0) {
      const rows = company_ids.map((cid: string) => ({ user_id: id, company_id: cid }))
      const { error: insError } = await service.from('user_companies').insert(rows)
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
