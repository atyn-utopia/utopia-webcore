'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useToast } from '@/contexts/ToastContext'
import { validatePhoneNumber } from '@/lib/validatePhone'

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

type Mode = 'single' | 'rotation' | 'location' | 'hybrid'

const LEADS_MODE: Record<Mode, { label: string; color: string; bg: string; desc: string }> = {
  single:   { label: 'Single',   color: '#475569', bg: '#f1f5f9', desc: 'Only the default number handles all leads.' },
  rotation: { label: 'Rotation', color: '#0369a1', bg: '#e0f2fe', desc: 'Multiple numbers rotate for all locations.' },
  location: { label: 'Location', color: '#7c3aed', bg: '#ede9fe', desc: 'Each number targets a specific location.' },
  hybrid:   { label: 'Hybrid',   color: '#b45309', bg: '#fef3c7', desc: 'Mix of all-location and specific numbers.' },
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
  key: string
  id?: string
  phone_number: string
  whatsapp_text: string
  location_slug: string
  percentage: number
  label: string
  is_active: boolean
  type: string
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

function computeMode(active: WorkingRow[]): Mode | null {
  if (active.length === 0) return null
  const allLoc = active.filter(n => n.location_slug === 'all')
  const specificLoc = active.filter(n => n.location_slug !== 'all')
  if (allLoc.length > 0 && specificLoc.length > 0) return 'hybrid'
  if (specificLoc.length > 0 && allLoc.length === 0) return 'location'
  if (allLoc.length === 1) return 'single'
  return 'rotation'
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
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)
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

  const detectedMode = useMemo<Mode | null>(() => computeMode(rows.filter(r => r.is_active && !r.markedForDelete)), [rows])

  useEffect(() => {
    setSelectedMode(prev => prev ?? detectedMode)
  }, [detectedMode])

  const mode: Mode | null = selectedMode ?? detectedMode
  const showLocationColumn = mode !== 'rotation'
  const locationAllowsAll = mode !== 'location'

  // Filter rows for display based on selected mode.
  // Single mode: only default row visible. Others: all visible.
  const visibleRows = useMemo(() => {
    if (mode === 'single') return rows.filter(r => r.type === 'default')
    return rows
  }, [rows, mode])

  const visibleDrafts = useMemo(() => {
    // In Single mode, don't let user add new rows (only default matters).
    if (mode === 'single') return []
    return addDrafts
  }, [addDrafts, mode])

  const allActiveForPct = useMemo(() => {
    const combined = [...visibleRows, ...visibleDrafts.filter(d => d.phone_number.trim())]
    return combined.filter(r => r.is_active && !r.markedForDelete)
  }, [visibleRows, visibleDrafts])
  const pctTotal = allActiveForPct.reduce((s, r) => s + (r.percentage || 0), 0)

  function patchRow(key: string, patch: Partial<WorkingRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch, dirty: true } : r))
  }

  function patchDraft(key: string, patch: Partial<WorkingRow>) {
    setAddDrafts(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d))
  }

  function toggleDelete(key: string) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, markedForDelete: !r.markedForDelete } : r))
  }

  const deletableRows = visibleRows.filter(r => r.type !== 'default')
  const selectedRows = deletableRows.filter(r => r.markedForDelete)
  const allSelected = deletableRows.length > 0 && selectedRows.length === deletableRows.length
  const someSelected = selectedRows.length > 0 && !allSelected

  function toggleSelectAll() {
    const shouldSelect = !allSelected
    setRows(prev => prev.map(r => {
      if (r.type === 'default') return r
      if (!visibleRows.find(v => v.key === r.key)) return r
      return { ...r, markedForDelete: shouldSelect }
    }))
  }

  function addBlankDraft() {
    setAddDrafts(prev => [...prev, emptyNewRow()])
  }

  const deletingCount = rows.filter(r => r.markedForDelete).length
  const dirtyCount = rows.filter(r => r.dirty && !r.markedForDelete).length
  const newCount = addDrafts.filter(d => d.phone_number.trim()).length
  const hasChanges = deletingCount > 0 || dirtyCount > 0 || newCount > 0

  async function bulkDeleteSelected() {
    if (selectedRows.length === 0) return
    const ok = await confirm({
      title: `Delete ${selectedRows.length} number${selectedRows.length !== 1 ? 's' : ''}?`,
      message: 'These numbers will be permanently removed from the rotation pool. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      for (const r of selectedRows) {
        if (!r.id) continue
        const res = await fetch(`/api/phone-numbers/${r.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`Failed to delete ${r.phone_number}`)
      }
      toast.success(`Deleted ${selectedRows.length} number${selectedRows.length !== 1 ? 's' : ''}`, 'Deleted')
      await fetchExisting(website)
    } catch (e) {
      toast.error((e as Error).message, 'Delete failed')
    }
  }

  async function doSave() {
    if (!website) { toast.error('Pick a website first', 'Missing website'); return }

    const allNumbers = [
      ...rows.filter(r => !r.markedForDelete),
      ...addDrafts.filter(d => d.phone_number.trim()),
    ]

    for (const r of allNumbers) {
      if (!r.is_active) continue
      const err = validatePhoneNumber(r.phone_number)
      if (err) { toast.error(`${r.phone_number || '(empty)'}: ${err}`, 'Invalid phone'); return }
      if (!r.whatsapp_text.trim()) { toast.error(`${r.phone_number}: WhatsApp text is required`, 'Missing text'); return }
    }

    const seen = new Set<string>()
    for (const r of allNumbers) {
      const n = r.phone_number.trim()
      if (seen.has(n)) { toast.error(`Duplicate number: ${n}`, 'Duplicate'); return }
      seen.add(n)
    }

    if (pctTotal !== 100) {
      toast.error(`Active percentages total ${pctTotal}% — must be exactly 100%.`, 'Percentage invalid')
      return
    }

    const ok = await confirm({
      title: 'Save changes?',
      message: `${dirtyCount} updated · ${newCount} added · ${deletingCount} deleted. This cannot be undone.`,
      confirmLabel: 'Save',
      variant: 'info',
    })
    if (!ok) return

    setSaving(true)
    try {
      for (const r of rows.filter(x => x.markedForDelete && x.id)) {
        const res = await fetch(`/api/phone-numbers/${r.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`Delete failed for ${r.phone_number}`)
      }
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

  function handleBack() {
    router.push(`/phone-numbers?website=${encodeURIComponent(website)}`)
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-5">
      <PageHeader title="Manage Phone Numbers"
        description="Edit inline, bulk-delete with checkboxes, and add new numbers. Save commits all changes at once." />

      {/* Selection panel */}
      <Panel>
        <PanelHeader title="Website" />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company" required>
            <Select value={selectedCompany}
              onChange={v => { setSelectedCompany(v); setWebsite(''); setSelectedMode(null) }}
              options={[{ value: '', label: 'Select company…' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
          </Field>
          <Field label="Website" required>
            <Select value={website}
              onChange={v => { setWebsite(v); setSelectedMode(null); setAddDrafts([emptyNewRow()]) }}
              disabled={!selectedCompany}
              options={[{ value: '', label: selectedCompany ? 'Select website…' : 'Select a company first' }, ...companyWebsites.map(w => ({ value: w.domain, label: w.domain }))]} />
          </Field>
        </div>
      </Panel>

      {!website ? (
        <Panel>
          <div className="p-12 text-center text-sm" style={{ color: '#94a3b8' }}>
            Select a company and website to manage phone numbers.
          </div>
        </Panel>
      ) : (
        <>
          {/* Mode */}
          <Panel>
            <PanelHeader
              title="Leads Mode"
              right={detectedMode && mode !== detectedMode && (
                <button type="button" onClick={() => setSelectedMode(detectedMode)}
                  className="text-[11px] font-medium underline-offset-2 hover:underline"
                  style={{ color: '#64748b' }}>
                  Reset to auto-detected
                </button>
              )} />
            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(['single', 'rotation', 'location', 'hybrid'] as Mode[]).map(m => {
                const meta = LEADS_MODE[m]
                const isSelected = mode === m
                const isDetected = detectedMode === m
                return (
                  <button type="button" key={m} onClick={() => setSelectedMode(m)}
                    className="text-left rounded-lg p-3.5 border transition-all"
                    style={{
                      background: isSelected ? meta.bg : 'white',
                      borderColor: isSelected ? meta.color : '#e2e8f0',
                      borderWidth: isSelected ? 2 : 1,
                      padding: isSelected ? '13px' : '14px',
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: isSelected ? meta.color : '#475569' }}>{meta.label}</span>
                      {isDetected && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: isSelected ? 'white' : meta.bg, color: meta.color }}>
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-snug" style={{ color: isSelected ? meta.color : '#94a3b8' }}>{meta.desc}</p>
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* Distribution */}
          <Panel>
            <PanelHeader
              title="Lead Distribution"
              right={
                <span className="text-xs font-semibold tabular-nums"
                  style={{ color: pctTotal === 100 ? '#16a34a' : '#b91c1c' }}>
                  {pctTotal}% / 100%
                </span>
              } />
            <div className="px-5 py-4">
              <div className="flex h-3 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                {allActiveForPct.filter(r => r.percentage > 0).map((r, idx) => (
                  <div key={r.key}
                    style={{ width: `${r.percentage}%`, background: BAR_COLORS[idx % BAR_COLORS.length], transition: 'width 0.2s' }}
                    title={`${r.phone_number || 'new'}: ${r.percentage}%`} />
                ))}
              </div>
              {pctTotal !== 100 && (
                <p className="text-[11px] mt-2" style={{ color: '#b91c1c' }}>
                  Total must be exactly 100% before saving.
                </p>
              )}
            </div>
          </Panel>

          {/* Numbers table */}
          <Panel>
            <PanelHeader
              title="Phone Numbers"
              right={
                <div className="flex items-center gap-1.5 text-[11px]">
                  {loading && <Chip color="#64748b" bg="#f1f5f9">Loading…</Chip>}
                  {deletingCount > 0 && <Chip color="#b91c1c" bg="#fef2f2">{deletingCount} to delete</Chip>}
                  {dirtyCount > 0 && <Chip color="#b45309" bg="#fef3c7">{dirtyCount} edited</Chip>}
                  {newCount > 0 && <Chip color="#15803d" bg="#f0fdf4">{newCount} new</Chip>}
                </div>
              } />

            {/* Bulk-delete bar */}
            {selectedRows.length > 0 && (
              <div className="px-5 py-2.5 flex items-center justify-between gap-3"
                style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                <span className="text-xs font-medium" style={{ color: '#b91c1c' }}>
                  {selectedRows.length} number{selectedRows.length !== 1 ? 's' : ''} selected
                </span>
                <button type="button" onClick={bulkDeleteSelected}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-white transition-colors"
                  style={{ background: '#dc2626' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                  Delete selected
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
                    <Th>Phone Number</Th>
                    <Th>WhatsApp Text</Th>
                    {showLocationColumn && <Th style={{ width: 180 }}>Location</Th>}
                    <Th style={{ width: 90, textAlign: 'right' }}>%</Th>
                    <Th>Label</Th>
                    <Th style={{ width: 90, textAlign: 'center' }}>Active</Th>
                    <Th style={{ width: 52, textAlign: 'center' }}>
                      <SelectAllCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        disabled={deletableRows.length === 0}
                        onChange={toggleSelectAll}
                      />
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 && visibleDrafts.length === 0 && (
                    <tr>
                      <td colSpan={showLocationColumn ? 7 : 6} className="px-5 py-10 text-center text-sm" style={{ color: '#94a3b8' }}>
                        {mode === 'single' ? 'No default number yet — add one below.' : 'No numbers yet for this website.'}
                      </td>
                    </tr>
                  )}
                  {visibleRows.map(r => (
                    <RowEditor key={r.key} r={r}
                      existingTexts={existingTexts}
                      waOpenKey={waOpenKey} setWaOpenKey={setWaOpenKey}
                      showLocationColumn={showLocationColumn}
                      locationAllowsAll={locationAllowsAll}
                      onPatch={patch => patchRow(r.key, patch)}
                      onToggleDelete={() => toggleDelete(r.key)}
                    />
                  ))}
                  {visibleDrafts.map((d, idx) => (
                    <DraftRowEditor key={d.key} d={d}
                      existingTexts={existingTexts}
                      waOpenKey={waOpenKey} setWaOpenKey={setWaOpenKey}
                      showLocationColumn={showLocationColumn}
                      locationAllowsAll={locationAllowsAll}
                      isLast={idx === visibleDrafts.length - 1}
                      onPatch={patch => patchDraft(d.key, patch)}
                      onAdd={addBlankDraft}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Preview */}
          <Panel>
            <PanelHeader title="WhatsApp Preview"
              subtitle={<>Format: <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>Hi &lt;domain&gt;[ &lt;location&gt;], &lt;text&gt;</code></>} />
            <div className="p-5 space-y-2">
              {allActiveForPct.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#94a3b8' }}>No active rows to preview yet.</p>
              ) : allActiveForPct.map(r => {
                const preview = buildWhatsAppPreview(website, r.location_slug, r.whatsapp_text || '…')
                const cleanNum = r.phone_number.replace(/\D/g, '')
                const testUrl = `https://wa.me/${cleanNum}?text=${encodeURIComponent(preview)}`
                return (
                  <div key={r.key} className="flex items-start gap-3 rounded-lg p-3 border" style={{ borderColor: '#e2e8f0', background: 'white' }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium mb-1 flex items-center gap-1.5 flex-wrap" style={{ color: '#64748b' }}>
                        <span className="font-mono">{r.phone_number || '(no number)'}</span>
                        {r.location_slug !== 'all' && (
                          <span className="px-1.5 py-0.5 rounded" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                            {LOCATION_LABEL[r.location_slug] ?? r.location_slug}
                          </span>
                        )}
                      </div>
                      <div className="text-sm" style={{ color: '#0f172a' }}>{preview}</div>
                    </div>
                    {cleanNum.length >= 8 && (
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
          </Panel>

          {/* Save bar */}
          <div className="sticky bottom-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap px-5 py-3 shadow-sm"
            style={{ borderColor: '#e2e8f0', background: 'white' }}>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#64748b' }}>
              <Link href={`/phone-numbers${website ? `?website=${encodeURIComponent(website)}` : ''}`}
                className="font-medium underline-offset-2 hover:underline">
                Cancel
              </Link>
              {hasChanges ? (
                <span className="font-medium" style={{ color: '#b45309' }}>Unsaved changes</span>
              ) : (
                <span>No changes</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBack}
                className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                Back
              </button>
              <button type="button" onClick={doSave} disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                style={{ background: 'var(--primary)' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Layout primitives ───────────────────────────────────────── */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0', background: 'white' }}>
      {children}
    </div>
  )
}

function PanelHeader({ title, subtitle, right }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
        {subtitle && <div className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>{subtitle}</div>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options, disabled }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: '#e2e8f0', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.25rem' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </div>
  )
}

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span className="px-1.5 py-0.5 rounded font-medium" style={{ color, background: bg }}>{children}</span>
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-3 py-2.5" style={{ color: '#64748b', ...style }}>{children}</th>
}

function SelectAllCheckbox({ checked, indeterminate, disabled, onChange }: {
  checked: boolean; indeterminate: boolean; disabled: boolean; onChange: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      ref={el => { if (el) el.indeterminate = indeterminate }}
      onChange={onChange}
      className="w-4 h-4 cursor-pointer accent-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Select all"
    />
  )
}

/* ─── Input helpers ───────────────────────────────────────────── */

function TextAutocomplete({ value, onChange, texts, openKey, myKey, setOpenKey, placeholder }: {
  value: string; onChange: (v: string) => void; texts: string[]
  openKey: string | null; myKey: string; setOpenKey: (k: string | null) => void
  placeholder?: string
}) {
  const matches = texts.filter(t => t.toLowerCase().includes(value.toLowerCase()) && t !== value).slice(0, 6)
  const open = openKey === myKey && matches.length > 0
  return (
    <div className="relative">
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setOpenKey(myKey)}
        onBlur={() => setTimeout(() => setOpenKey(null), 150)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[var(--primary)]"
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

function LocationCombobox({ value, onChange, allowsAll, listId }: {
  value: string
  onChange: (v: string) => void
  allowsAll: boolean
  listId: string
}) {
  // Convert slug to label when a known state; pass-through otherwise.
  const displayValue = value === 'all' ? (allowsAll ? 'All locations' : '') : (LOCATION_LABEL[value] ?? value)

  function handleInput(v: string) {
    if (!v.trim()) { onChange(allowsAll ? 'all' : ''); return }
    if (allowsAll && v.toLowerCase().trim() === 'all locations') { onChange('all'); return }
    const match = MY_STATES.find(s => s.label.toLowerCase() === v.toLowerCase().trim())
    onChange(match ? match.slug : v.trim())
  }

  return (
    <>
      <input type="text" list={listId}
        value={displayValue}
        onChange={e => handleInput(e.target.value)}
        placeholder={allowsAll ? 'All locations or state name' : 'Pick or type a location'}
        className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[var(--primary)]"
        style={{ borderColor: '#e2e8f0', background: 'white' }} />
      <datalist id={listId}>
        {allowsAll && <option value="All locations" />}
        {MY_STATES.map(s => <option key={s.slug} value={s.label} />)}
      </datalist>
    </>
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

/* ─── Row renderers ───────────────────────────────────────────── */

function RowEditor({ r, existingTexts, waOpenKey, setWaOpenKey, showLocationColumn, locationAllowsAll, onPatch, onToggleDelete }: {
  r: WorkingRow
  existingTexts: string[]
  waOpenKey: string | null
  setWaOpenKey: (k: string | null) => void
  showLocationColumn: boolean
  locationAllowsAll: boolean
  onPatch: (patch: Partial<WorkingRow>) => void
  onToggleDelete: () => void
}) {
  const isDefault = r.type === 'default'
  const bg = r.markedForDelete
    ? '#fef2f2'
    : isDefault
    ? '#fffbea'
    : r.dirty
    ? '#fffbf0'
    : 'white'

  return (
    <tr style={{ background: bg, borderBottom: '1px solid #f1f5f9', textDecoration: r.markedForDelete ? 'line-through' : 'none' }}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isDefault && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--primary)', color: 'white' }}>★</span>}
          <input type="text" value={r.phone_number}
            onChange={e => onPatch({ phone_number: e.target.value })}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono rounded border focus:outline-none focus:border-[var(--primary)]"
            style={{ borderColor: '#e2e8f0', background: 'white' }} />
        </div>
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <TextAutocomplete value={r.whatsapp_text} onChange={v => onPatch({ whatsapp_text: v })}
          texts={existingTexts} openKey={waOpenKey} myKey={`wa-${r.key}`} setOpenKey={setWaOpenKey} />
      </td>
      {showLocationColumn && (
        <td className="px-3 py-2">
          <LocationCombobox value={r.location_slug} onChange={v => onPatch({ location_slug: v })}
            allowsAll={locationAllowsAll} listId={`locs-${r.key}`} />
        </td>
      )}
      <td className="px-3 py-2">
        <input type="number" min="0" max="100" value={r.percentage}
          onChange={e => onPatch({ percentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[var(--primary)] text-right tabular-nums"
          style={{ borderColor: '#e2e8f0', background: 'white' }} />
      </td>
      <td className="px-3 py-2">
        <input type="text" value={r.label} onChange={e => onPatch({ label: e.target.value })}
          disabled={isDefault}
          placeholder={isDefault ? 'Default' : 'optional'}
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[var(--primary)] disabled:opacity-60"
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

function DraftRowEditor({ d, existingTexts, waOpenKey, setWaOpenKey, showLocationColumn, locationAllowsAll, isLast, onPatch, onAdd }: {
  d: WorkingRow
  existingTexts: string[]
  waOpenKey: string | null
  setWaOpenKey: (k: string | null) => void
  showLocationColumn: boolean
  locationAllowsAll: boolean
  isLast: boolean
  onPatch: (patch: Partial<WorkingRow>) => void
  onAdd: () => void
}) {
  return (
    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#16a34a', color: 'white' }}>NEW</span>
          <input type="text" value={d.phone_number}
            onChange={e => onPatch({ phone_number: e.target.value })}
            placeholder="60123456789"
            className="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono rounded border focus:outline-none focus:border-[var(--primary)]"
            style={{ borderColor: '#e2e8f0', background: 'white' }} />
        </div>
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <TextAutocomplete value={d.whatsapp_text} onChange={v => onPatch({ whatsapp_text: v })}
          texts={existingTexts} openKey={waOpenKey} myKey={`wa-${d.key}`} setOpenKey={setWaOpenKey} />
      </td>
      {showLocationColumn && (
        <td className="px-3 py-2">
          <LocationCombobox value={d.location_slug} onChange={v => onPatch({ location_slug: v })}
            allowsAll={locationAllowsAll} listId={`locs-${d.key}`} />
        </td>
      )}
      <td className="px-3 py-2">
        <input type="number" min="0" max="100" value={d.percentage}
          onChange={e => onPatch({ percentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[var(--primary)] text-right tabular-nums"
          style={{ borderColor: '#e2e8f0', background: 'white' }} />
      </td>
      <td className="px-3 py-2">
        <input type="text" value={d.label} onChange={e => onPatch({ label: e.target.value })}
          placeholder="optional"
          className="w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[var(--primary)]"
          style={{ borderColor: '#e2e8f0', background: 'white' }} />
      </td>
      <td className="px-3 py-2 text-center">
        <ActiveToggle on={d.is_active} onChange={v => onPatch({ is_active: v })} />
      </td>
      <td className="px-3 py-2 text-center">
        {isLast ? (
          <button type="button" onClick={onAdd} title="Add another row"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            style={{ borderColor: '#e2e8f0', color: '#64748b', background: 'white' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
        ) : (
          <span className="text-[10px]" style={{ color: '#cbd5e1' }}>—</span>
        )}
      </td>
    </tr>
  )
}
