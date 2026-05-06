import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

// GET /api/companies — list all companies with their websites
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const service = createServiceClient()

  let query = service
    .from('companies')
    .select('*, company_websites(domain)')
    .order('name')

  if (scope.isScoped) {
    const ids = scope.companyIds ?? []
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/companies — create a company with websites
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Malformed body' }, { status: 400 })
  const { name, domains } = body
  if (!name) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  const service = createServiceClient()

  // Create company
  const { data: company, error: companyError } = await service
    .from('companies')
    .insert({ name })
    .select()
    .single()

  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 })

  // Add websites if provided
  if (Array.isArray(domains) && domains.length > 0) {
    const rows = domains.filter(Boolean).map((domain: string) => ({
      company_id: company.id,
      domain: domain.trim(),
    }))
    if (rows.length > 0) {
      const { error: websiteError } = await service.from('company_websites').insert(rows)
      if (websiteError) return NextResponse.json({ error: websiteError.message }, { status: 500 })
    }
  }

  return NextResponse.json(company, { status: 201 })
}
