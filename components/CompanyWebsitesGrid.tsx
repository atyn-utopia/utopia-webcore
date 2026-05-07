'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import WebsiteCard from './WebsiteCard'

import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid'
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

const ACTIVITY_LABEL: Record<Activity, string> = { all: 'All sites', active: 'Active sites', idle: 'Idle sites' }

export default function CompanyWebsitesGrid({ domains, initialSites }: { domains: string[]; initialSites?: SiteRow[] }) {
  const [all, setAll] = useState<SiteRow[]>(initialSites ?? [])
  const [search, setSearch] = useState('')
  const [activity, setActivity] = useState<Activity>('all')
  const [leadsMode, setLeadsMode] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const [scopeOpen, setScopeOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const scopeRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Server-side prefetch covers leads_mode + counts for the first paint, but
  // counts go stale fast (a phone toggled active on another tab won't show up
  // otherwise). Always run a background refresh; if it fails we keep whatever
  // initialSites gave us.
  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setAll(d) })
      .catch(() => {})
  }, [initialSites])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const domainSet = useMemo(() => new Set(domains), [domains])
  const sites = useMemo(() => {
    const byDomain = new Map(all.filter(s => domainSet.has(s.domain)).map(s => [s.domain, s]))
    return [...domains]
      .sort((a, b) => a.localeCompare(b))
      .map(d => byDomain.get(d) ?? { domain: d, leads_mode: null, phone_count: 0, active_phone_count: 0, blog_count: 0, published_blog_count: 0 } as SiteRow)
  }, [all, domains, domainSet])

  const scoped = sites.filter(s => {
    if (activity === 'active' && s.active_phone_count === 0 && s.published_blog_count === 0) return false
    if (activity === 'idle' && (s.active_phone_count > 0 || s.published_blog_count > 0)) return false
    if (leadsMode && s.leads_mode !== leadsMode) return false
    return true
  })

  const filtered = scoped.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    const friendly = s.domain.replace(/^www\./, '').split('.')[0].replace(/-/g, ' ').toLowerCase()
    return s.domain.toLowerCase().includes(q) || friendly.includes(q)
  })

  const filterCount = (activity !== 'all' ? 1 : 0) + (leadsMode ? 1 : 0)
  const hasActiveFilters = filterCount > 0 || !!search

  function clearFilters() { setSearch(''); setActivity('all'); setLeadsMode('') }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      {/* Toolbar. Wix-style pill bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
        {/* Scope dropdown. "All sites (N) ▾" */}
        <div className="relative" ref={scopeRef}>
          <button
            onClick={() => setScopeOpen(v => !v)}
            className="inline-flex items-center gap-2 h-9 pl-4 pr-3 rounded-full text-sm font-medium transition-colors"
            style={{ background: 'white', border: '1px solid #e2e8f0', color: '#94a3b8' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'}
          >
            <span>{ACTIVITY_LABEL[activity]}</span>
            <span className="text-xs" style={{ color: '#cbd5e1' }}>({scoped.length})</span>
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
          </button>
          {scopeOpen && (
            <div className="absolute top-11 left-0 w-44 rounded-md shadow-lg z-30 py-1" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
              {(['all', 'active', 'idle'] as Activity[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => { setActivity(opt); setScopeOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                  style={{ color: activity === opt ? 'var(--primary)' : '#475569', fontWeight: activity === opt ? 600 : 500 }}
                >
                  {ACTIVITY_LABEL[opt]}
                  {activity === opt && <CheckIcon className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium px-2 h-9 transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Filter pill (popover) */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors"
              style={{
                background: filterCount > 0 ? '#eff6ff' : 'white',
                border: `1px solid ${filterCount > 0 ? '#bfdbfe' : '#e2e8f0'}`,
                color: filterCount > 0 ? 'var(--primary)' : '#94a3b8',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Filter
              {filterCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white tabular-nums" style={{ background: 'var(--primary)' }}>
                  {filterCount}
                </span>
              )}
            </button>
            {filterOpen && (
              <div className="absolute top-11 right-0 w-64 rounded-md shadow-lg z-30 p-3" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Leads mode</p>
                <div className="space-y-1">
                  <button
                    onClick={() => setLeadsMode('')}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs hover:bg-slate-50 transition-colors"
                    style={{ color: !leadsMode ? 'var(--primary)' : '#475569', fontWeight: !leadsMode ? 600 : 500 }}
                  >
                    All
                    {!leadsMode && <CheckIcon className="w-3.5 h-3.5" />}
                  </button>
                  {Object.entries(LEADS_MODE).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setLeadsMode(k)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs hover:bg-slate-50 transition-colors"
                      style={{ color: leadsMode === k ? 'var(--primary)' : '#475569', fontWeight: leadsMode === k ? 600 : 500 }}
                    >
                      {label}
                      {leadsMode === k && <CheckIcon className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
                {(filterCount > 0) && (
                  <div className="pt-2 mt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <button
                      onClick={() => { setLeadsMode(''); setActivity('all'); setFilterOpen(false) }}
                      className="text-xs font-medium"
                      style={{ color: 'var(--primary)' }}
                    >
                      Reset all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 w-44 lg:w-56 pl-9 pr-8 rounded-full text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
              style={{ border: '1px solid #e2e8f0', background: 'white', color: 'var(--foreground)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <XMarkIcon className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

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

      {/* Body */}
      <div className="p-4">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No websites match your filters</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs font-medium" style={{ color: 'var(--primary)' }}>Clear filters</button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map(s => (
              <WebsiteCard
                key={s.domain}
                domain={s.domain}
                leadsMode={s.leads_mode}
                activePhones={s.active_phone_count}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden" style={{ borderColor: '#f1f5f9' }}>
            {filtered.map((s, i) => <SiteListRow key={s.domain} site={s} isLast={i === filtered.length - 1} />)}
          </div>
        )}

        {/* Footer summary. Total counts across the visible/filtered set */}
        {filtered.length > 0 && (() => {
          const totalActivePhones = filtered.reduce((s, x) => s + x.active_phone_count, 0)
          const totalPublishedPosts = filtered.reduce((s, x) => s + x.published_blog_count, 0)
          const bits: string[] = []
          bits.push(`${filtered.length} website${filtered.length === 1 ? '' : 's'}`)
          if (totalActivePhones > 0) bits.push(`${totalActivePhones} active phone${totalActivePhones === 1 ? '' : 's'}`)
          if (totalPublishedPosts > 0) bits.push(`${totalPublishedPosts} published post${totalPublishedPosts === 1 ? '' : 's'}`)
          return <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{bits.join(' · ')}</p>
        })()}
      </div>
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
      <ChevronRightIcon className="w-4 h-4 flex-shrink-0 opacity-50" />
    </Link>
  )
}
