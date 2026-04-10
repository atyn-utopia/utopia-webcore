'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Post {
  id: string
  website: string
  title: string
  slug: string
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
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{posts.length} posts across all websites</p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {['Title', 'Website', 'Slug', 'Languages', 'Status', 'Updated', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((post, i) => (
                  <tr key={post.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-4 py-3 align-middle">
                      <Link href={`/blog/${post.id}/edit`} className="text-sm font-medium hover:underline truncate block max-w-[250px]" style={{ color: 'var(--foreground)' }}>
                        {post.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs" style={{ color: '#475569' }}>{post.website}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs truncate block max-w-[150px] mx-auto" style={{ color: '#94a3b8' }}>/{post.slug}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <div className="flex gap-0.5 justify-center">
                        {['en', 'ms', 'zh'].map(l => (
                          <span key={l} className="text-[8px] px-1 py-0.5 rounded font-medium uppercase"
                            style={post.languages?.includes(l) ? { background: '#e0ecf5', color: '#1e3a5f' } : { background: '#f8fafc', color: '#e2e8f0' }}>{l}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: post.status === 'published' ? '#16a34a' : '#94a3b8' }} />
                        {post.status === 'published' ? 'Live' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>{formatDate(post.updated_at)}</span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Link href={`/blog/${post.id}/edit`}
                          className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                          Edit
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </Link>
                        <Link href={`/blog/${post.id}/view`}
                          className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                          Preview
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{filtered.length} of {posts.length} posts</p>
    </div>
  )
}
