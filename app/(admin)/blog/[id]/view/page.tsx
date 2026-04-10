'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import FlagIcon from '@/components/FlagIcon'
import PageHeader from '@/components/PageHeader'

interface Translation {
  language: string
  title: string
  content: string
  excerpt: string
  meta_title: string
  meta_description: string
}

interface Post {
  id: string
  website: string
  slug: string
  cover_image_url: string | null
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  blog_translations: Translation[]
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Malay' },
  { code: 'zh', label: 'Chinese' },
]

export default function BlogViewPage() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeLang, setActiveLang] = useState('en')

  useEffect(() => {
    fetch(`/api/blog/${id}`)
      .then(r => r.json())
      .then(data => { if (data.id) setPost(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: '#475569' }}>Loading…</div>
  if (!post) return <div className="p-12 text-center text-sm" style={{ color: '#475569' }}>Post not found</div>

  const translations = post.blog_translations ?? []
  const t = translations.find(tr => tr.language === activeLang) ?? translations[0]
  const availableLangs = translations.map(tr => tr.language)

  return (
    <div>
      <PageHeader
        title="Preview"
        description={`${post.website} / ${post.slug}`}
        actions={
          <>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {post.status}
            </span>
            <div className="relative group">
              {post.status === 'published' ? (
                <a href={`https://${post.website}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" style={{ color: '#475569' }}>
                  Open
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-medium rounded-lg border border-slate-200 cursor-not-allowed opacity-40" style={{ color: '#94a3b8' }}>
                  Open
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </span>
              )}
              {post.status !== 'published' && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: '#1e293b' }}>
                  Publish this post first to open the live link
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4" style={{ borderTopColor: '#1e293b' }} />
                </div>
              )}
            </div>
            <Link href={`/blog/${id}/edit`}
              className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
              style={{ background: 'var(--primary)' }}>
              Edit
            </Link>
          </>
        }
      />

      {/* Language switcher */}
      <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ background: '#f1f5f9' }}>
        {LANGUAGES.map(lang => {
          const hasTranslation = availableLangs.includes(lang.code)
          return (
            <button
              key={lang.code}
              onClick={() => hasTranslation && setActiveLang(lang.code)}
              disabled={!hasTranslation}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${activeLang === lang.code ? 'bg-white shadow-sm' : 'hover:bg-white/50'} ${!hasTranslation ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ color: activeLang === lang.code ? 'var(--foreground)' : '#94a3b8' }}
            >
              <FlagIcon lang={lang.code} size={16} />
              <span>{lang.label}</span>
            </button>
          )
        })}
      </div>

      {!t ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No translation available for this language.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {post.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.cover_image_url} alt="" className="w-full h-48 sm:h-56 object-cover" />
              )}
              <div className="p-5 sm:p-6">
                <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>{t.title}</h1>
                {t.excerpt && (
                  <p className="text-sm leading-relaxed mb-4" style={{ color: '#475569' }}>{t.excerpt}</p>
                )}
                {post.published_at && (
                  <p className="text-[10px] mb-4" style={{ color: '#94a3b8' }}>
                    Published {new Date(post.published_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                <div className="h-px mb-4" style={{ background: '#f1f5f9' }} />
                <div
                  className="tiptap prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: t.content || '<p style="color: #94a3b8">No content yet.</p>' }}
                />
              </div>
            </div>
          </div>

          {/* Sidebar meta */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {/* Post info */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FlagIcon lang={activeLang} size={14} />
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>Post Info</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>Website</span>
                  <span className="text-xs font-medium truncate ml-2" style={{ color: 'var(--foreground)' }}>{post.website}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>Slug</span>
                  <span className="text-xs truncate ml-2" style={{ color: '#475569' }}>/{post.slug}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>Status</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {post.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>Created</span>
                  <span className="text-[10px]" style={{ color: '#475569' }}>{new Date(post.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* SEO preview */}
            {(t.meta_title || t.meta_description) && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>SEO Preview</span>
                <div className="rounded-lg border p-3" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                  <p className="text-xs font-medium truncate" style={{ color: '#1a0dab' }}>{t.meta_title || t.title}</p>
                  <p className="text-[10px] truncate mt-0.5" style={{ color: '#006621' }}>https://{post.website}/blog/{post.slug}</p>
                  <p className="text-[10px] mt-1 line-clamp-2" style={{ color: '#545454' }}>{t.meta_description || t.excerpt}</p>
                </div>
              </div>
            )}

            {/* Blog link */}
            <div className="relative group">
              {post.status === 'published' ? (
                <a href={`https://${post.website}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 transition-colors" style={{ color: '#475569' }}>
                  Open in Browser
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              ) : (
                <span className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-medium cursor-not-allowed opacity-40" style={{ color: '#94a3b8' }}>
                  Open in Browser
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </span>
              )}
              {post.status !== 'published' && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: '#1e293b' }}>
                  Publish this post first to open the live link
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4" style={{ borderTopColor: '#1e293b' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
