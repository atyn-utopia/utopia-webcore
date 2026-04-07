'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'

interface Post {
  id: string
  website: string
  title: string
  slug: string
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
  excerpt: string | null
}

interface WebsiteSummary {
  domain: string
  blog_count: number
  published_blog_count: number
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BlogListPage() {
  const router = useRouter()
  const { selectedWebsite } = useWebsite()
  const searchParams = useSearchParams()
  const openFolder = searchParams.get('website') ?? ''

  const [websites, setWebsites] = useState<WebsiteSummary[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')

  // Fetch websites
  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setWebsites(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Fetch posts when a folder is open
  const fetchPosts = useCallback(async () => {
    if (!openFolder) { setPosts([]); return }
    setPostsLoading(true)
    const res = await fetch(`/api/blog?website=${encodeURIComponent(openFolder)}`)
    const data = await res.json()
    setPosts(Array.isArray(data) ? data : [])
    setPostsLoading(false)
  }, [openFolder])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function deletePost(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/blog/${id}`, { method: 'DELETE' })
    setDeleting(null)
    fetchPosts()
  }

  const filtered = posts.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || (p.excerpt ?? '').toLowerCase().includes(q)
  })

  // Folder view (no folder selected)
  if (!openFolder) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Blog Posts</h1>
          <Link
            href="/blog/new"
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Post
          </Link>
        </div>
        <p className="text-sm mb-6" style={{ color: '#475569' }}>Select a website folder to manage its blog posts.</p>

        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
        ) : websites.length === 0 ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
            No websites found. Add a phone number first to register a website.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {websites.map(site => (
              <Link
                key={site.domain}
                href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300"
                style={{ borderColor: '#e2e8f0' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs" style={{ color: '#475569' }}>{site.blog_count} {site.blog_count === 1 ? 'post' : 'posts'}</span>
                      {site.published_blog_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
                          {site.published_blog_count} live
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Inside a folder
  return (
    <div>
      {/* Header with back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/blog"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{openFolder}</h1>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Blog posts for this website</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#cbd5e1' }}>
            <button
              onClick={() => setViewMode('list')}
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'list' ? 'var(--primary)' : 'white', color: viewMode === 'list' ? 'white' : '#94a3b8' }}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'white', color: viewMode === 'grid' ? 'white' : '#94a3b8', borderLeft: '1px solid #cbd5e1' }}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>
          <Link
            href={`/blog/new?website=${encodeURIComponent(openFolder)}`}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Post
          </Link>
        </div>
      </div>

      {/* Search */}
      {posts.length > 0 && (
        <div className="mt-4 mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search posts…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>
      )}

      {/* Posts */}
      {postsLoading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : filtered.length === 0 && !search ? (
        <div className="p-12 text-center rounded-xl border" style={{ borderColor: '#cbd5e1' }}>
          <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: '#475569' }}>No posts yet</p>
          <p className="text-xs mt-1 mb-4" style={{ color: '#94a3b8' }}>Create the first blog post for {openFolder}</p>
          <Link
            href={`/blog/new?website=${encodeURIComponent(openFolder)}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Post
          </Link>
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No posts matching &quot;{search}&quot;
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(post => (
            <Link
              key={post.id}
              href={`/blog/${post.id}/edit`}
              className="block rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow"
              style={{ borderColor: '#e2e8f0' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={post.status === 'published' ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: post.status === 'published' ? '#16a34a' : '#94a3b8' }} />
                  {post.status === 'published' ? 'Live' : 'Draft'}
                </span>
                <button
                  onClick={e => { e.preventDefault(); deletePost(post.id, post.title) }}
                  disabled={deleting === post.id}
                  className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                  style={{ color: '#cbd5e1' }}
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <h3 className="text-sm font-medium truncate mb-1" style={{ color: 'var(--foreground)' }}>{post.title}</h3>
              {post.excerpt && <p className="text-xs truncate mb-2" style={{ color: '#475569' }}>{post.excerpt}</p>}
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#94a3b8' }}>/{post.slug}</p>
                <p className="text-[10px]" style={{ color: '#94a3b8' }}>{formatDate(post.updated_at)}</p>
              </div>
            </Link>
          ))}
          {/* Add card */}
          <Link
            href={`/blog/new?website=${encodeURIComponent(openFolder)}`}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors hover:border-slate-300 hover:bg-slate-50"
            style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">New Post</span>
          </Link>
        </div>
      ) : (
        /* List view */
        <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: '#cbd5e1' }}>
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col className="w-20 sm:w-24" />
              <col className="w-24 sm:w-28" />
              <col className="w-20 sm:w-24" />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                <th className="px-3 sm:px-4 py-3 text-left text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Post</th>
                <th className="px-2 py-3 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Status</th>
                <th className="px-2 py-3 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Updated</th>
                <th className="px-2 sm:px-4 py-3 text-right text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post, i) => (
                <tr key={post.id} className="hover:bg-[#f1f5f9] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #cbd5e1' : 'none' }}>
                  <td className="px-3 sm:px-4 py-3 align-middle overflow-hidden">
                    <div className="min-w-0">
                      <Link href={`/blog/${post.id}/edit`} className="text-xs sm:text-sm font-medium hover:underline truncate block" style={{ color: 'var(--foreground)' }}>{post.title}</Link>
                      {post.excerpt && <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: '#475569' }}>{post.excerpt}</p>}
                      <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>/{post.slug}</p>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-middle text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={post.status === 'published' ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: post.status === 'published' ? '#16a34a' : '#94a3b8' }} />
                      {post.status === 'published' ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-2 py-3 align-middle text-center text-[10px] sm:text-xs" style={{ color: '#475569' }}>{formatDate(post.updated_at)}</td>
                  <td className="px-2 sm:px-4 py-3 align-middle">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => router.push(`/blog/${post.id}/edit`)} className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors hover:text-[var(--primary)] hover:border-[var(--primary)]" style={{ borderColor: '#cbd5e1', color: '#475569' }} title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => deletePost(post.id, post.title)} disabled={deleting === post.id} className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 hover:border-red-300 hover:text-red-500 hover:bg-red-50" style={{ borderColor: '#cbd5e1', color: '#475569' }} title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Row count */}
      {!postsLoading && filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#475569' }}>
          {filtered.length} of {posts.length} posts
        </p>
      )}
    </div>
  )
}
