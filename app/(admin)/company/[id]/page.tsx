import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import CompanyWebsitesGrid from '@/components/CompanyWebsitesGrid'
import CompanyHeader from '@/components/CompanyHeader'

export const dynamic = 'force-dynamic'

interface SiteStat {
  domain: string
  leads_mode: string | null
  phone_count: number
  active_phone_count: number
  blog_count: number
  published_blog_count: number
}

function computeLeadsMode(phones: { is_active: boolean; location_slug: string }[]): string | null {
  const active = phones.filter(p => p.is_active)
  if (active.length === 0) return null
  const allLoc = active.filter(p => p.location_slug === 'all')
  const specificLoc = active.filter(p => p.location_slug !== 'all')
  if (allLoc.length > 0 && specificLoc.length > 0) return 'hybrid'
  if (specificLoc.length > 0 && allLoc.length === 0) return 'location'
  if (allLoc.length === 1) return 'single'
  return 'rotation'
}

export default async function CompanyFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const scope = await getUserScope(user.id)
  if (scope.isScoped && !(scope.companyIds ?? []).includes(id)) notFound()

  const service = createServiceClient()
  const { data: company } = await service
    .from('companies')
    .select('id, name, logo_url, company_websites(domain, leads_mode_override)')
    .eq('id', id)
    .maybeSingle()

  if (!company) notFound()

  const allowedDomains = scope.isScoped ? (scope.domains ?? []) : null
  const cwRows = (company.company_websites ?? []) as { domain: string; leads_mode_override: string | null }[]
  const filteredCw = cwRows.filter(w => !allowedDomains || allowedDomains.includes(w.domain))
  const domains = filteredCw.map(w => w.domain)

  // Pre-compute per-site stats on the server so the grid renders with leads
  // mode + active phone count already filled in on first paint (no spinner).
  let initialSites: SiteStat[] = []
  if (domains.length > 0) {
    const [{ data: phoneData }, { data: blogData }] = await Promise.all([
      service.from('phone_numbers').select('website, is_active, location_slug').in('website', domains),
      service.from('blog_posts').select('website, status').in('website', domains),
    ])
    const phoneRows = phoneData ?? []
    const blogRows = blogData ?? []
    initialSites = filteredCw.map(w => {
      const phones = phoneRows.filter((r: { website: string }) => r.website === w.domain)
      const posts = blogRows.filter((r: { website: string }) => r.website === w.domain)
      const computed = computeLeadsMode(phones as { is_active: boolean; location_slug: string }[])
      return {
        domain: w.domain,
        leads_mode: w.leads_mode_override ?? computed,
        phone_count: phones.length,
        active_phone_count: phones.filter((r: { is_active: boolean }) => r.is_active).length,
        blog_count: posts.length,
        published_blog_count: posts.filter((r: { status: string }) => r.status === 'published').length,
      }
    })
  }

  return (
    <div>
      <CompanyHeader id={company.id} name={company.name} logoUrl={company.logo_url ?? null} />

      {domains.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#f1f5f9' }}>
            <svg className="w-7 h-7" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M2 7h20" /><path strokeLinecap="round" d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No websites in this company yet</p>
          <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Add a website from the Websites page or via Onboard Designer.</p>
        </div>
      ) : (
        <CompanyWebsitesGrid domains={domains} initialSites={initialSites} />
      )}
    </div>
  )
}
