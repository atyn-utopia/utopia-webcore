'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { MagnifyingGlassIcon, PlusIcon, CheckCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid'

type Site = { domain: string }

function friendlyName(domain: string) {
  return domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

function thumbFor(domain: string) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(`https://${domain}`)}?w=200`
}

/**
 * Wix-style site picker. Lives in the top header. Click the trigger to open a
 * panel with a search field, scrollable list of sites with screenshot
 * thumbnails, and a "Go to All Sites" footer link. Picking a site preserves
 * the current path when it's a per-site route, otherwise jumps to the site
 * dashboard.
 */
export default function SiteSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const websiteParam = searchParams?.get('website') ?? ''
  const { role } = useUser()
  const canAdd = role === 'admin' || role === 'designer'

  const [open, setOpen] = useState(false)
  const [sites, setSites] = useState<Site[]>([])
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (!Array.isArray(data)) return
        const seen = new Set<string>()
        const out: Site[] = []
        for (const item of data) {
          const domain = typeof item === 'string' ? item : (item as { domain?: string })?.domain
          if (!domain || seen.has(domain)) continue
          seen.add(domain)
          out.push({ domain })
        }
        out.sort((a, b) => a.domain.localeCompare(b.domain))
        setSites(out)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(domain: string) {
    setOpen(false)
    setFilter('')
    const sitePathnames = new Set(['/websites', '/products', '/phone-numbers', '/blog', '/seo', '/integrations', '/site-settings', '/analytics'])
    const target = sitePathnames.has(pathname) ? pathname : '/websites'
    router.push(`${target}?website=${encodeURIComponent(domain)}`)
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return sites
    const q = filter.trim().toLowerCase()
    return sites.filter(s => s.domain.toLowerCase().includes(q) || friendlyName(s.domain).toLowerCase().includes(q))
  }, [filter, sites])

  const triggerLabel = websiteParam ? friendlyName(websiteParam) : 'All Sites'

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 rounded-full text-sm font-medium transition-colors"
        style={{
          background: open ? 'var(--header-hover)' : 'transparent',
          color: 'var(--header-text-strong)',
          border: '1px solid var(--header-divider)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={websiteParam || 'All Sites'}
      >
        <span className="truncate max-w-[80px] sm:max-w-[200px]">{triggerLabel}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="fixed sm:absolute top-16 sm:top-11 left-3 right-3 sm:left-0 sm:right-auto sm:w-[26rem] rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: 'white', border: '1px solid #e2e8f0' }}
        >
          {/* Header: search pill + (admin) Add Website link */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94a3b8' }} />
              <input
                autoFocus
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Search site names…"
                className="w-full h-9 pl-8 pr-3 text-xs rounded-full outline-none transition-colors"
                style={{ border: '1px solid #e2e8f0', background: 'white', color: 'var(--foreground)' }}
              />
            </div>
            {canAdd && (
              <Link
                href="/?addWebsite=1"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add Website
              </Link>
            )}
          </div>

          {/* List */}
          <div className="max-h-[26rem] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-10 text-xs text-center" style={{ color: '#94a3b8' }}>
                {filter ? `No sites matching "${filter}"` : 'No sites yet'}
              </p>
            ) : (
              filtered.map(s => {
                const active = s.domain === websiteParam
                return (
                  <button
                    key={s.domain}
                    onClick={() => pick(s.domain)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    style={{
                      background: active ? '#f8fafc' : 'transparent',
                      borderBottom: '1px solid #f8fafc',
                    }}
                  >
                    {/* Screenshot thumbnail */}
                    <div className="w-16 h-10 rounded-md overflow-hidden flex-shrink-0" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbFor(s.domain)}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                        {friendlyName(s.domain)}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: '#94a3b8' }}>
                        {s.domain}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#dcfce7', color: '#15803d' }}
                    >
                      <span className="w-1 h-1 rounded-full" style={{ background: '#15803d' }} />
                      Active
                    </span>
                    {active && (
                      <CheckCircleIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block w-full py-3 text-center text-sm font-medium transition-colors hover:bg-slate-50"
            style={{ color: 'var(--primary)', borderTop: '1px solid #f1f5f9' }}
          >
            Go to All Sites
          </Link>
        </div>
      )}
    </div>
  )
}
