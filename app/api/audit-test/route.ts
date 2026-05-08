import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/audit-test — admin-only diagnostic.
 *
 * lib/auditLog.ts swallows insert errors so a missing table or stale CHECK
 * looks identical to a healthy-but-empty trail in /audit. This endpoint
 * tries the same insert and surfaces whatever Supabase actually says, so
 * we can read the real error without having to dig through Vercel logs.
 *
 * After fixing whatever the response says, hit /audit and the test row
 * (label = '__audit_test__') should be visible at the top.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role, name').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  // Probe 1: does the table exist + can we read?
  const readProbe = await service.from('audit_logs').select('id', { count: 'exact', head: true })

  // Probe 2: try a test insert
  const insertProbe = await service.from('audit_logs').insert({
    user_id: user.id,
    user_name: profile?.name ?? 'audit-test',
    user_role: profile?.role ?? 'admin',
    entity_type: 'website',
    entity_id: null,
    action: 'create',
    website: null,
    label: '__audit_test__',
    changes: null,
    metadata: { source: 'audit-test endpoint', ts: new Date().toISOString() },
  }).select().single()

  return NextResponse.json({
    read: {
      ok: !readProbe.error,
      count: readProbe.count ?? null,
      error: readProbe.error ? { message: readProbe.error.message, code: readProbe.error.code, details: readProbe.error.details, hint: readProbe.error.hint } : null,
    },
    insert: {
      ok: !insertProbe.error,
      inserted_id: insertProbe.data?.id ?? null,
      error: insertProbe.error ? { message: insertProbe.error.message, code: insertProbe.error.code, details: insertProbe.error.details, hint: insertProbe.error.hint } : null,
    },
    actor: {
      id: user.id,
      name: profile?.name ?? null,
      role: profile?.role ?? null,
    },
  })
}
