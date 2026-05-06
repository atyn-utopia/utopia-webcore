import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

interface AltRow {
  id: string
  website: string
  image_src: string
  alt: string
  updated_at: string
}

async function checkAccess(userId: string, website: string) {
  const scope = await getUserScope(userId)
  if (!ALLOWED_ROLES.has(scope.role)) return { ok: false, error: 'Forbidden', status: 403 } as const
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) return { ok: false, error: 'Forbidden for this website', status: 403 } as const
  return { ok: true } as const
}

// GET /api/seo/alt-overrides?website=DOMAIN — list all alt overrides for a site
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
    .from('alt_overrides')
    .select('id, website, image_src, alt, updated_at')
    .eq('website', website)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []) as AltRow[])
}

// POST /api/seo/alt-overrides — upsert.
// Body: { website, image_src, alt }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { website, image_src, alt } = body as Record<string, unknown>
  if (typeof website !== 'string' || !website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (typeof image_src !== 'string' || !image_src.trim()) return NextResponse.json({ error: 'image_src is required' }, { status: 400 })
  if (typeof alt !== 'string') return NextResponse.json({ error: 'alt must be a string' }, { status: 400 })

  const access = await checkAccess(user.id, website)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const service = createServiceClient()
  const { data, error } = await service
    .from('alt_overrides')
    .upsert({ website, image_src: image_src.trim(), alt: alt.trim(), updated_at: new Date().toISOString() }, { onConflict: 'website,image_src' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/seo/alt-overrides?website=&image_src=
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const imageSrc = searchParams.get('image_src')
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (!imageSrc) return NextResponse.json({ error: 'image_src is required' }, { status: 400 })

  const access = await checkAccess(user.id, website)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const service = createServiceClient()
  const { error } = await service
    .from('alt_overrides')
    .delete()
    .eq('website', website)
    .eq('image_src', imageSrc)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
