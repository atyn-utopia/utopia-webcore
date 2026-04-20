'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useToast } from '@/contexts/ToastContext'
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

const LOCATION_LABEL: Record<string, string> = Object.fromEntries(MY_STATES.map(s => [s.slug, s.label]))

const LEADS_MODE: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  single: { label: 'Single', color: '#475569', bg: '#f1f5f9', desc: '1 active number, all locations' },
  rotation: { label: 'Rotation', color: '#0369a1', bg: '#e0f2fe', desc: 'Multiple numbers rotate for all locations' },
  location: { label: 'Location', color: '#7c3aed', bg: '#ede9fe', desc: 'Each number targets a specific location' },
  hybrid: { label: 'Hybrid', color: '#b45309', bg: '#fef3c7', desc: 'Mix of all-location and specific-location numbers' },
}

const BAR_COLORS = ['#1e3a5f', '#2979d6', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

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

interface WorkingRow {
  key: string            // stable: id for existing, tempId for new
  id?: string            // set for existing rows
  phone_number: string
  whatsapp_text: string
  location_slug: string
  percentage: number
  label: string
  is_active: boolean
  type: string           // 'default' | 'custom'
  isNew: boolean
  markedForDelete: boolean
  dirty: boolean
}

function toWorkingRow(n: ExistingNumber): WorkingRow {
  return {
    key: n.id,
    id: n.id,
    phone_number: n.phone_number,
    whatsapp_text: n.whatsapp_text,
    location_slug: n.location_slug || 'all',
    percentage: n.percentage,
    label: n.label ?? '',
    is_active: n.is_active,
    type: n.type,
    isNew: false,
    markedForDelete: false,
    dirty: false,
  }
}

function emptyNewRow(): WorkingRow {
  return {
    key: `new-${Math.random().toString(36).slice(2, 10)}`,
    phone_number: '',
    whatsapp_text: '',
    location_slug: 'all',
    percentage: 0,
    label: '',
    is_active: true,
    type: 'custom',
    isNew: true,
    markedForDelete: false,
    dirty: false,
  }
}

function computeMode(active: WorkingRow[]): string | null {
  if (active.length === 0) return null
  const allLoc = active.filter(n => n.location_slug === 'all')
  const specificLoc = active.filter(n => n.location_slug !== 'all')
  if (allLoc.length > 0 && specificLoc.length > 0) return 'hybrid'
  if (specificLoc.length > 0 && allLoc.length === 0) return 'location'
  if (allLoc.length === 1) return 'single'
  return 'rotation'
}

/**
 * Redistribute percentages across active, non-deleted rows so the total = 100.
 * Scales the other rows proportionally to absorb the change; integers only.
 * Uses largest-remainder rounding so totals stay exact.
 */
function rebalancePercentages(rows: WorkingRow[], editedKey: string, rawValue: number): WorkingRow[] {
  const newValue = Math.max(0, Math.min(100, Math.round(rawValue)))
  const next = rows.map(r => r.key === editedKey ? { ...r, percentage: newValue, dirty: r.dirty || !r.isNew } : r)

  const othersIdx: number[] = []
  next.forEach((r, i) => {
    if (r.key === editedKey) return
    if (!r.is_active || r.markedForDelete) return
    othersIdx.push(i)
  })
  if (othersIdx.length === 0) return next

  const targetOthers = 100 - newValue
  if (targetOthers <= 0) {
    othersIdx.forEach(i => { next[i] = { ...next[i], percentage: 0, dirty: next[i].dirty || !next[i].isNew } })
    return next
  }

  const oldOthersSum = othersIdx.reduce((s, i) => s + next[i].percentage, 0)
  const floats = othersIdx.map(i =>
    oldOthersSum > 0 ? next[i].percentage * targetOthers / oldOthersSum : targetOthers / othersIdx.length,
  )
  const floors = floats.map(Math.floor)
  let remainder = targetOthers - floors.reduce((s, f) => s + f, 0)
  const residuals = floats.map((f, k) => ({ r: f - floors[k], k })).sort((a, b) => b.r - a.r)
  for (let j = 0; j < remainder && j < residuals.length; j++) floors[residuals[j].k] += 1

  othersIdx.forEach((i, k) => {
    if (next[i].percentage !== floors[k]) {
      next[i] = { ...next[i], percentage: floors[k], dirty: next[i].dirty || !next[i].isNew }
    }
  })
  return next
}

function buildWhatsAppPreview(domain: string, locationSlug: string, text: string): string {
  const loc = locationSlug && locationSlug !== 'all' ? ` ${LOCATION_LABEL[locationSlug] ?? locationSlug}` : ''
  return `Hi ${domain}${loc}, ${text}`.trim()
}

export default function ManagePhoneNumbersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const confirm = useConfirm()
  const toast = useToast()
  const prefillWebsite = searchParams.get('website') ?? ''
  const prefillCompany = searchParams.get('company') ?? ''

  const [companies, setCompanies] = useState<{ id: string; name: string; company_websites: { domain: string }[] }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [website, setWebsite] = useState(prefillWebsite)

  const [rows, setRows] = useState<WorkingRow[]>([])
  const [addDrafts, setAddDrafts] = useState<WorkingRow[]>([emptyNewRow()])
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [existingTexts, setExistingTexts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [waOpenKey, setWaOpenKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        setCompanies(data)
        if (prefillCompany) {
          const match = data.find((c: { name: string }) => c.name === prefillCompany)
          if (match) setSelectedCompany(match.id)
        } else if (prefillWebsite) {
          const match = data.find((c: { company_websites: { domain: string }[] }) =>
            c.company_websites.some(w => w.domain === prefillWebsite),
          )
          if (match) setSelectedCompany(match.id)
        }
      })
      .catch(() => {})
  }, [prefillCompany, prefillWebsite])

  const companyWebsites = companies.find(c => c.id === selectedCompany)?.company_websites ?? []

  const fetchExisting = useCallback(async (ws: string) => {
    if (!ws.trim()) { setRows([]); setExistingTexts([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/phone-numbers?website=${encodeURIComponent(ws.trim())}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        const sorted: ExistingNumber[] = [...data].sort((a, b) => {
          if (a.type === 'default' && b.type !== 'default') return -1
          if (a.type !== 'default' && b.type === 'default') return 1
          return 0
        })
        setRows(sorted.map(toWorkingRow))
        setExistingTexts([...new Set(sorted.map(n => n.whatsapp_text).filter(Boolean))])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchExisting(website), 400)
    return () => clearTimeout(timeout)
  }, [website, fetchExisting])

  useEffect(() => {
    const active = rows.filter(r => r.is_active && !r.markedForDelete)
    setSelectedMode(prev => prev ?? computeMode(active))
  }, [rows])

  const currentMode = useMemo(() => computeMode(rows.filter(r => r.is_active && !r.markedForDelete)), [rows])

  const allActiveForPct = useMemo(
    () => [...rows, ...addDrafts.filter(d => d.phone_number.trim())].filter(r => r.is_active && !r.markedForDelete),
    [rows, addDrafts],
  )
  const pctTotal = allActiveForPct.reduce((s, r) => s + (r.percentage || 0), 0)

  function patchRow(key: string, patch: Partial<WorkingRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch, dirty: true } : r))
  }

  function patchDraft(key: string, patch: Partial<WorkingRow>) {
    setAddDrafts(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d))
  }

  function onChangePercentage(key: string, value: number, isDraft: boolean) {
    const combined = [...rows, ...addDrafts]
    const rebalanced = rebalancePercentages(combined, key, value)
    setRows(rebalanced.filter(r => !r.isNew))
    setAddDrafts(rebalanced.filter(r => r.isNew))
    void isDraft
  }

  function toggleDelete(key: string) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, markedForDelete: !r.markedForDelete } : r))
  }

  function addBlankDraft() {
    setAddDrafts(prev => [...prev, emptyNewRow()])
  }

  function removeDraft(key: string) {
    setAddDrafts(prev => prev.length === 1 ? [emptyNewRow()] : prev.filter(d => d.key !== key))
  }

  const deletingCount = rows.filter(r => r.markedForDelete).length
  const dirtyCount = rows.filter(r => r.dirty && !r.markedForDelete).length
  const newCount = addDrafts.filter(d => d.phone_number.trim()).length
  const hasChanges = deletingCount > 0 || dirtyCount > 0 || newCount > 0

  async function doSave() {
    if (!website) { toast.error('Pick a website first', 'Missing website'); return }

    // Validate inputs
    const allNumbers = [...rows.filter(r => !r.markedForDelete), ...addDrafts.filter(d => d.phone_number.trim())]
    for (const r of allNumbers) {
      if (!r.is_active) continue
      const err = validatePhoneNumber(r.phone_number)
      if (err) { toast.error(`${r.phone_number || '(empty)'}: ${err}`, 'Invalid phone'); return }
      if (!r.whatsapp_text.trim()) { toast.error(`${r.phone_number}: WhatsApp text is required`, 'Missing text'); return }
    }

    // Duplicate check (within final list)
    const seen = new Set<string>()
    for (const r of allNumbers) {
      const n = r.phone_number.trim()
      if (seen.has(n)) { toast.error(`Duplicate number: ${n}`, 'Duplicate'); return }
      seen.add(n)
    }

    // Percentage check
    if (pctTotal !== 100) {
      toast.error(`Active percentages total ${pctTotal}% — must be exactly 100% before saving`, 'Percentage invalid')
      return
    }

    const ok = await confirm({
      title: 'Save changes?',
      message: `${dirtyCount} updated · ${newCount} added · ${deletingCount} deleted. This cannot be undone.`,
      confirmLabel: 'Save',
      variant: 'default',
    })
    if (!ok) return

    setSaving(true)
    try {
      // Deletes first
      for (const r of rows.filter(x => x.markedForDelete && x.id)) {
        const res = await fetch(`/api/phone-numbers/${r.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`Delete failed for ${r.phone_number}`)
      }
      // Patches
      for (const r of rows.filter(x => x.dirty && !x.markedForDelete && x.id)) {
        const body = {
          phone_number: r.phone_number.trim(),
          whatsapp_text: r.whatsapp_text.trim(),
          location_slug: r.location_slug || 'all',
          percentage: r.percentage,
          label: r.label.trim() || null,
          is_active: r.is_active,
        }
        const res = await fetch(`/api/phone-numbers/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? `Update failed for ${r.phone_number}`)
        }
      }
      // Posts
      for (const d of addDrafts.filter(x => x.phone_number.trim())) {
        const body = {
          website: website.trim(),
          location_slug: d.location_slug || 'all',
          phone_number: d.phone_number.trim(),
          type: 'custom',
          whatsapp_text: d.whatsapp_text.trim(),
          percentage: d.percentage,
          label: d.label.trim() || null,
        }
        const res = await fetch('/api/phone-numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? `Add failed for ${d.phone_number}`)
        }
      }
      toast.success('All changes saved', 'Saved')
      setAddDrafts([emptyNewRow()])
      await fetchExisting(website)
    } catch (e) {
      toast.error((e as Error).message, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleDone() {
    router.push(`/phone-numbers?website=${encodeURIComponent(website)}`)
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto w-full">
        <PageHeader title="Manage Phone Numbers" description="Edit numbers inline, stage new ones, and pick the lead-distribution mode." />

        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#e2e8f0', background: 'white' }}>
          {/* Company / Website */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Company<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                <select value={selectedCompany}
                  onChange={e => { setSelectedCompany(e.target.value); setWebsite(''); setSelectedMode(null) }}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer focus:outline-none"
                  style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Website<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                <select value={website} onChange={e => { setWebsite(e.target.value); setSelectedMode(null); setAddDrafts([emptyNewRow()]) }}
                  disabled={!selectedCompany}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                  <option value="">{selectedCompany ? 'Select website…' : 'Select a company first'}</option>
                  {companyWebsites.map(w => <option key={w.domain} value={w.domain}>{w.domain}</option>)}
                </select>
                <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {!website ? (
            <div className="p-10 text-center text-sm" style={{ color: '#94a3b8' }}>Select a company and website to manage phone numbers.</div>
          ) : (
            <>
              {/* Mode selector */}
              <div className="px-6 pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#64748b' }} strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Leads Mode</span>
                  {currentMode && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#64748b' }}>Auto-detected: {LEADS_MODE[currentMode].label}</span>}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(['single', 'rotation', 'location', 'hybrid'] as const).map(mode => {
                    const isSelected = selectedMode === mode
                    const isDetected = currentMode === mode
                    const m = LEADS_MODE[mode]
                    return (
                      <button type="button" key={mode} onClick={() => setSelectedMode(mode)}
                        className="text-left rounded-xl p-3 border-2 transition-all relative"
                        style={{
                          background: isSelected ? m.bg : 'white',
                          borderColor: isSelected ? m.color : '#e2e8f0',
                          opacity: isSelected ? 1 : 0.7,
                        }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold" style={{ color: isSelected ? m.color : '#64748b' }}>{m.label}</span>
                          {isDetected && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}` }}>CURRENT</span>
                          )}
                        </div>
                        <p className="text-xs leading-snug" style={{ color: isSelected ? m.color : '#94a3b8' }}>{m.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Distribution bar */}
              <div className="px-6 pt-5">
                <div className="rounded-xl border p-4" style={{ borderColor: pctTotal === 100 ? '#e2e8f0' : '#fca5a5', background: pctTotal === 100 ? '#f8fafc' : '#fef2f2' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold" style={{ color: '#475569' }}>Lead Distribution</span>
                    <span className="text-xs font-semibold" style={{ color: pctTotal === 100 ? '#16a34a' : '#b91c1c' }}>
                      Total: {pctTotal}% {pctTotal === 100 ? '✓' : '(must be 100%)'}
                    </span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                    {allActiveForPct.filter(r => r.percentage > 0).map((r, idx) => (
                      <div key={r.key} style={{ width: `${r.percentage}%`, background: BAR_COLORS[idx % BAR_COLORS.length] }} title={`${r.phone_number || 'new'}: ${r.percentage}%`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Phone Numbers</h3>
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                    {loading && <span>Loading…</span>}
                    {deletingCount > 0 && <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">{deletingCount} marked to delete</span>}
                    {dirtyCount > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{dirtyCount} edited</span>}
                    {newCount > 0 && <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium">{newCount} new</span>}
                  </div>
                </div>

                <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#e2e8f0' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <Th>Phone Number</Th>
                        <Th>WhatsApp Text</Th>
                        <Th>Location</Th>
                        <Th className="w-20">%</Th>
                        <Th>Label</Th>
                        <Th className="w-24 text-center">Active</Th>
                        <Th className="w-12 text-center">Del</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <RowEditor key={r.key} r={r} existingTexts={existingTexts}
                          waOpenKey={waOpenKey} setWaOpenKey={setWaOpenKey}
                          onPatch={patch => patchRow(r.key, patch)}
                          onPercentage={val => onChangePercentage(r.key, val, false)}
                          onToggleDelete={() => toggleDelete(r.key)}
                        />
                      ))}
                      {addDrafts.map((d, idx) => (
                        <DraftRowEditor key={d.key} d={d} existingTexts={existingTexts}
                          waOpenKey={waOpenKey} setWaOpenKey={setWaOpenKey}
                          showAdd={idx === addDrafts.length - 1}
                          onPatch={patch => patchDraft(d.key, patch)}
                          onPercentage={val => onChangePercentage(d.key, val, true)}
                          onRemove={() => removeDraft(d.key)}
                          onAdd={addBlankDraft}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview */}
              <div className="px-6 pb-6">
                <div className="rounded-xl border p-5" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#16a34a' }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>WhatsApp Preview</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}>
                      Hi &lt;domain&gt;[ &lt;location&gt;], &lt;text&gt;
                    </span>
                  </div>
                  <div className="space-y-2">
                    {allActiveForPct.length === 0 ? (
                      <p className="text-xs" style={{ color: '#94a3b8' }}>No active rows to preview yet.</p>
                    ) : allActiveForPct.map(r => {
                      const preview = buildWhatsAppPreview(website, r.location_slug, r.whatsapp_text || '…')
                      const testUrl = `https://wa.me/${r.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(preview)}`
                      return (
                        <div key={r.key} className="flex items-start gap-3 rounded-lg bg-white border p-3" style={{ borderColor: '#e2e8f0' }}>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium mb-1" style={{ color: '#64748b' }}>
                              <span className="font-mono">{r.phone_number || '(no number)'}</span>
                              {r.location_slug !== 'all' && <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: '#ede9fe', color: '#7c3aed' }}>{LOCATION_LABEL[r.location_slug] ?? r.location_slug}</span>}
                            </div>
                            <div className="text-sm" style={{ color: '#0f172a' }}>{preview}</div>
                          </div>
                          {r.phone_number.replace(/\D/g, '').length >= 8 && (
                            <a href={testUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors hover:border-green-500 hover:text-green-700 flex-shrink-0"
                              style={{ borderColor: '#e2e8f0', color: '#16a34a' }}>
                              Test
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="px-6 py-5 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <Link href={`/phone-numbers${website ? `?website=${encodeURIComponent(website)}` : ''}`}
              className="text-sm font-medium px-5 py-2.5 rounded-lg border transition-all hover:bg-white"
              style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}>
              Cancel
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              {hasChanges && <span className="text-xs" style={{ color: '#64748b' }}>Unsaved changes</span>}
              <button type="button" onClick={handleDone}
                className="text-sm font-medium px-4 py-2.5 rounded-lg border transition-colors"
                style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                Back to website
              </button>
              <button type="button" onClick={doSave} disabled={saving || !website || !hasChanges}
                className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                style={{ background: 'var(--primary)' }}>
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left text-[10px] font-semibold uppercase tracking-wider px-3 py-2.5 ${className}`} style={{ color: '#64748b' }}>{children}</th>
}

function TextAutocomplete({ value, onChange, texts, openKey, myKey, setOpenKey }: {
  value: string; onChange: (v: string) => void; texts: string[]
  openKey: string | null; myKey: string; setOpenKey: (k: string | null) => void
}) {
  const matches = texts.filter(t => t.toLowerCase().includes(value.toLowerCase()) && t !== value).slice(0, 6)
  const open = openKey === myKey && matches.length > 0
  return (
    <div className="relative">
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setOpenKey(myKey)}
        onBlur={() => setTimeout(() => setOpenKey(null), 150)}
        className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none"
        style={{ borderColor: '#e2e8f0', background: 'white' }} />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-lg z-20 max-h-44 overflow-y-auto" style={{ background: 'white', borderColor: '#e2e8f0' }}>
          {matches.map((t, i) => (
            <button key={i} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(t); setOpenKey(null) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 block truncate"
              style={{ color: '#475569' }}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LocationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm rounded border cursor-pointer focus:outline-none"
        style={{ borderColor: '#e2e8f0', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '1.5rem' }}>
        <option value="all">All locations</option>
        {MY_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
      </select>
      <svg className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </div>
  )
}

function ActiveToggle({ on, onChange, dimmed = false }: { on: boolean; onChange: (v: boolean) => void; dimmed?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{ background: on ? '#16a34a' : '#cbd5e1', opacity: dimmed ? 0.5 : 1 }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  )
}

function RowEditor({ r, existingTexts, waOpenKey, setWaOpenKey, onPatch, onPercentage, onToggleDelete }: {
  r: WorkingRow
  existingTexts: string[]
  waOpenKey: string | null
  setWaOpenKey: (k: string | null) => void
  onPatch: (patch: Partial<WorkingRow>) => void
  onPercentage: (value: number) => void
  onToggleDelete: () => void
}) {
  const isDefault = r.type === 'default'
  const bg = r.markedForDelete ? '#fef2f2' : isDefault ? '#fff9e6' : r.dirty ? '#fffbeb' : 'white'
  return (
    <tr style={{ background: bg, borderBottom: '1px solid #f1f5f9', textDecoration: r.markedForDelete ? 'line-through' : 'none' }}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isDefault && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--primary)', color: 'white' }}>★</span>}
          <input type="text" value={r.phone_number}
            onChange={e => onPatch({ phone_number: e.target.value })}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono rounded border focus:outline-none"
            style={{ borderColor: '#e2e8f0', background: 'white' }} />
        </div>
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <TextAutocomplete value={r.whatsapp_text} onChange={v => onPatch({ whatsapp_text: v })}
          texts={existingTexts} openKey={waOpenKey} myKey={`wa-${r.key}`} setOpenKey={setWaOpenKey} />
      </td>
      <td className="px-3 py-2 min-w-[140px]">
        <LocationSelect value={r.location_slug} onChange={v => onPatch({ location_slug: v })} />
      </td>
      <td className="px-3 py-2">
        <input type="number" min="0" max="100" value={r.percentage}
          onChange={e => onPercentage(parseInt(e.target.value) || 0)}
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none text-right tabular-nums"
          style={{ borderColor: '#e2e8f0', background: 'white' }} />
      </td>
      <td className="px-3 py-2">
        <input type="text" value={r.label} onChange={e => onPatch({ label: e.target.value })}
          disabled={isDefault}
          placeholder={isDefault ? 'Default' : 'optional'}
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none disabled:opacity-60"
          style={{ borderColor: '#e2e8f0', background: 'white' }} />
      </td>
      <td className="px-3 py-2 text-center">
        <ActiveToggle on={r.is_active} onChange={v => onPatch({ is_active: v })} />
      </td>
      <td className="px-3 py-2 text-center">
        {isDefault ? (
          <span className="text-[10px]" style={{ color: '#cbd5e1' }}>—</span>
        ) : (
          <input type="checkbox" checked={r.markedForDelete} onChange={onToggleDelete}
            className="w-4 h-4 cursor-pointer accent-red-600" />
        )}
      </td>
    </tr>
  )
}

function DraftRowEditor({ d, existingTexts, waOpenKey, setWaOpenKey, showAdd, onPatch, onPercentage, onRemove, onAdd }: {
  d: WorkingRow
  existingTexts: string[]
  waOpenKey: string | null
  setWaOpenKey: (k: string | null) => void
  showAdd: boolean
  onPatch: (patch: Partial<WorkingRow>) => void
  onPercentage: (value: number) => void
  onRemove: () => void
  onAdd: () => void
}) {
  return (
    <tr style={{ background: '#f0fdf4', borderBottom: '1px solid #f1f5f9' }}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#16a34a', color: 'white' }}>NEW</span>
          <input type="text" value={d.phone_number}
            onChange={e => onPatch({ phone_number: e.target.value })}
            placeholder="60123456789"
            className="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono rounded border focus:outline-none"
            style={{ borderColor: '#bbf7d0', background: 'white' }} />
        </div>
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <TextAutocomplete value={d.whatsapp_text} onChange={v => onPatch({ whatsapp_text: v })}
          texts={existingTexts} openKey={waOpenKey} myKey={`wa-${d.key}`} setOpenKey={setWaOpenKey} />
      </td>
      <td className="px-3 py-2 min-w-[140px]">
        <LocationSelect value={d.location_slug} onChange={v => onPatch({ location_slug: v })} />
      </td>
      <td className="px-3 py-2">
        <input type="number" min="0" max="100" value={d.percentage}
          onChange={e => onPercentage(parseInt(e.target.value) || 0)}
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none text-right tabular-nums"
          style={{ borderColor: '#bbf7d0', background: 'white' }} />
      </td>
      <td className="px-3 py-2">
        <input type="text" value={d.label} onChange={e => onPatch({ label: e.target.value })}
          placeholder="optional"
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none"
          style={{ borderColor: '#bbf7d0', background: 'white' }} />
      </td>
      <td className="px-3 py-2 text-center">
        <ActiveToggle on={d.is_active} onChange={v => onPatch({ is_active: v })} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={onRemove} title="Remove this row"
            className="w-6 h-6 inline-flex items-center justify-center rounded-md border transition-colors hover:border-red-400 hover:text-red-600"
            style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
          </button>
          {showAdd && (
            <button type="button" onClick={onAdd} title="Add another new row"
              className="w-6 h-6 inline-flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
