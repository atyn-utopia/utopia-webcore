import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { buildGscAuthUrl } from '@/lib/integrations/gsc'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const domain = url.searchParams.get('domain')
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'You can only connect integrations for your assigned websites' }, { status: 403 })
  }

  const state = Buffer.from(JSON.stringify({ domain, userId: user.id, ts: Date.now() })).toString('base64url')

  try {
    const authUrl = buildGscAuthUrl({ origin: url.origin, state })
    return NextResponse.json({ url: authUrl })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
