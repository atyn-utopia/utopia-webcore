'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/contexts/ConfirmContext'
import { validatePhoneNumber, isDuplicatePhone } from '@/lib/validatePhone'

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

interface NewRow {
  phone_number: string
  whatsapp_text: string
  location_slug: string
  percentage: string
  label: string
}

const emptyNewRow = (): NewRow => ({ phone_number: '', whatsapp_text: '', location_slug: '', percentage: '', label: '' })

const BAR_COLORS = ['#1e3a5f', '#2979d6', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

function computeMode(active: ExistingNumber[]): string | null {
  if (active.length === 0) return null
  const allLoc = active.filter(n => n.location_slug === 'all')
  const specificLoc = active.filter(n => n.location_slug !== 'all')
  if (allLoc.length > 0 && specificLoc.length > 0) return 'hybrid'
  if (specificLoc.length > 0 && allLoc.length === 0) return 'location'
  if (allLoc.length === 1) return 'single'
  return 'rotation'
}

export default function EditPhoneNumbersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const confirm = useConfirm()
  const prefillWebsite = searchParams.get('website') ?? ''
  const prefillCompany = searchParams.get('company') ?? ''

  const [companies, setCompanies] = useState<{ id: string; name: string; company_websites: { domain: string }[] }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [website, setWebsite] = useState(prefillWebsite)
  const [existingNumbers, setExistingNumbers] = useState<ExistingNumber[]>([])
  const [existingTexts, setExistingTexts] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<ExistingNumber>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [newRow, setNewRow] = useState<NewRow>(emptyNewRow())
  const [addingNew, setAddingNew] = useState(false)
  const [newError, setNewError] = useState('')
  const [newWaOpen, setNewWaOpen] = useState(false)
  const [editWaOpen, setEditWaOpen] = useState(false)

  // Fetch companies
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
  }, [prefillCompany, prefillWebsite])

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

  // Sort with default first
  const sortedExisting = [...existingNumbers].sort((a, b) => {
    if (a.type === 'default' && b.type !== 'default') return -1
    if (a.type !== 'default' && b.type === 'default') return 1
    return 0
  })

  const currentMode = computeMode(existingNumbers.filter(n => n.is_active))

  // ─── Inline edit existing ─────────────────────────────────────
  function startEdit(n: ExistingNumber) {
    setEditingId(n.id)
    setEditError('')
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
    setEditError('')
  }

  const [editError, setEditError] = useState('')

  async function saveEdit() {
    if (!editingId) return
    setEditError('')
    const phoneErr = validatePhoneNumber(editDraft.phone_number ?? '')
    if (phoneErr) { setEditError(phoneErr); return }
    if (isDuplicatePhone(editDraft.phone_number ?? '', existingNumbers, editingId)) {
      setEditError('Another number with this value already exists for this website')
      return
    }
    if (!(editDraft.whatsapp_text ?? '').trim()) {
      setEditError('WhatsApp text is required')
      return
    }
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
    } else {
      const d = await res.json()
      setEditError(d.error ?? 'Save failed')
    }
  }

  async function deleteExisting(id: string) {
    const ok = await confirm({
      title: 'Delete phone number',
      message: 'This number will be permanently removed from the rotation pool. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchExisting(website)
  }

  // ─── Add new number (immediate) ───────────────────────────────
  async function addNewNumber() {
    setNewError('')
    if (!website.trim()) { setNewError('Please select a website first'); return }
    const phoneErr = validatePhoneNumber(newRow.phone_number)
    if (phoneErr) { setNewError(phoneErr); return }
    if (isDuplicatePhone(newRow.phone_number, existingNumbers)) {
      setNewError('This number already exists for this website')
      return
    }
    if (!newRow.whatsapp_text.trim()) { setNewError('WhatsApp text is required'); return }

    setAddingNew(true)
    const res = await fetch('/api/phone-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: website.trim(),
        location_slug: newRow.location_slug || 'all',
        phone_number: newRow.phone_number.trim(),
        type: 'custom',
        whatsapp_text: newRow.whatsapp_text.trim(),
        percentage: parseInt(newRow.percentage) || 0,
        label: newRow.label.trim() || null,
      }),
    })
    setAddingNew(false)
    if (res.ok) {
      setNewRow(emptyNewRow())
      await fetchExisting(website)
    } else {
      const d = await res.json()
      setNewError(d.error ?? 'Failed to add number')
    }
  }

  function handleDone() {
    router.push(`/phone-numbers?website=${encodeURIComponent(website)}`)
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto w-full">
        <PageHeader title="Edit Phone Numbers" description="Modify existing numbers or add new ones to this website's rotation pool." />

        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#e2e8f0', background: 'white' }}>
          {/* Card header */}
          <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e0f2fe' }}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Phone Number Details</h2>
              <p className="text-xs" style={{ color: '#94a3b8' }}>Edits save individually. New numbers are inserted on confirm.</p>
            </div>
          </div>

          <div className="p-6 space-y-6" style={{ background: 'white' }}>
            {/* Company & Website */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Company<span className="text-red-500 ml-0.5">*</span></label>
                <div className="relative">
                  <select
                    value={selectedCompany}
                    onChange={e => { setSelectedCompany(e.target.value); setWebsite('') }}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors cursor-pointer"
                    style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                  >
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Website<span className="text-red-500 ml-0.5">*</span></label>
                <div className="relative">
                  <select
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    disabled={!selectedCompany}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                  >
                    <option value="">{selectedCompany ? 'Select website…' : 'Select a company first'}</option>
                    {companyWebsites.map(w => <option key={w.domain} value={w.domain}>{w.domain}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Leads Mode Indicator — all 4 modes displayed */}
            {website && (
              <div className="rounded-xl border p-5" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#64748b' }} strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Leads Mode</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(['single', 'rotation', 'location', 'hybrid'] as const).map(mode => {
                    const isCurrent = currentMode === mode
                    const m = LEADS_MODE[mode]
                    return (
                      <div
                        key={mode}
                        className="rounded-xl p-3 border-2 transition-all relative"
                        style={{
                          background: isCurrent ? m.bg : 'white',
                          borderColor: isCurrent ? m.color : '#e2e8f0',
                          opacity: isCurrent ? 1 : 0.5,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold" style={{ color: isCurrent ? m.color : '#64748b' }}>{m.label}</span>
                          {isCurrent && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: m.color }}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          )}
                        </div>
                        <p className="text-xs leading-snug" style={{ color: isCurrent ? m.color : '#94a3b8' }}>{m.desc}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="text-sm mt-4 flex items-center gap-2 flex-wrap" style={{ color: '#475569' }}>
                  {!currentMode && existingNumbers.length === 0 && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: '#94a3b8' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      This website has no numbers yet. The mode will be set once you add one.
                    </span>
                  )}
                  {currentMode && (
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
                </div>
              </div>
            )}

            {/* Current Numbers table */}
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

                {/* Distribution bar */}
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

                {/* Rows */}
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
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {isDefault && <span className="text-xs px-2 py-1 rounded-full font-bold flex-shrink-0" style={{ background: 'var(--primary)', color: 'white' }}>★ DEFAULT</span>}
                              {!isDefault && n.label && <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#f1f5f9', color: '#475569' }}>{n.label}</span>}
                              <span className="text-sm font-mono font-semibold truncate" style={{ color: 'var(--foreground)' }}>{n.phone_number}</span>
                              <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#f8fafc', color: '#64748b' }}>
                                {n.location_slug === 'all' ? 'All locations' : n.location_slug}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{n.percentage}%</span>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${n.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: n.is_active ? '#16a34a' : '#94a3b8' }} />
                                {n.is_active ? 'Active' : 'Off'}
                              </span>
                              <button type="button" onClick={() => startEdit(n)}
                                className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
                                Edit
                              </button>
                              {!isDefault && (
                                <button type="button" onClick={() => deleteExisting(n.id)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:bg-[#ef4444] hover:border-white hover:text-white"
                                  style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4" style={{ background: '#fafbfc' }}>
                            {editError && (
                              <div className="mb-3 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>
                                {editError}
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Phone Number</label>
                                <input type="text" value={editDraft.phone_number ?? ''} onChange={e => setEditDraft(d => ({ ...d, phone_number: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: editError ? '#fca5a5' : '#cbd5e1', background: 'white' }} />
                              </div>
                              <div className="relative">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>WhatsApp Text</label>
                                <input type="text" value={editDraft.whatsapp_text ?? ''} onChange={e => setEditDraft(d => ({ ...d, whatsapp_text: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }}
                                  onFocus={() => setEditWaOpen(true)}
                                  onBlur={() => setTimeout(() => setEditWaOpen(false), 150)} />
                                {editWaOpen && existingTexts.filter(t => t.toLowerCase().includes((editDraft.whatsapp_text ?? '').toLowerCase())).length > 0 && (
                                  <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-lg z-20 max-h-52 overflow-y-auto" style={{ background: 'white', borderColor: '#e2e8f0' }}>
                                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0 bg-white" style={{ color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Existing texts</div>
                                    {existingTexts.filter(t => t.toLowerCase().includes((editDraft.whatsapp_text ?? '').toLowerCase())).map((text, ti) => (
                                      <button
                                        key={ti}
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setEditDraft(d => ({ ...d, whatsapp_text: text })); setEditWaOpen(false) }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors block truncate"
                                        style={{ color: '#475569' }}
                                      >
                                        {text}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Location</label>
                                <div className="relative">
                                  <select value={editDraft.location_slug ?? 'all'} onChange={e => setEditDraft(d => ({ ...d, location_slug: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer"
                                    style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                                    <option value="all">All locations</option>
                                    {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                                  </select>
                                  <svg className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <div className="w-20">
                                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>%</label>
                                  <input type="number" min="0" max="100" value={editDraft.percentage ?? 0}
                                    onChange={e => setEditDraft(d => ({ ...d, percentage: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }} />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Label</label>
                                  <input type="text" value={editDraft.label ?? ''} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))}
                                    disabled={isDefault}
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none disabled:opacity-50" style={{ borderColor: '#cbd5e1', background: 'white' }} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <button type="button" onClick={() => setEditDraft(d => ({ ...d, is_active: !d.is_active }))}
                                  className="relative w-9 h-5 rounded-full transition-colors"
                                  style={{ background: editDraft.is_active ? '#16a34a' : '#cbd5e1' }}>
                                  <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: editDraft.is_active ? 'translateX(16px)' : 'translateX(0)' }} />
                                </button>
                                <span className="text-xs" style={{ color: '#475569' }}>{editDraft.is_active ? 'Active' : 'Inactive'}</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={cancelEdit}
                                  className="text-xs px-3 py-1.5 rounded-md border transition-colors"
                                  style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
                                  Cancel
                                </button>
                                <button type="button" onClick={saveEdit} disabled={savingEdit}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md text-white transition-opacity disabled:opacity-50"
                                  style={{ background: 'var(--primary)' }}>
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

            {/* Add New Number — matches /new row styling */}
            <div>
              <div className="mb-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Add New Number</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Fill in the details and click &ldquo;Add to pool&rdquo; — the number will appear in the table above immediately.</p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border p-5" style={{ borderColor: '#e2e8f0', background: '#fafbfc' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--primary)', color: 'white' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: '#475569' }}>
                        New Number
                      </span>
                    </div>
                  </div>

                  {newError && (
                    <div className="mb-3 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>
                      {newError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Phone Number</label>
                      <input type="text" value={newRow.phone_number}
                        onChange={e => setNewRow(r => ({ ...r, phone_number: e.target.value }))}
                        placeholder="e.g. 60123456789"
                        className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                        style={{ borderColor: '#cbd5e1', background: 'white' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'} />
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>WhatsApp Text</label>
                      <input type="text" value={newRow.whatsapp_text}
                        onChange={e => setNewRow(r => ({ ...r, whatsapp_text: e.target.value }))}
                        placeholder="e.g. Hi, I'd like to enquire…"
                        className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                        style={{ borderColor: '#cbd5e1', background: 'white' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; setNewWaOpen(true) }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; setTimeout(() => setNewWaOpen(false), 150) }} />
                      {newWaOpen && existingTexts.filter(t => t.toLowerCase().includes(newRow.whatsapp_text.toLowerCase())).length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-lg z-20 max-h-52 overflow-y-auto" style={{ background: 'white', borderColor: '#e2e8f0' }}>
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0 bg-white" style={{ color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Existing texts</div>
                          {existingTexts.filter(t => t.toLowerCase().includes(newRow.whatsapp_text.toLowerCase())).map((text, ti) => (
                            <button
                              key={ti}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setNewRow(r => ({ ...r, whatsapp_text: text })); setNewWaOpen(false) }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors block truncate"
                              style={{ color: '#475569' }}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Location</label>
                      <div className="relative">
                        <select value={newRow.location_slug}
                          onChange={e => setNewRow(r => ({ ...r, location_slug: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer"
                          style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                          <option value="">All locations</option>
                          {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                        </select>
                        <svg className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-20">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>%</label>
                        <input type="number" min="0" max="100" value={newRow.percentage}
                          onChange={e => setNewRow(r => ({ ...r, percentage: e.target.value }))}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                          style={{ borderColor: '#cbd5e1', background: 'white' }} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Label <span className="font-normal" style={{ color: '#94a3b8' }}>(optional)</span></label>
                        <input type="text" value={newRow.label}
                          onChange={e => setNewRow(r => ({ ...r, label: e.target.value }))}
                          placeholder="e.g. Agent A"
                          className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
                          style={{ borderColor: '#cbd5e1', background: 'white' }} />
                      </div>
                    </div>
                  </div>

{/* Add to pool button — full width, prominent */}
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <button type="button" onClick={addNewNumber} disabled={addingNew || !website}
                      className="group/btn w-full flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3 rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shadow-sm hover:shadow-md"
                      style={{ background: 'var(--primary)' }}
                      onMouseEnter={e => { if (website && !addingNew) (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)' }}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary)'}>
                      {addingNew ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Adding…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add to Pool
                          <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
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
                  {['Edits save individually on each row', 'New numbers commit on Add to Pool', 'Mode updates automatically'].map(t => (
                    <li key={t} className="text-xs text-green-700 flex items-start gap-1"><span className="mt-0.5">•</span>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-5 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <Link href={`/phone-numbers${website ? `?website=${encodeURIComponent(website)}` : ''}`}
              className="text-sm font-medium px-5 py-2.5 rounded-lg border transition-all hover:bg-white hover:border-slate-400"
              style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}>
              Cancel
            </Link>
            <button type="button" onClick={handleDone}
              className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-lg text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              style={{ background: 'var(--primary)', minWidth: '180px', justifyContent: 'center' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
