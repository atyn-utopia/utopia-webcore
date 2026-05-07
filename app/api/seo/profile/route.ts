import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

interface ProfileRow {
  website: string
  brand_name: string
  location: string
  keywords: string[]
  languages: string[]
  updated_at: string
}

const ALLOWED_LANGUAGES = new Set(['en', 'ms'])

async function checkAccess(userId: string, website: string) {
  const scope = await getUserScope(userId)
  if (!ALLOWED_ROLES.has(scope.role)) return { ok: false, error: 'Forbidden', status: 403 } as const
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) return { ok: false, error: 'Forbidden for this website', status: 403 } as const
  return { ok: true } as const
}

// GET /api/seo/profile?website=DOMAIN — returns the profile or an empty
// shell if none exists yet.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })

  const access = await checkAccess(user.id, website)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const service = createServiceClient()
  const { data } = await service
    .from('seo_site_profile')
    .select('website, brand_name, location, keywords, languages, updated_at')
    .eq('website', website)
    .maybeSingle()

  const row: ProfileRow = data ?? {
    website,
    brand_name: '',
    location: '',
    keywords: [],
    languages: ['en'],
    updated_at: new Date().toISOString(),
  }
  return NextResponse.json(row)
}

// PUT /api/seo/profile — upsert.
// Body: { website, brand_name, location, keywords }
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Malformed body' }, { status: 400 })
  const { website, brand_name, location, keywords, languages } = body as Record<string, unknown>
  if (typeof website !== 'string' || !website) return NextResponse.json({ error: 'website is required' }, { status: 400 })

  const access = await checkAccess(user.id, website)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const cleanKeywords = Array.isArray(keywords)
    ? keywords.map(k => typeof k === 'string' ? k.trim() : '').filter(Boolean).slice(0, 32)
    : []

  // Languages: keep only known codes, dedupe, ensure at least one. Default to
  // ['en'] if the client sent nothing valid — every site needs at least one.
  const cleanLanguages = Array.isArray(languages)
    ? Array.from(new Set(languages.map(l => typeof l === 'string' ? l.toLowerCase() : '').filter(l => ALLOWED_LANGUAGES.has(l))))
    : []
  const finalLanguages = cleanLanguages.length > 0 ? cleanLanguages : ['en']

  const service = createServiceClient()
  const { data, error } = await service
    .from('seo_site_profile')
    .upsert({
      website,
      brand_name: typeof brand_name === 'string' ? brand_name.trim() : '',
      location: typeof location === 'string' ? location.trim() : '',
      keywords: cleanKeywords,
      languages: finalLanguages,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'website' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
