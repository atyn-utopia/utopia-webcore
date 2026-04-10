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

export default function AllWebsitesPage() {
  const { role } = useUser()
  const isWriter = role === 'writer'
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/websites').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSites(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = search
    ? sites.filter(s => s.domain.toLowerCase().includes(search.toLowerCase()) || (s.company_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : sites

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Websites</h1>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{sites.length} websites registered</p>
      </div>

      <div className="mb-5 relative max-w-sm">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search websites or companies…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0' }} />
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {['Website', 'Company', ...(isWriter ? [] : ['Leads Mode', 'Phone Numbers', 'Active']), 'Blog Posts', 'Published', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                  ))}
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
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                              <circle cx="12" cy="12" r="9" strokeWidth="1.5"/><path strokeWidth="1.5" d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path strokeWidth="1.5" d="M12 3c0 0 3 4 3 9s-3 9-3 9"/><path strokeWidth="1.5" d="M3 12h18"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                            <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>https://{site.domain} ↗</a>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle text-center">
                        <span className="text-xs" style={{ color: site.company_name ? '#475569' : '#cbd5e1' }}>{site.company_name ?? '—'}</span>
                      </td>
                      {!isWriter && (
                        <td className="px-5 py-4 align-middle text-center">
                          {lm ? (
                            <span className="inline-flex items-center text-[10px] sm:text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span>
                          ) : (
                            <span className="text-[10px]" style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                      )}
                      {!isWriter && (
                        <td className="px-5 py-4 align-middle text-center">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span>
                          <span className="text-[10px] ml-1" style={{ color: '#94a3b8' }}>{site.phone_count === 1 ? 'number' : 'numbers'}</span>
                        </td>
                      )}
                      {!isWriter && (
                        <td className="px-5 py-4 align-middle text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium"
                            style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#64748b' }}>
                            {site.active_phone_count} active
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-4 align-middle text-center">
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span>
                        <span className="text-[10px] ml-1" style={{ color: '#94a3b8' }}>{site.blog_count === 1 ? 'post' : 'posts'}</span>
                      </td>
                      <td className="px-5 py-4 align-middle text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium"
                          style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#64748b' }}>
                          {site.published_blog_count} published
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle text-center">
                        <div className="flex items-center gap-2 justify-center">
                          {!isWriter && (
                            <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`}
                              className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                              style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                              Phones
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </Link>
                          )}
                          <Link href={`/blog?website=${encodeURIComponent(site.domain)}`}
                            className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                            style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                            Blog
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
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
