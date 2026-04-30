'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import WebsiteCard from './WebsiteCard'

interface SiteRow {
  domain: string
  leads_mode: string | null
  phone_count: number
  active_phone_count: number
  blog_count: number
  published_blog_count: number
}

const LEADS_MODE: Record<string, string> = {
  single: 'Single',
  rotation: 'Rotation',
  location: 'Location',
  hybrid: 'Hybrid',
}

type Activity = 'all' | 'active' | 'idle'
type ViewMode = 'grid' | 'list'

export default function CompanyWebsitesGrid({ domains }: { domains: string[] }) {
  const [all, setAll] = useState<SiteRow[]>([])
  const [search, setSearch] = useState('')
  const [activity, setActivity] = useState<Activity>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setAll(d) })
      .catch(() => {})
  }, [])

  const domainSet = useMemo(() => new Set(domains), [domains])
  const sites = useMemo(() => {
    // Use the API rows when available; fall back to a stub for any domain we
    // haven't fetched stats for yet so the card still renders.
    const byDomain = new Map(all.filter(s => domainSet.has(s.domain)).map(s => [s.domain, s]))
    return [...domains]
      .sort((a, b) => a.localeCompare(b))
      .map(d => byDomain.get(d) ?? { domain: d, leads_mode: null, phone_count: 0, active_phone_count: 0, blog_count: 0, published_blog_count: 0 } as SiteRow)
  }, [all, domains, domainSet])

  const filtered = sites.filter(s => {
    if (activity === 'active' && s.active_phone_count === 0 && s.published_blog_count === 0) return false
    if (activity === 'idle' && (s.active_phone_count > 0 || s.published_blog_count > 0)) return false
    if (search) {
      const q = search.toLowerCase()
      const friendly = s.domain.replace(/^www\./, '').split('.')[0].replace(/-/g, ' ').toLowerCase()
      if (!s.domain.toLowerCase().includes(q) && !friendly.includes(q)) return false
    }
    return true
  })

  const hasActiveFilters = !!(search || activity !== 'all')

  function clearFilters() { setSearch(''); setActivity('all') }

  return (
    <div>
      {/* Toolbar — every control is h-9 for consistency */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this company's websites…"
            className="w-full pl-9 pr-8 h-9 text-sm rounded-md border focus:outline-none focus:border-[var(--primary)] transition-colors"
            style={{ borderColor: '#e2e8f0', background: 'white' }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Activity segmented */}
        <div className="flex items-center rounded-md border h-9 overflow-hidden" style={{ borderColor: '#e2e8f0', background: 'white' }}>
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'active' as const, label: 'Active' },
            { key: 'idle' as const, label: 'Idle' },
          ]).map((opt, i) => {
            const active = activity === opt.key
            return (
              <button key={opt.key} onClick={() => setActivity(opt.key)}
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
          <span className="text-[11px]" style={{ color: '#94a3b8' }}>
            <strong style={{ color: '#475569' }}>{filtered.length}</strong> of {sites.length}
          </span>

          {/* View toggle */}
          <div className="flex items-center rounded-md border h-9 overflow-hidden" style={{ borderColor: '#e2e8f0', background: 'white' }}>
            <button onClick={() => setViewMode('grid')} className="w-9 h-full flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'white', color: viewMode === 'grid' ? 'white' : '#94a3b8' }}
              title="Grid view">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
            <button onClick={() => setViewMode('list')} className="w-9 h-full flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'list' ? 'var(--primary)' : 'white', color: viewMode === 'list' ? 'white' : '#94a3b8', borderLeft: '1px solid #e2e8f0' }}
              title="List view">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No websites match your filters</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-2 text-xs font-medium" style={{ color: 'var(--primary)' }}>Clear filters</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(s => <WebsiteCard key={s.domain} domain={s.domain} />)}
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((s, i) => <SiteListRow key={s.domain} site={s} isLast={i === filtered.length - 1} />)}
        </div>
      )}
    </div>
  )
}

function SiteListRow({ site, isLast }: { site: SiteRow; isLast: boolean }) {
  const friendlyName = site.domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  const isActive = site.active_phone_count > 0 || site.published_blog_count > 0
  const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null

  return (
    <Link
      href={`/websites?website=${encodeURIComponent(site.domain)}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
      style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isActive ? '#16a34a' : '#cbd5e1' }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{friendlyName}</p>
          <span className="text-xs truncate" style={{ color: '#94a3b8' }}>{site.domain}</span>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        {lm && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1e40af' }}>{lm}</span>}
        {site.active_phone_count > 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{site.active_phone_count} phones</span>}
        {site.published_blog_count > 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#e0f2fe', color: '#0369a1' }}>{site.published_blog_count} posts</span>}
      </div>
      <svg className="w-4 h-4 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: '#94a3b8' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
