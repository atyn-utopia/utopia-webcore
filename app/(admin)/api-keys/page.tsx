'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'

type KeyStatus = 'grace' | 'active' | 'expired_unused' | 'revoked'

interface ApiKey {
  id: string
  name: string
  key_preview: string
  website: string
  permissions: string[]
  is_active: boolean
  last_used: string | null
  created_at: string
  status: KeyStatus
  full_key: string | null
  grace_expires_at: string | null
}

function formatCountdown(iso: string | null, nowMs: number): string {
  if (!iso) return ''
  const remain = new Date(iso).getTime() - nowMs
  if (remain <= 0) return 'expiring…'
  const h = Math.floor(remain / 3600000)
  const m = Math.floor((remain % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

const STATUS_META: Record<KeyStatus, { label: string; color: string; bg: string }> = {
  grace:          { label: 'Grace period',    color: '#92400e', bg: '#fef3c7' },
  active:         { label: 'Active',          color: '#16a34a', bg: '#dcfce7' },
  expired_unused: { label: 'Expired — unused', color: '#dc2626', bg: '#fef2f2' },
  revoked:        { label: 'Revoked',         color: '#64748b', bg: '#f1f5f9' },
}

function formatDate(d: string | null) {
  if (!d) return 'Never'
  return new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const PERM_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  read: { label: 'Read', color: '#0369a1', bg: '#e0f2fe' },
  write: { label: 'Write', color: '#b45309', bg: '#fef3c7' },
  all: { label: 'Full Access', color: '#dc2626', bg: '#fef2f2' },
}

export default function ApiKeysPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ name: '', website: '', permissions: ['read', 'write'] as string[] })
  const [websites, setWebsites] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null)
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set())
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    fetchKeys()
    fetch('/api/websites').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setWebsites(data.map((w: { domain: string }) => w.domain))
    }).catch(() => {})
  }, [])

  // Tick every 30s to drive the grace-period countdown
  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(i)
  }, [])

  function copyGraceKey(value: string, id: string) {
    navigator.clipboard.writeText(value)
    setCopiedId(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function copySnippet(value: string, id: string) {
    navigator.clipboard.writeText(value)
    setCopiedSnippetId(id)
    toast.success('Tracking snippet copied')
    setTimeout(() => setCopiedSnippetId(null), 2000)
  }

  function toggleSnippet(id: string) {
    setExpandedSnippets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function trackingSnippetFor(domain: string): string {
    return `<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="${domain}"></script>`
  }

  async function fetchKeys() {
    setLoading(true)
    const res = await fetch('/api/admin/api-keys')
    const data = await res.json()
    if (Array.isArray(data)) setKeys(data)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.website) {
      toast.warning('Name and website are required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setNewKey(data.full_key)
      setForm({ name: '', website: '', permissions: ['read', 'write'] })
      setShowForm(false)
      toast.success('API key created — copy it now, it won\'t be shown again', 'Key created')
      fetchKeys()
    } else {
      toast.error(data.error ?? 'Failed to create key')
    }
  }

  async function revokeKey(id: string, name: string) {
    const ok = await confirm({
      title: 'Revoke API key',
      message: `This will deactivate "${name}". Any systems using this key will lose access immediately.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch('/api/admin/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      toast.success('API key revoked', 'Revoked')
      fetchKeys()
    } else {
      toast.error('Failed to revoke key')
    }
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function togglePerm(perm: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }))
  }

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="New keys are visible for 5 hours. If never used in that window, they auto-expire and must be regenerated."
        actions={
          <button onClick={() => { setShowForm(!showForm); setNewKey(null) }}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Generate Key
          </button>
        }
      />

      {/* Newly created key banner */}
      {newKey && (
        <div className="mb-5 rounded-xl border p-5" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <h3 className="text-sm font-bold text-amber-800">Copy your API key now — it won&apos;t be shown again</h3>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border border-amber-200 font-mono break-all select-all" style={{ color: '#92400e' }}>
              {newKey}
            </code>
            <button onClick={copyKey}
              className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors"
              style={{ background: copied ? '#16a34a' : 'var(--primary)' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-5 rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Generate New API Key</h3>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Key Name<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Production Website"
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Website Scope<span className="text-red-500 ml-0.5">*</span></label>
                <div className="relative">
                  <select value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer"
                    style={{ borderColor: '#cbd5e1', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                    <option value="">Select website…</option>
                    <option value="*">All websites (wildcard)</option>
                    {websites.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Permissions</label>
              <div className="flex gap-2">
                {['read', 'write', 'all'].map(perm => {
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
                      {perm === 'all' ? 'Full Access' : perm.charAt(0).toUpperCase() + perm.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#cbd5e1', color: '#475569' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {saving ? 'Generating…' : 'Generate Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : keys.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
          No API keys yet. Generate one to allow external systems to access product data.
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          {keys.map((k, i) => {
            const statusMeta = STATUS_META[k.status]
            const dimmed = k.status === 'revoked' || k.status === 'expired_unused'
            const showFullKey = k.status === 'grace' && k.full_key
            return (
              <div key={k.id} className="px-5 py-4 flex items-start gap-4 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < keys.length - 1 ? '1px solid #f1f5f9' : 'none', opacity: dimmed ? 0.65 : 1 }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#f1f5f9' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: dimmed ? '#94a3b8' : 'var(--primary)' }} strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{k.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                      {statusMeta.label}{k.status === 'grace' && k.grace_expires_at && ` · ${formatCountdown(k.grace_expires_at, nowMs)}`}
                    </span>
                    {!showFullKey && (
                      <code className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: '#f1f5f9', color: '#64748b' }}>{k.key_preview}</code>
                    )}
                  </div>
                  {showFullKey && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 text-[11px] px-2.5 py-1.5 rounded-md font-mono break-all select-all" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                        {k.full_key}
                      </code>
                      <button onClick={() => copyGraceKey(k.full_key!, k.id)}
                        className="flex-shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-md text-white transition-colors"
                        style={{ background: copiedId === k.id ? '#16a34a' : 'var(--primary)' }}>
                        {copiedId === k.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs" style={{ color: '#64748b' }}>{k.website === '*' ? 'All websites' : k.website}</span>
                    <span className="text-xs" style={{ color: '#94a3b8' }}>·</span>
                    {k.permissions.map(p => {
                      const meta = PERM_LABELS[p] ?? PERM_LABELS.read
                      return <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    })}
                    <span className="text-xs" style={{ color: '#94a3b8' }}>· Last used: {formatDate(k.last_used)}</span>
                  </div>
                  {k.status === 'expired_unused' && (
                    <p className="text-[11px] mt-1.5" style={{ color: '#dc2626' }}>This key was never used within 5 hours and was auto-disabled. Generate a new key to replace it.</p>
                  )}
                  {k.website !== '*' && (
                    <div className="mt-2">
                      <button type="button" onClick={() => toggleSnippet(k.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:underline"
                        style={{ color: '#64748b' }}>
                        <svg className={`w-3 h-3 transition-transform ${expandedSnippets.has(k.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        {expandedSnippets.has(k.id) ? 'Hide' : 'Show'} tracking snippet
                      </button>
                      {expandedSnippets.has(k.id) && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 text-[11px] px-2.5 py-1.5 rounded-md font-mono break-all select-all" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}>
                            {trackingSnippetFor(k.website)}
                          </code>
                          <button onClick={() => copySnippet(trackingSnippetFor(k.website), k.id)}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all"
                            style={{
                              background: copiedSnippetId === k.id ? '#dcfce7' : 'white',
                              border: `1px solid ${copiedSnippetId === k.id ? '#86efac' : '#e2e8f0'}`,
                              color: copiedSnippetId === k.id ? '#16a34a' : '#475569',
                            }}>
                            {copiedSnippetId === k.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {k.is_active && (
                  <button type="button" onClick={() => revokeKey(k.id, k.name)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-all flex-shrink-0 mt-0.5"
                    style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                    Revoke
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
