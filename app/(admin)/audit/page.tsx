'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'

interface FieldChange { before: unknown; after: unknown }
interface AuditLog {
  id: string
  user_id: string | null
  user_name: string
  user_role: string
  entity_type: 'phone_number' | 'blog_post' | 'product' | 'website'
  entity_id: string | null
  action: 'create' | 'update' | 'delete'
  website: string | null
  label: string | null
  changes: Record<string, FieldChange> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: 'Created', color: '#16a34a', bg: '#dcfce7' },
  update: { label: 'Updated', color: '#0369a1', bg: '#e0f2fe' },
  delete: { label: 'Deleted', color: '#dc2626', bg: '#fef2f2' },
}

const ENTITY_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  phone_number: {
    label: 'Phone',
    color: '#0369a1',
    bg: '#eff6ff',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  blog_post: {
    label: 'Blog',
    color: '#16a34a',
    bg: '#f0fdf4',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  product: {
    label: 'Product',
    color: '#b45309',
    bg: '#fef3c7',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  website: {
    label: 'Website',
    color: '#7c3aed',
    bg: '#ede9fe',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path strokeLinecap="round" d="M2 7h20M8 21h8M12 17v4" />
      </svg>
    ),
  },
}

function formatRelative(d: string) {
  const date = new Date(d)
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFull(d: string) {
  return new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function truncate(value: unknown, max = 80): string {
  if (value === null || value === undefined) return '—'
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return str.length > max ? str.slice(0, max) + '…' : str
}

function formatFieldLabel(key: string): string {
  // Handle prefixed keys like "en.title"
  const parts = key.split('.')
  if (parts.length === 2) {
    return `${parts[0].toUpperCase()} ${parts[1].replace(/_/g, ' ')}`
  }
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState<'' | 'phone_number' | 'blog_post' | 'product' | 'website'>('')
  const [filterAction, setFilterAction] = useState<'' | 'create' | 'update' | 'delete'>('')

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    setLoading(true)
    try {
      const res = await fetch('/api/audit-logs?limit=500')
      const data = await res.json()
      if (Array.isArray(data)) setLogs(data)
    } catch {}
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = logs.filter(log => {
    if (filterEntity && log.entity_type !== filterEntity) return false
    if (filterAction && log.action !== filterAction) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (log.user_name ?? '').toLowerCase().includes(q) ||
        (log.website ?? '').toLowerCase().includes(q) ||
        (log.label ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div>
      <PageHeader title="Audit Trail" description="All changes across the system — phones, blog, products, websites" />

      {/* Filters */}
      <div className="rounded-xl border p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <div className="flex-1 min-w-48 max-w-sm">
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, website, or label…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0', background: 'white' }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Entity</label>
          <div className="relative">
            <select value={filterEntity} onChange={e => setFilterEntity(e.target.value as '' | 'phone_number' | 'blog_post' | 'product' | 'website')}
              className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer pr-9" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '140px', color: '#64748b' }}>
              <option value="">All entities</option>
              <option value="phone_number">Phone numbers</option>
              <option value="blog_post">Blog posts</option>
              <option value="product">Products</option>
              <option value="website">Websites</option>
            </select>
            <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Action</label>
          <div className="relative">
            <select value={filterAction} onChange={e => setFilterAction(e.target.value as '' | 'create' | 'update' | 'delete')}
              className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer pr-9" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '140px', color: '#64748b' }}>
              <option value="">All actions</option>
              <option value="create">Created</option>
              <option value="update">Updated</option>
              <option value="delete">Deleted</option>
            </select>
            <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Logs list */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
          {logs.length === 0 ? 'No audit logs yet. Activity will appear here.' : 'No logs match your filters.'}
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((log, i) => {
            const actionMeta = ACTION_META[log.action] ?? ACTION_META.update
            const entityMeta = ENTITY_META[log.entity_type] ?? ENTITY_META.phone_number
            const isExpanded = expanded.has(log.id)
            const changeCount = log.changes ? Object.keys(log.changes).length : 0
            const canExpand = (log.action === 'update' && changeCount > 0) || (log.metadata !== null)

            return (
              <div key={log.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div
                  className={`px-4 py-3.5 flex items-center gap-3 ${canExpand ? 'cursor-pointer hover:bg-[#f8fafc]' : ''} transition-colors`}
                  onClick={() => canExpand && toggleExpand(log.id)}
                >
                  {/* Expand caret */}
                  <div className="w-4 flex-shrink-0 flex justify-center">
                    {canExpand && (
                      <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: '#94a3b8' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
                    {log.user_name[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{log.user_name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: actionMeta.bg, color: actionMeta.color }}>{actionMeta.label}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: entityMeta.bg, color: entityMeta.color }}>
                        {entityMeta.icon}
                        {entityMeta.label}
                      </span>
                      {log.label && (
                        <span className="text-xs font-mono truncate max-w-[240px]" style={{ color: '#475569' }}>{log.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: '#94a3b8' }}>
                      {log.website && <span className="truncate">{log.website}</span>}
                      {log.action === 'update' && changeCount > 0 && <span>· {changeCount} change{changeCount > 1 ? 's' : ''}</span>}
                    </div>
                  </div>

                  {/* Date / time — right aligned */}
                  <div className="flex-shrink-0 text-right" style={{ color: '#94a3b8' }}>
                    <p className="text-xs font-medium" style={{ color: '#475569' }}>{formatFull(log.created_at)}</p>
                    <p className="text-[10px] mt-0.5">{formatRelative(log.created_at)}</p>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pl-[72px]" style={{ background: '#fafbfc' }}>
                    {log.action === 'update' && log.changes && (
                      <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                          Changes
                        </div>
                        <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
                          {Object.entries(log.changes).map(([key, change]) => (
                            <div key={key} className="px-3 py-2.5 grid grid-cols-[140px_1fr_1fr] gap-3 items-start">
                              <span className="text-xs font-semibold pt-0.5" style={{ color: '#475569' }}>{formatFieldLabel(key)}</span>
                              <div>
                                <p className="text-[10px] font-medium mb-0.5" style={{ color: '#dc2626' }}>Before</p>
                                <div className="text-xs p-2 rounded border font-mono break-words" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#7f1d1d' }}>
                                  {truncate(change.before, 500)}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium mb-0.5" style={{ color: '#16a34a' }}>After</p>
                                <div className="text-xs p-2 rounded border font-mono break-words" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#14532d' }}>
                                  {truncate(change.after, 500)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(log.action === 'create' || log.action === 'delete') && log.metadata && (
                      <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                          {log.action === 'create' ? 'Created with' : 'Deleted record'}
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-2">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <div key={key} className="flex flex-col">
                              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{formatFieldLabel(key)}</span>
                              <span className="text-xs break-words" style={{ color: '#475569' }}>{truncate(value, 200)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{filtered.length} of {logs.length} entries</p>
    </div>
  )
}
