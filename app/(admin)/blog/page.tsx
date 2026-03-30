'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BlogListPage() {
  const router = useRouter()
  const { selectedWebsite } = useWebsite()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterWebsite, setFilterWebsite] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { setFilterWebsite(selectedWebsite) }, [selectedWebsite])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterWebsite) params.set('website', filterWebsite)
    if (filterStatus) params.set('status', filterStatus)
    const res = await fetch(`/api/blog?${params}`)
    const data = await res.json()
    setPosts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterWebsite, filterStatus])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function deletePost(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/blog/${id}`, { method: 'DELETE' })
    setDeleting(null)
    fetchPosts()
  }

  const websites = [...new Set(posts.map(p => p.website))]

  const filtered = posts.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.title.toLowerCase().includes(q) ||
      p.website.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      (p.excerpt ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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
      <p className="text-sm mb-6" style={{ color: '#4a7a8a' }}>Create and manage blog content across all websites.</p>

      {/* Info strip */}
      <div className="rounded-lg border px-4 py-3 mb-6 text-sm" style={{ borderColor: 'var(--border)', background: '#fafafa', color: '#4a7a8a' }}>
        Click <strong style={{ color: 'var(--foreground)' }}>Edit</strong> to open the full post editor. Published posts are visible on the website immediately.
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-4 mb-5 items-end">
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a7a8a' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#7dbdd0' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, website, or slug…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: 'var(--border)', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a7a8a' }}>Website</label>
          <select
            value={filterWebsite}
            onChange={e => setFilterWebsite(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border focus:outline-none"
            style={{ borderColor: 'var(--border)', background: 'white', color: 'var(--foreground)' }}
          >
            <option value="">All websites</option>
            {websites.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a7a8a' }}>Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border focus:outline-none"
            style={{ borderColor: 'var(--border)', background: 'white', color: 'var(--foreground)' }}
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        {(filterWebsite || filterStatus || search) && (
          <button
            onClick={() => { setFilterWebsite(''); setFilterStatus(''); setSearch('') }}
            className="py-2 px-3 text-sm rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: '#4a7a8a', background: 'white' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', background: 'white' }}>
        {loading ? (
          <div className="p-12 text-center text-sm" style={{ color: '#7dbdd0' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: '#7dbdd0' }}>
            No posts found.{' '}
            <Link href="/blog/new" className="hover:underline" style={{ color: 'var(--primary)' }}>Create one</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#f4f9fb' }}>
                {['Title', 'Website', 'Slug', 'Status', 'Published', 'Updated', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3.5 text-left text-xs font-semibold" style={{ color: '#4a7a8a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((post, i) => (
                <tr
                  key={post.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f8fb'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-5 py-3.5 max-w-xs">
                    <Link
                      href={`/blog/${post.id}/edit`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--foreground)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
                    >
                      {post.title}
                    </Link>
                    {post.excerpt && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#7dbdd0' }}>{post.excerpt}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: '#4a7a8a' }}>{post.website}</td>
                  <td className="px-5 py-3.5 font-mono text-xs" style={{ color: '#7dbdd0' }}>{post.slug}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={post.status === 'published'
                        ? { background: '#dcfce7', color: '#16a34a' }
                        : { background: '#f1f5f9', color: '#64748b' }
                      }
                    >
                      {post.status === 'published' ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {post.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: '#4a7a8a' }}>{formatDate(post.published_at)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: '#4a7a8a' }}>{formatDate(post.updated_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => router.push(`/blog/${post.id}/edit`)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border)', color: '#4a7a8a' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = '#4a7a8a' }}
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deletePost(post.id, post.title)}
                        disabled={deleting === post.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: '#4a7a8a' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = '#4a7a8a'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Row count */}
      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#7dbdd0' }}>
          Showing {filtered.length} of {posts.length} entries
        </p>
      )}
    </div>
  )
}
