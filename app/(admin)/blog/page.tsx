'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWebsite } from '@/contexts/WebsiteContext'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useToast } from '@/contexts/ToastContext'
import ViewToggle from '@/components/ViewToggle'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
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
  const toast = useToast()
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  type SortKey = 'title' | 'status' | 'updated_at'
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [blogStats, setBlogStats] = useState<{
    summary: { total_posts: number; published: number; drafts: number; total_views: number; prev_total_views: number; growing: number; declining: number; trend: string }
    posts: { id: string; slug: string; views: number; prev_views: number; clicks: number; impressions: number; trend: string; change_pct: number }[]
  } | null>(null)

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

  // Fetch blog analytics when folder is open
  useEffect(() => {
    if (!openFolder) { setBlogStats(null); return }
    fetch(`/api/analytics/blog?website=${encodeURIComponent(openFolder)}`)
      .then(r => r.json())
      .then(d => { if (d.summary) setBlogStats(d) })
      .catch(() => {})
  }, [openFolder])

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
    const res = await fetch(`/api/blog/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      toast.success(`Post "${title}" deleted`, 'Deleted')
    } else {
      toast.error('Failed to delete post', 'Delete failed')
    }
    fetchPosts()
  }

  const filtered = posts
    .filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
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
            <>
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <Button
                variant="primary"
                size="lg"
                href="/blog/new"
                iconLeft={<PlusIcon className="w-4 h-4" />}
              >
                {t('button.newPost')}
              </Button>
            </>
          }
        />
        <div className="mb-5">
          <div className="relative max-w-sm">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'} onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <XMarkIcon className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <Card padding={false}><PageSpinner /></Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <Link key={c.id} href={`/blog?company=${encodeURIComponent(c.name)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <BuildingOfficeIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px]" style={{ color: '#475569' }}>{c.blog_count} {c.blog_count === 1 ? 'post' : 'posts'}</span>
                      {c.published_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{c.published_count} live</span>}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
            {/* Unassigned websites with posts */}
            {unassignedSites.map(site => (
              <Link key={site.domain} href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <FolderIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: '#94a3b8' }}>{site.domain}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px]" style={{ color: '#94a3b8' }}>{site.blog_count} posts · Unassigned</span>
                    </div>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {filtered.map((c, i) => (
              <Link key={c.id} href={`/blog?company=${encodeURIComponent(c.name)}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < filtered.length - 1 || unassignedSites.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  <BuildingOfficeIcon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold truncate flex-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs" style={{ color: '#64748b' }}>{c.blog_count} {c.blog_count === 1 ? 'post' : 'posts'}</span>
                  {c.published_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{c.published_count} live</span>}
                  <ChevronRightIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
            {unassignedSites.map((site, i) => (
              <Link key={site.domain} href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < unassignedSites.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  <FolderIcon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold truncate flex-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: '#94a3b8' }}>{site.domain}</p>
                <span className="text-xs flex-shrink-0" style={{ color: '#94a3b8' }}>{site.blog_count} posts · Unassigned</span>
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
            <>
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <Button
                variant="primary"
                size="lg"
                href="/blog/new"
                iconLeft={<PlusIcon className="w-4 h-4" />}
              >
                {t('button.newPost')}
              </Button>
            </>
          }
        />
        {loading ? (
          <Card padding={false}><PageSpinner /></Card>
        ) : companySites.length === 0 ? (
          <Card className="!py-12 text-center"><p className="text-sm text-slate-500">No websites found for this company.</p></Card>
        ) : viewMode === 'list' ? (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {companySites.map((site, i) => (
              <Link key={site.domain} href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < companySites.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  <FolderIcon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold truncate flex-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs" style={{ color: '#64748b' }}>{site.blog_count} {site.blog_count === 1 ? 'post' : 'posts'}</span>
                  {site.published_blog_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{site.published_blog_count} live</span>}
                  <ChevronRightIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companySites.map(site => (
              <Link key={site.domain} href={`/blog?website=${encodeURIComponent(site.domain)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <FolderIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs" style={{ color: '#475569' }}>{site.blog_count} {site.blog_count === 1 ? 'post' : 'posts'}</span>
                      {site.published_blog_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{site.published_blog_count} live</span>}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
        title="Blog Posts"
        description={t('page.blogPosts.description.folder')}
      />

      {/* Blog Analytics Stats */}
      {blogStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <DocumentTextIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>Total Posts</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{blogStats.summary.total_posts}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>{blogStats.summary.published} published · {blogStats.summary.drafts} draft</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                <EyeIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>Total Views</span>
              {blogStats.summary.trend !== 'flat' && (
                <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${blogStats.summary.trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                  {blogStats.summary.trend === 'up' ? '↑' : '↓'}
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-slate-900">{blogStats.summary.total_views.toLocaleString()}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>vs {blogStats.summary.prev_total_views.toLocaleString()} prev period</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>Growing</span>
            </div>
            <p className="text-xl font-bold text-green-600">{blogStats.summary.growing}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>posts with increasing views</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#fef2f2' }}>
                <ArrowTrendingDownIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>Declining</span>
            </div>
            <p className="text-xl font-bold text-red-500">{blogStats.summary.declining}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>posts with decreasing views</p>
          </div>
        </div>
      )}

      {/* Status tabs (Wix Posts page style) */}
      {posts.length > 0 && (
        <div className="mb-4 flex items-center gap-1" style={{ borderBottom: '1px solid #e2e8f0' }}>
          {([
            { key: 'all' as const, label: 'All', count: posts.length },
            { key: 'published' as const, label: 'Published', count: posts.filter(p => p.status === 'published').length },
            { key: 'draft' as const, label: 'Drafts', count: posts.filter(p => p.status === 'draft').length },
          ]).map(tab => {
            const active = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="relative px-3 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5"
                style={{ color: active ? 'var(--primary)' : '#64748b' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#64748b' }}
              >
                {tab.label}
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: active ? 'rgba(30, 58, 95, 0.1)' : '#f1f5f9', color: active ? 'var(--primary)' : '#94a3b8' }}>
                  {tab.count}
                </span>
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--primary)' }} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Search + view toggle + New Post. Unified header card */}
      <div className="rounded-xl border p-4 sm:p-5 mb-5" style={{ borderColor: '#cbd5e1', background: '#f8fafc' }}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search posts by title, slug, or excerpt…"
                className="w-full h-9 pl-9 pr-9 text-sm rounded-full border outline-none focus:ring-2 focus:ring-offset-0"
                style={{ borderColor: '#cbd5e1', background: 'white', ['--tw-ring-color' as string]: 'rgba(41, 117, 204, 0.2)' }}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                  <XMarkIcon className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center rounded-full border overflow-hidden h-9 flex-shrink-0" style={{ borderColor: '#cbd5e1', background: 'white' }}>
            <button
              onClick={() => setViewMode('list')}
              className="w-9 h-full flex items-center justify-center transition-colors"
              style={{ background: viewMode === 'list' ? 'var(--primary)' : 'white', color: viewMode === 'list' ? 'white' : '#94a3b8' }}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className="w-9 h-full flex items-center justify-center transition-colors"
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
            className="inline-flex items-center justify-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-full transition-opacity hover:opacity-90 flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <PlusIcon className="w-4 h-4" />
            {t('button.newPost')}
          </Link>
        </div>
      </div>

      {/* Posts */}
      {postsLoading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : filtered.length === 0 && !search ? (
        <div className="p-12 text-center rounded-xl border" style={{ borderColor: '#cbd5e1' }}>
          <DocumentTextIcon className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: '#475569' }}>No posts yet</p>
          <p className="text-xs mt-1 mb-4" style={{ color: '#94a3b8' }}>Create the first blog post for {openFolder}</p>
          <Link
            href={`/blog/new?website=${encodeURIComponent(openFolder)}${websites.find(w => w.domain === openFolder)?.company_name ? `&company=${encodeURIComponent(websites.find(w => w.domain === openFolder)!.company_name!)}` : ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            <PlusIcon className="w-3.5 h-3.5" />
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
              href={`/blog/${post.id}/edit?website=${encodeURIComponent(openFolder)}`}
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
                  className="w-6 h-6 flex items-center justify-center rounded-full border border-[#e2e8f0] text-[#cbd5e1] transition-colors flex-shrink-0 disabled:opacity-50 hover:bg-[#ef4444] hover:border-white hover:text-white"
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
            <PlusIcon className="w-6 h-6 mb-1" />
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
              <col className="w-20" />
              <col className="w-16" />
              <col className="w-20" />
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
                  <span className="flex w-full items-center justify-between gap-1">Post<SortIcon active={sortKey === 'title'} dir={sortKey === 'title' ? sortDir : 'asc'} /></span>
                </th>
                <th
                  className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                  onClick={() => toggleSort('status')}
                >
                  <span className="flex w-full items-center justify-between gap-1">Status<SortIcon active={sortKey === 'status'} dir={sortKey === 'status' ? sortDir : 'asc'} /></span>
                </th>
                <th className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Views</th>
                <th className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Clicks</th>
                <th className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Impr.</th>
                <th
                  className="px-2 py-3 text-left text-[10px] sm:text-xs font-medium cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                  onClick={() => toggleSort('updated_at')}
                >
                  <span className="flex w-full items-center justify-between gap-1">Updated<SortIcon active={sortKey === 'updated_at'} dir={sortKey === 'updated_at' ? sortDir : 'asc'} /></span>
                </th>
                <th className="px-2 sm:px-4 py-3 text-center text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#94a3b8' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post, i) => (
                <tr key={post.id} className="hover:bg-[#f1f5f9] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #cbd5e1' : 'none' }}>
                  <td className="px-3 sm:px-4 py-3 align-middle overflow-hidden">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const stat = blogStats?.posts.find(p => p.id === post.id)
                          if (stat && stat.trend === 'up') return <ArrowTrendingUpIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          if (stat && stat.trend === 'down') return <ArrowTrendingDownIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          return <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                        })()}
                        <Link href={`/blog/${post.id}/edit?website=${encodeURIComponent(openFolder)}`} className="text-xs sm:text-sm font-medium hover:underline truncate" style={{ color: 'var(--foreground)' }}>{post.title}</Link>
                      </div>
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
                  <td className="px-2 py-3 align-middle">
                    {(() => {
                      const stat = blogStats?.posts.find(p => p.id === post.id)
                      if (!stat) return <span className="text-[10px]" style={{ color: '#cbd5e1' }}>—</span>
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{stat.views}</span>
                          {stat.trend !== 'flat' && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded ${stat.trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                              {stat.trend === 'up' ? '↑' : '↓'}{stat.change_pct}%
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    {(() => {
                      const stat = blogStats?.posts.find(p => p.id === post.id)
                      return <span className="text-xs" style={{ color: stat && stat.clicks > 0 ? '#475569' : '#cbd5e1' }}>{stat?.clicks ?? 0}</span>
                    })()}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    {(() => {
                      const stat = blogStats?.posts.find(p => p.id === post.id)
                      return <span className="text-xs" style={{ color: stat && stat.impressions > 0 ? '#475569' : '#cbd5e1' }}>{stat?.impressions ?? 0}</span>
                    })()}
                  </td>
                  <td className="px-2 py-3 align-middle text-[10px] sm:text-xs" style={{ color: '#475569' }}>{formatDate(post.updated_at)}</td>
                  <td className="px-2 sm:px-4 py-3 align-middle">
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => router.push(`/blog/${post.id}/edit?website=${encodeURIComponent(openFolder)}`)} className="w-8 h-8 flex items-center justify-center rounded-full border transition-colors hover:text-[var(--primary)] hover:border-[var(--primary)]" style={{ borderColor: '#cbd5e1', color: '#475569' }} title="Edit">
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deletePost(post.id, post.title)}
                        disabled={deleting === post.id}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-[#e2e8f0] text-[#94a3b8] transition-colors disabled:opacity-50 hover:bg-[#ef4444] hover:border-white hover:text-white"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
