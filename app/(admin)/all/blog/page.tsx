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
  return <svg className={`w-3 h-3 inline-block ml-0.5 ${active ? '' : 'opacity-30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
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
      <th className="px-4 py-3.5 text-center text-[10px] sm:text-xs font-semibold cursor-pointer select-none hover:text-[var(--primary)] transition-colors"
        style={{ color: '#475569' }} onClick={() => toggleSort(col)}>
        {label} <SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} />
      </th>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Blog Posts</h1>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{posts.length} posts across all websites</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="flex-1 min-w-48 max-w-sm relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#e2e8f0' }} />
        </div>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2rem', background: 'white' }}>
          <option value="">All companies</option>
          {companyNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer" style={{ borderColor: '#e2e8f0', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2rem', background: 'white' }}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        {(search || filterCompany || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterCompany(''); setFilterStatus('') }} className="px-3 py-2 text-xs rounded-lg border hover:bg-slate-50 transition-colors" style={{ borderColor: '#e2e8f0', color: '#475569' }}>Clear</button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <ThSort label="Title" col="title" />
                  <ThSort label="Website" col="website" />
                  <th className="px-4 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Slug</th>
                  <th className="px-4 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}>Languages</th>
                  <ThSort label="Status" col="status" />
                  <ThSort label="Updated" col="updated_at" />
                  <th className="px-4 py-3.5 text-center text-[10px] sm:text-xs font-semibold" style={{ color: '#475569' }}></th>
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
                      <div className="flex items-center gap-2 justify-center">
                        <Link href={`/blog/${post.id}/edit`} className="text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#475569' }}>Edit ↗</Link>
                        <Link href={`/blog/${post.id}/view`} className="text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-lg border transition-colors whitespace-nowrap hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: '#e2e8f0', color: '#475569' }}>Preview ↗</Link>
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
