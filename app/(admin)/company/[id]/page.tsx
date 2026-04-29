import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

interface SiteCard {
  domain: string
  phoneCount: number
  activePhoneCount: number
  blogCount: number
  publishedBlogCount: number
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

  let cards: SiteCard[] = []
  if (domains.length > 0) {
    const [phones, posts] = await Promise.all([
      service.from('phone_numbers').select('website, is_active').in('website', domains),
      service.from('blog_posts').select('website, status').in('website', domains),
    ])
    const phoneRows = phones.data ?? []
    const postRows = posts.data ?? []
    cards = domains.map(d => {
      const sitePhones = phoneRows.filter((p: { website: string }) => p.website === d)
      const sitePosts = postRows.filter((p: { website: string }) => p.website === d)
      return {
        domain: d,
        phoneCount: sitePhones.length,
        activePhoneCount: sitePhones.filter((p: { is_active: boolean }) => p.is_active).length,
        blogCount: sitePosts.length,
        publishedBlogCount: sitePosts.filter((p: { status: string }) => p.status === 'published').length,
      }
    })
    cards.sort((a, b) => a.domain.localeCompare(b.domain))
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
  // mshots is the same screenshot service the websites page uses
  const thumbUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=600`
  const friendlyName = card.domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  const hasActivity = card.activePhoneCount > 0 || card.publishedBlogCount > 0

  return (
    <Link
      href={`/websites?website=${encodeURIComponent(card.domain)}`}
      className="group rounded-xl border bg-white overflow-hidden transition-all hover:border-[var(--primary)] hover:shadow-md"
      style={{ borderColor: '#e2e8f0' }}
    >
      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: '#f8fafc' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl} alt={card.domain} loading="lazy"
          className="w-full h-full object-cover object-top transition-transform group-hover:scale-105" />
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
            style={{ background: hasActivity ? '#7c3aed' : '#94a3b8' }}>
            {hasActivity ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{friendlyName}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: '#64748b' }}>{siteUrl}</p>
        <div className="mt-3 flex items-center gap-3 text-[11px]" style={{ color: '#94a3b8' }}>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            {card.activePhoneCount}/{card.phoneCount}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            {card.publishedBlogCount}/{card.blogCount}
          </span>
        </div>
      </div>
    </Link>
  )
}
