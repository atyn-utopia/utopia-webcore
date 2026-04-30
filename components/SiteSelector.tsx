'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

/**
 * Wix-style site selector that lives in the top header bar.
 *
 * - When the URL has ?website=DOMAIN, shows the active site as the trigger
 *   label and a dropdown of all sites the user can switch to (preserving the
 *   current pathname so they stay on the same tab).
 * - When not in site context, shows a workspace label ("All Sites") and the
 *   dropdown is a list of sites that, when picked, jumps to that site's
 *   dashboard.
 */
export default function SiteSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const websiteParam = searchParams?.get('website') ?? ''

  const [open, setOpen] = useState(false)
  const [sites, setSites] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.ok ? r.json() : [])
      .then((data: { domain: string }[] | string[]) => {
        if (!Array.isArray(data)) return
        const domains = data.map(d => typeof d === 'string' ? d : d.domain).filter(Boolean) as string[]
        setSites([...new Set(domains)].sort())
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(domain: string) {
    setOpen(false)
    setFilter('')
    // If we're on a path that supports a per-site view, keep the path and
    // swap the website param. Otherwise jump to the per-site dashboard.
    const sitePathnames = new Set(['/websites', '/products', '/phone-numbers', '/blog', '/integrations', '/analytics'])
    const target = sitePathnames.has(pathname) ? pathname : '/websites'
    router.push(`${target}?website=${encodeURIComponent(domain)}`)
  }

  const triggerLabel = websiteParam || 'All Sites'
  const filtered = filter ? sites.filter(s => s.toLowerCase().includes(filter.toLowerCase())) : sites

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-colors"
        style={{
          background: open ? 'var(--header-hover)' : 'transparent',
          color: 'var(--header-text-strong)',
          border: '1px solid var(--header-divider)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[200px]" title={triggerLabel}>{triggerLabel}</span>
        <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-11 left-0 w-72 rounded-lg shadow-lg z-50 overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="relative">
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                autoFocus
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter sites…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md outline-none"
                style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--foreground)' }}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
              style={{ color: '#475569' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home (all companies)
            </Link>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-center" style={{ color: '#94a3b8' }}>{filter ? `No sites matching "${filter}"` : 'No sites'}</p>
            ) : (
              filtered.map(d => {
                const active = d === websiteParam
                return (
                  <button
                    key={d}
                    onClick={() => pick(d)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors"
                    style={{ color: active ? 'var(--primary)' : '#475569', background: active ? '#eff6ff' : 'transparent', fontWeight: active ? 600 : 500 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? 'var(--primary)' : '#cbd5e1' }} />
                    <span className="font-mono truncate flex-1">{d}</span>
                    {active && <span className="text-[10px]" style={{ color: 'var(--primary)' }}>current</span>}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
