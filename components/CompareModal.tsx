'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Site { domain: string; company_name: string | null }

interface CompareModalProps {
  open: boolean
  onClose: () => void
  /** Sites to pre-tick (typically the current domain). */
  preselect?: string[]
}

const MAX_SITES = 3

export default function CompareModal({ open, onClose, preselect }: CompareModalProps) {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/websites')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSites(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) {
      setSelected([])
      setSearch('')
      return
    }
    setSelected((preselect ?? []).slice(0, MAX_SITES))
  }, [open, preselect])

  function toggle(domain: string) {
    setSelected(prev => {
      if (prev.includes(domain)) return prev.filter(d => d !== domain)
      if (prev.length >= MAX_SITES) return prev // ignore — cap reached
      return [...prev, domain]
    })
  }

  function confirm() {
    if (selected.length < 2) return
    const url = `/websites?compare=${selected.map(encodeURIComponent).join(',')}&period=7d`
    router.push(url)
    onClose()
  }

  // Group sites by company
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q ? sites : sites.filter(s => s.domain.toLowerCase().includes(q) || (s.company_name ?? '').toLowerCase().includes(q))
    const map: Record<string, Site[]> = {}
    for (const s of filtered) {
      const key = s.company_name ?? '— Unlinked —'
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [sites, search])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto backdrop-blur-sm" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl my-4 overflow-hidden flex flex-col" style={{ border: '1px solid #e2e8f0', maxHeight: 'calc(100vh - 4rem)' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Compare websites</h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
              Pick 2 or 3 sites to see their dashboards side-by-side.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: '#64748b' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search websites or companies…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none transition-colors focus:border-[var(--primary)]"
              style={{ border: '1px solid #e2e8f0' }}
            />
          </div>
        </div>

        {/* Selection pills */}
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap flex-shrink-0" style={{ minHeight: '32px' }}>
          <span className="text-[11px] font-medium" style={{ color: '#64748b' }}>
            {selected.length}/{MAX_SITES} selected
          </span>
          {selected.map(d => (
            <span key={d}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
              {d}
              <button onClick={() => toggle(d)} aria-label={`Remove ${d}`}
                className="hover:opacity-70" type="button">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto border-t" style={{ borderColor: '#e2e8f0' }}>
          {loading ? (
            <p className="p-6 text-center text-xs" style={{ color: '#94a3b8' }}>Loading websites…</p>
          ) : grouped.length === 0 ? (
            <p className="p-6 text-center text-xs" style={{ color: '#94a3b8' }}>No matching websites.</p>
          ) : grouped.map(([company, items]) => (
            <div key={company}>
              <div className="px-6 py-2 text-[10px] font-semibold uppercase tracking-wider sticky top-0 z-10" style={{ color: '#94a3b8', background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
                {company}
              </div>
              {items.map(site => {
                const checked = selected.includes(site.domain)
                const disabled = !checked && selected.length >= MAX_SITES
                return (
                  <label key={site.domain}
                    className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                    style={{ borderBottom: '1px solid #f8fafc', background: checked ? '#eff6ff' : 'transparent' }}>
                    <input type="checkbox" checked={checked} disabled={disabled}
                      onChange={() => toggle(site.domain)} className="flex-shrink-0" />
                    <span className="text-sm font-mono flex-1 truncate" style={{ color: '#334155' }}>{site.domain}</span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-2 flex-shrink-0" style={{ borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: '#475569' }}>Cancel</button>
          <button type="button" onClick={confirm} disabled={selected.length < 2}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            {selected.length < 2 ? `Select at least 2` : `Compare ${selected.length} sites`}
          </button>
        </div>
      </div>
    </div>
  )
}
