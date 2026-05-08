import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { isVercelEnabled, listTeamDomains } from '@/lib/vercel'

/**
 * GET /api/company-websites/zones — return apex domains the team owns on
 * Vercel (utopiaai.my, etc). Used by the domain rename UI to populate the
 * zone dropdown so admins can build subdomains by picking a zone instead of
 * typing the full hostname.
 *
 * Returns { zones: string[], vercelEnabled: boolean }. When VERCEL_API_TOKEN
 * isn't configured, returns an empty list and a flag the UI uses to fall
 * back to free-form input only.
 */
const ALLOWED_ROLES = new Set(['admin', 'designer'])

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isVercelEnabled()) {
    return NextResponse.json({ zones: [], vercelEnabled: false })
  }

  const zones = await listTeamDomains()
  return NextResponse.json({ zones, vercelEnabled: true })
}
