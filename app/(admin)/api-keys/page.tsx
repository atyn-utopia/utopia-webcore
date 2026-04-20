'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { fullSetupMarkdown } from '@/lib/setupBundle'

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

const STATUS_META: Record<KeyStatus, { label: string; color: string; bg: string; border: string }> = {
  grace:          { label: 'Grace',    color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  active:         { label: 'Active',   color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
  expired_unused: { label: 'Expired',  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  revoked:        { label: 'Revoked',  color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' },
}

const PERM_META: Record<string, { label: string; color: string; bg: string }> = {
  read:  { label: 'Read',  color: '#0369a1', bg: '#e0f2fe' },
  write: { label: 'Write', color: '#b45309', bg: '#fef3c7' },
  all:   { label: 'Full',  color: '#dc2626', bg: '#fef2f2' },
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

function formatDate(d: string | null) {
  if (!d) return 'Never'
  return new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function trackingSnippetFor(domain: string): string {
  return `<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="${domain}"></script>`
}

export default function ApiKeysPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [websites, setWebsites] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', website: '', permissions: ['read', 'write'] as string[] })
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set())
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    fetchKeys()
    fetch('/api/websites').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setWebsites(data.map((w: { domain: string }) => w.domain))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(i)
  }, [])

  async function fetchKeys() {
    setLoading(true)
    const res = await fetch('/api/admin/api-keys')
    const data = await res.json()
    if (Array.isArray(data)) setKeys(data)
    setLoading(false)
  }

  function copy(value: string, token: string, label = 'Copied') {
    navigator.clipboard.writeText(value)
    setCopiedToken(token)
    toast.success(label)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  function toggleSnippet(id: string) {
    setExpandedSnippets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      setForm({ name: '', website: '', permissions: ['read', 'write'] })
      setShowForm(false)
      toast.success('Key created — grace window is 5 hours', 'Created')
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
      toast.success('Revoked')
      fetchKeys()
    } else {
      toast.error('Failed to revoke key')
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
        description="Keys are visible on this page for 5 hours. If never used in that window they auto-expire."
        actions={
          <button onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Generate Key
          </button>
        }
      />

      {showForm && (
        <CreateForm
          form={form}
          websites={websites}
          saving={saving}
          onChange={setForm}
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreate}
          onTogglePerm={togglePerm}
        />
      )}

      {loading ? (
        <div className="p-16 text-center text-sm rounded-2xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : keys.length === 0 ? (
        <EmptyState onCreate={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <KeyCard
              key={k.id}
              k={k}
              nowMs={nowMs}
              copiedToken={copiedToken}
              snippetExpanded={expandedSnippets.has(k.id)}
              onCopy={copy}
              onToggleSnippet={() => toggleSnippet(k.id)}
              onRevoke={() => revokeKey(k.id, k.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Key card ──────────────────────────────────────────────── */

function KeyCard({ k, nowMs, copiedToken, snippetExpanded, onCopy, onToggleSnippet, onRevoke }: {
  k: ApiKey
  nowMs: number
  copiedToken: string | null
  snippetExpanded: boolean
  onCopy: (value: string, token: string, label?: string) => void
  onToggleSnippet: () => void
  onRevoke: () => void
}) {
  const statusMeta = STATUS_META[k.status]
  const isGrace = k.status === 'grace' && !!k.full_key
  const isDimmed = k.status === 'revoked' || k.status === 'expired_unused'
  const graceLabel = k.status === 'grace' && k.grace_expires_at ? `${statusMeta.label} · ${formatCountdown(k.grace_expires_at, nowMs)}` : statusMeta.label

  return (
    <div className="rounded-xl bg-white transition-shadow hover:shadow-sm"
      style={{ border: `1px solid ${isGrace ? '#fde68a' : '#e2e8f0'}`, opacity: isDimmed ? 0.7 : 1 }}>
      {/* Header row */}
      <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.border}` }}>
              {graceLabel}
            </span>
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{k.name}</h3>
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs" style={{ color: '#64748b' }}>
            <span className="font-medium" style={{ color: '#475569' }}>{k.website === '*' ? 'All websites' : k.website}</span>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <div className="flex items-center gap-1">
              {k.permissions.map(p => {
                const meta = PERM_META[p] ?? PERM_META.read
                return <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
              })}
            </div>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span>Last used: {formatDate(k.last_used)}</span>
          </div>
        </div>

        {k.is_active && (
          <button type="button" onClick={onRevoke}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-all flex-shrink-0"
            style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
            Revoke
          </button>
        )}
      </div>

      {!isGrace && !isDimmed && (
        <div className="px-5 pb-4">
          <code className="inline-block text-[11px] px-2 py-0.5 rounded font-mono" style={{ background: '#f1f5f9', color: '#64748b' }}>{k.key_preview}</code>
        </div>
      )}

      {k.status === 'expired_unused' && (
        <div className="px-5 pb-4">
          <p className="text-[11px]" style={{ color: '#b91c1c' }}>Never used within 5 hours. Generate a new key to replace it.</p>
        </div>
      )}

      {isGrace && (
        <div className="px-5 pb-4 space-y-3">
          <InfoPanel
            label="API key"
            hint="Keep secret — don't commit to git. Shown only during the 5h grace window."
            tone="warning"
            value={k.full_key!}
            token={`key-${k.id}`}
            copiedToken={copiedToken}
            onCopy={onCopy}
          />
          <ClaudeHandoff domain={k.website} apiKey={k.full_key!} permissions={k.permissions}
            copiedToken={copiedToken} onCopy={onCopy} />
        </div>
      )}

      {k.website !== '*' && (
        <div className="px-5 pb-4">
          <button type="button" onClick={onToggleSnippet}
            className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:underline"
            style={{ color: '#64748b' }}>
            <svg className={`w-3 h-3 transition-transform ${snippetExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            {snippetExpanded ? 'Hide' : 'Show'} tracking snippet
          </button>
          {snippetExpanded && (
            <div className="mt-2">
              <InfoPanel
                label="Tracking script"
                hint="Paste in the <head> of every page on the designer's site"
                value={trackingSnippetFor(k.website)}
                token={`snip-${k.id}`}
                copiedToken={copiedToken}
                onCopy={onCopy}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Claude handoff section ────────────────────────────────── */

function ClaudeHandoff({ domain, apiKey, permissions, copiedToken, onCopy }: {
  domain: string
  apiKey: string
  permissions: string[]
  copiedToken: string | null
  onCopy: (value: string, token: string, label?: string) => void
}) {
  const token = `setup-${domain}`
  const copied = copiedToken === token
  return (
    <div className="rounded-lg p-3.5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" style={{ color: 'var(--primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div className="min-w-0">
            <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Claude Code handoff</div>
            <div className="text-[11px]" style={{ color: '#64748b' }}>Paste into any Claude — it creates all files and does the integration.</div>
          </div>
        </div>
        <button type="button"
          onClick={() => onCopy(fullSetupMarkdown({ domain, apiKey, permissions }), token, 'Paste into Claude — it will do the rest')}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md transition-all flex-shrink-0"
          style={{
            background: copied ? '#dcfce7' : 'white',
            border: `1px solid ${copied ? '#86efac' : '#e2e8f0'}`,
            color: copied ? '#15803d' : '#475569',
          }}>
          {copied ? (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied — paste into Claude</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m-8 4h5m-7 4h10a2 2 0 002-2V6a2 2 0 00-2-2H9.914a2 2 0 00-1.414.586l-2.828 2.828A2 2 0 005 8.828V20a2 2 0 002 2z" /></svg>Copy setup for Claude</>
          )}
        </button>
      </div>
    </div>
  )
}

/* ─── Generic InfoPanel (reused for key + snippet) ──────────── */

function InfoPanel({ label, hint, value, token, copiedToken, onCopy, tone }: {
  label: string
  hint?: string
  value: string
  token: string
  copiedToken: string | null
  onCopy: (value: string, token: string, label?: string) => void
  tone?: 'warning'
}) {
  const copied = copiedToken === token
  const bg = tone === 'warning' ? '#fffbeb' : '#f8fafc'
  const borderColor = tone === 'warning' ? '#fde68a' : '#e2e8f0'
  const fg = tone === 'warning' ? '#92400e' : '#334155'
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: bg }}>
      <div className="px-3 py-2 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: fg, opacity: 0.8 }}>{label}</div>
          {hint && <div className="text-[11px] mt-0.5" style={{ color: fg, opacity: 0.75 }}>{hint}</div>}
        </div>
        <button onClick={() => onCopy(value, token, `${label} copied`)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          style={{
            background: copied ? '#dcfce7' : 'white',
            border: `1px solid ${copied ? '#86efac' : '#e2e8f0'}`,
            color: copied ? '#15803d' : '#475569',
          }}>
          {copied ? (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
          ) : (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round" /></svg>Copy</>
          )}
        </button>
      </div>
      <code className="block px-3 py-2.5 text-[11px] font-mono break-all select-all" style={{ color: fg }}>
        {value}
      </code>
    </div>
  )
}

/* ─── Empty state ───────────────────────────────────────────── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-12 text-center rounded-2xl border" style={{ borderColor: '#e2e8f0', background: 'white' }}>
      <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" style={{ color: '#94a3b8' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No API keys yet</h3>
      <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>Generate a key to let an external website fetch data from webcore.</p>
      <button onClick={onCreate}
        className="inline-flex items-center gap-2 text-white text-xs font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
        style={{ background: 'var(--primary)' }}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        Generate your first key
      </button>
    </div>
  )
}

/* ─── Create form ───────────────────────────────────────────── */

function CreateForm({ form, websites, saving, onChange, onCancel, onSubmit, onTogglePerm }: {
  form: { name: string; website: string; permissions: string[] }
  websites: string[]
  saving: boolean
  onChange: (updater: (f: { name: string; website: string; permissions: string[] }) => { name: string; website: string; permissions: string[] }) => void
  onCancel: () => void
  onSubmit: (e: React.FormEvent) => void
  onTogglePerm: (perm: string) => void
}) {
  return (
    <form onSubmit={onSubmit} className="mb-5 rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>New API key</h3>
        <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Visible for 5 hours after creation, then only shown once it&apos;s been used.</p>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#334155' }}>Name</label>
            <input type="text" value={form.name} onChange={e => onChange(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Production website"
              className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-colors focus:border-[var(--primary)]"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#334155' }}>Website</label>
            <div className="relative">
              <select value={form.website} onChange={e => onChange(f => ({ ...f, website: e.target.value }))}
                className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none cursor-pointer pr-9 transition-colors focus:border-[var(--primary)]"
                style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none' }}>
                <option value="">Select a website…</option>
                <option value="*">All websites (wildcard)</option>
                {websites.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#334155' }}>Permissions</label>
          <div className="flex gap-2">
            {['read', 'write', 'all'].map(perm => {
              const meta = PERM_META[perm]
              const active = form.permissions.includes(perm)
              return (
                <button key={perm} type="button" onClick={() => onTogglePerm(perm)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: active ? 'var(--primary)' : 'white',
                    border: `1px solid ${active ? 'var(--primary)' : '#e2e8f0'}`,
                    color: active ? 'white' : '#475569',
                  }}>
                  {active && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: '#475569' }}>Cancel</button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--primary)' }}>
          {saving ? 'Generating…' : 'Generate key'}
        </button>
      </div>
    </form>
  )
}
