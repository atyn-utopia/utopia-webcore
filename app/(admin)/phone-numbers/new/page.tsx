'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'

const MY_STATES = [
  { label: 'Johor', slug: 'johor' },
  { label: 'Kedah', slug: 'kedah' },
  { label: 'Kelantan', slug: 'kelantan' },
  { label: 'Kuala Lumpur', slug: 'kuala-lumpur' },
  { label: 'Labuan', slug: 'labuan' },
  { label: 'Melaka', slug: 'melaka' },
  { label: 'Negeri Sembilan', slug: 'negeri-sembilan' },
  { label: 'Pahang', slug: 'pahang' },
  { label: 'Perak', slug: 'perak' },
  { label: 'Perlis', slug: 'perlis' },
  { label: 'Pulau Pinang', slug: 'pulau-pinang' },
  { label: 'Putrajaya', slug: 'putrajaya' },
  { label: 'Sabah', slug: 'sabah' },
  { label: 'Sarawak', slug: 'sarawak' },
  { label: 'Selangor', slug: 'selangor' },
  { label: 'Terengganu', slug: 'terengganu' },
]

const LEADS_MODE: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  single: { label: 'Single', color: '#475569', bg: '#f1f5f9', desc: '1 active number, all locations' },
  rotation: { label: 'Rotation', color: '#0369a1', bg: '#e0f2fe', desc: 'Multiple numbers rotate for all locations' },
  location: { label: 'Location', color: '#7c3aed', bg: '#ede9fe', desc: 'Each number targets a specific location' },
  hybrid: { label: 'Hybrid', color: '#b45309', bg: '#fef3c7', desc: 'Mix of all-location and specific-location numbers' },
}

interface NumberRow {
  id: string
  phone_number: string
  whatsapp_text: string
  location_slug: string
  percentage: string
  label: string
}

interface ExistingNumber {
  id: string
  phone_number: string
  location_slug: string
  is_active: boolean
  whatsapp_text: string
  percentage: number
  label: string | null
  type: string
}

const BAR_COLORS = ['#1e3a5f', '#2979d6', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

function makeId() { return Math.random().toString(36).slice(2, 9) }

function emptyRow(): NumberRow {
  return { id: makeId(), phone_number: '', whatsapp_text: '', location_slug: '', percentage: '', label: '' }
}

/** Predict leads_mode from existing active numbers + new rows */
function predictMode(existing: ExistingNumber[], newRows: NumberRow[]): string | null {
  const allNums = [
    ...existing.filter(n => n.is_active).map(n => n.location_slug),
    ...newRows.map(r => r.location_slug || 'all'),
  ]
  if (allNums.length === 0) return null

  const allLoc = allNums.filter(l => l === 'all')
  const specificLoc = allNums.filter(l => l !== 'all')

  if (allLoc.length > 0 && specificLoc.length > 0) return 'hybrid'
  if (specificLoc.length > 0 && allLoc.length === 0) return 'location'
  if (allLoc.length === 1) return 'single'
  return 'rotation'
}

export default function NewPhoneNumberPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const prefillWebsite = searchParams.get('website') ?? ''
  const prefillCompany = searchParams.get('company') ?? ''
  const [companies, setCompanies] = useState<{ id: string; name: string; company_websites: { domain: string }[] }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [website, setWebsite] = useState(prefillWebsite)
  const [rows, setRows] = useState<NumberRow[]>([emptyRow()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [existingNumbers, setExistingNumbers] = useState<ExistingNumber[]>([])
  const [existingTexts, setExistingTexts] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<ExistingNumber>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Current mode (from DB) and predicted mode (after adding new numbers)
  const currentMode = predictMode(existingNumbers, [])
  const predictedMode = predictMode(existingNumbers, rows)
  const modeChanged = currentMode !== null && predictedMode !== currentMode

  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCompanies(data)
          if (prefillCompany) {
            const match = data.find((c: { name: string }) => c.name === prefillCompany)
            if (match) setSelectedCompany(match.id)
          } else if (prefillWebsite) {
            const match = data.find((c: { company_websites: { domain: string }[] }) =>
              c.company_websites.some(w => w.domain === prefillWebsite)
            )
            if (match) setSelectedCompany(match.id)
          }
        }
      })
      .catch(() => {})
  }, [prefillWebsite, prefillCompany])

  const companyWebsites = companies.find(c => c.id === selectedCompany)?.company_websites ?? []

  const fetchExisting = useCallback(async (ws: string) => {
    if (!ws.trim()) { setExistingNumbers([]); setExistingTexts([]); return }
    const res = await fetch(`/api/phone-numbers?website=${encodeURIComponent(ws.trim())}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      setExistingNumbers(data)
      const texts = [...new Set(data.map((n: { whatsapp_text?: string }) => n.whatsapp_text).filter(Boolean))] as string[]
      setExistingTexts(texts)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchExisting(website), 400)
    return () => clearTimeout(timeout)
  }, [website, fetchExisting])

  // Auto-distribute percentages evenly when rows change
  useEffect(() => {
    const activeExisting = existingNumbers.filter(n => n.is_active).length
    const total = activeExisting + rows.length
    if (total === 0) return
    const each = Math.floor(100 / total)
    const remainder = 100 - each * total
    setRows(prev => prev.map((r, i) => ({
      ...r,
      percentage: String(i === 0 ? each + remainder : each),
    })))
  }, [rows.length, existingNumbers])

  // Existing numbers sorted: default first, then by created order
  const sortedExisting = [...existingNumbers].sort((a, b) => {
    if (a.type === 'default' && b.type !== 'default') return -1
    if (a.type !== 'default' && b.type === 'default') return 1
    return 0
  })

  function startEdit(n: ExistingNumber) {
    setEditingId(n.id)
    setEditDraft({
      phone_number: n.phone_number,
      whatsapp_text: n.whatsapp_text,
      location_slug: n.location_slug,
      percentage: n.percentage,
      label: n.label,
      is_active: n.is_active,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  async function saveEdit() {
    if (!editingId) return
    setSavingEdit(true)
    const res = await fetch(`/api/phone-numbers/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    })
    setSavingEdit(false)
    if (res.ok) {
      await fetchExisting(website)
      cancelEdit()
    }
  }

  async function deleteExisting(id: string) {
    if (!confirm('Delete this phone number?')) return
    const res = await fetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchExisting(website)
  }

  function updateRow(id: string, field: keyof NumberRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!selectedCompany) e.company = 'Please select a company'
    if (!website.trim()) e.website = 'Please select a website'
    rows.forEach((r, i) => {
      if (!r.phone_number.trim()) e[`phone_${i}`] = 'Required'
      if (!r.whatsapp_text.trim()) e[`wa_${i}`] = 'Required'
    })
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    setServerError('')

    try {
      // Submit all rows
      const results = await Promise.all(
        rows.map(r =>
          fetch('/api/phone-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              website: website.trim(),
              location_slug: r.location_slug || 'all',
              phone_number: r.phone_number.trim(),
              type: 'custom',
              whatsapp_text: r.whatsapp_text.trim(),
              percentage: parseInt(r.percentage) || Math.floor(100 / rows.length),
              label: r.label.trim() || null,
            }),
          })
        )
      )

      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) {
        const d = await failed[0].json()
        setServerError(d.error ?? `${failed.length} number(s) failed to save`)
      } else {
        router.push(`/phone-numbers?website=${encodeURIComponent(website)}`)
      }
    } catch {
      setServerError('Something went wrong')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto w-full">
        <PageHeader title={t('page.addPhone.title')} description={t('page.addPhone.description')} />

        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#e2e8f0', background: 'white' }}>

          {/* Card header */}
          <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e0f2fe' }}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Phone Number Details</h2>
              <p className="text-xs" style={{ color: '#94a3b8' }}>Select a website to see its current numbers and add new ones</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6" style={{ background: 'white' }}>

              {serverError && (
                <div className="p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>
                  {serverError}
                </div>
              )}

              {/* Company & Website row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Company<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCompany}
                      onChange={e => { setSelectedCompany(e.target.value); setWebsite('') }}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors cursor-pointer"
                      style={{ borderColor: errors.company ? '#fca5a5' : '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                    >
                      <option value="">Select company…</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {errors.company && <p className="mt-1 text-xs text-red-500">{errors.company}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Website<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      disabled={!selectedCompany}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: errors.website ? '#fca5a5' : '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                    >
                      <option value="">{selectedCompany ? 'Select website…' : 'Select a company first'}</option>
                      {companyWebsites.map(w => <option key={w.domain} value={w.domain}>{w.domain}</option>)}
                    </select>
                    <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website}</p>}
                </div>
              </div>

              {/* Leads Mode Indicator — all 4 modes displayed */}
              {website && (
                <div className="rounded-xl border p-5" style={{ borderColor: modeChanged ? '#fbbf24' : '#e2e8f0', background: modeChanged ? '#fffbeb' : '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: modeChanged ? '#d97706' : '#64748b' }} strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Leads Mode</span>
                    {modeChanged && (
                      <span className="text-xs font-semibold ml-auto px-2 py-1 rounded-full" style={{ background: '#fef3c7', color: '#d97706' }}>
                        Mode will change after save
                      </span>
                    )}
                  </div>
                  {/* All 4 mode pills */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {(['single', 'rotation', 'location', 'hybrid'] as const).map(mode => {
                      const isCurrent = currentMode === mode
                      const isPredicted = predictedMode === mode
                      const m = LEADS_MODE[mode]
                      return (
                        <div
                          key={mode}
                          className="rounded-xl p-3 border-2 transition-all relative"
                          style={{
                            background: isPredicted ? m.bg : 'white',
                            borderColor: isPredicted ? m.color : '#e2e8f0',
                            opacity: isPredicted || isCurrent ? 1 : 0.5,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold" style={{ color: isPredicted ? m.color : '#64748b' }}>{m.label}</span>
                            {isCurrent && !isPredicted && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: '#f1f5f9', color: '#64748b' }}>NOW</span>
                            )}
                            {isPredicted && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: m.color }}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                            )}
                          </div>
                          <p className="text-xs leading-snug" style={{ color: isPredicted ? m.color : '#94a3b8' }}>{m.desc}</p>
                        </div>
                      )
                    })}
                  </div>
                  {/* Status line */}
                  <div className="text-sm mt-4 flex items-center gap-2 flex-wrap" style={{ color: '#475569' }}>
                    {!currentMode && existingNumbers.length === 0 && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: '#94a3b8' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        This website has no numbers yet. The mode will be set once you add one.
                      </span>
                    )}
                    {currentMode && !modeChanged && (
                      <>
                        <span>This website is currently operating in</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: LEADS_MODE[currentMode].bg, color: LEADS_MODE[currentMode].color }}>
                          {LEADS_MODE[currentMode].label}
                        </span>
                        <span>mode with</span>
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{existingNumbers.filter(n => n.is_active).length}</span>
                        <span>of</span>
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{existingNumbers.length}</span>
                        <span>number{existingNumbers.length !== 1 ? 's' : ''} active.</span>
                      </>
                    )}
                    {modeChanged && currentMode && predictedMode && (
                      <>
                        <span>Adding</span>
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{rows.length}</span>
                        <span>new number{rows.length > 1 ? 's' : ''} will transition this website from</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: LEADS_MODE[currentMode].bg, color: LEADS_MODE[currentMode].color }}>
                          {LEADS_MODE[currentMode].label}
                        </span>
                        <span>to</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: LEADS_MODE[predictedMode].bg, color: LEADS_MODE[predictedMode].color }}>
                          {LEADS_MODE[predictedMode].label}
                        </span>
                        <span>mode.</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Existing numbers list */}
              {website && existingNumbers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Current Numbers</h3>
                      <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Default number is pinned to top. Click Edit to modify any number.</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
                      {existingNumbers.filter(n => n.is_active).length} active / {existingNumbers.length} total
                    </span>
                  </div>

                  {/* Percentage distribution bar */}
                  {existingNumbers.filter(n => n.is_active).length > 0 && (
                    <div className="mb-4 rounded-xl border p-4" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold" style={{ color: '#475569' }}>Lead Distribution</span>
                        <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                          Total: {sortedExisting.filter(n => n.is_active).reduce((s, n) => s + (n.percentage ?? 0), 0)}%
                        </span>
                      </div>
                      <div className="flex h-4 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                        {sortedExisting.filter(n => n.is_active && n.percentage > 0).map((n, idx) => (
                          <div key={n.id} style={{ width: `${n.percentage}%`, background: BAR_COLORS[idx % BAR_COLORS.length] }} title={`${n.phone_number}: ${n.percentage}%`} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                        {sortedExisting.filter(n => n.is_active).map((n, idx) => (
                          <div key={n.id} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: BAR_COLORS[idx % BAR_COLORS.length] }} />
                            <span className="text-xs" style={{ color: '#475569' }}>
                              {n.type === 'default' && <span className="font-bold" style={{ color: 'var(--primary)' }}>★ </span>}
                              <span className="font-mono">{n.phone_number.slice(-4)}</span>: <span className="font-semibold">{n.percentage}%</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Numbers table */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                    {sortedExisting.map((n, i) => {
                      const isDefault = n.type === 'default'
                      const isEditing = editingId === n.id
                      return (
                        <div key={n.id} style={{
                          borderBottom: i < sortedExisting.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: isDefault ? '#fff9e6' : 'white',
                        }}>
                          {!isEditing ? (
                            <div className="px-4 py-3.5 flex items-center gap-3 flex-wrap">
                              {/* Default/label badge */}
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {isDefault && (
                                  <span className="text-xs px-2 py-1 rounded-full font-bold flex-shrink-0" style={{ background: 'var(--primary)', color: 'white' }}>★ DEFAULT</span>
                                )}
                                {!isDefault && n.label && (
                                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#f1f5f9', color: '#475569' }}>{n.label}</span>
                                )}
                                <span className="text-sm font-mono font-semibold truncate" style={{ color: 'var(--foreground)' }}>{n.phone_number}</span>
                                <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#f8fafc', color: '#64748b' }}>
                                  {n.location_slug === 'all' ? 'All locations' : n.location_slug}
                                </span>
                              </div>
                              {/* Percentage + status */}
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{n.percentage}%</span>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${n.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: n.is_active ? '#16a34a' : '#94a3b8' }} />
                                  {n.is_active ? 'Active' : 'Off'}
                                </span>
                                {/* Edit button */}
                                <button
                                  type="button"
                                  onClick={() => startEdit(n)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                  style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                                >
                                  Edit
                                </button>
                                {/* Delete only for non-default */}
                                {!isDefault && (
                                  <button
                                    type="button"
                                    onClick={() => deleteExisting(n.id)}
                                    className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:border-red-400 hover:text-red-500"
                                    style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Edit mode */
                            <div className="p-3" style={{ background: '#fafbfc' }}>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Phone Number</label>
                                  <input
                                    type="text"
                                    value={editDraft.phone_number ?? ''}
                                    onChange={e => setEditDraft(d => ({ ...d, phone_number: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                                    style={{ borderColor: '#cbd5e1', background: 'white' }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>WhatsApp Text</label>
                                  <input
                                    type="text"
                                    value={editDraft.whatsapp_text ?? ''}
                                    onChange={e => setEditDraft(d => ({ ...d, whatsapp_text: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                                    style={{ borderColor: '#cbd5e1', background: 'white' }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Location</label>
                                  <div className="relative">
                                    <select
                                      value={editDraft.location_slug ?? 'all'}
                                      onChange={e => setEditDraft(d => ({ ...d, location_slug: e.target.value }))}
                                      className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer"
                                      style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                                    >
                                      <option value="all">All locations</option>
                                      {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                                    </select>
                                    <svg className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <div className="w-20">
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>%</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={editDraft.percentage ?? 0}
                                      onChange={e => setEditDraft(d => ({ ...d, percentage: parseInt(e.target.value) || 0 }))}
                                      className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                                      style={{ borderColor: '#cbd5e1', background: 'white' }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Label</label>
                                    <input
                                      type="text"
                                      value={editDraft.label ?? ''}
                                      onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))}
                                      disabled={isDefault}
                                      className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none disabled:opacity-50"
                                      style={{ borderColor: '#cbd5e1', background: 'white' }}
                                    />
                                  </div>
                                </div>
                              </div>
                              {/* Active toggle + actions */}
                              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <button
                                    type="button"
                                    onClick={() => setEditDraft(d => ({ ...d, is_active: !d.is_active }))}
                                    className="relative w-9 h-5 rounded-full transition-colors"
                                    style={{ background: editDraft.is_active ? '#16a34a' : '#cbd5e1' }}
                                  >
                                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: editDraft.is_active ? 'translateX(16px)' : 'translateX(0)' }} />
                                  </button>
                                  <span className="text-xs" style={{ color: '#475569' }}>{editDraft.is_active ? 'Active' : 'Inactive'}</span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="text-xs px-3 py-1.5 rounded-md border transition-colors"
                                    style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEdit}
                                    disabled={savingEdit}
                                    className="text-xs font-medium px-3 py-1.5 rounded-md text-white transition-opacity disabled:opacity-50"
                                    style={{ background: 'var(--primary)' }}
                                  >
                                    {savingEdit ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {website && existingNumbers.length === 0 && (
                <div className="rounded-lg border p-4 text-center" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>No phone numbers exist for this website yet. Add the first one below.</p>
                </div>
              )}

              {/* Number rows */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                      New Numbers<span className="text-red-500 ml-1">*</span>
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Add one or more new numbers to this website</p>
                  </div>
                  <div className="relative group/add">
                    <button
                      type="button"
                      onClick={addRow}
                      disabled={!website}
                      className="text-sm font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      style={{ borderColor: '#cbd5e1', color: '#475569' }}
                    >
                      + Add another
                    </button>
                    {!website && (
                      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover/add:opacity-100 transition-opacity z-20" style={{ background: '#1e293b' }}>
                        Select a website first
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-b-4" style={{ borderBottomColor: '#1e293b' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {rows.map((row, i) => (
                    <div key={row.id} className="rounded-xl border p-5" style={{ borderColor: '#e2e8f0', background: '#fafbfc' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--primary)', color: 'white' }}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-semibold" style={{ color: '#475569' }}>
                            New Number {i + 1}
                          </span>
                        </div>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:border-red-400 hover:text-red-500 hover:bg-red-50"
                            style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Phone number */}
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Phone Number</label>
                          <input
                            type="text"
                            value={row.phone_number}
                            onChange={e => updateRow(row.id, 'phone_number', e.target.value)}
                            placeholder="e.g. 60123456789"
                            className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                            style={{ borderColor: errors[`phone_${i}`] ? '#fca5a5' : '#cbd5e1', background: 'white' }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.currentTarget.style.borderColor = errors[`phone_${i}`] ? '#fca5a5' : '#cbd5e1'}
                          />
                          {errors[`phone_${i}`] && <p className="mt-0.5 text-xs text-red-500">{errors[`phone_${i}`]}</p>}
                        </div>

                        {/* WhatsApp text */}
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>WhatsApp Text</label>
                          <input
                            type="text"
                            value={row.whatsapp_text}
                            onChange={e => updateRow(row.id, 'whatsapp_text', e.target.value)}
                            placeholder="e.g. Hi, I'd like to enquire…"
                            className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                            style={{ borderColor: errors[`wa_${i}`] ? '#fca5a5' : '#cbd5e1', background: 'white' }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.currentTarget.style.borderColor = errors[`wa_${i}`] ? '#fca5a5' : '#cbd5e1'}
                          />
                          {errors[`wa_${i}`] && <p className="mt-0.5 text-xs text-red-500">{errors[`wa_${i}`]}</p>}
                        </div>

                        {/* Location */}
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Location</label>
                          <div className="relative">
                            <select
                              value={row.location_slug}
                              onChange={e => updateRow(row.id, 'location_slug', e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer"
                              style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                            >
                              <option value="">All locations</option>
                              {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                            </select>
                            <svg className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>

                        {/* Percentage + Label */}
                        <div className="flex gap-3">
                          <div className="w-20">
                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>%</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={row.percentage}
                              onChange={e => updateRow(row.id, 'percentage', e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                              style={{ borderColor: '#cbd5e1', background: 'white' }}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Label <span className="font-normal" style={{ color: '#94a3b8' }}>(optional)</span></label>
                            <input
                              type="text"
                              value={row.label}
                              onChange={e => updateRow(row.id, 'label', e.target.value)}
                              placeholder="e.g. Agent A"
                              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                              style={{ borderColor: '#cbd5e1', background: 'white' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* WA text suggestions (only show for first row if no text filled) */}
                      {i === 0 && existingTexts.length > 0 && !row.whatsapp_text && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                          <p className="text-xs font-medium mb-1.5.5" style={{ color: '#94a3b8' }}>Existing texts — click to use:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {existingTexts.map((text, ti) => (
                              <button
                                key={ti}
                                type="button"
                                onClick={() => updateRow(row.id, 'whatsapp_text', text)}
                                className="text-xs px-2.5 py-1 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                              >
                                {text.length > 50 ? text.slice(0, 50) + '…' : text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info boxes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-orange-700">Important</span>
                  </div>
                  <ul className="space-y-1">
                    {['Domain must match exactly', 'Include country code (60…)', 'No spaces or dashes'].map(t => (
                      <li key={t} className="text-xs text-orange-700 flex items-start gap-1"><span className="mt-0.5">•</span>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border p-3" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-green-700">How it works</span>
                  </div>
                  <ul className="space-y-1">
                    {['Percentages auto-distribute evenly', 'Mode updates automatically on save', 'Toggle active to pause a number'].map(t => (
                      <li key={t} className="text-xs text-green-700 flex items-start gap-1"><span className="mt-0.5">•</span>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <Link
                href="/phone-numbers"
                className="text-sm font-medium px-5 py-2.5 rounded-lg border transition-all hover:bg-white hover:border-slate-400"
                style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}
              >
                Cancel
              </Link>
              <div className="relative group/submit">
                <button
                  type="submit"
                  disabled={saving || !website}
                  className="group/btn flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
                  style={{ background: 'var(--primary)', minWidth: '200px', justifyContent: 'center' }}
                  onMouseEnter={e => { if (website && !saving) (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)' }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary)'}
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add {rows.length} Number{rows.length > 1 ? 's' : ''}
                      <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
                {!website && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover/submit:opacity-100 transition-opacity z-20" style={{ background: '#1e293b' }}>
                    Select a company and website first
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4" style={{ borderTopColor: '#1e293b' }} />
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
