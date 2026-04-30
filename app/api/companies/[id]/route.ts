import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_EDIT_ROLES = new Set(['admin', 'designer'])

function isValidHttpsUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// PATCH /api/companies/[id] — edit name and/or logo_url. Admin/designer only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_EDIT_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, logo_url } = body as { name?: unknown; logo_url?: unknown }

  const update: Record<string, unknown> = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
    }
    update.name = name.trim()
  }
  if (logo_url !== undefined) {
    if (logo_url === null || logo_url === '') {
      update.logo_url = null
    } else if (!isValidHttpsUrl(logo_url)) {
      return NextResponse.json({ error: 'logo_url must be a valid http(s) URL' }, { status: 400 })
    } else {
      update.logo_url = logo_url
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('companies')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
