import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { randomBytes } from 'node:crypto'

function generateSecret(): string {
  return `wcrev_${randomBytes(24).toString('hex')}`
}

function isValidHttpsUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')

  const service = createServiceClient()
  if (website) {
    if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data } = await service.from('website_settings').select('*').eq('website', website).maybeSingle()
    return NextResponse.json(data ?? { website, offering_type: 'products' })
  }

  let query = service.from('website_settings').select('*')
  if (scope.isScoped) {
    const allowed = scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json([])
    query = query.in('website', allowed)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const body = await request.json()
  const { website, offering_type, revalidate_url } = body
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const update: Record<string, unknown> = { website }

  if (offering_type !== undefined) {
    if (!['products', 'services'].includes(offering_type)) {
      return NextResponse.json({ error: 'Invalid offering_type' }, { status: 400 })
    }
    update.offering_type = offering_type
  }

  if (revalidate_url !== undefined) {
    if (revalidate_url === null || revalidate_url === '') {
      update.revalidate_url = null
    } else if (!isValidHttpsUrl(revalidate_url)) {
      return NextResponse.json({ error: 'revalidate_url must be a valid http(s) URL' }, { status: 400 })
    } else {
      update.revalidate_url = revalidate_url
    }
  }

  const service = createServiceClient()

  // Auto-generate a secret on the first time a revalidate_url is configured
  if (update.revalidate_url) {
    const { data: existing } = await service
      .from('website_settings')
      .select('revalidate_secret')
      .eq('website', website)
      .maybeSingle()
    if (!existing?.revalidate_secret) {
      update.revalidate_secret = generateSecret()
    }
  }

  const { data, error } = await service
    .from('website_settings')
    .upsert(update, { onConflict: 'website' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/website-settings/rotate-secret  { website }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const { website, action } = await request.json()
  if (action !== 'rotate_secret') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const newSecret = generateSecret()
  const { data, error } = await service
    .from('website_settings')
    .upsert({ website, revalidate_secret: newSecret }, { onConflict: 'website' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
