'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fullSetupMarkdown } from '@/lib/setupBundle'
import {
  BoltIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/solid'

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

const STATUS_META: Record<KeyStatus, { label: string; color: string; bg: string }> = {
  grace:          { label: 'Grace',    color: '#92400e', bg: '#fef3c7' },
  active:         { label: 'Active',   color: '#15803d', bg: '#dcfce7' },
  expired_unused: { label: 'Expired',  color: '#b91c1c', bg: '#fef2f2' },
  revoked:        { label: 'Revoked',  color: '#64748b', bg: '#f1f5f9' },
}

const PERM_META: Record<string, { color: string; bg: string; label: string }> = {
  read:  { label: 'Read',  color: '#0369a1', bg: '#e0f2fe' },
  write: { label: 'Write', color: '#b45309', bg: '#fef3c7' },
  all:   { label: 'Full',  color: '#dc2626', bg: '#fef2f2' },
}

function formatDate(d: string | null) {
  if (!d) return 'Never'
  return new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

interface Props { domain: string }

/**
 * Per-site API keys card. Lives on /site-settings?website=<domain>.
 *
 * Lists every key scoped to this site with status, permissions, last-used,
 * preview, and (within the grace window) the full key for one-time copy.
 * Lets admins create a new key for the site directly here without bouncing
 * to the global /api-keys page.
 */
export default function SiteApiKeysCard({ domain }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [perms, setPerms] = useState<string[]>(['read', 'write'])
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [revalidateSecret, setRevalidateSecret] = useState<string | null>(null)

  // Pull the website's revalidate_secret once so the Claude handoff can
  // bake it into the generated setup markdown alongside the API key.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/website-settings?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setRevalidateSecret(d?.revalidate_secret ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [domain])

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/api-keys')
      const data = await res.json() as ApiKey[]
      setKeys(Array.isArray(data) ? data.filter(k => k.website === domain) : [])
    } catch {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [domain])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  function copy(value: string, token: string, label = 'Copied') {
    navigator.clipboard.writeText(value)
    setCopied(token)
    toast.success(label)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.warning('Give the key a name')
      return
    }
    if (perms.length === 0) {
      toast.warning('Pick at least one permission')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), website: domain, permissions: perms }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create key')
        return
      }
      setName('')
      setPerms(['read', 'write'])
      setShowForm(false)
      toast.success('Key created — grace window is 5 hours', 'Created')
      fetchKeys()
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string, label: string) {
    const ok = await confirm({
      title: 'Revoke API key',
      message: `This will deactivate "${label}". Any systems using this key lose access immediately.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch('/api/admin/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      toast.error('Failed to revoke')
      return
    }
    toast.success('Revoked')
    fetchKeys()
  }

  function togglePerm(p: string) {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>API Keys</h3>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
            Server-to-server credentials for this site only. {keys.length > 0 && <span>{keys.length} key{keys.length === 1 ? '' : 's'}</span>}
          </p>
        </div>
        {!showForm && (
          <Button variant="primary" size="md" onClick={() => setShowForm(true)} iconLeft={<PlusIcon className="w-3.5 h-3.5" />}>
            New key
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="px-5 py-4 space-y-3" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Key name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tracker — production" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Permissions</label>
            <div className="flex flex-wrap gap-2">
              {(['read', 'write', 'all'] as const).map(p => {
                const meta = PERM_META[p]
                const checked = perms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePerm(p)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors"
                    style={{
                      background: checked ? meta.bg : 'white',
                      color: checked ? meta.color : '#94a3b8',
                      borderColor: checked ? 'transparent' : '#e2e8f0',
                    }}
                  >
                    {checked && <CheckIcon className="w-3 h-3" />}
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="md" onClick={() => { setShowForm(false); setName(''); setPerms(['read', 'write']) }} disabled={creating}>Cancel</Button>
            <Button variant="primary" size="md" type="submit" loading={creating}>
              {creating ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      <div>
        {loading ? (
          <div className="px-5 py-10 text-center text-xs" style={{ color: '#94a3b8' }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <KeyIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#cbd5e1' }} />
            <p className="text-xs" style={{ color: '#94a3b8' }}>No API keys for this site yet.</p>
          </div>
        ) : (
          keys.map((k, i) => {
            const status = STATUS_META[k.status]
            const isRevealed = revealed[k.id]
            const showFull = (k.status === 'grace') && k.full_key
            return (
              <div
                key={k.id}
                className="px-5 py-3 flex items-start gap-3 flex-wrap"
                style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{k.name}</span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                    {k.permissions.map(p => {
                      const meta = PERM_META[p] ?? { label: p, color: '#475569', bg: '#f1f5f9' }
                      return (
                        <span
                          key={p}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-[11px] px-2 py-1 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>
                      {showFull && isRevealed ? k.full_key : k.key_preview}
                    </code>
                    {showFull && (
                      <button
                        type="button"
                        onClick={() => setRevealed(r => ({ ...r, [k.id]: !r[k.id] }))}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--primary)]"
                        style={{ color: '#64748b' }}
                      >
                        <EyeIcon className="w-3 h-3" />
                        {isRevealed ? 'Hide' : 'Reveal'}
                      </button>
                    )}
                    {showFull && isRevealed && k.full_key && (
                      <button
                        type="button"
                        onClick={() => copy(k.full_key!, k.id, 'Full key copied — store it now')}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--primary)]"
                        style={{ color: '#64748b' }}
                      >
                        <ClipboardDocumentListIcon className="w-3 h-3" />
                        {copied === k.id ? 'Copied' : 'Copy'}
                      </button>
                    )}
                    {showFull && k.full_key && (
                      <button
                        type="button"
                        onClick={() => copy(
                          fullSetupMarkdown({ domain, apiKey: k.full_key!, permissions: k.permissions, revalidateSecret }),
                          `${k.id}-claude`,
                          'Setup pasted. Drop it into Claude Code and it will integrate the customer site.',
                        )}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--primary)]"
                        style={{ color: '#64748b' }}
                        title="Generates a setup bundle (Webcore client + API key + revalidate secret) for the designer to paste into Claude Code"
                      >
                        <BoltIcon className="w-3 h-3" />
                        {copied === `${k.id}-claude` ? 'Copied for Claude' : 'Copy for Claude'}
                      </button>
                    )}
                    {!showFull && (
                      <button
                        type="button"
                        onClick={() => copy(k.key_preview, k.id, 'Preview copied (not the full key)')}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--primary)]"
                        style={{ color: '#94a3b8' }}
                      >
                        <ClipboardDocumentListIcon className="w-3 h-3" />
                        {copied === k.id ? 'Copied' : 'Copy preview'}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: '#94a3b8' }}>
                    Created {formatDate(k.created_at)} · Last used {formatDate(k.last_used)}
                  </p>
                </div>
                {k.is_active && (
                  <button
                    type="button"
                    onClick={() => revoke(k.id, k.name)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
                    style={{ borderColor: '#fecaca', color: '#b91c1c', background: 'white' }}
                  >
                    <TrashIcon className="w-3 h-3" />
                    Revoke
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
