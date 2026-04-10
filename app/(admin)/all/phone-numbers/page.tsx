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
  created_at: string
}

interface Company { id: string; name: string; company_websites: { domain: string }[] }

type SortKey = 'phone_number' | 'website' | 'location_slug' | 'percentage' | 'created_at'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="inline-flex flex-col ml-1 -space-y-0.5 align-middle">
      <svg className={`w-2.5 h-2.5 ${active && dir === 'asc' ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 8 5"><path d="M4 0L8 5H0z"/></svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 8 5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  )
}

export default function AllPhoneNumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    Promise.all([
      fetch('/api/phone-numbers').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]).then(([nums, comps]) => {
      if (Array.isArray(nums)) setNumbers(nums)
      if (Array.isArray(comps)) setCompanies(comps)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const companyNames = [...new Set(companies.map(c => c.name))]
  const companyDomainMap: Record<string, string> = {}
  companies.forEach(c => c.company_websites.forEach(w => { companyDomainMap[w.domain] = c.name }))

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = numbers
    .filter(n => {
      if (filterCompany && companyDomainMap[n.website] !== filterCompany) return false
      if (search) {
        const q = search.toLowerCase()
        return n.phone_number.includes(q) || n.website.toLowerCase().includes(q) || (n.label ?? '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  function ThSort({ label, col }: { label: string; col: SortKey }) {
    return (
      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:text-[var(--primary)] transition-colors"
        style={{ color: '#94a3b8' }} onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center justify-center gap-1">{label}<SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} /></span>
      </th>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Phone Numbers</h1>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{numbers.length} numbers across all websites</p>
      </div>

      <div className="rounded-xl border p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <div className="flex-1 min-w-48 max-w-sm">
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search numbers, websites…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0', background: 'white' }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Company</label>
          <div className="relative">
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer pr-9" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '160px', color: '#64748b' }}>
              <option value="">All companies</option>
              {companyNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <ThSort label="Phone Number" col="phone_number" />
                  <ThSort label="Website" col="website" />
                  <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>WhatsApp Text</th>
                  <ThSort label="Location" col="location_slug" />
                  <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Type</th>
                  <ThSort label="%" col="percentage" />
                  <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => (
                  <tr key={n.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-4 py-3 align-middle"><span className="text-sm font-medium font-mono" style={{ color: 'var(--foreground)' }}>{n.phone_number}</span></td>
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs" style={{ color: '#475569' }}>{n.website}</span></td>
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs truncate block max-w-[200px] mx-auto" style={{ color: '#94a3b8' }}>{n.whatsapp_text || '—'}</span></td>
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs" style={{ color: '#94a3b8' }}>{n.location_slug}</span></td>
                    <td className="px-4 py-3 align-middle text-center">
                      {n.type === 'default' ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--primary)', color: 'white' }}>Default</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>{n.label ?? 'Custom'}</span>}
                    </td>
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{n.percentage}%</span></td>
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
