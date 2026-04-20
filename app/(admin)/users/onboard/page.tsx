'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/contexts/ToastContext'

interface Company { id: string; name: string }

interface OnboardResult {
  user: { id: string; email: string; name: string; role: string; temp_password: string }
  company: { id: string; name: string }
  website: { domain: string }
  api_key: string
  api_key_permissions: string[]
  tracking_snippet: string
}

export default function OnboardPage() {
  const toast = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<OnboardResult | null>(null)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [form, setForm] = useState({
    company_id: '',
    company_name: '',
    domain: '',
    name: '',
    email: '',
    permissions: ['read', 'write'] as string[],
  })

  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCompanies(data.map((c: Company) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
  }, [])

  function togglePerm(perm: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'existing' && !form.company_id) return setError('Pick a company or switch to "Create new"')
    if (mode === 'new' && !form.company_name.trim()) return setError('Enter a company name')
    if (!form.domain.trim() || !form.name.trim() || !form.email.trim()) {
      return setError('Domain, name, and email are required')
    }

    setSaving(true)
    const res = await fetch('/api/users/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: mode === 'existing' ? form.company_id : undefined,
        company_name: mode === 'new' ? form.company_name.trim() : undefined,
        domain: form.domain.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        key_permissions: form.permissions,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (res.ok) {
      setResult(data)
      toast.success('Designer onboarded — copy the credentials below', 'Onboarded')
    } else {
      setError(data.error ?? 'Failed to onboard')
    }
  }

  if (result) return <ResultView result={result} onReset={() => { setResult(null); setForm({ company_id: '', company_name: '', domain: '', name: '', email: '', permissions: ['read', 'write'] }) }} />

  return (
    <div>
      <PageHeader
        title="Onboard External Designer"
        description="Creates the company, website, user account, and API key in one step"
      />

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        {error && (
          <div className="mx-6 mt-6 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
        )}

        <div className="p-6 space-y-6">
          {/* Section 1: Company */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>1. Company</h3>
            <div className="flex gap-2 mb-3">
              {(['existing', 'new'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                  style={{
                    background: mode === m ? 'var(--primary)' : 'white',
                    borderColor: mode === m ? 'var(--primary)' : '#cbd5e1',
                    color: mode === m ? 'white' : '#475569',
                  }}>
                  {m === 'existing' ? 'Use existing company' : 'Create new company'}
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
          </section>

          {/* Section 2: Website */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>2. Website</h3>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Domain</label>
            <input type="text" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="abc-wheelchairs.com"
              className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
              style={{ borderColor: '#cbd5e1' }} />
            <p className="text-[11px] mt-1.5" style={{ color: '#94a3b8' }}>Without https:// or trailing slash. Must match exactly what the designer uses.</p>
          </section>

          {/* Section 3: Designer */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>3. Designer account</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Sarah Ahmad"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="sarah@abc-wheelchairs.com"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#94a3b8' }}>A temporary password is generated automatically and shown on the next screen.</p>
          </section>

          {/* Section 4: API Key */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>4. API key permissions</h3>
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
            <p className="text-[11px] mt-2" style={{ color: '#94a3b8' }}>Read: site fetches phones/products/blog. Write: builder pushes product updates.</p>
          </section>
        </div>

        <div className="px-6 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <Link href="/users" className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-white"
            style={{ borderColor: '#cbd5e1', color: '#475569' }}>Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ background: 'var(--primary)' }}>
            {saving ? 'Onboarding…' : 'Onboard Designer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ResultView({ result, onReset }: { result: OnboardResult; onReset: () => void }) {
  const toast = useToast()
  const [copied, setCopied] = useState<string | null>(null)

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(null), 2000)
  }

  const fullSummary = [
    `Login: ${result.user.email}`,
    `Password: ${result.user.temp_password}`,
    `Webcore URL: https://utopia-webcore.vercel.app`,
    ``,
    `Website: ${result.website.domain}`,
    `Company: ${result.company.name}`,
    ``,
    `API Key (keep secret): ${result.api_key}`,
    `Permissions: ${result.api_key_permissions.join(', ')}`,
    ``,
    `Tracking snippet (paste in <head>):`,
    result.tracking_snippet,
    ``,
    `Integration guide: https://utopia-webcore.vercel.app/docs/TRACKING-GUIDE.md`,
  ].join('\n')

  return (
    <div>
      <PageHeader
        title="Designer onboarded"
        description="Copy these credentials now — the API key and password will not be shown again"
      />

      <div className="rounded-xl border p-5 mb-5" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h3 className="text-sm font-bold text-amber-800">Hand this over to the designer now</h3>
        </div>
        <p className="text-xs" style={{ color: '#92400e' }}>Send via your usual secure channel (not public chat). They can change the password after first login.</p>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden mb-5" style={{ borderColor: '#e2e8f0' }}>
        <CredRow label="Login email" value={result.user.email} onCopy={v => copy(v, 'email')} copied={copied === 'email'} />
        <CredRow label="Temporary password" value={result.user.temp_password} onCopy={v => copy(v, 'pw')} copied={copied === 'pw'} mono />
        <CredRow label="Webcore URL" value="https://utopia-webcore.vercel.app" onCopy={v => copy(v, 'url')} copied={copied === 'url'} />
        <CredRow label="Website domain" value={result.website.domain} onCopy={v => copy(v, 'dom')} copied={copied === 'dom'} mono />
        <CredRow label="Company" value={result.company.name} />
        <CredRow label="API Key" value={result.api_key} onCopy={v => copy(v, 'key')} copied={copied === 'key'} mono warn />
        <CredRow label="API permissions" value={result.api_key_permissions.join(', ')} />
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden mb-5" style={{ borderColor: '#e2e8f0' }}>
        <div className="px-5 py-3" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h3 className="text-xs font-semibold" style={{ color: '#475569' }}>Tracking snippet — paste in &lt;head&gt; of every page</h3>
        </div>
        <div className="p-5 flex items-center gap-2">
          <code className="flex-1 text-xs bg-slate-50 px-3 py-2.5 rounded-lg border font-mono break-all" style={{ borderColor: '#e2e8f0', color: '#334155' }}>
            {result.tracking_snippet}
          </code>
          <button onClick={() => copy(result.tracking_snippet, 'snip')}
            className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors"
            style={{ background: copied === 'snip' ? '#16a34a' : 'var(--primary)' }}>
            {copied === 'snip' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => copy(fullSummary, 'all')}
          className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
          style={{ borderColor: '#cbd5e1', color: '#475569', background: copied === 'all' ? '#dcfce7' : 'white' }}>
          {copied === 'all' ? 'Copied all!' : 'Copy all as one block'}
        </button>
        <div className="flex gap-2">
          <Link href="/users" className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-slate-50"
            style={{ borderColor: '#cbd5e1', color: '#475569' }}>Back to Users</Link>
          <button onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ background: 'var(--primary)' }}>Onboard another</button>
        </div>
      </div>
    </div>
  )
}

function CredRow({ label, value, onCopy, copied, mono, warn }: {
  label: string
  value: string
  onCopy?: (v: string) => void
  copied?: boolean
  mono?: boolean
  warn?: boolean
}) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
      <div className="w-40 flex-shrink-0 text-xs font-medium" style={{ color: '#64748b' }}>{label}</div>
      <code className={`flex-1 text-xs px-3 py-1.5 rounded-md break-all select-all ${mono ? 'font-mono' : ''}`}
        style={{ background: warn ? '#fef3c7' : '#f8fafc', color: warn ? '#92400e' : '#334155' }}>
        {value}
      </code>
      {onCopy && (
        <button onClick={() => onCopy(value)}
          className="flex-shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors"
          style={{
            borderColor: copied ? '#16a34a' : '#cbd5e1',
            color: copied ? '#16a34a' : '#475569',
            background: copied ? '#dcfce7' : 'white',
          }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}
