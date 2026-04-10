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
    <svg className={`w-3 h-3 inline-block ml-0.5 ${active ? '' : 'opacity-30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  )
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
    fetch('/api/websites').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSites(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const companies = [...new Set(sites.map(s => s.company_name).filter(Boolean))] as string[]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = sites
    .filter(s => {
      if (filterCompany && s.company_name !== filterCompany) return false
      if (search) {
        const q = search.toLowerCase()
        return s.domain.toLowerCase().includes(q) || (s.company_name ?? '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  function ThSort({ label, col }: { label: string; col: SortKey }) {
    return (
      <th className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold cursor-pointer select-none hover:text-[var(--primary)] transition-colors"
        style={{ color: '#475569' }} onClick={() => toggleSort(col)}>
        {label} <SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} />
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
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="flex-1 min-w-48 max-w-sm relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0' }} />
        </div>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2rem', background: 'white' }}>
          <option value="">All companies</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || filterCompany) && (
          <button onClick={() => { setSearch(''); setFilterCompany('') }} className="px-3 py-2 text-xs rounded-lg border hover:bg-slate-50 transition-colors" style={{ borderColor: '#e2e8f0', color: '#475569' }}>Clear</button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <ThSort label="Website" col="domain" />
                  <ThSort label="Company" col="company_name" />
                  {!isWriter && <th className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Leads Mode</th>}
                  {!isWriter && <ThSort label="Phones" col="phone_count" />}
                  {!isWriter && <th className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Active</th>}
                  <ThSort label="Blog Posts" col="blog_count" />
                  <th className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Published</th>
                  <th className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((site, i) => {
                  const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null
                  return (
                    <tr key={site.domain} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}><circle cx="12" cy="12" r="9" strokeWidth="1.5"/><path strokeWidth="1.5" d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path strokeWidth="1.5" d="M12 3c0 0 3 4 3 9s-3 9-3 9"/><path strokeWidth="1.5" d="M3 12h18"/></svg>
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                            <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>https://{site.domain} ↗</a>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle text-center"><span className="text-xs" style={{ color: site.company_name ? '#475569' : '#cbd5e1' }}>{site.company_name ?? '—'}</span></td>
                      {!isWriter && <td className="px-5 py-4 align-middle text-center">{lm ? <span className="text-[10px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span> : <span className="text-[10px]" style={{ color: '#cbd5e1' }}>—</span>}</td>}
                      {!isWriter && <td className="px-5 py-4 align-middle text-center"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span></td>}
                      {!isWriter && <td className="px-5 py-4 align-middle text-center"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#64748b' }}>{site.active_phone_count} active</span></td>}
                      <td className="px-5 py-4 align-middle text-center"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span></td>
                      <td className="px-5 py-4 align-middle text-center"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#64748b' }}>{site.published_blog_count} published</span></td>
                      <td className="px-5 py-4 align-middle text-center">
                        <div className="flex items-center gap-2 justify-center">
                          {!isWriter && <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`} className="text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#475569' }}>Phones ↗</Link>}
                          <Link href={`/blog?website=${encodeURIComponent(site.domain)}`} className="text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#475569' }}>Blog ↗</Link>
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
