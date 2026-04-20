import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { generateApiKey } from '@/lib/validateApiKey'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'

/**
 * POST /api/company-websites — self-serve "connect a new website to webcore".
 *
 * Who can use:
 *   - admin            → full access, any company
 *   - designer         → internal, any company (self-serve)
 *   - external_designer, others → blocked
 *
 * Request body:
 *   {
 *     company_id?: string,       // use existing
 *     company_name?: string,     // OR create new
 *     domain: string,
 *     create_api_key?: boolean,  // default true
 *     key_permissions?: ('read' | 'write')[]  // default ['read', 'write']
 *   }
 *
 * Side effects:
 *   - company created if needed
 *   - company_websites row inserted
 *   - api_keys row inserted (if create_api_key)
 *   - audit_log 'website' entity 'create' entry written
 */
const ALLOWED_ROLES = new Set(['admin', 'designer'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { company_id, company_name, domain, create_api_key = true, key_permissions } = body

  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  if (!company_id && !company_name) {
    return NextResponse.json({ error: 'Either company_id or company_name is required' }, { status: 400 })
  }

  const cleanDomain = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!cleanDomain) return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })

  const service = createServiceClient()

  // 1. Find or create company
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

  // 2. Check if domain already linked
  const { data: existingCw } = await service
    .from('company_websites')
    .select('company_id')
    .eq('domain', cleanDomain)
    .maybeSingle()

  if (existingCw) {
    if (existingCw.company_id !== companyId) {
      return NextResponse.json({ error: `Domain "${cleanDomain}" is already linked to a different company` }, { status: 409 })
    }
    return NextResponse.json({ error: `Domain "${cleanDomain}" is already linked to this company` }, { status: 409 })
  }

  // 3. Insert the link
  const { data: cw, error: cwError } = await service
    .from('company_websites')
    .insert({ company_id: companyId, domain: cleanDomain })
    .select()
    .single()
  if (cwError) return NextResponse.json({ error: `Website link: ${cwError.message}` }, { status: 500 })

  // 4. Optional API key
  let apiKey: string | null = null
  let apiKeyPerms: string[] = []
  if (create_api_key) {
    const validPerms = ['read', 'write', 'all']
    apiKeyPerms = Array.isArray(key_permissions)
      ? key_permissions.filter((p: string) => validPerms.includes(p))
      : ['read', 'write']

    apiKey = generateApiKey()
    const { error: keyError } = await service.from('api_keys').insert({
      name: `${companyName} — ${cleanDomain}`,
      key: apiKey,
      website: cleanDomain,
      permissions: apiKeyPerms,
      is_active: true,
      created_by: user.id,
    })
    if (keyError) return NextResponse.json({ error: `API key: ${keyError.message}` }, { status: 500 })
  }

  // 5. Audit log
  const actor = await resolveActor(user.id)
  await writeAuditLog({
    actor,
    entityType: 'website',
    entityId: cw.id,
    action: 'create',
    website: cleanDomain,
    label: cleanDomain,
    metadata: {
      company_id: companyId,
      company_name: companyName,
      api_key_created: apiKey !== null,
      permissions: apiKeyPerms,
    },
  })

  return NextResponse.json({
    company: { id: companyId, name: companyName },
    website: { domain: cleanDomain },
    api_key: apiKey,
    api_key_permissions: apiKeyPerms,
    tracking_snippet: `<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="${cleanDomain}"></script>`,
  }, { status: 201 })
}
