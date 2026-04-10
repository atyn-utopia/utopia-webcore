'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useConfirm } from '@/contexts/ConfirmContext'

interface Post {
  id: string
  website: string
  title: string
  slug: string
  cover_image_url: string | null
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
  excerpt: string | null
  languages: string[]
}

interface WebsiteSummary {
  domain: string
  company_name: string | null
  blog_count: number
  published_blog_count: number
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <svg className={`w-3.5 h-3.5 ml-1 ${active ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4" style={{ opacity: !active || dir === 'asc' ? 1 : 0.3 }} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 15l4 4 4-4" style={{ opacity: !active || dir === 'desc' ? 1 : 0.3 }} />
    </svg>
  )
}

export default function BlogListPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const confirm = useConfirm()
  const { selectedWebsite } = useWebsite()
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''
  const openFolder = searchParams.get('website') ?? ''

  interface CompanyInfo { id: string; name: string; company_websites: { domain: string }[] }
  const [companies, setCompanies] = useState<CompanyInfo[]>([])
  const [websites, setWebsites] = useState<WebsiteSummary[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  type SortKey = 'title' | 'status' | 'updated_at'
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Fetch websites and companies
  useEffect(() => {
    Promise.all([
      fetch('/api/websites').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]).then(([sitesData, companiesData]) => {
      if (Array.isArray(sitesData)) setWebsites(sitesData)
      if (Array.isArray(companiesData)) setCompanies(companiesData)
      setLoading(false)
    }).catch(() => setLoading(false))
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
    const ok = await confirm({
      title: 'Delete blog post',
      message: (
        <>
          Are you sure you want to delete <strong className="text-slate-800">&ldquo;{title}&rdquo;</strong>? This will remove the post and all its translations. This action cannot be undone.
        </>
      ),
      confirmLabel: 'Delete post',
      variant: 'danger',
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/blog/${id}`, { method: 'DELETE' })
    setDeleting(null)
    fetchPosts()
  }

  const filtered = posts
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || (p.excerpt ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  // Company folder view (no company or website selected)
  if (!openCompany && !openFolder) {
    const companyStats = companies.map(c => {
      const domains = c.company_websites.map(w => w.domain)
      const companySites = websites.filter(s => domains.includes(s.domain))
      return { ...c, blog_count: companySites.reduce((s, x) => s + x.blog_count, 0), published_count: companySites.reduce((s, x) => s + x.published_blog_count, 0) }
    })
    const filtered = search ? companyStats.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : companyStats

    // Unassigned websites (have posts but no company)
    const assignedDomains = new Set(companies.flatMap(c => c.company_websites.map(w => w.domain)))
    const unassignedSites = websites.filter(s => !assignedDomains.has(s.domain) && s.blog_count > 0)

    return (
      <div>
        <PageHeader
          title={t('page.blogPosts.title')}
          description={t('page.blogPosts.description')}
          actions={
            <Link href="/blog/new" className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity" style={{ background: 'var(--primary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('button.newPost')}
            </Link>
          }
        />
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'} onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <Link key={c.id} href={`/blog?company=${encodeURIComponent(c.name)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px]" style={{ color: '#475569' }}>{c.blog_count} {c.blog_count === 1 ? 'post' : 'posts'}</span>
                      {c.published_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{c.published_count} live</span>}
                    </div>
                  </div>
                  <svg className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
            {/* Unassigned websites with posts */}
            {unassignedSites.map(site => (
              <Link key={site.domain} href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: '#94a3b8' }}>{site.domain}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px]" style={{ color: '#94a3b8' }}>{site.blog_count} posts · Unassigned</span>
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

  // Website folder view (company selected, no website)
  if (openCompany && !openFolder) {
    const companyDomains = new Set(companies.find(c => c.name === openCompany)?.company_websites.map(w => w.domain) ?? [])
    const companySites = websites.filter(s => companyDomains.has(s.domain))

    return (
      <div>
        <PageHeader
          title={openCompany}
          description={t('page.blogPosts.description.websites')}
          actions={
            <Link href="/blog/new" className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity" style={{ background: 'var(--primary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('button.newPost')}
            </Link>
          }
        />
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
        ) : companySites.length === 0 ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>No websites found for this company.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companySites.map(site => (
              <Link key={site.domain} href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
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
                      {site.published_blog_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{site.published_blog_count} live</span>}
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

  // Inside a website folder — show posts
  return (
    <div>
      <PageHeader
        title={openFolder}
        description={t('page.blogPosts.description.folder')}
        actions={
          <>
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
              href={`/blog/new?website=${encodeURIComponent(openFolder)}${websites.find(w => w.domain === openFolder)?.company_name ? `&company=${encodeURIComponent(websites.find(w => w.domain === openFolder)!.company_name!)}` : ''}`}
              className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('button.newPost')}
            </Link>
          </>
        }
      />

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
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
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
            href={`/blog/new?website=${encodeURIComponent(openFolder)}${websites.find(w => w.domain === openFolder)?.company_name ? `&company=${encodeURIComponent(websites.find(w => w.domain === openFolder)!.company_name!)}` : ''}`}
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
              className="block rounded-xl border bg-white overflow-hidden hover:shadow-sm transition-shadow"
              style={{ borderColor: '#e2e8f0' }}
            >
              {post.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.cover_image_url} alt="" className="w-full h-32 object-cover" />
              )}
              <div className="p-4">
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
                  className="w-6 h-6 flex items-center justify-center rounded-md text-white transition-colors shadow-sm flex-shrink-0 disabled:opacity-50"
                  style={{ background: '#ef4444' }}
                  onMouseEnter={e => { if (deleting !== post.id) (e.currentTarget as HTMLElement).style.background = '#dc2626' }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#ef4444'}
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <h3 className="text-sm font-medium truncate mb-1" style={{ color: 'var(--foreground)' }}>{post.title}</h3>
              {post.languages?.length > 0 && (
                <div className="flex gap-1 mb-1">
                  {['en', 'ms', 'zh'].map(lang => (
                    <span key={lang} className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase"
                      style={post.languages.includes(lang) ? { background: '#e0ecf5', color: '#1e3a5f' } : { background: '#f1f5f9', color: '#cbd5e1' }}>
                      {lang}
                    </span>
                  ))}
                </div>
              )}
              {post.excerpt && <p className="text-xs truncate mb-2" style={{ color: '#475569' }}>{post.excerpt}</p>}
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#94a3b8' }}>/{post.slug}</p>
                <p className="text-[10px]" style={{ color: '#94a3b8' }}>{formatDate(post.updated_at)}</p>
              </div>
              </div>
            </Link>
          ))}
          {/* Add card */}
          <Link
            href={`/blog/new?website=${encodeURIComponent(openFolder)}${websites.find(w => w.domain === openFolder)?.company_name ? `&company=${encodeURIComponent(websites.find(w => w.domain === openFolder)!.company_name!)}` : ''}`}
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
        <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col className="w-20 sm:w-24" />
              <col className="w-24 sm:w-28" />
              <col className="w-20 sm:w-24" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <th
                  className="px-3 sm:px-4 py-3 text-left text-[10px] sm:text-xs font-medium cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                  onClick={() => toggleSort('title')}
                >
                  <span className="inline-flex items-center">Post<SortIcon active={sortKey === 'title'} dir={sortKey === 'title' ? sortDir : 'asc'} /></span>
                </th>
                <th
                  className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                  onClick={() => toggleSort('status')}
                >
                  <span className="inline-flex items-center">Status<SortIcon active={sortKey === 'status'} dir={sortKey === 'status' ? sortDir : 'asc'} /></span>
                </th>
                <th
                  className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                  onClick={() => toggleSort('updated_at')}
                >
                  <span className="inline-flex items-center">Updated<SortIcon active={sortKey === 'updated_at'} dir={sortKey === 'updated_at' ? sortDir : 'asc'} /></span>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post, i) => (
                <tr key={post.id} className="hover:bg-[#f1f5f9] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #cbd5e1' : 'none' }}>
                  <td className="px-3 sm:px-4 py-3 align-middle overflow-hidden">
                    <div className="min-w-0">
                      <Link href={`/blog/${post.id}/edit`} className="text-xs sm:text-sm font-medium hover:underline truncate block" style={{ color: 'var(--foreground)' }}>{post.title}</Link>
                      {post.languages?.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {['en', 'ms', 'zh'].map(lang => (
                            <span key={lang} className="text-[9px] px-1 py-0.5 rounded font-medium uppercase"
                              style={post.languages.includes(lang) ? { background: '#e0ecf5', color: '#1e3a5f' } : { background: '#f1f5f9', color: '#cbd5e1' }}>
                              {lang}
                            </span>
                          ))}
                        </div>
                      )}
                      {post.excerpt && <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: '#475569' }}>{post.excerpt}</p>}
                      <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>/{post.slug}</p>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={post.status === 'published' ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: post.status === 'published' ? '#16a34a' : '#94a3b8' }} />
                      {post.status === 'published' ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-2 py-3 align-middle text-[10px] sm:text-xs" style={{ color: '#475569' }}>{formatDate(post.updated_at)}</td>
                  <td className="px-2 sm:px-4 py-3 align-middle">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => router.push(`/blog/${post.id}/edit`)} className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors hover:text-[var(--primary)] hover:border-[var(--primary)]" style={{ borderColor: '#cbd5e1', color: '#475569' }} title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => deletePost(post.id, post.title)}
                        disabled={deleting === post.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors shadow-sm disabled:opacity-50"
                        style={{ background: '#ef4444' }}
                        onMouseEnter={e => { if (deleting !== post.id) (e.currentTarget as HTMLElement).style.background = '#dc2626' }}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#ef4444'}
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
