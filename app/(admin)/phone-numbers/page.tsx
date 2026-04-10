'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'

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
  const { selectedWebsite } = useWebsite()
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [companies, setCompanies] = useState<CompanyInfo[]>([])
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({}) // domain → company name
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterWebsite, setFilterWebsite] = useState(() => searchParams.get('website') ?? '')
  const [editingWebsite, setEditingWebsite] = useState<string | null>(null)
  const [editRows, setEditRows] = useState<Record<string, Partial<PhoneNumber>>>({})
  const [error, setError] = useState('')

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
    if (!confirm('Delete this phone number?')) return
    await fetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
    fetchNumbers()
  }

  function startEditGroup(website: string, rows: PhoneNumber[]) {
    const map: Record<string, Partial<PhoneNumber>> = {}
    rows.forEach(r => {
      map[r.id] = { phone_number: r.phone_number, whatsapp_text: r.whatsapp_text, percentage: r.percentage ?? 100, label: r.label ?? '', is_active: r.is_active, location_slug: r.location_slug }
    })
    setEditRows(map)
    setEditingWebsite(website)
    setError('')
  }

  function updateEditRow(id: string, updates: Partial<PhoneNumber>, allRows?: PhoneNumber[]) {
    setEditRows(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...updates } }
      // Auto-redistribute if percentage changed
      if (updates.percentage !== undefined && allRows) {
        const activeIds = allRows.filter(r => next[r.id]?.is_active !== false).map(r => r.id)
        const otherIds = activeIds.filter(oid => oid !== id)
        if (otherIds.length > 0) {
          const remaining = 100 - (updates.percentage as number)
          const base = Math.floor(remaining / otherIds.length)
          const rem = remaining - base * otherIds.length
          otherIds.forEach((oid, i) => {
            next[oid] = { ...next[oid], percentage: Math.max(0, base + (i < rem ? 1 : 0)) }
          })
        }
      }
      return next
    })
  }

  function distributeEvenly(rows: PhoneNumber[]) {
    const activeIds = rows.filter(r => editRows[r.id]?.is_active !== false).map(r => r.id)
    if (activeIds.length === 0) return
    const base = Math.floor(100 / activeIds.length)
    const remainder = 100 - base * activeIds.length
    setEditRows(prev => {
      const next = { ...prev }
      activeIds.forEach((id, i) => {
        next[id] = { ...next[id], percentage: base + (i < remainder ? 1 : 0) }
      })
      return next
    })
  }

  async function saveAllEdits() {
    setError('')
    for (const [id, vals] of Object.entries(editRows)) {
      if (!vals.phone_number) { setError('All phone numbers are required'); return }
      const res = await fetch(`/api/phone-numbers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: vals.phone_number,
          whatsapp_text: vals.whatsapp_text,
          percentage: vals.percentage ?? 100,
          label: vals.label || null,
          is_active: vals.is_active,
          location_slug: vals.location_slug,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
    }
    setEditingWebsite(null)
    setEditRows({})
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
          actions={
            <Link href="/phone-numbers/new" className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity" style={{ background: 'var(--primary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('button.addNumber')}
            </Link>
          }
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
        ) : (
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
        )}
      </div>
    )
  }

  // Filter to only show websites under the selected company
  const companyWebsiteDomains = openCompany
    ? new Set(companies.find(c => c.name === openCompany)?.company_websites.map(w => w.domain) ?? [])
    : null
  const visibleEntries = companyWebsiteDomains
    ? companyEntries.filter(([, { websites }]) => websites.some(([w]) => companyWebsiteDomains.has(w))).map(([name, data]) => [name, { ...data, websites: data.websites.filter(([w]) => companyWebsiteDomains.has(w)) }] as [string, typeof data])
    : companyEntries

  return (
    <div>
      <PageHeader
        title={openCompany || t('page.phoneNumbers.title')}
        description={openCompany ? t('page.phoneNumbers.description.scoped') : t('page.phoneNumbers.description')}
        actions={
          <Link
            href={`/phone-numbers/new${openCompany ? `?company=${encodeURIComponent(openCompany)}` : ''}`}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('button.addNumber')}
          </Link>
        }
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

      {error && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
      )}

      {/* Grouped by company then website */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : visibleEntries.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No phone numbers found.{' '}
          <Link href="/phone-numbers/new" className="hover:underline" style={{ color: 'var(--primary)' }}>Add one</Link>
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
            const isGroupEditing = editingWebsite === website
            const activeRows = isGroupEditing
              ? rows.filter(r => editRows[r.id]?.is_active !== false)
              : rows.filter(r => r.is_active)
            const totalPct = isGroupEditing
              ? activeRows.reduce((s, r) => s + ((editRows[r.id]?.percentage as number) ?? r.percentage ?? 100), 0)
              : activeRows.reduce((s, r) => s + (r.percentage ?? 100), 0)
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
                    {!isGroupEditing && (
                      <button
                        onClick={() => startEditGroup(website, rows)}
                        className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-medium px-2.5 rounded-full transition-colors hover:bg-slate-200 whitespace-nowrap"
                        style={{ background: '#e2e8f0', color: '#475569' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </button>
                    )}
                    <Link
                      href={`/phone-numbers/new?website=${encodeURIComponent(website)}${openCompany ? `&company=${encodeURIComponent(openCompany)}` : ''}`}
                      className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-medium px-2.5 rounded-full text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                      style={{ background: 'var(--primary)' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </Link>
                  </div>
                </div>
              </div>

              {/* Edit mode: percentage distribution bar */}
              {isGroupEditing && (
                <div className="px-4 sm:px-5 py-3" style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium" style={{ color: '#475569' }}>Lead Distribution</span>
                    <button
                      onClick={() => distributeEvenly(rows)}
                      className="text-[10px] font-medium px-2 py-1 rounded-md transition-colors hover:bg-slate-200"
                      style={{ color: 'var(--primary)', background: '#e2e8f0' }}
                    >
                      Distribute equally
                    </button>
                  </div>
                  {/* Visual bar */}
                  <div className="flex h-3 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                    {rows.map(row => {
                      const val = (editRows[row.id]?.percentage as number) ?? row.percentage ?? 100
                      const active = editRows[row.id]?.is_active !== false
                      if (!active || val <= 0) return null
                      const colors = ['#1e3a5f', '#2979d6', '#475569', '#64748b', '#94a3b8', '#cbd5e1']
                      const idx = rows.indexOf(row) % colors.length
                      return <div key={row.id} style={{ width: `${val}%`, background: colors[idx] }} title={`${row.phone_number}: ${val}%`} />
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {rows.map((row, idx) => {
                      const val = (editRows[row.id]?.percentage as number) ?? row.percentage ?? 100
                      const active = editRows[row.id]?.is_active !== false
                      const colors = ['#1e3a5f', '#2979d6', '#475569', '#64748b', '#94a3b8', '#cbd5e1']
                      return (
                        <div key={row.id} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? colors[idx % colors.length] : '#e2e8f0' }} />
                          <span className="text-[10px]" style={{ color: active ? '#475569' : '#94a3b8' }}>{row.phone_number.slice(-4)}: {val}%</span>
                        </div>
                      )
                    })}
                  </div>
                  {!pctOk && (
                    <p className="text-[10px] mt-2" style={{ color: '#dc2626' }}>Total is {totalPct}% — must equal 100%</p>
                  )}
                </div>
              )}

              {/* Rows */}
              <div>
                {rows.map((row, i) => {
                  const isDefault = row.type === 'default'
                  const vals = editRows[row.id]
                  return (
                    <div key={row.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #cbd5e1' : 'none' }}>
                      {isGroupEditing ? (() => {
                        const existingTexts = [...new Set(rows.map(r => r.whatsapp_text).filter(Boolean).filter(t => t !== (vals?.whatsapp_text ?? '')))]
                        return (
                        <div className="px-4 sm:px-5 py-3" style={{ background: 'white' }}>
                          {/* Badge */}
                          <div className="flex items-center gap-1.5 mb-2">
                            {isDefault ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--primary)', color: 'white' }}>Default</span>
                            ) : row.label ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>{row.label}</span>
                            ) : null}
                          </div>
                          {/* Desktop: all in one row / Mobile: stacked */}
                          <div className="hidden sm:flex items-end gap-2">
                            <div className="w-40 flex-shrink-0">
                              <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>Phone</label>
                              <input className="px-2.5 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors font-mono" style={{ borderColor: '#e2e8f0' }}
                                value={vals?.phone_number ?? ''} onChange={e => updateEditRow(row.id, { phone_number: e.target.value })} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>WhatsApp Text</label>
                              <input className="px-2.5 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors" style={{ borderColor: '#e2e8f0' }}
                                value={vals?.whatsapp_text ?? ''} onChange={e => updateEditRow(row.id, { whatsapp_text: e.target.value })} />
                              {existingTexts.length > 0 && !(vals?.whatsapp_text) && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>Suggestions:</span>
                                  {existingTexts.slice(0, 3).map((text, ti) => (
                                    <button key={ti} type="button" onClick={() => updateEditRow(row.id, { whatsapp_text: text })}
                                      className="text-[10px] px-2.5 py-1 rounded-md truncate max-w-[180px] transition-all cursor-pointer"
                                      style={{ background: '#f1f5f9', color: 'var(--primary)' }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)' }}>
                                      {text}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {!isDefault && (
                              <div className="w-28 flex-shrink-0">
                                <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>Location</label>
                                <select className="px-2 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"
                                  style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E") no-repeat right 6px center', paddingRight: '1.5rem' }}
                                  value={vals?.location_slug ?? 'all'} onChange={e => updateEditRow(row.id, { location_slug: e.target.value })}>
                                  {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                                </select>
                              </div>
                            )}
                            <div className="w-14 flex-shrink-0">
                              <label className="text-[10px] mb-1 block text-center" style={{ color: '#94a3b8' }}>%</label>
                              <input type="number" min="0" max="100" className="px-1 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors text-center" style={{ borderColor: '#e2e8f0' }}
                                value={vals?.percentage ?? 100} onChange={e => updateEditRow(row.id, { percentage: parseInt(e.target.value) || 0 }, rows)} />
                            </div>
                            <div className="flex-shrink-0">
                              <label className="text-[10px] mb-1 block text-center" style={{ color: '#94a3b8' }}>Active</label>
                              <button onClick={() => updateEditRow(row.id, { is_active: !vals?.is_active }, rows)} className="relative w-9 h-5 rounded-full transition-colors" style={{ background: vals?.is_active ? '#16a34a' : '#cbd5e1' }}>
                                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ left: vals?.is_active ? '18px' : '2px' }} />
                              </button>
                            </div>
                          </div>
                          {/* Mobile: stacked rows */}
                          <div className="sm:hidden space-y-2">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>Phone</label>
                                <input className="px-2.5 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors font-mono" style={{ borderColor: '#e2e8f0' }}
                                  value={vals?.phone_number ?? ''} onChange={e => updateEditRow(row.id, { phone_number: e.target.value })} />
                              </div>
                              {!isDefault && (
                                <div className="w-28 flex-shrink-0">
                                  <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>Location</label>
                                  <select className="px-2 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"
                                    style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E") no-repeat right 6px center', paddingRight: '1.5rem' }}
                                    value={vals?.location_slug ?? 'all'} onChange={e => updateEditRow(row.id, { location_slug: e.target.value })}>
                                    {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                                  </select>
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>WhatsApp Text</label>
                              <input className="px-2.5 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-[var(--primary)] transition-colors" style={{ borderColor: '#e2e8f0' }}
                                value={vals?.whatsapp_text ?? ''} onChange={e => updateEditRow(row.id, { whatsapp_text: e.target.value })} />
                              {/* Suggestions below WA text — mobile only */}
                              {existingTexts.length > 0 && !(vals?.whatsapp_text) && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>Suggestions:</span>
                                  {existingTexts.slice(0, 3).map((text, ti) => (
                                    <button key={ti} type="button" onClick={() => updateEditRow(row.id, { whatsapp_text: text })}
                                      className="text-[10px] px-2.5 py-1 rounded-md truncate max-w-[180px] transition-all cursor-pointer"
                                      style={{ background: '#f1f5f9', color: 'var(--primary)' }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)' }}>
                                      {text}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-end gap-3">
                              <div>
                                <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>%</label>
                                <input type="number" min="0" max="100" className="px-2 py-1.5 border rounded-lg text-xs w-14 outline-none focus:border-[var(--primary)] transition-colors text-center" style={{ borderColor: '#e2e8f0' }}
                                  value={vals?.percentage ?? 100} onChange={e => updateEditRow(row.id, { percentage: parseInt(e.target.value) || 0 }, rows)} />
                              </div>
                              <div>
                                <label className="text-[10px] mb-1 block" style={{ color: '#94a3b8' }}>Active</label>
                                <button onClick={() => updateEditRow(row.id, { is_active: !vals?.is_active }, rows)} className="relative w-9 h-5 rounded-full transition-colors" style={{ background: vals?.is_active ? '#16a34a' : '#cbd5e1' }}>
                                  <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ left: vals?.is_active ? '18px' : '2px' }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )})() : (
                        /* View row */
                        <div className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-[#f1f5f9] transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs sm:text-sm font-medium font-mono truncate" style={{ color: 'var(--foreground)' }}>{row.phone_number}</span>
                              {isDefault ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-bold" style={{ background: 'var(--primary)', color: 'white' }}>Default</span>
                              ) : row.label ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#f1f5f9', color: '#475569' }}>{row.label}</span>
                              ) : null}
                            </div>
                            {row.whatsapp_text && <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: '#475569' }}>{row.whatsapp_text}</p>}
                            {!isDefault && row.location_slug !== 'all' && (
                              <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>{MY_STATES.find(s => s.slug === row.location_slug)?.label ?? row.location_slug}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-semibold" style={{ color: 'var(--foreground)' }}>{row.percentage ?? 100}%</span>
                              <div className="w-8 h-1 rounded-full" style={{ background: '#e2e8f0' }}>
                                <div className="h-full rounded-full" style={{ width: `${row.percentage ?? 100}%`, background: row.is_active ? 'var(--primary)' : '#94a3b8' }} />
                              </div>
                            </div>
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={row.is_active ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.is_active ? '#16a34a' : '#94a3b8' }} />
                              {row.is_active ? 'Active' : 'Off'}
                            </span>
                            {!isDefault ? (
                              <button
                                onClick={() => deleteNumber(row.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md border transition-colors hover:bg-red-500 hover:border-red-500 hover:text-white"
                                style={{ borderColor: '#e2e8f0', color: '#cbd5e1' }}
                                title="Delete"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            ) : (
                              <div className="w-6 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Edit mode footer */}
              {isGroupEditing && (
                <div className="px-4 sm:px-5 py-3 flex items-center justify-end gap-2" style={{ background: '#f8fafc', borderTop: '1px solid #cbd5e1' }}>
                  <button
                    onClick={() => { setEditingWebsite(null); setEditRows({}) }}
                    className="px-4 py-2 text-xs rounded-lg border transition-colors hover:bg-white"
                    style={{ borderColor: '#cbd5e1', color: '#475569' }}
                  >Cancel</button>
                  <button
                    onClick={saveAllEdits}
                    disabled={!pctOk}
                    className="px-4 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                  >Save All Changes</button>
                </div>
              )}
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
