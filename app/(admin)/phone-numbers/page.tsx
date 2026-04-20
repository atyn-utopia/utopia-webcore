'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useToast } from '@/contexts/ToastContext'
import ViewToggle, { type ViewMode } from '@/components/ViewToggle'

const MY_STATES = [
  { label: 'All Locations', slug: 'all' },
  { label: 'Johor', slug: 'johor' },
  { label: 'Kedah', slug: 'kedah' },
  { label: 'Kelantan', slug: 'kelantan' },
  { label: 'Kuala Lumpur', slug: 'kuala-lumpur' },
  { label: 'Labuan', slug: 'labuan' },
  { label: 'Melaka', slug: 'melaka' },
  { label: 'Negeri Sembilan', slug: 'negeri-sembilan' },
  { label: 'Pahang', slug: 'pahang' },
  { label: 'Perak', slug: 'perak' },
  { label: 'Perlis', slug: 'perlis' },
  { label: 'Pulau Pinang', slug: 'pulau-pinang' },
  { label: 'Putrajaya', slug: 'putrajaya' },
  { label: 'Sabah', slug: 'sabah' },
  { label: 'Sarawak', slug: 'sarawak' },
  { label: 'Selangor', slug: 'selangor' },
  { label: 'Terengganu', slug: 'terengganu' },
]

interface PhoneNumber {
  id: string
  website: string

  location_slug: string
  phone_number: string
  type: 'default' | 'custom'
  whatsapp_text: string
  percentage: number
  label: string | null
  is_active: boolean
  created_at: string
}

interface CompanyInfo {
  id: string
  name: string
  company_websites: { domain: string }[]
}

export default function PhoneNumbersPage() {
  const { t } = useLanguage()
  const confirm = useConfirm()
  const toast = useToast()
  const { selectedWebsite } = useWebsite()
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [companies, setCompanies] = useState<CompanyInfo[]>([])
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({}) // domain → company name
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterWebsite, setFilterWebsite] = useState(() => searchParams.get('website') ?? '')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    const fromUrl = searchParams.get('website')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl) { setFilterWebsite(fromUrl); return }
    setFilterWebsite(selectedWebsite)
  }, [selectedWebsite, searchParams])

  // Fetch companies
  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCompanies(data)
          const map: Record<string, string> = {}
          data.forEach((c: CompanyInfo) => {
            c.company_websites?.forEach(w => { map[w.domain] = c.name })
          })
          setCompanyMap(map)
        }
      })
      .catch(() => {})
  }, [])

  const fetchNumbers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterWebsite) params.set('website', filterWebsite)
    const res = await fetch(`/api/phone-numbers?${params}`)
    const data = await res.json()
    setNumbers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterWebsite])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchNumbers() }, [fetchNumbers])

  async function deleteNumber(id: string) {
    const ok = await confirm({
      title: 'Delete phone number',
      message: 'This number will be permanently removed from the rotation pool. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Phone number deleted', 'Deleted')
    } else {
      toast.error('Failed to delete number', 'Delete failed')
    }
    fetchNumbers()
  }

  // Filter + search
  const filtered = numbers.filter(n => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      n.website.toLowerCase().includes(q) ||
      n.location_slug.toLowerCase().includes(q) ||
      n.phone_number.toLowerCase().includes(q) ||
      (n.label ?? '').toLowerCase().includes(q)
    )
  })

  // Group by website, default numbers first
  const sorted = [...filtered].sort((a, b) => {
    if (a.type === 'default' && b.type !== 'default') return -1
    if (a.type !== 'default' && b.type === 'default') return 1
    return 0
  })
  const grouped = sorted.reduce<Record<string, PhoneNumber[]>>((acc, n) => {
    if (!acc[n.website]) acc[n.website] = []
    acc[n.website].push(n)
    return acc
  }, {})

  const websites = [...new Set(numbers.map(n => n.website))]
  const groupedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  // Group websites by company
  const companyGroups: Record<string, { name: string; websites: [string, PhoneNumber[]][] }> = {}
  groupedEntries.forEach(([website, rows]) => {
    const company = companyMap[website] ?? 'Unassigned'
    if (!companyGroups[company]) companyGroups[company] = { name: company, websites: [] }
    companyGroups[company].websites.push([website, rows])
  })
  const companyEntries = Object.entries(companyGroups).sort(([a], [b]) => {
    if (a === 'Unassigned') return 1
    if (b === 'Unassigned') return -1
    return a.localeCompare(b)
  })

  // Company folder view (no company selected and no website filter)
  if (!openCompany && !filterWebsite) {
    const companyStats = companies.map(c => {
      const domains = c.company_websites.map(w => w.domain)
      const companyNums = numbers.filter(n => domains.includes(n.website))
      return { ...c, phone_count: companyNums.length, active_count: companyNums.filter(n => n.is_active).length }
    })
    const searchQ = search.toLowerCase()
    const filteredCompanies = search
      ? companyStats.filter(c => c.name.toLowerCase().includes(searchQ) || c.company_websites.some(w => w.domain.toLowerCase().includes(searchQ)))
      : companyStats

    return (
      <div>
        <PageHeader
          title={t('page.phoneNumbers.title')}
          description={t('page.phoneNumbers.description')}
          actions={<ViewToggle value={viewMode} onChange={setViewMode} />}
        />
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies or numbers…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'} onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'} />
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map(c => (
              <Link key={c.id} href={`/phone-numbers?company=${encodeURIComponent(c.name)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px]" style={{ color: '#475569' }}>{c.phone_count} numbers</span>
                      {c.active_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{c.active_count} active</span>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {filteredCompanies.map((c, i) => (
              <Link key={c.id} href={`/phone-numbers?company=${encodeURIComponent(c.name)}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < filteredCompanies.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-sm font-semibold truncate flex-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs" style={{ color: '#64748b' }}>{c.phone_count} numbers</span>
                  {c.active_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{c.active_count} active</span>}
                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Filter to only show websites under the selected company, and inject empty
  // entries for websites that have no phone numbers yet (so the table can
  // prompt the user to add a default).
  const companyWebsiteDomains = openCompany
    ? new Set(companies.find(c => c.name === openCompany)?.company_websites.map(w => w.domain) ?? [])
    : null
  let visibleEntries = companyWebsiteDomains
    ? companyEntries.filter(([, { websites }]) => websites.some(([w]) => companyWebsiteDomains.has(w))).map(([name, data]) => [name, { ...data, websites: data.websites.filter(([w]) => companyWebsiteDomains.has(w)) }] as [string, typeof data])
    : companyEntries

  if (openCompany && companyWebsiteDomains) {
    const presentDomains = new Set(visibleEntries.flatMap(([, { websites }]) => websites.map(([w]) => w)))
    const missing = Array.from(companyWebsiteDomains).filter(d => !presentDomains.has(d))
    if (missing.length > 0) {
      const missingEntries: [string, PhoneNumber[]][] = missing.map(d => [d, [] as PhoneNumber[]])
      if (visibleEntries.length > 0) {
        const [firstName, firstData] = visibleEntries[0]
        visibleEntries = [[firstName, { ...firstData, websites: [...firstData.websites, ...missingEntries] }], ...visibleEntries.slice(1)]
      } else {
        visibleEntries = [[openCompany, { name: openCompany, websites: missingEntries }]]
      }
    }
  }

  return (
    <div>
      <PageHeader
        title={openCompany || t('page.phoneNumbers.title')}
        description={openCompany ? t('page.phoneNumbers.description.scoped') : t('page.phoneNumbers.description')}
      />

      {/* Search + website filter */}
      <div className="rounded-xl border p-4 sm:p-5 mb-5" style={{ borderColor: '#cbd5e1', background: '#f8fafc' }}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by domain, location, or number…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-offset-0"
              style={{ borderColor: '#cbd5e1', background: 'white', ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="sm:w-56 flex-shrink-0">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Website</label>
          <div className="relative">
            <select
              value={filterWebsite}
              onChange={e => setFilterWebsite(e.target.value)}
              className="cursor-pointer text-sm rounded-lg border outline-none focus:ring-2 focus:ring-offset-0 w-full"
              style={{
                appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                borderColor: '#cbd5e1', background: 'white', color: '#475569',
                paddingTop: '0.5rem', paddingBottom: '0.5rem', paddingLeft: '0.75rem', paddingRight: '2.25rem',
                ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)',
              }}
            >
              <option value="">All websites</option>
              {websites.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        </div>
      </div>

{/* Grouped by company then website */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : visibleEntries.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No phone numbers found. Open a website and use <span className="font-medium">Manage</span> to add numbers.
        </div>
      ) : (
        <div className="space-y-8">
          {visibleEntries.map(([companyName, { websites: companyWebsites }]) => (
            <div key={companyName}>
              {/* Company header — only show if not inside a company folder */}
              {!openCompany && (
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: companyName === 'Unassigned' ? '#94a3b8' : 'var(--primary)' }} strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h2 className="text-sm font-semibold" style={{ color: companyName === 'Unassigned' ? '#94a3b8' : 'var(--foreground)' }}>{companyName}</h2>
                </div>
              )}
              <div className="space-y-5">
          {companyWebsites.map(([website, rows]) => {
            const activeRows = rows.filter(r => r.is_active)
            const totalPct = activeRows.reduce((s, r) => s + (r.percentage ?? 100), 0)
            const pctOk = activeRows.length === 0 || totalPct === 100
            return (
            <section key={website} className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
              {/* Website header */}
              <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3" style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{website}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5">
                    {activeRows.length > 0 && (
                      <span className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap"
                        style={pctOk ? { background: '#dcfce7', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}>
                        {totalPct}%
                      </span>
                    )}
                    <span className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap" style={{ background: '#e2e8f0', color: '#475569' }}>
                      {rows.length} {rows.length === 1 ? 'number' : 'numbers'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/phone-numbers/edit?website=${encodeURIComponent(website)}${openCompany ? `&company=${encodeURIComponent(openCompany)}` : ''}`}
                      className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-medium px-2.5 rounded-full text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                      style={{ background: 'var(--primary)' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Manage
                    </Link>
                  </div>
                </div>
              </div>

              {/* Rows — professional table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <colgroup>
                    <col className="w-36" />
                    <col />
                    <col className="w-40" />
                    <col className="w-24" />
                    <col className="w-14" />
                    <col className="w-24" />
                    <col className="w-12" />
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Phone Number</th>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>WhatsApp Text</th>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Location</th>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Type</th>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-center" style={{ color: '#94a3b8' }}>%</th>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Status</th>
                      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-right" style={{ color: '#94a3b8' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-5 text-center">
                          <Link
                            href={`/phone-numbers/edit?website=${encodeURIComponent(website)}${openCompany ? `&company=${encodeURIComponent(openCompany)}` : ''}`}
                            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                            style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            Please add a default phone number
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          </Link>
                        </td>
                      </tr>
                    )}
                    {rows.map((row, i) => {
                      const isDefault = row.type === 'default'
                      return (
                        <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <td className="px-4 py-3 align-middle">
                            <span className="text-sm font-medium font-mono" style={{ color: 'var(--foreground)' }}>{row.phone_number}</span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className="text-xs truncate block" style={{ color: '#94a3b8' }}>{row.whatsapp_text || '—'}</span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className="text-xs" style={{ color: '#94a3b8' }}>{row.location_slug === 'all' ? 'All' : (MY_STATES.find(s => s.slug === row.location_slug)?.label ?? row.location_slug)}</span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {isDefault ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--primary)', color: 'white' }}>Default</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>{row.label ?? 'Custom'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle text-center">
                            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{row.percentage ?? 100}%</span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.is_active ? '#16a34a' : '#94a3b8' }} />
                              {row.is_active ? 'Active' : 'Off'}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle text-right">
                            {!isDefault && (
                              <button
                                onClick={() => deleteNumber(row.id)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:bg-[#ef4444] hover:border-white hover:text-white"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )})}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visibleEntries.length > 0 && (() => {
        const visibleNumbers = visibleEntries.flatMap(([, { websites }]) => websites.flatMap(([, rows]) => rows))
        const visibleWebsiteCount = visibleEntries.reduce((s, [, { websites }]) => s + websites.length, 0)
        return (
          <p className="mt-3 text-xs" style={{ color: '#475569' }}>
            {visibleNumbers.length} {visibleNumbers.length === 1 ? 'number' : 'numbers'} across {visibleWebsiteCount} {visibleWebsiteCount === 1 ? 'website' : 'websites'}
          </p>
        )
      })()}
    </div>
  )
}
