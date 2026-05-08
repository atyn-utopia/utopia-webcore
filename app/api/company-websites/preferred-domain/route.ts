import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { isVercelEnabled, findProjectIdByDomain, getProjectAliases } from '@/lib/vercel'

/**
 * GET /api/company-websites/preferred-domain?domain=foo.vercel.app
 *
 * Returns the canonical hostname Webcore should hand to the customer site's
 * setup bundle. The Claude handoff hardcodes this domain into the
 * generated lib/webcore.ts (window.location.hostname check, tracker
 * data-website, API queries) — so picking the right one means the
 * customer's deployed site lines up 1:1 with a single webcore record
 * instead of forcing us to keep a duplicate row per alias.
 *
 * Logic:
 *   1. If the input domain doesn't end in .vercel.app, return it as-is —
 *      it's already a real custom domain, no swap needed.
 *   2. Otherwise, look up the Vercel project for the domain and inspect
 *      its aliases. Prefer team-owned non-.vercel.app aliases (utopiaai.my,
 *      stickerlori.com.my, etc.). When the project has multiple, the
 *      lexicographically-first one wins (deterministic, and team-zone
 *      aliases tend to share a stem with the project name anyway).
 *   3. If no team-zone alias is attached or VERCEL_API_TOKEN isn't set,
 *      fall back to the input domain — the bundle still works, the
 *      operator just has to keep the duplicate row situation.
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
  const recorded = (searchParams.get('domain') ?? '').trim().toLowerCase()
  if (!recorded) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  // Custom domains pass through unchanged.
  if (!recorded.endsWith('.vercel.app')) {
    return NextResponse.json({ recorded, preferred: recorded, reason: 'custom-domain' })
  }

  if (!isVercelEnabled()) {
    return NextResponse.json({ recorded, preferred: recorded, reason: 'vercel-token-missing' })
  }

  const projectId = await findProjectIdByDomain(recorded).catch(() => null)
  if (!projectId) {
    return NextResponse.json({ recorded, preferred: recorded, reason: 'no-project' })
  }

  const aliases = await getProjectAliases(projectId).catch(() => [] as string[])
  const teamAliases = aliases.filter(a => !a.endsWith('.vercel.app')).sort()
  if (teamAliases.length === 0) {
    return NextResponse.json({ recorded, preferred: recorded, reason: 'no-team-alias' })
  }

  return NextResponse.json({
    recorded,
    preferred: teamAliases[0],
    candidates: teamAliases,
    reason: 'team-alias',
  })
}
