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
  const [acked, setAcked] = useState(false)

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
      setAcked(false)
      setForm({ company_id: '', company_name: '', domain: '', create_api_key: true, permissions: ['read', 'write'] })
      setMode('existing')
      return
    }
    // Pre-fill company when a preset is given
    if (presetCompany) {
      setMode('existing')
      setForm(f => ({ ...f, company_id: presetCompany.id }))
    }
  }, [open, presetCompany])

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    toast.success('Copied to clipboard')
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

  const keyLocked = !!(result?.api_key) && !acked

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-4 overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#ede9fe' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#7c3aed' }} strokeWidth="1.8">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path strokeLinecap="round" d="M2 7h20M8 21h8M12 17v4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{result ? 'Website connected' : 'Connect a new website'}</h2>
              <p className="text-xs" style={{ color: '#94a3b8' }}>{result ? (keyLocked ? 'Copy the API key before closing' : 'Save these details now') : 'Link a domain to a company and optionally generate an API key'}</p>
            </div>
          </div>
          {!keyLocked && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors" style={{ color: '#64748b' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {result ? (
          /* Result view */
          <div className="p-6 space-y-4">
            <div className="rounded-xl border p-4" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <p className="text-sm font-medium" style={{ color: '#16a34a' }}>
                {result.website.domain} is now linked to {result.company.name}
              </p>
            </div>

            {result.api_key && (
              <div className="rounded-xl border p-4" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#92400e' }}>API key</p>
                <p className="text-[11px] mb-2" style={{ color: '#92400e' }}>
                  You can still copy this from the API Keys page for the next 5 hours. After that, if it&apos;s never been used, it auto-expires and you&apos;ll need to generate a new one.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border font-mono break-all select-all" style={{ borderColor: '#fed7aa', color: '#92400e' }}>
                    {result.api_key}
                  </code>
                  <button onClick={() => copy(result.api_key!, 'key')}
                    className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg text-white"
                    style={{ background: copied === 'key' ? '#16a34a' : 'var(--primary)' }}>
                    {copied === 'key' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] mt-2" style={{ color: '#92400e' }}>Permissions: {result.api_key_permissions.join(', ')}</p>
              </div>
            )}

            <div className="rounded-xl border" style={{ borderColor: '#e2e8f0' }}>
              <div className="px-4 py-2.5" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <p className="text-xs font-semibold" style={{ color: '#475569' }}>Tracking snippet — paste in &lt;head&gt;</p>
              </div>
              <div className="p-4 flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-50 px-3 py-2 rounded-lg border font-mono break-all" style={{ borderColor: '#e2e8f0', color: '#334155' }}>
                  {result.tracking_snippet}
                </code>
                <button onClick={() => copy(result.tracking_snippet, 'snip')}
                  className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg text-white"
                  style={{ background: copied === 'snip' ? '#16a34a' : 'var(--primary)' }}>
                  {copied === 'snip' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {result.api_key && (
              <label className="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer" style={{ borderColor: acked ? '#16a34a' : '#fed7aa', background: acked ? '#f0fdf4' : '#fff7ed' }}>
                <input type="checkbox" checked={acked} onChange={e => setAcked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0" />
                <span className="text-xs" style={{ color: acked ? '#16a34a' : '#92400e' }}>
                  I&apos;ve copied the API key and tracking snippet. I know I can still retrieve the key from the API Keys page for 5 hours.
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => { setResult(null); setAcked(false); setForm({ company_id: '', company_name: '', domain: '', create_api_key: true, permissions: ['read', 'write'] }) }}
                disabled={keyLocked}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: '#cbd5e1', color: '#475569' }}>Add another</button>
              <button onClick={onClose}
                disabled={keyLocked}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--primary)' }}>Done</button>
            </div>
          </div>
        ) : (
          /* Form view */
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
              )}

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Company</label>
                <div className="flex gap-2 mb-3">
                  {(['existing', 'new'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                      style={{
                        background: mode === m ? 'var(--primary)' : 'white',
                        borderColor: mode === m ? 'var(--primary)' : '#cbd5e1',
                        color: mode === m ? 'white' : '#475569',
                      }}>
                      {m === 'existing' ? 'Use existing' : 'Create new'}
                    </button>
                  ))}
                </div>
                {mode === 'existing' ? (
                  <div className="relative">
                    <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none cursor-pointer pr-9"
                      style={{ borderColor: '#cbd5e1', appearance: 'none', WebkitAppearance: 'none' }}>
                      <option value="">Select company…</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                ) : (
                  <input type="text" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="e.g. ABC Wheelchairs Sdn Bhd"
                    className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
                    style={{ borderColor: '#cbd5e1' }} />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Domain</label>
                <input type="text" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="abc-wheelchairs.com"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
                <p className="text-[11px] mt-1.5" style={{ color: '#94a3b8' }}>Without https:// or trailing slash.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.create_api_key} onChange={e => setForm(f => ({ ...f, create_api_key: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>Also generate an API key for this domain</span>
                </label>

                {form.create_api_key && (
                  <div className="mt-3 pl-6">
                    <p className="text-xs mb-2" style={{ color: '#64748b' }}>Permissions:</p>
                    <div className="flex gap-2">
                      {['read', 'write'].map(perm => {
                        const active = form.permissions.includes(perm)
                        return (
                          <button key={perm} type="button" onClick={() => togglePerm(perm)}
                            className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                            style={{
                              background: active ? 'var(--primary)' : 'white',
                              borderColor: active ? 'var(--primary)' : '#cbd5e1',
                              color: active ? 'white' : '#475569',
                            }}>
                            {active && <span className="mr-1">✓</span>}
                            {perm.charAt(0).toUpperCase() + perm.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-white transition-colors"
                style={{ borderColor: '#cbd5e1', color: '#475569' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {saving ? 'Connecting…' : 'Connect Website'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
