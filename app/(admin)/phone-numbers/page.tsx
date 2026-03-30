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

  useEffect(() => { fetchNumbers() }, [fetchNumbers])

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/phone-numbers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    fetchNumbers()
  }

  async function deleteNumber(id: string) {
    if (!confirm('Delete this phone number?')) return
    await fetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
    fetchNumbers()
  }

  function startEdit(row: PhoneNumber) {
    setEditingId(row.id)
    setEditValues({ phone_number: row.phone_number, label: row.label ?? '' })
    setError('')
  }

  async function saveEdit(id: string) {
    if (!editValues.phone_number) { setError('Phone number is required'); return }
    const res = await fetch(`/api/phone-numbers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: editValues.phone_number, label: editValues.label || null }),
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Phone Numbers</h1>
        <Link
          href="/phone-numbers/new"
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
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
      <p className="text-sm mb-6" style={{ color: '#4a7a8a' }}>Manage phone numbers per website and location. Multiple numbers rotate randomly on each WhatsApp click.</p>

      {/* Search + website filter */}
      <div className="flex flex-wrap gap-4 mb-5 items-end">
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a7a8a' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#7dbdd0' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by domain, location, or number…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: 'var(--border)', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a7a8a' }}>Website</label>
          <div className="relative inline-block">
            <select
              value={filterWebsite}
              onChange={e => setFilterWebsite(e.target.value)}
              className="cursor-pointer text-sm rounded-lg border focus:outline-none"
              style={{
                appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                borderColor: 'var(--border)', background: 'white', color: '#4a7a8a',
                paddingTop: '0.5rem', paddingBottom: '0.5rem', paddingLeft: '0.75rem', paddingRight: '2.25rem',
                minWidth: '160px',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <option value="">All websites</option>
              {websites.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#7dbdd0' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {(filterWebsite || search) && (
          <button
            onClick={() => { setFilterWebsite(''); setSearch('') }}
            className="py-2 px-3 text-sm rounded-lg border"
            style={{ borderColor: 'var(--border)', color: '#4a7a8a', background: 'white' }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
      )}

      {/* Grouped tables */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: 'var(--border)', color: '#7dbdd0' }}>Loading…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: 'var(--border)', color: '#7dbdd0' }}>
          No phone numbers found.{' '}
          <Link href="/phone-numbers/new" className="hover:underline" style={{ color: 'var(--primary)' }}>Add one</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([website, rows]) => (
            <div key={website} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {/* Website header */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#f4f9fb', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{website}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--primary)', color: 'white' }}>
                  {rows.length} {rows.length === 1 ? 'number' : 'numbers'}
                </span>
              </div>

              <table className="w-full text-sm" style={{ background: 'white' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: '#fafcfd' }}>
                    {['Location', 'Phone Number', 'Label', 'Status', ''].map((h, i) => (
                      <th key={i} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#4a7a8a' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f4f9fb'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td className="px-5 py-3 align-middle font-mono text-xs" style={{ color: '#4a7a8a' }}>{row.location_slug}</td>
                      <td className="px-5 py-3 align-middle">
                        {editingId === row.id ? (
                          <input
                            className="px-2 py-1 border rounded text-sm w-40 focus:outline-none"
                            style={{ borderColor: 'var(--primary)' }}
                            value={editValues.phone_number ?? ''}
                            onChange={e => setEditValues(v => ({ ...v, phone_number: e.target.value }))}
                          />
                        ) : (
                          <span className="font-mono font-medium" style={{ color: 'var(--foreground)' }}>{row.phone_number}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-middle">
                        {editingId === row.id ? (
                          <input
                            className="px-2 py-1 border rounded text-sm w-28 focus:outline-none"
                            style={{ borderColor: 'var(--primary)' }}
                            value={editValues.label ?? ''}
                            placeholder="Optional"
                            onChange={e => setEditValues(v => ({ ...v, label: e.target.value }))}
                          />
                        ) : (
                          <span style={{ color: '#7dbdd0' }}>{row.label ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <button
                          onClick={() => toggleActive(row.id, row.is_active)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={row.is_active
                            ? { background: '#dcfce7', color: '#16a34a' }
                            : { background: '#f1f5f9', color: '#64748b' }
                          }
                        >
                          {row.is_active ? (
                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Active</>
                          ) : (
                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Inactive</>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <div className="flex items-center gap-1 justify-end">
                          {editingId === row.id ? (
                            <>
                              <button
                                onClick={() => saveEdit(row.id)}
                                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                                style={{ background: 'var(--primary)' }}
                              >Save</button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 text-xs rounded-lg border"
                                style={{ borderColor: 'var(--border)', color: '#4a7a8a' }}
                              >Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(row)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--border)', color: '#6b6b8a' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = '#6b6b8a' }}
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteNumber(row.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--border)', color: '#6b6b8a' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = '#6b6b8a'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#7dbdd0' }}>
          Showing {filtered.length} of {numbers.length} entries across {Object.keys(grouped).length} {Object.keys(grouped).length === 1 ? 'website' : 'websites'}
        </p>
      )}
    </div>
  )
}
