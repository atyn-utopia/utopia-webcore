'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WebsiteSummary {
  domain: string
  company_id: string | null
  company_name: string | null
  phone_count: number
  active_phone_count: number
  blog_count: number
  published_blog_count: number
}

export default function WebsitesPage() {
  const [sites, setSites] = useState<WebsiteSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.json())
      .then(data => { setSites(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Group by company
  const grouped: Record<string, { name: string; sites: WebsiteSummary[] }> = {}
  sites.forEach(site => {
    const key = site.company_id ?? '_unassigned'
    const name = site.company_name ?? 'Unassigned'
    if (!grouped[key]) grouped[key] = { name, sites: [] }
    grouped[key].sites.push(site)
  })
  // Sort: assigned companies first (alphabetical), unassigned last
  const entries = Object.entries(grouped).sort(([a, av], [b, bv]) => {
    if (a === '_unassigned') return 1
    if (b === '_unassigned') return -1
    return av.name.localeCompare(bv.name)
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Websites</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#475569' }}>
          All websites connected to this system, grouped by company.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : sites.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No websites found. Add a phone number or blog post to register a website.
        </div>
      ) : (
        <div className="space-y-6">
          {entries.map(([companyId, { name: companyName, sites: companySites }]) => (
            <div key={companyId}>
              {/* Company header */}
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: companyId === '_unassigned' ? '#94a3b8' : 'var(--primary)' }} strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h2 className="text-sm font-semibold" style={{ color: companyId === '_unassigned' ? '#94a3b8' : 'var(--foreground)' }}>{companyName}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f1f5f9', color: '#475569' }}>
                  {companySites.length} {companySites.length === 1 ? 'site' : 'sites'}
                </span>
              </div>

              {/* Website cards */}
              <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>
                        {['Website', 'Phone Numbers', 'Active Numbers', 'Blog Posts', 'Published Posts', ''].map((h, i) => (
                          <th key={i} className="px-5 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {companySites.map((site, i) => (
                        <tr
                          key={site.domain}
                          style={{ borderBottom: i < companySites.length - 1 ? '1px solid #cbd5e1' : 'none' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-4 align-middle">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                                  <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
                                  <path strokeWidth="1.5" d="M12 3c0 0-3 4-3 9s3 9 3 9"/>
                                  <path strokeWidth="1.5" d="M12 3c0 0 3 4 3 9s-3 9-3 9"/>
                                  <path strokeWidth="1.5" d="M3 12h18"/>
                                </svg>
                              </div>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                                <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#475569' }}>
                                  https://{site.domain} ↗
                                </a>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-middle text-center">
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span>
                            <span className="text-xs ml-1" style={{ color: '#475569' }}>total</span>
                          </td>
                          <td className="px-5 py-4 align-middle text-center">
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap"
                              style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#64748b' }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: site.active_phone_count > 0 ? '#16a34a' : '#64748b' }} />
                              {site.active_phone_count} active
                            </span>
                          </td>
                          <td className="px-5 py-4 align-middle text-center">
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span>
                            <span className="text-xs ml-1" style={{ color: '#475569' }}>total</span>
                          </td>
                          <td className="px-5 py-4 align-middle text-center">
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap"
                              style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#64748b' }}>
                              {site.published_blog_count} published
                            </span>
                          </td>
                          <td className="px-5 py-4 align-middle text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`}
                                className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Phones
                              </Link>
                              <Link href={`/blog?website=${encodeURIComponent(site.domain)}`}
                                className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Blog
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sites.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#475569' }}>
          {sites.length} website{sites.length !== 1 ? 's' : ''} across {entries.length} {entries.length === 1 ? 'group' : 'groups'}
        </p>
      )}
    </div>
  )
}
