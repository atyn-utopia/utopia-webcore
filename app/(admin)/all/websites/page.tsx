'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search websites…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0' }} />
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((site, i) => {
            const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null
            return (
              <div key={site.domain} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                  <p className="text-[10px]" style={{ color: '#94a3b8' }}>{site.company_name ?? 'Unassigned'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {lm && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span>}
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>{site.phone_count} phones</span>
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>{site.blog_count} posts</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
