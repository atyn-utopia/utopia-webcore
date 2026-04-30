'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'

interface Site {
  domain: string
  company_name: string | null
  leads_mode: string | null
  phone_count: number
  active_phone_count: number
  blog_count: number
  published_blog_count: number
}

const LEADS_MODE: Record<string, { label: string; color: string; bg: string }> = {
  single: { label: 'Single', color: '#475569', bg: '#f1f5f9' },
  rotation: { label: 'Rotation', color: '#0369a1', bg: '#e0f2fe' },
  location: { label: 'Location', color: '#7c3aed', bg: '#ede9fe' },
  hybrid: { label: 'Hybrid', color: '#b45309', bg: '#fef3c7' },
}

type SortKey = 'domain' | 'company_name' | 'phone_count' | 'blog_count'
type ActivityFilter = 'all' | 'active' | 'idle'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <svg className={`w-3.5 h-3.5 ml-1 ${active ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4" style={{ opacity: !active || dir === 'asc' ? 1 : 0.3 }} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 15l4 4 4-4" style={{ opacity: !active || dir === 'desc' ? 1 : 0.3 }} />
    </svg>
  )
}

function SelectArrow() {
  return <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
}

export default function AllWebsitesPage() {
  const { role } = useUser()
  const { t } = useLanguage()
  const isWriter = role === 'writer'
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterLeadsMode, setFilterLeadsMode] = useState('')
  const [filterActivity, setFilterActivity] = useState<ActivityFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('domain')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  useEffect(() => {
    fetch('/api/websites').then(r => r.json()).then(data => { if (Array.isArray(data)) setSites(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const companies = [...new Set(sites.map(s => s.company_name).filter(Boolean))] as string[]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = sites
    .filter(s => {
      if (filterCompany && s.company_name !== filterCompany) return false
      if (filterLeadsMode && s.leads_mode !== filterLeadsMode) return false
      if (filterActivity === 'active' && s.active_phone_count === 0 && s.published_blog_count === 0) return false
      if (filterActivity === 'idle' && (s.active_phone_count > 0 || s.published_blog_count > 0)) return false
      if (search) { const q = search.toLowerCase(); return s.domain.toLowerCase().includes(q) || (s.company_name ?? '').toLowerCase().includes(q) }
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  const totalActivePhones = filtered.reduce((s, x) => s + x.active_phone_count, 0)
  const totalPublishedPosts = filtered.reduce((s, x) => s + x.published_blog_count, 0)
  const hasActiveFilters = !!(search || filterCompany || filterLeadsMode || filterActivity !== 'all')

  function clearFilters() {
    setSearch(''); setFilterCompany(''); setFilterLeadsMode(''); setFilterActivity('all')
  }

  function Th({ label, col, align }: { label: string; col?: SortKey; align?: 'center' }) {
    const base = `px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left${align === 'center' ? ' !text-center' : ''}`
    if (!col) return <th className={base} style={{ color: '#94a3b8' }}>{label}</th>
    return (
      <th className={`${base} cursor-pointer select-none hover:text-[var(--primary)] transition-colors`} style={{ color: '#94a3b8' }} onClick={() => toggleSort(col)}>
        <span className="w-full inline-flex items-center justify-between gap-1">{label}<SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} /></span>
      </th>
    )
  }

  return (
    <div>
      <PageHeader title={t('page.allWebsites.title')} description={`${sites.length} ${t('page.allWebsites.description')}`} />

      {/* Toolbar — search + filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by domain or company…"
            className="w-full pl-9 pr-8 h-9 text-sm rounded-md border focus:outline-none focus:border-[var(--primary)] transition-colors"
            style={{ borderColor: '#e2e8f0', background: 'white' }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Company filter */}
        <div className="relative">
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className="h-9 pl-3 pr-9 text-sm rounded-md border focus:outline-none focus:border-[var(--primary)] cursor-pointer"
            style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '150px', color: filterCompany ? 'var(--foreground)' : '#94a3b8' }}>
            <option value="">All companies</option>
            {companies.sort().map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <SelectArrow />
        </div>

        {/* Leads mode filter — admin/designer only since writers don't see phones */}
        {!isWriter && (
          <div className="relative">
            <select value={filterLeadsMode} onChange={e => setFilterLeadsMode(e.target.value)}
              className="h-9 pl-3 pr-9 text-sm rounded-md border focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '150px', color: filterLeadsMode ? 'var(--foreground)' : '#94a3b8' }}>
              <option value="">All leads modes</option>
              {Object.entries(LEADS_MODE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <SelectArrow />
          </div>
        )}

        {/* Activity segmented control */}
        <div className="flex items-center rounded-md border h-9 overflow-hidden" style={{ borderColor: '#e2e8f0', background: 'white' }}>
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'active' as const, label: 'Active' },
            { key: 'idle' as const, label: 'Idle' },
          ]).map((opt, i) => {
            const active = filterActivity === opt.key
            return (
              <button key={opt.key} onClick={() => setFilterActivity(opt.key)}
                className="px-3 h-full text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--primary)' : 'white',
                  color: active ? 'white' : '#64748b',
                  borderLeft: i > 0 ? '1px solid #e2e8f0' : undefined,
                }}>
                {opt.label}
              </button>
            )
          })}
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters}
            className="text-xs font-medium px-3 h-9 rounded-md transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748b'}
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Summary chip */}
          {!loading && (
            <span className="text-[11px]" style={{ color: '#94a3b8' }}>
              <strong style={{ color: '#475569' }}>{filtered.length}</strong> of {sites.length}
              {!isWriter && filtered.length > 0 && (
                <> · <strong style={{ color: '#475569' }}>{totalActivePhones}</strong> active phones · <strong style={{ color: '#475569' }}>{totalPublishedPosts}</strong> live posts</>
              )}
            </span>
          )}

          {/* View toggle */}
          <div className="flex items-center rounded-md border h-9 overflow-hidden" style={{ borderColor: '#e2e8f0', background: 'white' }}>
            <button onClick={() => setViewMode('list')} className="w-9 h-full flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'list' ? 'var(--primary)' : 'white', color: viewMode === 'list' ? 'white' : '#94a3b8' }}
              title="List view">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <button onClick={() => setViewMode('grid')} className="w-9 h-full flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'white', color: viewMode === 'grid' ? 'white' : '#94a3b8', borderLeft: '1px solid #e2e8f0' }}
              title="Grid view">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border bg-white" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No websites match your filters</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-2 text-xs font-medium" style={{ color: 'var(--primary)' }}>Clear filters</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(site => <SiteGridCard key={site.domain} site={site} isWriter={isWriter} />)}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="sticky top-0 z-10" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <Th label="Website" col="domain" />
                  <Th label="Company" col="company_name" />
                  {!isWriter && <Th label="Leads Mode" />}
                  {!isWriter && <Th label="Phones" col="phone_count" />}
                  {!isWriter && <Th label="Active" />}
                  <Th label="Blog" col="blog_count" />
                  <Th label="Published" />
                  <Th label="" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((site, i) => {
                  const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null
                  return (
                    <tr key={site.domain} className="hover:bg-[#f8fafc] transition-colors relative hover:z-20" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td className="px-4 py-3.5 align-middle">
                        <Link href={`/websites?website=${encodeURIComponent(site.domain)}`} className="flex items-center gap-2 hover:text-[var(--primary)]">
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path d="M12 3c0 0 3 4 3 9s-3 9-3 9"/><path d="M3 12h18"/></svg>
                          </div>
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 align-middle"><span className="text-xs" style={{ color: site.company_name ? '#475569' : '#cbd5e1' }}>{site.company_name ?? '—'}</span></td>
                      {!isWriter && <td className="px-4 py-3.5 align-middle">{lm ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>}
                      {!isWriter && <td className="px-4 py-3.5 align-middle"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span></td>}
                      {!isWriter && <td className="px-4 py-3.5 align-middle"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.active_phone_count}</span></td>}
                      <td className="px-4 py-3.5 align-middle"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span></td>
                      <td className="px-4 py-3.5 align-middle"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.published_blog_count}</span></td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-1.5 justify-end">
                          <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" title="Open website"
                            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                          {!isWriter && (
                            <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`} title="Phone numbers"
                              className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </Link>
                          )}
                          <Link href={`/blog?website=${encodeURIComponent(site.domain)}`} title="Blog posts"
                            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SiteGridCard({ site, isWriter }: { site: Site; isWriter: boolean }) {
  const siteUrl = `https://${site.domain}`
  const thumbUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=400`
  const friendlyName = site.domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  const isActive = site.active_phone_count > 0 || site.published_blog_count > 0
  const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null

  return (
    <Link href={`/websites?website=${encodeURIComponent(site.domain)}`} className="group rounded-xl border bg-white overflow-hidden transition-all hover:shadow-md" style={{ borderColor: '#e2e8f0' }}>
      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: '#f8fafc' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl} alt={site.domain} loading="lazy" className="w-full h-full object-cover object-top" />
        <div className="absolute top-0 left-3">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md"
            style={{ background: isActive ? '#16a34a' : '#94a3b8', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
            {isActive ? 'Active' : 'Idle'}
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--foreground)' }}>{friendlyName}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: '#94a3b8' }}>{site.domain}</p>
        {site.company_name && <p className="text-[10px] mt-1 truncate" style={{ color: '#64748b' }}>{site.company_name}</p>}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {!isWriter && lm && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span>}
          {!isWriter && site.active_phone_count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>{site.active_phone_count} phones</span>}
          {site.published_blog_count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#e0f2fe', color: '#0369a1' }}>{site.published_blog_count} posts</span>}
        </div>
      </div>
    </Link>
  )
}
