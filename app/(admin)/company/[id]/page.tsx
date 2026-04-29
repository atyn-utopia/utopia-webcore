import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

interface SiteCard {
  domain: string
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
    .select('id, name, company_websites(domain)')
    .eq('id', id)
    .maybeSingle()

  if (!company) notFound()

  const allowedDomains = scope.isScoped ? (scope.domains ?? []) : null
  const domains = (company.company_websites ?? [])
    .map((w: { domain: string }) => w.domain)
    .filter((d: string) => !allowedDomains || allowedDomains.includes(d))

  const cards: SiteCard[] = domains
    .map(d => ({ domain: d }))
    .sort((a, b) => a.domain.localeCompare(b.domain))

  return (
    <div>
      <PageHeader
        title={company.name}
        description={`${domains.length} website${domains.length === 1 ? '' : 's'} · click any card to open its dashboard`}
      />

      {cards.length === 0 ? (
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {cards.map(c => (
            <WebsiteCard key={c.domain} card={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function WebsiteCard({ card }: { card: SiteCard }) {
  const siteUrl = `https://${card.domain}`
  const thumbUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=400`
  const friendlyName = card.domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')

  return (
    <Link
      href={`/websites?website=${encodeURIComponent(card.domain)}`}
      className="group block rounded-xl border bg-white overflow-hidden transition-all hover:shadow-md"
      style={{ borderColor: '#e2e8f0' }}
    >
      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: '#f8fafc' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl} alt={card.domain} loading="lazy"
          className="w-full h-full object-cover object-top" />
        {/* PREMIUM-style badge anchored top-left, matching the screenshot */}
        <div className="absolute top-0 left-3">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md"
            style={{ background: '#7c3aed', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
            Premium
          </div>
        </div>
      </div>
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--foreground)' }}>{friendlyName}</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: '#94a3b8' }}>{siteUrl}</p>
        </div>
        <button
          type="button"
          aria-label="Site actions"
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-slate-100"
          style={{ border: '1px solid #e2e8f0', color: '#94a3b8' }}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>
    </Link>
  )
}
