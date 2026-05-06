import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { notifyWebsite } from '@/lib/notifyWebsite'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

function normalizePath(p: string | undefined | null): string {
  if (!p || typeof p !== 'string') return '/'
  let v = p.trim()
  if (!v.startsWith('/')) v = `/${v}`
  // Collapse trailing slashes (except for root)
  if (v.length > 1) v = v.replace(/\/+$/, '')
  return v || '/'
}

const ALLOWED_LANGUAGES = new Set(['en', 'ms'])
function normalizeLanguage(l: unknown): string {
  if (typeof l !== 'string') return 'en'
  const v = l.toLowerCase()
  return ALLOWED_LANGUAGES.has(v) ? v : 'en'
}

function isValidUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

async function checkAccess(userId: string, website: string) {
  const scope = await getUserScope(userId)
  if (!ALLOWED_ROLES.has(scope.role)) return { ok: false, error: 'Forbidden', status: 403 } as const
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) return { ok: false, error: 'Forbidden for this website', status: 403 } as const
  return { ok: true, scope } as const
}

// GET /api/seo?website=DOMAIN — list all overrides for a website
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
  const { data, error } = await service
    .from('seo_overrides')
    .select('id, website, path, language, title, description, og_image, updated_at')
    .eq('website', website)
    .order('path')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/seo — upsert an override.
// Body: { website, path, title?, description?, og_image? }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { website, path, language, title, description, og_image } = body as Record<string, unknown>
  if (typeof website !== 'string' || !website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  const access = await checkAccess(user.id, website)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const normalized = normalizePath(typeof path === 'string' ? path : '/')
  const lang = normalizeLanguage(language)
  const row: Record<string, unknown> = {
    website,
    path: normalized,
    language: lang,
    title: typeof title === 'string' && title.trim() ? title.trim() : null,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    updated_at: new Date().toISOString(),
  }
  if (og_image === null || og_image === '' || og_image === undefined) {
    row.og_image = null
  } else if (!isValidUrl(og_image)) {
    return NextResponse.json({ error: 'og_image must be a valid http(s) URL' }, { status: 400 })
  } else {
    row.og_image = og_image
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('seo_overrides')
    .upsert(row, { onConflict: 'website,path,language' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void notifyWebsite(website, 'seo')
  return NextResponse.json(data)
}

// DELETE /api/seo?website=&path=&language=
// Without language → deletes every language for that path.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const path = searchParams.get('path')
  const language = searchParams.get('language')
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  const access = await checkAccess(user.id, website)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const service = createServiceClient()
  let q = service
    .from('seo_overrides')
    .delete()
    .eq('website', website)
    .eq('path', normalizePath(path))
  if (language) q = q.eq('language', normalizeLanguage(language))
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void notifyWebsite(website, 'seo')
  return NextResponse.json({ success: true })
}
