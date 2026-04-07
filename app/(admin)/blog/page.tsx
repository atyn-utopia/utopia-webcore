'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'
import SelectFilter from '@/components/SelectFilter'

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
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [allWebsites, setAllWebsites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterWebsite, setFilterWebsite] = useState(() => searchParams.get('website') ?? '')
  const [filterStatus, setFilterStatus] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const fromUrl = searchParams.get('website')
    if (fromUrl) { setFilterWebsite(fromUrl); return }
    setFilterWebsite(selectedWebsite)
  }, [selectedWebsite, searchParams])

  // Fetch all registered websites (from phone numbers / websites API)
  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllWebsites(data.map((s: { domain: string }) => s.domain))
        }
      })
      .catch(() => {})
  }, [])

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

  // Group by website — always include all registered websites as folders
  const grouped = filtered.reduce<Record<string, Post[]>>((acc, p) => {
    if (!acc[p.website]) acc[p.website] = []
    acc[p.website].push(p)
    return acc
  }, {})
  // Ensure all registered websites appear even if they have no posts
  for (const w of allWebsites) {
    if (!grouped[w]) grouped[w] = []
  }
  const groupedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Blog Posts</h1>
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
      </div>
      <p className="text-sm mb-6" style={{ color: '#475569' }}>Create and manage blog content across all websites.</p>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-4 mb-5 items-end">
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, website, or slug…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>
        <SelectFilter
          label="Website"
          value={filterWebsite}
          onChange={setFilterWebsite}
          options={[{ value: '', label: 'All websites' }, ...websites.map(w => ({ value: w, label: w }))]}
        />
        <SelectFilter
          label="Status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
        {(filterWebsite || filterStatus || search) && (
          <button
            onClick={() => { setFilterWebsite(''); setFilterStatus(''); setSearch('') }}
            className="py-2 px-3 text-sm rounded-lg border transition-colors"
            style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Grouped by website */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : groupedEntries.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No posts found.{' '}
          <Link href="/blog/new" className="hover:underline" style={{ color: 'var(--primary)' }}>Create one</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedEntries.map(([website, rows]) => {
            const publishedCount = rows.filter(p => p.status === 'published').length
            const draftCount = rows.length - publishedCount
            return (
              <section key={website} className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
                {/* Website header */}
                <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3" style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{website}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {publishedCount > 0 && (
                      <span className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                        {publishedCount} published
                      </span>
                    )}
                    {draftCount > 0 && (
                      <span className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap" style={{ background: '#f1f5f9', color: '#64748b' }}>
                        {draftCount} draft
                      </span>
                    )}
                    <span className="inline-flex items-center h-6 sm:h-7 text-[10px] sm:text-xs px-2.5 rounded-full font-medium whitespace-nowrap" style={{ background: 'var(--primary)', color: 'white' }}>
                      {rows.length} {rows.length === 1 ? 'post' : 'posts'}
                    </span>
                    <Link
                      href={`/blog/new?website=${encodeURIComponent(website)}`}
                      className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-medium px-2.5 rounded-full text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                      style={{ background: '#475569' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </Link>
                  </div>
                </div>

                {/* Posts content */}
                {rows.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm" style={{ color: '#475569' }}>No posts yet</p>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Create the first blog post for this website</p>
                    <Link
                      href={`/blog/new?website=${encodeURIComponent(website)}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ background: 'var(--primary)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Post
                    </Link>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Grid view */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {rows.map(post => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.id}/edit`}
                        className="block rounded-lg border p-4 hover:shadow-sm transition-shadow"
                        style={{ borderColor: '#e2e8f0' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={post.status === 'published'
                              ? { background: '#dcfce7', color: '#16a34a' }
                              : { background: '#f1f5f9', color: '#94a3b8' }
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: post.status === 'published' ? '#16a34a' : '#94a3b8' }} />
                            {post.status === 'published' ? 'Live' : 'Draft'}
                          </span>
                          <button
                            onClick={e => { e.preventDefault(); deletePost(post.id, post.title) }}
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
                      href={`/blog/new?website=${encodeURIComponent(website)}`}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:border-slate-300 hover:bg-slate-50"
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
                  <table className="w-full text-sm" style={{ background: 'white', tableLayout: 'fixed' }}>
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
                      {rows.map((post, i) => (
                        <tr
                          key={post.id}
                          className="hover:bg-[#f1f5f9] transition-colors"
                          style={{ borderBottom: i < rows.length - 1 ? '1px solid #cbd5e1' : 'none' }}
                        >
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
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Row count */}
      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#475569' }}>
          Showing {filtered.length} of {posts.length} entries across {groupedEntries.length} {groupedEntries.length === 1 ? 'website' : 'websites'}
        </p>
      )}
    </div>
  )
}
