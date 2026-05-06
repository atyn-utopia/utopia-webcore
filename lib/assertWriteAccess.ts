import { NextResponse } from 'next/server'
import { getUserScope, type UserRole } from '@/lib/getUserScope'

/**
 * Gate a mutation route by role + per-website scope.
 *
 * Returns null on success; otherwise a NextResponse the route should return
 * verbatim. Pass `website = null` for routes that don't target a specific site
 * (still gates by role).
 */
export async function assertWriteAccess(
  userId: string,
  website: string | null | undefined,
  allowedRoles: UserRole[],
): Promise<NextResponse | null> {
  const scope = await getUserScope(userId)
  if (!allowedRoles.includes(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (website && scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }
  return null
}
