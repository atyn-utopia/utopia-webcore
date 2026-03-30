'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

export default function PostForm({ mode, initialData = {}, postId }: PostFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<PostValues>({ ...EMPTY, ...initialData })
  const [slugLocked, setSlugLocked] = useState(mode === 'edit')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [saved, setSaved] = useState(false)

  // Auto-generate slug from title when creating
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

  function Field({
    id, label, required = false, type = 'text', children
  }: { id: keyof PostValues; label: string; required?: boolean; type?: string; children?: React.ReactNode }) {
    const hasError = !!errors[id]
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children ?? (
          <input
            type={type}
            value={form[id]}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              hasError ? 'border-red-400' : 'border-slate-300'
            }`}
          />
        )}
        {hasError && <p className="mt-1 text-xs text-red-500">{errors[id]}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/blog" className="text-slate-400 hover:text-slate-600 text-sm">
          ← Blog Posts
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{mode === 'new' ? 'New Post' : 'Edit Post'}</h1>
          {mode === 'edit' && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                form.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {form.status}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(form.status === 'published' ? 'draft' : 'published')}
            disabled={saving}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : form.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <Field id="title" label="Title" required>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-400' : 'border-slate-300'}`}
                placeholder="Post title"
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">
                  Slug<span className="text-red-500 ml-0.5">*</span>
                </label>
                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => setSlugLocked(l => !l)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {slugLocked ? 'Edit slug' : 'Lock slug'}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={form.slug}
                readOnly={mode === 'edit' && slugLocked}
                onChange={e => {
                  setSlugLocked(true)
                  setForm(f => ({ ...f, slug: e.target.value }))
                }}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.slug ? 'border-red-400' : 'border-slate-300'
                } ${mode === 'edit' && slugLocked ? 'bg-slate-50 text-slate-500' : ''}`}
                placeholder="post-slug"
              />
              {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder="Brief excerpt shown in blog listings"
              />
            </div>
          </div>

          {/* Content Editor */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Content (Markdown)</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={20}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="Write your post content in Markdown…"
            />
          </div>
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Post Details</h2>

            <Field id="website" label="Website" required>
              <input
                type="text"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.website ? 'border-red-400' : 'border-slate-300'}`}
                placeholder="e.g. oxihome.my"
              />
              {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website}</p>}
            </Field>

            <Field id="cover_image_url" label="Cover Image URL">
              <input
                type="url"
                value={form.cover_image_url}
                onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://…"
              />
            </Field>

            {form.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.cover_image_url} alt="Cover preview" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">SEO</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta Title</label>
              <input
                type="text"
                value={form.meta_title}
                onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SEO title (50–60 chars)"
              />
              <p className="mt-1 text-xs text-slate-400">{form.meta_title.length} / 60</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
              <textarea
                value={form.meta_description}
                onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="SEO description (150–160 chars)"
              />
              <p className="mt-1 text-xs text-slate-400">{form.meta_description.length} / 160</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
