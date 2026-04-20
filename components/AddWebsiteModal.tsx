'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'

interface Company { id: string; name: string }

interface AddWebsiteResult {
  company: { id: string; name: string }
  website: { domain: string }
  api_key: string | null
  api_key_permissions: string[]
  tracking_snippet: string
}

export default function AddWebsiteModal({ open, onClose, onCreated, presetCompany }: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  /** When set, the company picker is pre-filled with this existing company. */
  presetCompany?: { id: string; name: string }
}) {
  const toast = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [form, setForm] = useState({
    company_id: '',
    company_name: '',
    domain: '',
    create_api_key: true,
    permissions: ['read', 'write'] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AddWebsiteResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/companies').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCompanies(data.map((c: Company) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) {
      setResult(null)
      setError('')
      setForm({ company_id: '', company_name: '', domain: '', create_api_key: true, permissions: ['read', 'write'] })
      setMode('existing')
      return
    }
    if (presetCompany) {
      setMode('existing')
      setForm(f => ({ ...f, company_id: presetCompany.id }))
    }
  }, [open, presetCompany])

  function copyValue(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    toast.success('Copied')
    setTimeout(() => setCopied(null), 2000)
  }

  function togglePerm(perm: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'existing' && !form.company_id) return setError('Pick a company')
    if (mode === 'new' && !form.company_name.trim()) return setError('Enter a company name')
    if (!form.domain.trim()) return setError('Domain is required')

    setSaving(true)
    const res = await fetch('/api/company-websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: mode === 'existing' ? form.company_id : undefined,
        company_name: mode === 'new' ? form.company_name.trim() : undefined,
        domain: form.domain.trim(),
        create_api_key: form.create_api_key,
        key_permissions: form.permissions,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (res.ok) {
      setResult(data)
      toast.success('Website connected', 'Created')
      onCreated?.()
    } else {
      setError(data.error ?? 'Failed to add website')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto backdrop-blur-sm" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl my-4 overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              {result ? 'Website connected' : 'Connect a new website'}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
              {result
                ? 'Copy the details below. You can retrieve the API key later from /api-keys.'
                : 'Link a domain to a company and generate access credentials.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: '#64748b' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {result ? (
          <ResultBody result={result} copied={copied} onCopy={copyValue}
            onAddAnother={() => { setResult(null); setForm({ company_id: '', company_name: '', domain: '', create_api_key: true, permissions: ['read', 'write'] }) }}
            onClose={onClose} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 pb-2 space-y-5">
              {error && (
                <div className="px-3 py-2.5 rounded-lg text-sm flex items-start gap-2"
                  style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
                  <span>{error}</span>
                </div>
              )}

              <Field label="Company">
                <SegmentedToggle
                  value={mode}
                  options={[{ v: 'existing', l: 'Existing' }, { v: 'new', l: 'New' }]}
                  onChange={v => setMode(v as 'existing' | 'new')}
                />
                <div className="mt-2.5">
                  {mode === 'existing' ? (
                    <SelectField value={form.company_id} onChange={v => setForm(f => ({ ...f, company_id: v }))}
                      placeholder="Select a company…"
                      options={companies.map(c => ({ value: c.id, label: c.name }))} />
                  ) : (
                    <TextField value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))}
                      placeholder="e.g. ABC Wheelchairs Sdn Bhd" />
                  )}
                </div>
              </Field>

              <Field label="Website domain" hint="No https:// or trailing slash — must match exactly what the designer uses">
                <TextField value={form.domain} onChange={v => setForm(f => ({ ...f, domain: v }))}
                  placeholder="abc-wheelchairs.com" autoComplete="off" spellCheck={false} mono />
              </Field>

              <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Toggle checked={form.create_api_key} onChange={v => setForm(f => ({ ...f, create_api_key: v }))} />
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generate an API key</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Required if the designer will fetch or push data from their builder</div>
                  </div>
                </label>

                {form.create_api_key && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <div className="text-xs font-medium mb-2" style={{ color: '#475569' }}>Permissions</div>
                    <div className="flex gap-2">
                      {['read', 'write'].map(perm => {
                        const active = form.permissions.includes(perm)
                        return (
                          <button key={perm} type="button" onClick={() => togglePerm(perm)}
                            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
                            style={{
                              background: active ? 'var(--primary)' : 'white',
                              border: `1px solid ${active ? 'var(--primary)' : '#e2e8f0'}`,
                              color: active ? 'white' : '#475569',
                            }}>
                            {active && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            {perm.charAt(0).toUpperCase() + perm.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 mt-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-slate-100"
                style={{ color: '#475569' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
                style={{ background: 'var(--primary)' }}>
                {saving ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── Result view ───────────────────────────────────────────── */

function ResultBody({ result, copied, onCopy, onAddAnother, onClose }: {
  result: AddWebsiteResult
  copied: string | null
  onCopy: (value: string, key: string) => void
  onAddAnother: () => void
  onClose: () => void
}) {
  return (
    <div>
      <div className="px-6 pb-6 space-y-3">
        <InfoRow label="Domain" value={result.website.domain} mono copyKey="dom" onCopy={onCopy} copied={copied} />
        <InfoRow label="Company" value={result.company.name} />
        {result.api_key && (
          <InfoRow label="API Key" value={result.api_key} mono copyKey="key" onCopy={onCopy} copied={copied}
            hint={`${result.api_key_permissions.join(' + ')} · retrievable for 5 hours`} />
        )}
        <InfoRow label="Tracking snippet" value={result.tracking_snippet} mono small copyKey="snip" onCopy={onCopy} copied={copied}
          hint="Paste into the <head> of every page" />
      </div>

      <div className="px-6 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
        <button onClick={onAddAnother}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: '#475569' }}>Add another</button>
        <button onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity"
          style={{ background: 'var(--primary)' }}>Done</button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono, small, hint, copyKey, onCopy, copied }: {
  label: string
  value: string
  mono?: boolean
  small?: boolean
  hint?: string
  copyKey?: string
  onCopy?: (value: string, key: string) => void
  copied?: string | null
}) {
  const isCopied = copyKey && copied === copyKey
  return (
    <div className="rounded-lg" style={{ border: '1px solid #e2e8f0' }}>
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3" style={{ background: '#fafbfc', borderBottom: hint ? '1px solid #f1f5f9' : undefined }}>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</div>
          {hint && <div className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{hint}</div>}
        </div>
        {copyKey && onCopy && (
          <button onClick={() => onCopy(value, copyKey)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
            style={{
              background: isCopied ? '#dcfce7' : 'white',
              border: `1px solid ${isCopied ? '#86efac' : '#e2e8f0'}`,
              color: isCopied ? '#16a34a' : '#475569',
            }}>
            {isCopied ? (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
            ) : (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round" /></svg>Copy</>
            )}
          </button>
        )}
      </div>
      <div className={`px-3.5 py-2.5 ${small ? 'text-[11px]' : 'text-sm'} ${mono ? 'font-mono' : ''} break-all select-all`}
        style={{ color: mono ? '#334155' : 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  )
}

/* ─── Form primitives ───────────────────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#334155' }}>{label}</label>
      {children}
      {hint && <p className="text-[11px] mt-1.5" style={{ color: '#94a3b8' }}>{hint}</p>}
    </div>
  )
}

function SegmentedToggle({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg" style={{ background: '#f1f5f9' }}>
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className="text-xs font-medium px-3 py-1.5 rounded-md transition-all"
          style={{
            background: value === o.v ? 'white' : 'transparent',
            color: value === o.v ? 'var(--foreground)' : '#64748b',
            boxShadow: value === o.v ? '0 1px 2px rgba(0,0,0,0.05)' : undefined,
          }}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

function TextField({ value, onChange, placeholder, autoComplete, spellCheck, mono }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  spellCheck?: boolean
  mono?: boolean
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} autoComplete={autoComplete} spellCheck={spellCheck}
      className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-colors focus:border-[var(--primary)] ${mono ? 'font-mono' : ''}`}
      style={{ borderColor: '#e2e8f0', background: 'white' }} />
  )
}

function SelectField({ value, onChange, placeholder, options }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none cursor-pointer pr-9 transition-colors focus:border-[var(--primary)]"
        style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white' }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? 'var(--primary)' : '#cbd5e1' }}>
      <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ left: checked ? 'calc(100% - 18px)' : '2px' }} />
    </button>
  )
}
