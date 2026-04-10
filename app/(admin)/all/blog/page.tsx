'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Post {
  id: string
  website: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  status: 'draft' | 'published'
  languages: string[]
  updated_at: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AllBlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/blog').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setPosts(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = search
    ? posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.website.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase()))
    : posts

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Blog Posts</h1>
        <p className="text-xs" style={{ color: '#94a3b8' }}>{posts.length} posts across all websites</p>
      </div>

      <div className="mb-5 relative max-w-sm">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts, websites, or slugs…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0' }} />
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((post, i) => (
            <Link key={post.id} href={`/blog/${post.id}/edit`}
              className="flex items-center justify-between px-4 sm:px-5 py-3 gap-3 hover:bg-slate-50 transition-colors"
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{post.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{post.website} · /{post.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {post.languages?.length > 0 && (
                  <div className="flex gap-0.5">
                    {['en', 'ms', 'zh'].map(l => (
                      <span key={l} className="text-[8px] px-1 py-0.5 rounded font-medium uppercase"
                        style={post.languages.includes(l) ? { background: '#e0ecf5', color: '#1e3a5f' } : { background: '#f8fafc', color: '#e2e8f0' }}>{l}</span>
                    ))}
                  </div>
                )}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {post.status === 'published' ? 'Live' : 'Draft'}
                </span>
                <span className="text-[10px] hidden sm:inline" style={{ color: '#cbd5e1' }}>{formatDate(post.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
