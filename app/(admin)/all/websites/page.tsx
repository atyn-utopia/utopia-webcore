'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'

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

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="inline-flex flex-col ml-1 -space-y-0.5 align-middle">
      <svg className={`w-2.5 h-2.5 ${active && dir === 'asc' ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 8 5"><path d="M4 0L8 5H0z"/></svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 8 5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  )
}

function SelectArrow() {
  return <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
}

export default function AllWebsitesPage() {
  const { role } = useUser()
  const isWriter = role === 'writer'
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('domain')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
      if (search) { const q = search.toLowerCase(); return s.domain.toLowerCase().includes(q) || (s.company_name ?? '').toLowerCase().includes(q) }
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  function Th({ label, col }: { label: string; col?: SortKey }) {
    const base = "px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap"
    if (!col) return <th className={base} style={{ color: '#94a3b8' }}>{label}</th>
    return (
      <th className={`${base} cursor-pointer select-none hover:text-[var(--primary)] transition-colors`} style={{ color: '#94a3b8' }} onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center justify-center gap-1">{label}<SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} /></span>
      </th>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Websites</h1>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{sites.length} websites registered</p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <div className="flex-1 min-w-48 max-w-sm">
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search websites or companies…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0', background: 'white' }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Company</label>
          <div className="relative">
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer pr-9" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '160px', color: '#64748b' }}>
              <option value="">All companies</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <SelectArrow />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>No websites found</div>
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
                    <tr key={site.domain} className="hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path d="M12 3c0 0 3 4 3 9s-3 9-3 9"/><path d="M3 12h18"/></svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-center"><span className="text-xs" style={{ color: site.company_name ? '#475569' : '#cbd5e1' }}>{site.company_name ?? '—'}</span></td>
                      {!isWriter && <td className="px-4 py-3.5 align-middle text-center">{lm ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>}
                      {!isWriter && <td className="px-4 py-3.5 align-middle text-center"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span></td>}
                      {!isWriter && <td className="px-4 py-3.5 align-middle text-center"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.active_phone_count}</span></td>}
                      <td className="px-4 py-3.5 align-middle text-center"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span></td>
                      <td className="px-4 py-3.5 align-middle text-center"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.published_blog_count}</span></td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-1.5 justify-end">
                          <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer"
                            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }} title="Open website">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                          {!isWriter && (
                            <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`}
                              className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }} title="Phone numbers">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </Link>
                          )}
                          <Link href={`/blog?website=${encodeURIComponent(site.domain)}`}
                            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }} title="Blog posts">
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
      <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{filtered.length} of {sites.length} websites</p>
    </div>
  )
}
