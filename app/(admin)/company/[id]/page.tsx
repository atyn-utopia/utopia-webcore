import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import CompanyWebsitesGrid from '@/components/CompanyWebsitesGrid'

export const dynamic = 'force-dynamic'

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
    .select('id, name, company_websites(domain)')
    .eq('id', id)
    .maybeSingle()

  if (!company) notFound()

  const allowedDomains = scope.isScoped ? (scope.domains ?? []) : null
  const domains = (company.company_websites ?? [])
    .map((w: { domain: string }) => w.domain)
    .filter((d: string) => !allowedDomains || allowedDomains.includes(d))

  return (
    <div>
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
        <CompanyWebsitesGrid domains={domains} />
      )}
    </div>
  )
}
