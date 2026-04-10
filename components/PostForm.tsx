'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RichTextEditor from '@/components/RichTextEditor'
import FlagIcon from '@/components/FlagIcon'

interface PostFormProps {
  mode: 'new' | 'edit'
  initialData?: Record<string, unknown>
  postId?: string
}

interface Translation {
  language: string
  title: string
  content: string
  excerpt: string
  meta_title: string
  meta_description: string
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Malay' },
  { code: 'zh', label: 'Chinese' },
]

const EMPTY_TRANSLATION: Translation = {
  language: '',
  title: '',
  content: '',
  excerpt: '',
  meta_title: '',
  meta_description: '',
}

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export default function PostForm({ mode, initialData = {}, postId }: PostFormProps) {
  const router = useRouter()

  const [website, setWebsite] = useState((initialData.website as string) ?? '')
  const [slug, setSlug] = useState((initialData.slug as string) ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState((initialData.cover_image_url as string) ?? '')
  const [status, setStatus] = useState<'draft' | 'published'>((initialData.status as 'draft' | 'published') ?? 'draft')
  const [slugLocked, setSlugLocked] = useState(mode === 'edit')

  const [activeLang, setActiveLang] = useState('en')
  const [translations, setTranslations] = useState<Record<string, Translation>>({
    en: { ...EMPTY_TRANSLATION, language: 'en' },
    ms: { ...EMPTY_TRANSLATION, language: 'ms' },
    zh: { ...EMPTY_TRANSLATION, language: 'zh' },
  })

  const [companies, setCompanies] = useState<{ id: string; name: string; company_websites: { domain: string }[] }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [saved, setSaved] = useState(false)

  // Fetch companies
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setCompanies(data)
        if (website) {
          const match = data.find((c: { company_websites: { domain: string }[] }) =>
            c.company_websites.some((w: { domain: string }) => w.domain === website))
          if (match) setSelectedCompany(match.id)
        }
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load existing post data in edit mode
  useEffect(() => {
    if (mode === 'edit' && postId) {
      fetch(`/api/blog/${postId}`).then(r => r.json()).then(data => {
        if (data.id) {
          setWebsite(data.website ?? '')
          setSlug(data.slug ?? '')
          setCoverImageUrl(data.cover_image_url ?? '')
          setStatus(data.status ?? 'draft')
          if (Array.isArray(data.blog_translations)) {
            const map: Record<string, Translation> = {
              en: { ...EMPTY_TRANSLATION, language: 'en' },
              ms: { ...EMPTY_TRANSLATION, language: 'ms' },
              zh: { ...EMPTY_TRANSLATION, language: 'zh' },
            }
            data.blog_translations.forEach((t: Translation) => {
              map[t.language] = t
            })
            setTranslations(map)
          }
        }
      })
    }
  }, [mode, postId])

  // Auto-slug from English title
  useEffect(() => {
    if (mode === 'new' && !slugLocked) {
      setSlug(toSlug(translations.en.title))
    }
  }, [translations.en.title, mode, slugLocked])

  const companyWebsites = companies.find(c => c.id === selectedCompany)?.company_websites ?? []
  const t = translations[activeLang]

  function updateTranslation(lang: string, updates: Partial<Translation>) {
    setTranslations(prev => ({ ...prev, [lang]: { ...prev[lang], ...updates } }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!website) e.website = 'Please select a website'
    if (!slug.trim()) e.slug = 'Slug is required'
    if (!translations.en.title.trim()) e.title = 'English title is required'
    return e
  }

  async function handleSave(newStatus?: 'draft' | 'published') {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    setServerError('')
    setSaved(false)

    const payload = {
      website,
      slug: toSlug(slug),
      cover_image_url: coverImageUrl || null,
      status: newStatus ?? status,
      translations: Object.values(translations).filter(t => t.title.trim()),
    }

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
      if (newStatus) setStatus(newStatus)
      if (mode === 'new') router.push(`/blog/${data.id}/edit`)
    } else {
      const d = await res.json()
      setServerError(d.error ?? 'Save failed')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{mode === 'new' ? 'New Post' : 'Edit Post'}</h1>
          {mode === 'edit' && (
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
          <button type="button" onClick={() => handleSave('draft')} disabled={saving}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Save as Draft
          </button>
          <button type="button" onClick={() => handleSave(status === 'published' ? 'draft' : 'published')} disabled={saving}
            className="px-3 py-2 text-xs text-white font-medium rounded-lg disabled:opacity-50 transition-colors" style={{ background: 'var(--primary)' }}>
            {saving ? 'Saving…' : status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-5 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{serverError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Language tabs */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#f1f5f9' }}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setActiveLang(lang.code)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${activeLang === lang.code ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                style={{ color: activeLang === lang.code ? 'var(--foreground)' : '#94a3b8' }}
              >
                <FlagIcon lang={lang.code} size={16} />
                <span>{lang.label}</span>
                {translations[lang.code]?.title && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#16a34a' }} />
                )}
              </button>
            ))}
          </div>

          {/* Title + Excerpt */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <input
              type="text"
              value={t?.title ?? ''}
              onChange={e => updateTranslation(activeLang, { title: e.target.value })}
              className={`w-full text-lg font-semibold border-0 border-b pb-2 focus:outline-none transition-colors placeholder:font-normal placeholder:text-slate-300 ${errors.title && activeLang === 'en' ? 'border-red-300' : 'border-slate-100'}`}
              placeholder={`Title (${LANGUAGES.find(l => l.code === activeLang)?.label})`}
              style={{ color: 'var(--foreground)' }}
            />
            {errors.title && activeLang === 'en' && <p className="text-xs text-red-500">{errors.title}</p>}
            <textarea
              value={t?.excerpt ?? ''}
              onChange={e => updateTranslation(activeLang, { excerpt: e.target.value })}
              rows={2}
              className="w-full text-sm border-0 focus:outline-none resize-none placeholder:text-slate-300"
              placeholder="Write a brief excerpt…"
              style={{ color: '#475569' }}
            />
          </div>

          {/* Content editor */}
          <RichTextEditor
            value={t?.content ?? ''}
            onChange={html => updateTranslation(activeLang, { content: html })}
            placeholder={`Write content in ${LANGUAGES.find(l => l.code === activeLang)?.label}…`}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {/* Preview */}
          {mode === 'edit' && (
            <Link href={`/blog/${postId}/view`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-xs font-medium transition-colors text-white"
              style={{ background: 'var(--primary)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </Link>
          )}

          {/* Publish settings */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#94a3b8' }}>Company</label>
              <select value={selectedCompany} onChange={e => { setSelectedCompany(e.target.value); setWebsite('') }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none transition-colors cursor-pointer"
                style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2rem' }}>
                <option value="">Select…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#94a3b8' }}>Website</label>
              <select value={website} onChange={e => setWebsite(e.target.value)} disabled={!selectedCompany}
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none transition-colors cursor-pointer disabled:opacity-40 ${errors.website ? 'border-red-400' : 'border-slate-200'}`}
                style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2rem' }}>
                <option value="">{selectedCompany ? 'Select…' : '—'}</option>
                {companyWebsites.map(w => <option key={w.domain} value={w.domain}>{w.domain}</option>)}
              </select>
              {errors.website && <p className="mt-1 text-[10px] text-red-500">{errors.website}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>Slug</label>
                {mode === 'edit' && (
                  <button type="button" onClick={() => setSlugLocked(l => !l)} className="text-[10px] text-blue-600 hover:text-blue-800">{slugLocked ? 'Edit' : 'Lock'}</button>
                )}
              </div>
              <input type="text" value={slug} readOnly={mode === 'edit' && slugLocked}
                onChange={e => { setSlugLocked(true); setSlug(e.target.value) }}
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none transition-colors ${errors.slug ? 'border-red-400' : 'border-slate-200'} ${mode === 'edit' && slugLocked ? 'bg-slate-50 text-slate-400' : ''}`}
                placeholder="post-slug" />
              {errors.slug && <p className="mt-1 text-[10px] text-red-500">{errors.slug}</p>}
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#94a3b8' }}>Cover Image</label>
              <input type="url" value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none transition-colors" placeholder="https://…" />
            </div>
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="Cover" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
            )}
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FlagIcon lang={activeLang} size={14} />
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>SEO · {LANGUAGES.find(l => l.code === activeLang)?.label}</span>
            </div>
            <div>
              <input type="text" value={t?.meta_title ?? ''} onChange={e => updateTranslation(activeLang, { meta_title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none transition-colors" placeholder="Meta title (50–60 chars)" />
              <p className="mt-1 text-[10px] text-right" style={{ color: (t?.meta_title ?? '').length > 60 ? '#ef4444' : '#cbd5e1' }}>{(t?.meta_title ?? '').length}/60</p>
            </div>
            <div>
              <textarea value={t?.meta_description ?? ''} onChange={e => updateTranslation(activeLang, { meta_description: e.target.value })}
                rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none transition-colors resize-none" placeholder="Meta description (150–160 chars)" />
              <p className="mt-1 text-[10px] text-right" style={{ color: (t?.meta_description ?? '').length > 160 ? '#ef4444' : '#cbd5e1' }}>{(t?.meta_description ?? '').length}/160</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
