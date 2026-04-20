import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { domain } = await request.json().catch(() => ({}))
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  if (scope.isScoped && !(scope.domains ?? []).includes(domain)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('website_integrations')
    .delete()
    .eq('website', domain)
    .eq('provider', 'gsc')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
