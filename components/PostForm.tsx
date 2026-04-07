'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RichTextEditor from '@/components/RichTextEditor'

interface PostFormProps {
  mode: 'new' | 'edit'
  initialData?: Partial<PostValues>
  postId?: string
}

interface PostValues {
  website: string
  title: string
  slug: string
  content: string
  excerpt: string
  cover_image_url: string
  meta_title: string
  meta_description: string
  status: 'draft' | 'published'
}

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

const EMPTY: PostValues = {
  website: '',
  title: '',
  slug: '',
  content: '',
  excerpt: '',
  cover_image_url: '',
  meta_title: '',
  meta_description: '',
  status: 'draft',
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#f1f5f9' }}>
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export default function PostForm({ mode, initialData = {}, postId }: PostFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<PostValues>({ ...EMPTY, ...initialData })
  const [slugLocked, setSlugLocked] = useState(mode === 'edit')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (mode === 'new' && !slugLocked) {
      setForm(f => ({ ...f, slug: toSlug(f.title) }))
    }
  }, [form.title, mode, slugLocked])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.website.trim()) e.website = 'Website is required'
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.slug.trim()) e.slug = 'Slug is required'
    return e
  }

  async function handleSave(status?: 'draft' | 'published') {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const payload = { ...form, slug: toSlug(form.slug) }
    if (status) payload.status = status

    setSaving(true)
    setServerError('')
    setSaved(false)

    const url = mode === 'edit' ? `/api/blog/${postId}` : '/api/blog'
    const method = mode === 'edit' ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (res.ok) {
      const data = await res.json()
      setSaved(true)
      if (mode === 'new') {
        router.push(`/blog/${data.id}/edit`)
      } else {
        setForm(f => ({ ...f, status: data.status }))
      }
    } else {
      const d = await res.json()
      setServerError(d.error ?? 'Save failed')
    }
  }

  const inputClass = (hasError: boolean, extra = '') =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${hasError ? 'border-red-400' : 'border-slate-200'} ${extra}`

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/blog" className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{mode === 'new' ? 'New Post' : 'Edit Post'}</h1>
            {mode === 'edit' && (
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                form.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {form.status}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(form.status === 'published' ? 'draft' : 'published')}
            disabled={saving}
            className="px-3 py-2 text-xs text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? 'Saving…' : form.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-5 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{serverError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Post info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <SectionHeader
              icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              title="Post Details"
              description="Title, URL slug, and summary for this post"
            />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputClass(!!errors.title)}
                  placeholder="Post title"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = errors.title ? '#f87171' : '#e2e8f0'}
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">Slug <span className="text-red-500">*</span></label>
                  {mode === 'edit' && (
                    <button type="button" onClick={() => setSlugLocked(l => !l)} className="text-[10px] text-blue-600 hover:text-blue-800">
                      {slugLocked ? 'Edit' : 'Lock'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={form.slug}
                  readOnly={mode === 'edit' && slugLocked}
                  onChange={e => { setSlugLocked(true); setForm(f => ({ ...f, slug: e.target.value })) }}
                  className={inputClass(!!errors.slug, mode === 'edit' && slugLocked ? 'bg-slate-50 text-slate-400' : '')}
                  placeholder="post-slug"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = errors.slug ? '#f87171' : '#e2e8f0'}
                />
                {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Excerpt</label>
                <textarea
                  value={form.excerpt}
                  onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none transition-colors resize-y"
                  placeholder="Brief summary shown in blog listings"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <SectionHeader
              icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              title="Content"
              description="Write your post using the rich text editor. Right-click text to add links."
            />
            <RichTextEditor
              value={form.content}
              onChange={html => setForm(f => ({ ...f, content: html }))}
              placeholder="Write your post content…"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Website & Cover */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <SectionHeader
              icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M2 7h20" strokeLinecap="round" /><path d="M8 21h8M12 17v4" strokeLinecap="round" /></svg>}
              title="Publishing"
              description="Choose which site this post belongs to"
            />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Website <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  className={inputClass(!!errors.website)}
                  placeholder="e.g. oxihome.my"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = errors.website ? '#f87171' : '#e2e8f0'}
                />
                {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={form.cover_image_url}
                  onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none transition-colors"
                  placeholder="https://…"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>

              {form.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.cover_image_url} alt="Cover preview" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
              )}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <SectionHeader
              icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" /></svg>}
              title="SEO"
              description="Optimize how this post appears in search results"
            />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meta Title</label>
                <input
                  type="text"
                  value={form.meta_title}
                  onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none transition-colors"
                  placeholder="SEO title (50–60 chars)"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
                <p className="mt-1 text-[10px] text-slate-400">{form.meta_title.length} / 60</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meta Description</label>
                <textarea
                  value={form.meta_description}
                  onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none transition-colors resize-none"
                  placeholder="SEO description (150–160 chars)"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
                <p className="mt-1 text-[10px] text-slate-400">{form.meta_description.length} / 160</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
