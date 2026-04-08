'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'

interface PhoneNumber {
  id: string
  website: string
  product_slug: string
  location_slug: string
  phone_number: string
  whatsapp_text: string
  percentage: number
  label: string | null
  is_active: boolean
  created_at: string
}

export default function PhoneNumbersPage() {
  const { selectedWebsite } = useWebsite()
  const searchParams = useSearchParams()
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterWebsite, setFilterWebsite] = useState(() => searchParams.get('website') ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<PhoneNumber>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    const fromUrl = searchParams.get('website')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl) { setFilterWebsite(fromUrl); return }
    setFilterWebsite(selectedWebsite)
  }, [selectedWebsite, searchParams])

  const fetchNumbers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterWebsite) params.set('website', filterWebsite)
    const res = await fetch(`/api/phone-numbers?${params}`)
    const data = await res.json()
    setNumbers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterWebsite])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchNumbers() }, [fetchNumbers])

  async function deleteNumber(id: string) {
    if (!confirm('Delete this phone number?')) return
    await fetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
    fetchNumbers()
  }

  function startEdit(row: PhoneNumber) {
    setEditingId(row.id)
    setEditValues({ phone_number: row.phone_number, whatsapp_text: row.whatsapp_text, percentage: row.percentage, label: row.label ?? '', is_active: row.is_active })
    setError('')
  }

  async function saveEdit(id: string) {
    if (!editValues.phone_number) { setError('Phone number is required'); return }
    const res = await fetch(`/api/phone-numbers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: editValues.phone_number, whatsapp_text: editValues.whatsapp_text, percentage: editValues.percentage ?? 100, label: editValues.label || null, is_active: editValues.is_active }),
    })
    if (res.ok) { setEditingId(null); fetchNumbers() }
    else { const d = await res.json(); setError(d.error ?? 'Save failed') }
  }

  // Filter + search
  const filtered = numbers.filter(n => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      n.website.toLowerCase().includes(q) ||
      n.location_slug.toLowerCase().includes(q) ||
      n.phone_number.toLowerCase().includes(q) ||
      (n.label ?? '').toLowerCase().includes(q)
    )
  })

  // Group by website
  const grouped = filtered.reduce<Record<string, PhoneNumber[]>>((acc, n) => {
    if (!acc[n.website]) acc[n.website] = []
    acc[n.website].push(n)
    return acc
  }, {})

  const websites = [...new Set(numbers.map(n => n.website))]
  const groupedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Phone Numbers</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#475569' }}>Manage phone numbers per website and location.</p>
        </div>
        <Link
          href="/phone-numbers/new"
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity mt-3 sm:mt-0 sm:flex-shrink-0"
          style={{ background: 'var(--primary)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Number
        </Link>
      </div>

      {/* Search + website filter */}
      <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: '#cbd5e1', background: '#f8fafc' }}>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by domain, location, or number…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-offset-0"
              style={{ borderColor: '#cbd5e1', background: 'white', ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)' }}
            />
          </div>
        </div>
        <div className="min-w-44">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Website</label>
          <div className="relative inline-block">
            <select
              value={filterWebsite}
              onChange={e => setFilterWebsite(e.target.value)}
              className="cursor-pointer text-sm rounded-lg border outline-none focus:ring-2 focus:ring-offset-0 w-full"
              style={{
                appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                borderColor: '#cbd5e1', background: 'white', color: '#475569',
                paddingTop: '0.5rem', paddingBottom: '0.5rem', paddingLeft: '0.75rem', paddingRight: '2.25rem',
                minWidth: '176px',
                ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)',
              }}
            >
              <option value="">All websites</option>
              {websites.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
          {(filterWebsite || search) && (
            <button
              onClick={() => { setFilterWebsite(''); setSearch('') }}
              className="h-9 py-2 px-3 text-sm rounded-lg border hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
              style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
      )}

      {/* Grouped tables */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : groupedEntries.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No phone numbers found.{' '}
          <Link href="/phone-numbers/new" className="hover:underline" style={{ color: 'var(--primary)' }}>Add one</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedEntries.map(([website, rows]) => {
            const activeRows = rows.filter(r => r.is_active)
            const totalPct = activeRows.reduce((s, r) => s + (r.percentage ?? 100), 0)
            const pctOk = activeRows.length === 0 || totalPct === 100
            return (
            <section key={website} className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
              {/* Website header */}
              <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3" style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{website}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {activeRows.length > 0 && (
                    <span
                      className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap"
                      style={pctOk
                        ? { background: '#dcfce7', color: '#16a34a' }
                        : { background: '#fef2f2', color: '#dc2626' }
                      }
                    >
                      {totalPct}% total
                    </span>
                  )}
                  <span className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap" style={{ background: 'var(--primary)', color: 'white' }}>
                    {rows.length} {rows.length === 1 ? 'number' : 'numbers'}
                  </span>
                  <Link
                    href={`/phone-numbers/new?website=${encodeURIComponent(website)}`}
                    className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-medium px-2.5 rounded-full text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                    style={{ background: '#475569' }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </Link>
                </div>
              </div>
              {!pctOk && activeRows.length > 0 && (
                <div className="px-4 sm:px-5 py-2 text-xs flex items-center gap-1.5" style={{ background: '#fef2f2', color: '#dc2626', borderBottom: '1px solid #fca5a5' }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Active numbers total {totalPct}% — adjust percentages to equal 100%.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ background: 'white', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col />
                    <col className="w-16 sm:w-20" />
                    <col className="w-16 sm:w-20" />
                    <col className="w-20 sm:w-24" />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                      <th className="px-3 sm:px-4 py-3 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Details</th>
                      <th className="px-2 py-3 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>%</th>
                      <th className="px-2 py-3 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Status</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      return (
                      <tr
                        key={row.id}
                        className="hover:bg-[#f1f5f9] transition-colors"
                        style={{ borderBottom: i < rows.length - 1 ? '1px solid #cbd5e1' : 'none' }}
                      >
                      {/* Number Details — stacked */}
                      <td className="px-3 sm:px-4 py-3 align-middle overflow-hidden">
                        {editingId === row.id ? (
                          <div className="space-y-2">
                            <input
                              className="px-2 py-1 border rounded text-sm w-full outline-none focus:ring-2"
                              style={{ borderColor: 'var(--primary)', ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)' }}
                              value={editValues.phone_number ?? ''}
                              placeholder="Phone number"
                              onChange={e => setEditValues(v => ({ ...v, phone_number: e.target.value }))}
                            />
                            <input
                              className="px-2 py-1 border rounded text-sm w-full outline-none focus:ring-2"
                              style={{ borderColor: '#cbd5e1', ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)' }}
                              value={editValues.whatsapp_text ?? ''}
                              placeholder="WhatsApp text"
                              onChange={e => setEditValues(v => ({ ...v, whatsapp_text: e.target.value }))}
                            />
                            <input
                              className="px-2 py-1 border rounded text-sm w-full outline-none focus:ring-2"
                              style={{ borderColor: '#cbd5e1', ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)' }}
                              value={editValues.label ?? ''}
                              placeholder="Label (optional)"
                              onChange={e => setEditValues(v => ({ ...v, label: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs sm:text-sm font-medium font-mono truncate" style={{ color: 'var(--foreground)' }}>{row.phone_number}</span>
                              {row.label && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#f1f5f9', color: '#475569' }}>{row.label}</span>}
                            </div>
                            {row.whatsapp_text && <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: '#475569' }}>{row.whatsapp_text}</p>}
                            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>{row.location_slug}</p>
                          </div>
                        )}
                      </td>

                      {/* Weight */}
                      <td className="px-2 py-3 align-middle text-center">
                        {editingId === row.id ? (
                          <input
                            type="number"
                            min="1"
                            max="100"
                            className="px-2 py-1 border rounded text-sm w-16 text-center outline-none focus:ring-2"
                            style={{ borderColor: 'var(--primary)', ['--tw-ring-color' as string]: 'rgba(30, 58, 95, 0.2)' }}
                            value={editValues.percentage ?? 100}
                            onChange={e => setEditValues(v => ({ ...v, percentage: parseInt(e.target.value) || 1 }))}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{row.percentage ?? 100}%</span>
                            <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                              <div className="h-full rounded-full" style={{ width: `${row.percentage ?? 100}%`, background: row.is_active ? 'var(--primary)' : '#94a3b8' }} />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-2 py-3 align-middle text-center">
                        {editingId === row.id ? (
                          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium"
                            style={{ color: editValues.is_active ? '#16a34a' : '#475569' }}>
                            <span
                              className="w-4 h-4 rounded flex items-center justify-center border"
                              style={editValues.is_active
                                ? { background: '#16a34a', borderColor: '#16a34a' }
                                : { background: 'white', borderColor: '#cbd5e1' }
                              }
                            >
                              {editValues.is_active && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={!!editValues.is_active}
                              onChange={e => setEditValues(v => ({ ...v, is_active: e.target.checked }))}
                            />
                          </label>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={row.is_active
                              ? { background: '#dcfce7', color: '#16a34a' }
                              : { background: '#f1f5f9', color: '#94a3b8' }
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.is_active ? '#16a34a' : '#94a3b8' }} />
                            {row.is_active ? 'Active' : 'Off'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2 sm:px-4 py-3 align-middle">
                        <div className="flex items-center gap-1 justify-center">
                          {editingId === row.id ? (
                            <>
                              <button
                                onClick={() => saveEdit(row.id)}
                                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
                                style={{ background: 'var(--primary)' }}
                              >Save</button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 text-xs rounded-lg border transition-colors hover:text-[var(--primary)] hover:border-[var(--primary)]"
                                style={{ borderColor: '#cbd5e1', color: '#475569' }}
                              >Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(row)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors hover:text-[var(--primary)] hover:border-[var(--primary)]"
                                style={{ borderColor: '#cbd5e1', color: '#475569' }}
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteNumber(row.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors hover:border-red-300 hover:text-red-500 hover:bg-red-50"
                                style={{ borderColor: '#cbd5e1', color: '#475569' }}
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </section>
          )})}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#475569' }}>
          Showing {filtered.length} of {numbers.length} entries across {groupedEntries.length} {groupedEntries.length === 1 ? 'website' : 'websites'}
        </p>
      )}
    </div>
  )
}
