'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
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

      <AuditPanel domain={domain} />

      <div className="mt-5 rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEdit = !!row.id

  async function uploadOgImage(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/seo/upload?website=${encodeURIComponent(domain)}`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed', 'Upload failed')
        return
      }
      setOgImage(data.url)
      toast.success('Image uploaded — remember to Save', 'Uploaded')
    } catch (e) {
      toast.error((e as Error).message, 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

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
              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) uploadOgImage(f)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-md border transition-colors hover:bg-slate-50 disabled:opacity-50 flex-shrink-0"
                    style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    {uploading ? 'Uploading…' : ogImage ? 'Replace' : 'Upload'}
                  </button>
                  {ogImage && (
                    <button
                      type="button"
                      onClick={() => setOgImage('')}
                      disabled={uploading || saving}
                      className="text-xs font-medium px-3 h-9 rounded-md border transition-colors hover:bg-slate-50 disabled:opacity-50 flex-shrink-0"
                      style={{ borderColor: '#e2e8f0', color: '#94a3b8', background: 'white' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={ogImage}
                  onChange={e => setOgImage(e.target.value)}
                  placeholder="…or paste an existing image URL"
                  className="w-full h-9 mt-2 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)]"
                  style={{ borderColor: '#e2e8f0', background: 'white' }}
                />
              </div>
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>PNG / JPG / WebP / GIF · max 4&nbsp;MB · ideal size 1200×630 for Facebook / WhatsApp / Twitter / LinkedIn previews.</p>
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

interface AuditIssue { type: 'error' | 'warn' | 'info'; category: 'meta' | 'images' | 'headings' | 'social'; message: string; detail?: string }
interface AuditResult {
  url: string
  fetchedAt: string
  ok: boolean
  status?: number
  error?: string
  meta: { title: string | null; titleLength: number; description: string | null; descriptionLength: number; canonical: string | null; robots: string | null; ogImage: string | null; ogTitle: string | null; ogDescription: string | null; twitterImage: string | null }
  headings: { h1Count: number; total: number; h1Texts: string[] }
  images: { total: number; missingAlt: number; emptyAlt: number; samples: { src: string; alt: string | null; reason: 'missing' | 'empty' }[] }
  issues: AuditIssue[]
}

const ISSUE_STYLE: Record<AuditIssue['type'], { bg: string; border: string; color: string; icon: string }> = {
  error: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '⚠' },
  warn:  { bg: '#fffbeb', border: '#fde68a', color: '#a16207', icon: '!'  },
  info:  { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'i'  },
}

interface AltOverride { id: string; image_src: string; alt: string; updated_at: string }

function AuditPanel({ domain }: { domain: string }) {
  const [path, setPath] = useState('/')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [altOverrides, setAltOverrides] = useState<AltOverride[]>([])
  const toast = useToast()
  const confirm = useConfirm()

  function loadAltOverrides() {
    fetch(`/api/seo/alt-overrides?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setAltOverrides(d) })
      .catch(() => {})
  }
  useEffect(loadAltOverrides, [domain])

  async function runAudit() {
    setRunning(true)
    try {
      const res = await fetch('/api/seo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, path }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Audit failed', 'Audit failed')
        return
      }
      setResult(data)
    } catch (e) {
      toast.error((e as Error).message, 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  async function saveAlt(imageSrc: string, alt: string) {
    const res = await fetch('/api/seo/alt-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website: domain, image_src: imageSrc, alt }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Save failed', 'Save failed')
      return false
    }
    toast.success('Alt text will apply on the next page load.', 'Alt text saved')
    loadAltOverrides()
    return true
  }

  async function deleteAlt(imageSrc: string) {
    const ok = await confirm({
      title: 'Remove alt-text override?',
      message: 'The image will fall back to whatever alt the designer site sets in code (or none).',
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/seo/alt-overrides?website=${encodeURIComponent(domain)}&image_src=${encodeURIComponent(imageSrc)}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Delete failed', 'Delete failed')
      return
    }
    toast.success('Override removed.', 'Alt text deleted')
    loadAltOverrides()
  }

  const errorCount = result?.issues.filter(i => i.type === 'error').length ?? 0
  const warnCount = result?.issues.filter(i => i.type === 'warn').length ?? 0
  const infoCount = result?.issues.filter(i => i.type === 'info').length ?? 0

  return (
    <div className="rounded-xl border bg-white mb-5" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>SEO audit</h3>
          <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>Fetches the live page and checks meta tags, headings, social images, and image alt text.</p>
        </div>
      </div>

      <div className="px-5 py-4 flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#475569' }}>Path</label>
          <div className="flex items-center h-9 rounded-md border overflow-hidden" style={{ borderColor: '#e2e8f0', background: 'white' }}>
            <span className="px-3 text-xs font-mono whitespace-nowrap" style={{ color: '#94a3b8' }}>https://{domain}</span>
            <input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/"
              className="flex-1 h-full pr-3 text-sm outline-none border-l"
              style={{ borderLeftColor: '#e2e8f0', background: 'white' }}
            />
          </div>
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-4 h-9 rounded-md text-white transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Auditing…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Run audit
            </>
          )}
        </button>
      </div>

      {result && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          {/* Summary chips */}
          <div className="px-5 py-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
            <SummaryChip label="Errors" count={errorCount} tone="error" />
            <SummaryChip label="Warnings" count={warnCount} tone="warn" />
            <SummaryChip label="Info" count={infoCount} tone="info" />
            <span className="ml-auto text-[10px]" style={{ color: '#94a3b8' }}>
              {result.ok ? `HTTP ${result.status}` : 'Fetch failed'} · {new Date(result.fetchedAt).toLocaleTimeString()}
            </span>
          </div>

          {result.ok && (
            <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <SummaryCard label="Title" value={result.meta.title ?? '—'} sub={result.meta.title ? `${result.meta.titleLength} chars` : 'Missing'} muted={!result.meta.title} />
              <SummaryCard label="Description" value={result.meta.description ?? '—'} sub={result.meta.description ? `${result.meta.descriptionLength} chars` : 'Missing'} muted={!result.meta.description} />
              <SummaryCard label="<h1>" value={result.headings.h1Texts.join(' / ') || '—'} sub={`${result.headings.h1Count} on page · ${result.headings.total} headings total`} muted={result.headings.h1Count === 0} />
              <SummaryCard label="Images" value={`${result.images.total} total`} sub={`${result.images.missingAlt} missing alt · ${result.images.emptyAlt} empty alt`} muted={result.images.total === 0} />
              <SummaryCard label="og:image" value={result.meta.ogImage ?? '—'} sub={result.meta.ogImage ? 'Set' : 'Missing'} muted={!result.meta.ogImage} mono />
              <SummaryCard label="Canonical" value={result.meta.canonical ?? '—'} sub={result.meta.canonical ? 'Set' : 'Not set'} muted={!result.meta.canonical} mono />
            </div>
          )}

          {/* Issues */}
          <div className="px-5 py-4" style={{ borderTop: '1px solid #f1f5f9' }}>
            {result.issues.length === 0 ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#16a34a' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                No issues found.
              </div>
            ) : (
              <div className="space-y-1.5">
                {result.issues.map((issue, i) => {
                  const s = ISSUE_STYLE[issue.type]
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-md" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold" style={{ color: 'white', background: s.color }}>{s.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium" style={{ color: s.color }}>{issue.message}</p>
                        {issue.detail && <p className="text-[10px] mt-0.5 truncate" style={{ color: '#64748b' }}>{issue.detail}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Images-without-alt editor — hide rows that already have an override saved */}
          {(() => {
            const overrideSrcs = new Set(altOverrides.map(o => o.image_src))
            const remaining = result.images.samples.filter(s => !overrideSrcs.has(s.src))
            if (remaining.length === 0) return null
            return (
              <div className="px-5 py-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Images needing alt text</p>
                <div className="space-y-2">
                  {remaining.map((img, i) => (
                    <AltRow
                      key={i}
                      domain={domain}
                      imageSrc={img.src}
                      reason={img.reason}
                      onSave={saveAlt}
                    />
                  ))}
                </div>
                <p className="text-[10px] mt-2" style={{ color: '#94a3b8' }}>Showing up to 8. Saved overrides apply within ~30 seconds on the live site via the webcore tracker.</p>
              </div>
            )
          })()}

          {/* Existing alt overrides for this site */}
          {altOverrides.length > 0 && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid #f1f5f9' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Active alt-text overrides ({altOverrides.length})</p>
              <div className="space-y-2">
                {altOverrides.map(o => (
                  <AltRow
                    key={o.id}
                    domain={domain}
                    imageSrc={o.image_src}
                    initialAlt={o.alt}
                    onSave={saveAlt}
                    onDelete={deleteAlt}
                  />
                ))}
              </div>
            </div>
          )}

          {!result.ok && result.error && (
            <div className="px-5 py-3 text-xs" style={{ borderTop: '1px solid #f1f5f9', color: '#b91c1c', background: '#fef2f2' }}>
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryChip({ label, count, tone }: { label: string; count: number; tone: 'error' | 'warn' | 'info' }) {
  const s = ISSUE_STYLE[tone]
  const dim = count === 0
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium" style={{ background: dim ? '#f1f5f9' : s.bg, color: dim ? '#94a3b8' : s.color, border: `1px solid ${dim ? '#e2e8f0' : s.border}` }}>
      <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold tabular-nums" style={{ background: dim ? '#cbd5e1' : s.color, color: 'white' }}>{count}</span>
      {label}
    </span>
  )
}

function SummaryCard({ label, value, sub, muted, mono }: { label: string; value: string; sub: string; muted?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-md p-3" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
      <p className={`text-xs mt-1 truncate ${mono ? 'font-mono' : ''}`} style={{ color: muted ? '#cbd5e1' : 'var(--foreground)' }} title={value}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: muted ? '#cbd5e1' : '#64748b' }}>{sub}</p>
    </div>
  )
}

function AltRow({
  domain,
  imageSrc,
  initialAlt,
  reason,
  onSave,
  onDelete,
}: {
  domain: string
  imageSrc: string
  initialAlt?: string
  reason?: 'missing' | 'empty'
  onSave: (src: string, alt: string) => Promise<boolean>
  onDelete?: (src: string) => void
}) {
  const [value, setValue] = useState(initialAlt ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = value !== (initialAlt ?? '')
  const previewSrc = imageSrc.startsWith('http') ? imageSrc : `https://${domain}${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`

  async function save() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(imageSrc, value.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-md" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <div className="w-12 h-12 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: '#f1f5f9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewSrc} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-mono truncate" style={{ color: '#475569' }} title={imageSrc}>{imageSrc}</p>
        {reason && (
          <p className="text-[10px] mt-0.5" style={{ color: reason === 'missing' ? '#b91c1c' : '#94a3b8' }}>
            {reason === 'missing' ? 'No alt attribute' : 'Empty alt (decorative)'}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Describe this image for screen readers and search engines"
            onKeyDown={e => { if (e.key === 'Enter' && dirty && !saving) save() }}
            className="flex-1 h-8 px-2.5 text-xs rounded border outline-none focus:border-[var(--primary)]"
            style={{ borderColor: '#e2e8f0', background: 'white' }}
          />
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !value.trim() || saving}
            className="text-[11px] font-medium px-2.5 h-8 rounded text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? '…' : 'Save'}
          </button>
          {onDelete && initialAlt !== undefined && (
            <button
              type="button"
              onClick={() => onDelete(imageSrc)}
              className="text-[11px] font-medium px-2.5 h-8 rounded border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              style={{ borderColor: '#e2e8f0', color: '#94a3b8', background: 'white' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
