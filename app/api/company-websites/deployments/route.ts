import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { isVercelEnabled, findProjectIdByDomain, listDeployments } from '@/lib/vercel'

/**
 * GET /api/company-websites/deployments?domain=foo.vercel.app
 *
 * Surfaces the last N deployments for the matching Vercel project so an
 * admin can see who shipped what. Webcore only records who added the
 * domain to its own DB (audit_logs entity_type='website' action='create')
 * — actual deploys are git pushes / CLI runs / GitHub Action runs that
 * happen outside webcore. This endpoint asks Vercel for that history.
 *
 * Returns null project when:
 *   - VERCEL_API_TOKEN isn't configured
 *   - The token doesn't have visibility into a project owning this domain
 *   - The domain isn't on Vercel at all (custom hosting, not yet attached)
 *
 * Admin / designer only — same gate as the other write-related endpoints.
 */
const ALLOWED_ROLES = new Set(['admin', 'designer'])

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const domain = (searchParams.get('domain') ?? '').trim().toLowerCase()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20'), 1), 100)
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  if (!isVercelEnabled()) {
    return NextResponse.json({ projectId: null, reason: 'vercel-token-missing', deployments: [] })
  }

  const projectId = await findProjectIdByDomain(domain).catch(() => null)
  if (!projectId) {
    return NextResponse.json({ projectId: null, reason: 'no-project', deployments: [] })
  }

  const deployments = await listDeployments(projectId, limit).catch(() => [])
  return NextResponse.json({ projectId, deployments })
}
