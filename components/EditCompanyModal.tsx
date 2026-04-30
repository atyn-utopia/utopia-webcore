'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'

interface Props {
  open: boolean
  company: { id: string; name: string; logo_url: string | null } | null
  onClose: () => void
  onSaved: (next: { id: string; name: string; logo_url: string | null }) => void
}

export default function EditCompanyModal({ open, company, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoBroken, setLogoBroken] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!company) return
    setName(company.name)
    setLogoUrl(company.logo_url ?? '')
    setLogoBroken(false)
    setShowUrlInput(false)
  }, [company])

  if (!open || !company) return null

  async function uploadFile(file: File) {
    if (!company) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/companies/${company.id}/logo`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed', 'Upload failed')
        return
      }
      // The API also persists the URL to companies.logo_url, so propagate
      // the new URL into the modal state and notify parent.
      setLogoUrl(data.logo_url ?? '')
      setLogoBroken(false)
      onSaved({ id: company.id, name, logo_url: data.logo_url ?? null })
      toast.success('Logo uploaded', 'Company logo')
    } catch (e) {
      toast.error((e as Error).message, 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function removeLogo() {
    if (!company) return
    setUploading(true)
    try {
      const res = await fetch(`/api/companies/${company.id}/logo`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to remove', 'Remove failed')
        return
      }
      setLogoUrl('')
      onSaved({ id: company.id, name, logo_url: null })
      toast.success('Logo removed', 'Company logo')
    } catch (e) {
      toast.error((e as Error).message, 'Remove failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!company) return
    setSaving(true)
    try {
      const trimmedName = name.trim()
      const trimmedLogo = logoUrl.trim()
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          logo_url: trimmedLogo === '' ? null : trimmedLogo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save', 'Save failed')
        return
      }
      toast.success(`Updated ${data.name}`, 'Company saved')
      onSaved({ id: data.id, name: data.name, logo_url: data.logo_url ?? null })
      onClose()
    } catch (e) {
      toast.error((e as Error).message, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const dirty = name.trim() !== company.name || (logoUrl.trim() === '' ? null : logoUrl.trim()) !== company.logo_url
  const previewUrl = logoUrl.trim()
  const busy = saving || uploading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Edit company</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-slate-100"
            style={{ color: '#94a3b8' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Logo preview + upload controls */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Logo</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                {previewUrl && !logoBroken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="w-full h-full object-contain" onError={() => setLogoBroken(true)} />
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" style={{ color: '#cbd5e1' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) uploadFile(f)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-md border transition-colors hover:bg-slate-50 disabled:opacity-50"
                    style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    {uploading ? 'Uploading…' : previewUrl ? 'Replace' : 'Upload logo'}
                  </button>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      disabled={busy}
                      className="text-xs font-medium px-3 h-9 rounded-md border transition-colors hover:bg-red-50 disabled:opacity-50"
                      style={{ borderColor: '#e2e8f0', color: '#b91c1c', background: 'white' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#94a3b8' }}>
                  PNG, JPG, SVG, WebP, or GIF · max 2&nbsp;MB
                </p>
                {previewUrl && logoBroken && (
                  <p className="text-[10px] mt-1" style={{ color: '#b91c1c' }}>Image failed to load — try uploading again.</p>
                )}
              </div>
            </div>

            {/* Power-user: paste URL fallback */}
            <button
              type="button"
              onClick={() => setShowUrlInput(v => !v)}
              className="text-[10px] font-medium mt-2 transition-colors hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              {showUrlInput ? 'Hide URL field' : 'Or paste an image URL'}
            </button>
            {showUrlInput && (
              <input
                type="url"
                value={logoUrl}
                onChange={e => { setLogoUrl(e.target.value); setLogoBroken(false) }}
                placeholder="https://example.com/logo.png"
                className="w-full h-9 mt-1 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)] transition-colors"
                style={{ borderColor: '#e2e8f0', background: 'white' }}
              />
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Company name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)] transition-colors"
              style={{ borderColor: '#e2e8f0', background: 'white' }}
            />
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            onClick={onClose}
            className="text-xs font-medium px-3 h-9 rounded-md transition-colors hover:bg-slate-100"
            style={{ color: '#475569' }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !dirty || !name.trim()}
            className="text-xs font-medium px-3 h-9 rounded-md text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
