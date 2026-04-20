import { createServiceClient } from '@/lib/supabase/service'

export type UserRole = 'admin' | 'designer' | 'external_designer' | 'writer' | 'indoor_sales' | 'manager'

/** Roles that are restricted to their assigned companies */
export const SCOPED_ROLES: UserRole[] = ['indoor_sales', 'manager', 'external_designer']

export interface UserScope {
  role: UserRole
  /** True if this user is restricted to a subset of companies */
  isScoped: boolean
  /** Company IDs the user can access (null = unrestricted/global access) */
  companyIds: string[] | null
  /** Website domains the user can access (null = unrestricted/global access) */
  domains: string[] | null
}

/**
 * Resolve what a given user can access.
 *
 * - admin/designer/writer → global access (isScoped: false, companyIds/domains null)
 * - indoor_sales/manager/external_designer → scoped to their assigned companies
 */
export async function getUserScope(userId: string): Promise<UserScope> {
  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = (profile?.role ?? 'admin') as UserRole

  if (!SCOPED_ROLES.includes(role)) {
    return { role, isScoped: false, companyIds: null, domains: null }
  }

  const { data: uc } = await service
    .from('user_companies')
    .select('company_id')
    .eq('user_id', userId)

  const companyIds = (uc ?? []).map(r => r.company_id as string)

  if (companyIds.length === 0) {
    return { role, isScoped: true, companyIds: [], domains: [] }
  }

  const { data: cw } = await service
    .from('company_websites')
    .select('domain')
    .in('company_id', companyIds)

  const domains = (cw ?? []).map(r => r.domain as string)

  return { role, isScoped: true, companyIds, domains }
}
