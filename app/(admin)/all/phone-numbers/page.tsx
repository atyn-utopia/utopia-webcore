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
        <p className="text-xs" style={{ color: '#94a3b8' }}>{numbers.length} numbers across all websites</p>
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
          {filtered.map((n, i) => (
            <div key={n.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium font-mono" style={{ color: 'var(--foreground)' }}>{n.phone_number}</span>
                  {n.type === 'default' ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--primary)', color: 'white' }}>Default</span>
                  ) : n.label ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>{n.label}</span>
                  ) : null}
                </div>
                <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{n.website} · {n.location_slug}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-medium" style={{ color: '#475569' }}>{n.percentage}%</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${n.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {n.is_active ? 'Active' : 'Off'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
