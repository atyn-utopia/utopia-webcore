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

interface Company { id: string; name: string; company_websites: { domain: string }[] }

type SortKey = 'title' | 'website' | 'status' | 'updated_at'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="inline-flex flex-col ml-1 -space-y-0.5 align-middle">
      <svg className={`w-2.5 h-2.5 ${active && dir === 'asc' ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 8 5"><path d="M4 0L8 5H0z"/></svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 8 5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AllBlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    Promise.all([
      fetch('/api/blog').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]).then(([blogData, compData]) => {
      if (Array.isArray(blogData)) setPosts(blogData)
      if (Array.isArray(compData)) setCompanies(compData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const companyNames = [...new Set(companies.map(c => c.name))]
  const companyDomainMap: Record<string, string> = {}
  companies.forEach(c => c.company_websites.forEach(w => { companyDomainMap[w.domain] = c.name }))

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = posts
    .filter(p => {
      if (filterCompany && companyDomainMap[p.website] !== filterCompany) return false
      if (filterStatus && p.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return p.title.toLowerCase().includes(q) || p.website.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  function ThSort({ label, col }: { label: string; col: SortKey }) {
    return (
      <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:text-[var(--primary)] transition-colors"
        style={{ color: '#94a3b8' }} onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center justify-center gap-1">{label}<SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} /></span>
      </th>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Blog Posts</h1>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{posts.length} posts across all websites</p>
      </div>

      <div className="rounded-xl border p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <div className="flex-1 min-w-48 max-w-sm">
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Search</label>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts, websites…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0', background: 'white' }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Company</label>
          <div className="relative">
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer pr-9" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '160px', color: '#64748b' }}>
              <option value="">All companies</option>
              {companyNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: '#94a3b8' }}>Status</label>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer pr-9" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', background: 'white', minWidth: '130px', color: '#64748b' }}>
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="sticky top-0 z-10" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <ThSort label="Title" col="title" />
                  <ThSort label="Website" col="website" />
                  <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Slug</th>
                  <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Languages</th>
                  <ThSort label="Status" col="status" />
                  <ThSort label="Updated" col="updated_at" />
                  <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((post, i) => (
                  <tr key={post.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-4 py-3 align-middle"><Link href={`/blog/${post.id}/edit`} className="text-sm font-medium hover:underline truncate block max-w-[250px]" style={{ color: 'var(--foreground)' }}>{post.title}</Link></td>
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs" style={{ color: '#475569' }}>{post.website}</span></td>
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs truncate block max-w-[150px] mx-auto" style={{ color: '#94a3b8' }}>/{post.slug}</span></td>
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
                    <td className="px-4 py-3 align-middle text-center"><span className="text-xs" style={{ color: '#94a3b8' }}>{formatDate(post.updated_at)}</span></td>
                    <td className="px-4 py-3 align-middle text-center">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link href={`/blog/${post.id}/edit`}
                          className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }} title="Edit post">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </Link>
                        <Link href={`/blog/${post.id}/view`}
                          className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }} title="Preview post">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
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
