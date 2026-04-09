'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

interface WebsiteSummary {
  domain: string
  company_id: string | null
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

interface Company {
  id: string
  name: string
  company_websites: { domain: string }[]
}

export default function WebsitesPage() {
  const { role } = useUser()
  const isWriter = role === 'writer'
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''

  const [sites, setSites] = useState<WebsiteSummary[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/websites').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]).then(([sitesData, companiesData]) => {
      if (Array.isArray(sitesData)) setSites(sitesData)
      if (Array.isArray(companiesData)) setCompanies(companiesData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Search filter
  const filteredSites = sites.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.domain.toLowerCase().includes(q) || (s.company_name ?? '').toLowerCase().includes(q)
  })

  // Company folder view (no company selected)
  if (!openCompany) {
    // Group companies with site counts
    const companyStats = companies.map(c => {
      const domains = c.company_websites.map(w => w.domain)
      const companySites = sites.filter(s => domains.includes(s.domain))
      return {
        ...c,
        site_count: domains.length,
        total_phones: companySites.reduce((s, x) => s + x.phone_count, 0),
        total_blogs: companySites.reduce((s, x) => s + x.blog_count, 0),
      }
    })

    // Unassigned sites
    const assignedDomains = new Set(companies.flatMap(c => c.company_websites.map(w => w.domain)))
    const unassigned = sites.filter(s => !assignedDomains.has(s.domain))

    // Filter companies by search
    const filteredCompanies = search
      ? companyStats.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.company_websites.some(w => w.domain.toLowerCase().includes(search.toLowerCase()))
        )
      : companyStats

    const filteredUnassigned = search
      ? unassigned.filter(s => s.domain.toLowerCase().includes(search.toLowerCase()))
      : unassigned

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Websites</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#475569' }}>Select a company to view its websites.</p>
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search companies or domains…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map(company => (
              <Link
                key={company.id}
                href={`/websites?company=${encodeURIComponent(company.name)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300"
                style={{ borderColor: '#e2e8f0' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{company.name}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: '#475569' }}>{company.site_count} {company.site_count === 1 ? 'site' : 'sites'}</span>
                      {!isWriter && company.total_phones > 0 && <span className="text-[10px]" style={{ color: '#94a3b8' }}>{company.total_phones} phones</span>}
                      {company.total_blogs > 0 && <span className="text-[10px]" style={{ color: '#94a3b8' }}>{company.total_blogs} posts</span>}
                    </div>
                  </div>
                  <svg className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}

            {/* Unassigned */}
            {filteredUnassigned.length > 0 && (
              <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Unassigned</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>{filteredUnassigned.length} {filteredUnassigned.length === 1 ? 'site' : 'sites'} not linked to a company</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Inside a company — show websites
  const companySites = filteredSites.filter(s => s.company_name === openCompany)

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/websites" className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{openCompany}</h1>
            <p className="text-xs" style={{ color: '#94a3b8' }}>{companySites.length} {companySites.length === 1 ? 'website' : 'websites'}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      {companySites.length > 3 && (
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search websites…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : companySites.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No websites found for this company.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>
                  {['Website', ...(isWriter ? [] : ['Leads Mode', 'Phone Numbers', 'Active']), 'Blog Posts', 'Published', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companySites.map((site, i) => (
                  <tr key={site.domain} style={{ borderBottom: i < companySites.length - 1 ? '1px solid #cbd5e1' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
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
                          <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#475569' }}>https://{site.domain} ↗</a>
                        </div>
                      </div>
                    </td>
                    {!isWriter && (
                    <td className="px-5 py-4 align-middle text-center">
                      {site.leads_mode && LEADS_MODE[site.leads_mode] ? (
                        <span className="inline-flex items-center text-[10px] sm:text-xs font-medium px-2.5 py-0.5 rounded-full"
                          style={{ background: LEADS_MODE[site.leads_mode].bg, color: LEADS_MODE[site.leads_mode].color }}>
                          {LEADS_MODE[site.leads_mode].label}
                        </span>
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
                          style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}>
                          Phones
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </Link>
                        )}
                        <Link href={`/blog?website=${encodeURIComponent(site.domain)}`}
                          className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}>
                          Blog
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
