import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import DashboardClient from '@/components/DashboardClient'
import type { UserRole } from '@/contexts/UserContext'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient()
  const scope = user ? await getUserScope(user.id) : { role: 'admin' as const, isScoped: false, companyIds: null, domains: null }
  const role = scope.role as UserRole
  const isScoped = scope.isScoped

  const allowedDomains = scope.isScoped ? (scope.domains ?? []) : null
  const noAccess = scope.isScoped && allowedDomains!.length === 0

  type CountQuery = { count: number | null }
  type WebsitesData = { data: { domain: string }[] | null }

  let phoneCountRes: CountQuery = { count: 0 }
  let postCountRes: CountQuery = { count: 0 }
  let productCountRes: CountQuery = { count: 0 }
  let websitesRes: WebsitesData = { data: [] }
  type CompanyRow = { id: string; name: string; logo_url: string | null; company_websites: { domain: string }[] }
  let companiesRes: { data: CompanyRow[] | null } = { data: [] }

  if (!noAccess) {
    const phoneCountQuery = service.from('phone_numbers').select('*', { count: 'exact', head: true })
    const postCountQuery = service.from('blog_posts').select('*', { count: 'exact', head: true })
    const productCountQuery = service.from('products').select('*', { count: 'exact', head: true })
    // Count from company_websites (the canonical link table) — using
    // phone_numbers leaks orphan domains that no longer have a company
    // link (e.g. parallel rows added for a team-domain alias).
    const websitesQuery = service.from('company_websites').select('domain')
    const companiesQuery = service.from('companies').select('id, name, logo_url, company_websites(domain)').order('name')

    if (allowedDomains) {
      phoneCountQuery.in('website', allowedDomains)
      postCountQuery.in('website', allowedDomains)
      productCountQuery.in('website', allowedDomains)
      websitesQuery.in('domain', allowedDomains)
    }
    if (scope.isScoped) {
      const ids = scope.companyIds ?? []
      if (ids.length === 0) {
        companiesRes = { data: [] }
      } else {
        companiesQuery.in('id', ids)
      }
    }

    const results = await Promise.all([phoneCountQuery, postCountQuery, productCountQuery, websitesQuery, companiesQuery])
    phoneCountRes = results[0] as CountQuery
    postCountRes = results[1] as CountQuery
    productCountRes = results[2] as CountQuery
    websitesRes = results[3] as WebsitesData
    companiesRes = results[4] as { data: CompanyRow[] | null }
  }

  const websitesSet = new Set((websitesRes.data ?? []).map((r: { domain: string }) => r.domain))
  if (allowedDomains) allowedDomains.forEach(d => websitesSet.add(d))

  // For scoped users, filter out websites outside their scope from each company folder
  const companies = (companiesRes.data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logo_url ?? null,
    domains: (c.company_websites ?? []).map(w => w.domain).filter(d => !allowedDomains || allowedDomains.includes(d)),
  })).filter(c => !scope.isScoped || c.domains.length > 0)

  return (
    <DashboardClient
      role={role}
      isScoped={isScoped}
      websiteCount={websitesSet.size}
      phoneCount={phoneCountRes.count}
      postCount={postCountRes.count}
      productCount={productCountRes.count}
      companies={companies}
    />
  )
}
