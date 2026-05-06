'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'

interface Override {
  id: string
  website: string
  path: string
  title: string | null
  description: string | null
  og_image: string | null
  updated_at: string
}

export default function SeoPage() {
  return (
    <Suspense>
      <SeoInner />
    </Suspense>
  )
}

function SeoInner() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('website') ?? ''
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Override> | null>(null)

  function load() {
    if (!domain) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/seo?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setRows(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [domain])

  async function remove(row: Override) {
    const ok = await confirm({
      title: `Delete SEO override for ${row.path}?`,
      message: 'The page will fall back to whatever metadata the designer site sets in code.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/seo?website=${encodeURIComponent(domain)}&path=${encodeURIComponent(row.path)}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Delete failed', 'Delete failed')
      return
    }
    toast.success(`Removed override for ${row.path}`, 'SEO override deleted')
    load()
  }

  if (!domain) {
    return (
      <div>
        <PageHeader title="SEO" description="Pick a website from the home dashboard to manage its SEO." />
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#64748b' }}>No website selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="SEO"
        description={<span>Per-page meta title, description, and social-share image for <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{domain}</code>. Overrides are pushed live without redeploying the designer site.</span>}
      />

      <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
        <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Page overrides</h3>
            <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>One row per URL path on this site.</p>
          </div>
          <button
            onClick={() => setEditing({ path: '/', title: '', description: '', og_image: '' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-md text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add override
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-center text-xs" style={{ color: '#94a3b8' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No overrides yet</p>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Click <strong>Add override</strong> to set a meta title, description, or social image for any path.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {rows.map(row => (
              <div key={row.id} className="px-5 py-4 flex items-start gap-4" style={{ borderTopColor: '#f1f5f9' }}>
                <div className="w-12 h-12 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  {row.og_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.og_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{row.path}</code>
                  </div>
                  {row.title && <p className="text-sm font-medium mt-1.5 truncate" style={{ color: 'var(--foreground)' }}>{row.title}</p>}
                  {row.description && <p className="text-xs mt-0.5" style={{ color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{row.description}</p>}
                  {!row.title && !row.description && <p className="text-xs mt-1" style={{ color: '#cbd5e1' }}>No title or description set.</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setEditing(row)}
                    className="text-xs font-medium px-3 h-8 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(row)}
                    className="text-xs font-medium px-3 h-8 rounded-md border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    style={{ borderColor: '#e2e8f0', color: '#94a3b8', background: 'white' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <SeoOverrideModal
          domain={domain}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function SeoOverrideModal({ domain, row, onClose, onSaved }: { domain: string; row: Partial<Override>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [path, setPath] = useState(row.path ?? '/')
  const [title, setTitle] = useState(row.title ?? '')
  const [description, setDescription] = useState(row.description ?? '')
  const [ogImage, setOgImage] = useState(row.og_image ?? '')
  const [saving, setSaving] = useState(false)
  const isEdit = !!row.id

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path: path.trim() || '/',
          title: title.trim() || null,
          description: description.trim() || null,
          og_image: ogImage.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success(`Saved override for ${data.path}`, 'SEO override saved')
      onSaved()
    } catch (e) {
      toast.error((e as Error).message, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{isEdit ? 'Edit override' : 'Add override'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-slate-100" style={{ color: '#94a3b8' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Page path</label>
            <input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/"
              disabled={isEdit}
              className="w-full h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)] disabled:bg-slate-50 disabled:text-slate-500"
              style={{ borderColor: '#e2e8f0', background: 'white' }}
            />
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>e.g. <code>/</code>, <code>/products</code>, <code>/blog/some-post</code>. Leading slash. {isEdit && <>Path is locked when editing — delete and re-create to move an override.</>}</p>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
              <span>Meta title</span>
              <span className="text-[10px] font-normal" style={{ color: '#94a3b8' }}>{title.length}/60</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Page title shown in search results"
              className="w-full h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)]"
              style={{ borderColor: title.length > 60 ? '#fecaca' : '#e2e8f0', background: 'white' }}
            />
            <p className="text-[10px] mt-1" style={{ color: title.length > 60 ? '#b91c1c' : '#94a3b8' }}>
              {title.length > 60 ? 'Google may truncate titles over 60 characters.' : 'Aim for 50–60 characters for full display in search results.'}
            </p>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
              <span>Meta description</span>
              <span className="text-[10px] font-normal" style={{ color: '#94a3b8' }}>{description.length}/160</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="One- or two-sentence summary of the page."
              className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:border-[var(--primary)] resize-y"
              style={{ borderColor: description.length > 160 ? '#fecaca' : '#e2e8f0', background: 'white' }}
            />
            <p className="text-[10px] mt-1" style={{ color: description.length > 160 ? '#b91c1c' : '#94a3b8' }}>
              {description.length > 160 ? 'Google will truncate descriptions over 160 characters.' : 'Aim for 120–160 characters.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Social share image (og:image)</label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-12 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {ogImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ogImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
              </div>
              <input
                type="url"
                value={ogImage}
                onChange={e => setOgImage(e.target.value)}
                placeholder="https://example.com/share.jpg"
                className="flex-1 h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)]"
                style={{ borderColor: '#e2e8f0', background: 'white' }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>1200×630 image used as the link preview on Facebook / WhatsApp / Twitter / LinkedIn.</p>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button onClick={onClose} className="text-xs font-medium px-3 h-9 rounded-md transition-colors hover:bg-slate-100" style={{ color: '#475569' }}>Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs font-medium px-3 h-9 rounded-md text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create override'}
          </button>
        </div>
      </div>
    </div>
  )
}
