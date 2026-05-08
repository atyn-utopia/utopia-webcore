import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import { isVercelEnabled, findProjectNameByDomain } from '@/lib/vercel'

/**
 * GET /api/company-websites/check-domain?name=foo.utopiaai.my
 *
 * Reports whether a hostname is free to use as a new domain in webcore.
 * Two layers of check:
 *   1. webcore (company_websites) — is another company already linked to it?
 *   2. Vercel — is it already attached to a project on this team?
 *
 * Returns { available: boolean; reason?: string; ... } so the rename UI can
 * surface a green/red status pill while the user types.
 */
const ALLOWED_ROLES = new Set(['admin', 'designer'])
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

function normalize(d: string) {
  return d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('name') ?? ''
  const name = normalize(raw)

  if (!name) {
    return NextResponse.json({ available: false, reason: 'Enter a hostname' })
  }
  if (!DOMAIN_RE.test(name)) {
    return NextResponse.json({ available: false, reason: 'Not a valid hostname' })
  }

  const service = createServiceClient()

  // 1. webcore-side: any company already linked to this domain?
  const { data: existing } = await service
    .from('company_websites')
    .select('domain, companies(name)')
    .eq('domain', name)
    .maybeSingle() as { data: { domain: string; companies?: { name: string } | { name: string }[] } | null }

  if (existing) {
    const companyField = existing.companies
    const companyName = Array.isArray(companyField) ? companyField[0]?.name : companyField?.name
    return NextResponse.json({
      available: false,
      reason: companyName ? `Already linked in webcore to ${companyName}` : 'Already linked in webcore',
      conflictSource: 'webcore' as const,
    })
  }

  // 2. Vercel-side: any project on this team already serving the domain?
  if (isVercelEnabled()) {
    try {
      const projectName = await findProjectNameByDomain(name)
      if (projectName) {
        return NextResponse.json({
          available: false,
          reason: `Attached on Vercel to project "${projectName}"`,
          conflictSource: 'vercel' as const,
          projectName,
        })
      }
    } catch {
      // Don't block on Vercel API hiccups — fall through to "available" so
      // the user can still proceed (rename API will catch real conflicts).
    }
  }

  return NextResponse.json({ available: true })
}
