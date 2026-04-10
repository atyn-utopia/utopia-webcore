'use client'

import { useEffect, useState } from 'react'

interface PhoneNumber {
  id: string
  website: string
  phone_number: string
  whatsapp_text: string
  location_slug: string
  type: string
  label: string | null
  percentage: number
  is_active: boolean
}

export default function AllPhoneNumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/phone-numbers').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setNumbers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = search
    ? numbers.filter(n => n.phone_number.includes(search) || n.website.toLowerCase().includes(search.toLowerCase()) || (n.label ?? '').toLowerCase().includes(search.toLowerCase()))
    : numbers

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Phone Numbers</h1>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{numbers.length} numbers across all websites</p>
      </div>

      <div className="mb-5 relative max-w-sm">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search numbers, websites, or labels…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0' }} />
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {['Phone Number', 'Website', 'WhatsApp Text', 'Location', 'Type', '%', 'Status'].map((h, i) => (
                    <th key={i} className="px-4 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => (
                  <tr key={n.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-4 py-3 align-middle">
                      <span className="text-sm font-medium font-mono" style={{ color: 'var(--foreground)' }}>{n.phone_number}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs truncate" style={{ color: '#475569' }}>{n.website}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs truncate block max-w-[200px] mx-auto" style={{ color: '#94a3b8' }}>{n.whatsapp_text || '—'}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>{n.location_slug}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      {n.type === 'default' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--primary)', color: 'white' }}>Default</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>{n.label ?? 'Custom'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{n.percentage}%</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${n.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: n.is_active ? '#16a34a' : '#94a3b8' }} />
                        {n.is_active ? 'Active' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{filtered.length} of {numbers.length} numbers</p>
    </div>
  )
}
