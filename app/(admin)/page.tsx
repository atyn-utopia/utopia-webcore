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
  type WebsitesData = { data: { website: string }[] | null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RecentData = { data: any[] | null }

  let phoneCountRes: CountQuery = { count: 0 }
  let postCountRes: CountQuery = { count: 0 }
  let websitesRes: WebsitesData = { data: [] }
  let recentPostsRes: RecentData = { data: [] }
  let recentPhonesRes: RecentData = { data: [] }
  type CompanyRow = { id: string; name: string; company_websites: { domain: string }[] }
  let companiesRes: { data: CompanyRow[] | null } = { data: [] }

  if (!noAccess) {
    const phoneCountQuery = service.from('phone_numbers').select('*', { count: 'exact', head: true })
    const postCountQuery = service.from('blog_posts').select('*', { count: 'exact', head: true })
    const websitesQuery = service.from('phone_numbers').select('website')
    const recentPostsQuery = service.from('blog_posts').select('id, website, slug, status, updated_at, blog_translations(language, title)').order('updated_at', { ascending: false }).limit(5)
    const recentPhonesQuery = service.from('phone_numbers').select('id, website, phone_number, label, type, updated_at').order('updated_at', { ascending: false }).limit(5)
    const companiesQuery = service.from('companies').select('id, name, company_websites(domain)').order('name')

    if (allowedDomains) {
      phoneCountQuery.in('website', allowedDomains)
      postCountQuery.in('website', allowedDomains)
      websitesQuery.in('website', allowedDomains)
      recentPostsQuery.in('website', allowedDomains)
      recentPhonesQuery.in('website', allowedDomains)
    }
    if (scope.isScoped) {
      const ids = scope.companyIds ?? []
      if (ids.length === 0) {
        companiesRes = { data: [] }
      } else {
        companiesQuery.in('id', ids)
      }
    }

    const results = await Promise.all([phoneCountQuery, postCountQuery, websitesQuery, recentPostsQuery, recentPhonesQuery, companiesQuery])
    phoneCountRes = results[0] as CountQuery
    postCountRes = results[1] as CountQuery
    websitesRes = results[2] as WebsitesData
    recentPostsRes = results[3] as RecentData
    recentPhonesRes = results[4] as RecentData
    companiesRes = results[5] as { data: CompanyRow[] | null }
  }

  const websitesSet = new Set((websitesRes.data ?? []).map((r: { website: string }) => r.website))
  if (allowedDomains) allowedDomains.forEach(d => websitesSet.add(d))

  // For scoped users, filter out websites outside their scope from each company folder
  const companies = (companiesRes.data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    domains: (c.company_websites ?? []).map(w => w.domain).filter(d => !allowedDomains || allowedDomains.includes(d)),
  })).filter(c => !scope.isScoped || c.domains.length > 0)

  return (
    <DashboardClient
      role={role}
      isScoped={isScoped}
      websiteCount={websitesSet.size}
      phoneCount={phoneCountRes.count}
      postCount={postCountRes.count}
      recentPosts={recentPostsRes.data ?? []}
      recentPhones={recentPhonesRes.data ?? []}
      companies={companies}
    />
  )
}
