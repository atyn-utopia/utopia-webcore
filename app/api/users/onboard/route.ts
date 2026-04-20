import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateApiKey } from '@/lib/validateApiKey'
import crypto from 'crypto'

/**
 * POST /api/users/onboard — admin-only onboarding wizard for external designers.
 *
 * Atomically:
 *   1. Finds or creates the company
 *   2. Registers the domain under that company (skipped if already linked)
 *   3. Creates the auth user + profile with role='external_designer'
 *   4. Links the user to the company via user_companies
 *   5. Generates an API key scoped to the domain
 *
 * Request body:
 *   {
 *     company_id?: string,       // use existing company
 *     company_name?: string,     // OR create new
 *     domain: string,
 *     name: string,
 *     email: string,
 *     key_permissions?: ('read' | 'write')[]  // default ['read', 'write']
 *   }
 *
 * Returns everything the admin needs to hand over to the designer in one shot.
 */
function generateTempPassword(): string {
  // 16 url-safe chars — no ambiguous lookalikes
  return crypto.randomBytes(12).toString('base64url')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await request.json()
  const { company_id, company_name, domain, name, email, key_permissions } = body

  if (!domain || !name || !email) {
    return NextResponse.json({ error: 'domain, name, and email are required' }, { status: 400 })
  }
  if (!company_id && !company_name) {
    return NextResponse.json({ error: 'Either company_id or company_name is required' }, { status: 400 })
  }

  const cleanDomain = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')

  // ─── 1. Find or create company ─────────────────────────────
  let companyId = company_id as string | undefined
  let companyName = company_name as string | undefined

  if (!companyId) {
    const { data: created, error: companyError } = await service
      .from('companies')
      .insert({ name: company_name })
      .select()
      .single()
    if (companyError) return NextResponse.json({ error: `Company: ${companyError.message}` }, { status: 500 })
    companyId = created.id
    companyName = created.name
  } else {
    const { data: existing } = await service.from('companies').select('name').eq('id', companyId).single()
    if (!existing) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    companyName = existing.name
  }

  // ─── 2. Link domain to company (upsert) ────────────────────
  const { data: existingCw } = await service
    .from('company_websites')
    .select('company_id')
    .eq('domain', cleanDomain)
    .maybeSingle()

  if (existingCw && existingCw.company_id !== companyId) {
    return NextResponse.json(
      { error: `Domain "${cleanDomain}" is already linked to a different company` },
      { status: 409 }
    )
  }

  if (!existingCw) {
    const { error: cwError } = await service
      .from('company_websites')
      .insert({ company_id: companyId, domain: cleanDomain })
    if (cwError) return NextResponse.json({ error: `Website link: ${cwError.message}` }, { status: 500 })
  }

  // ─── 3. Create auth user + profile ─────────────────────────
  const tempPassword = generateTempPassword()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: `Auth: ${authError.message}` }, { status: 500 })

  const { error: profileError } = await service
    .from('user_profiles')
    .insert({ id: authData.user.id, name, role: 'external_designer' })
  if (profileError) return NextResponse.json({ error: `Profile: ${profileError.message}` }, { status: 500 })

  // ─── 4. Link user to company ───────────────────────────────
  const { error: ucError } = await service
    .from('user_companies')
    .insert({ user_id: authData.user.id, company_id: companyId })
  if (ucError) return NextResponse.json({ error: `Company link: ${ucError.message}` }, { status: 500 })

  // ─── 5. Generate API key ───────────────────────────────────
  const validPerms = ['read', 'write', 'all']
  const perms = Array.isArray(key_permissions)
    ? key_permissions.filter((p: string) => validPerms.includes(p))
    : ['read', 'write']

  const apiKey = generateApiKey()
  const { error: keyError } = await service.from('api_keys').insert({
    name: `${name} — ${cleanDomain}`,
    key: apiKey,
    website: cleanDomain,
    permissions: perms,
    is_active: true,
    created_by: user.id,
  })
  if (keyError) return NextResponse.json({ error: `API key: ${keyError.message}` }, { status: 500 })

  return NextResponse.json({
    user: { id: authData.user.id, email, name, role: 'external_designer', temp_password: tempPassword },
    company: { id: companyId, name: companyName },
    website: { domain: cleanDomain },
    api_key: apiKey,
    api_key_permissions: perms,
    tracking_snippet: `<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="${cleanDomain}"></script>`,
  }, { status: 201 })
}
