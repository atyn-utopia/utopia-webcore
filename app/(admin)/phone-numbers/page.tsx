'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [filterWebsite, setFilterWebsite] = useState('')
  const [filterProduct, setFilterProduct] = useState('')

  useEffect(() => { setFilterWebsite(selectedWebsite) }, [selectedWebsite])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<PhoneNumber>>({})
  const [error, setError] = useState('')

  const fetchNumbers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterWebsite) params.set('website', filterWebsite)
    if (filterProduct) params.set('product_slug', filterProduct)
    const res = await fetch(`/api/phone-numbers?${params}`)
    const data = await res.json()
    setNumbers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterWebsite, filterProduct])

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
    if (!editValues.phone_number) {
      setError('Phone number is required')
      return
    }
    const res = await fetch(`/api/phone-numbers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: editValues.phone_number, label: editValues.label || null }),
    })
    if (res.ok) {
      setEditingId(null)
      fetchNumbers()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
    }
  }

  // Unique websites for filter dropdown
  const websites = [...new Set(numbers.map(n => n.website))]
  const products = [...new Set(numbers.map(n => n.product_slug))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Phone Numbers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage phone numbers per website, product, and location</p>
        </div>
        <Link
          href="/phone-numbers/new"
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" style={{ background: 'var(--primary)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary)'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Number
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterWebsite}
          onChange={e => setFilterWebsite(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All websites</option>
          {websites.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All products</option>
          {products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(filterWebsite || filterProduct) && (
          <button
            onClick={() => { setFilterWebsite(''); setFilterProduct('') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : numbers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No phone numbers found.{' '}
            <Link href="/phone-numbers/new" className="text-blue-600 hover:underline">Add one</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Website', 'Product', 'Location', 'Phone Number', 'Label', 'Active', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {numbers.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.website}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{row.product_slug}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{row.location_slug}</td>
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <input
                        className="px-2 py-1 border border-blue-400 rounded text-sm w-36 focus:outline-none"
                        value={editValues.phone_number ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, phone_number: e.target.value }))}
                      />
                    ) : (
                      <span className="font-mono text-slate-800">{row.phone_number}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <input
                        className="px-2 py-1 border border-blue-400 rounded text-sm w-28 focus:outline-none"
                        value={editValues.label ?? ''}
                        placeholder="Optional"
                        onChange={e => setEditValues(v => ({ ...v, label: e.target.value }))}
                      />
                    ) : (
                      <span className="text-slate-500">{row.label ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(row.id, row.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        row.is_active ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          row.is_active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {editingId === row.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(row.id)}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(row)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteNumber(row.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
