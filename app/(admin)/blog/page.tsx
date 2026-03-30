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

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-slate-100 text-slate-600',
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
  const [filterWebsite, setFilterWebsite] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { setFilterWebsite(selectedWebsite) }, [selectedWebsite])
  const [deleting, setDeleting] = useState<string | null>(null)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Blog Posts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage blog content across all websites</p>
        </div>
        <Link
          href="/blog/new"
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" style={{ background: 'var(--primary)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary)'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Post
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterWebsite}
          onChange={e => setFilterWebsite(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All websites</option>
          {websites.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        {(filterWebsite || filterStatus) && (
          <button
            onClick={() => { setFilterWebsite(''); setFilterStatus('') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No posts found.{' '}
            <Link href="/blog/new" className="text-green-600 hover:underline">Create one</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Title', 'Website', 'Slug', 'Status', 'Published', 'Updated', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/blog/${post.id}/edit`} className="font-medium text-slate-800 hover:text-blue-600">
                      {post.title}
                    </Link>
                    {post.excerpt && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{post.excerpt}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{post.website}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{post.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[post.status] ?? ''}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(post.published_at)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(post.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => router.push(`/blog/${post.id}/edit`)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePost(post.id, post.title)}
                        disabled={deleting === post.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting === post.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
