'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import ViewToggle, { type ViewMode } from '@/components/ViewToggle'
import AddWebsiteModal from '@/components/AddWebsiteModal'
import CompareModal from '@/components/CompareModal'
import ComparisonColumn from '@/components/ComparisonColumn'
import StatCard from '@/components/analytics/StatCard'
import SimpleChart from '@/components/analytics/SimpleChart'
import InsightsPanel from '@/components/analytics/InsightsPanel'
import MiniBar from '@/components/analytics/MiniBar'
import Tooltip from '@/components/analytics/Tooltip'

import {
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  EyeIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
interface WebsiteSummary { domain: string; company_id: string | null; company_name: string | null; leads_mode: string | null; phone_count: number; active_phone_count: number; blog_count: number; published_blog_count: number }
interface CompanyInfo { id: string; name: string; company_websites: { domain: string }[] }
interface WebsiteStat { website: string; pageviews: number; clicks: number; impressions: number; sessions: number; trend: 'up' | 'down' | 'flat'; trend_pct: number }
interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }
interface Insight { icon: string; text: string; type: 'positive' | 'negative' | 'neutral' | 'warning' }
interface DayStats { pageviews: number; clicks: number; impressions: number; sessions: number }
interface AnalyticsData { summary: { pageviews: number; clicks: number; impressions: number; sessions: number }; today: DayStats; yesterday: DayStats; insights: Insight[]; websiteStats: WebsiteStat[]; dailyStats: DailyStat[]; topPages: { path: string; count: number }[]; topReferrers: { source: string; count: number }[]; topClicks: { label: string; count: number }[]; devices: Record<string, number>; browsers: Record<string, number>; firstEventAt: string | null }
interface RecentPost { id: string; website: string; title: string; status: string; updated_at: string; slug: string }
interface RecentPhone { id: string; website: string; phone_number: string; label: string | null; type: string }

const LEADS_MODE: Record<string, { label: string; color: string; bg: string }> = { single: { label: 'Single', color: '#475569', bg: '#f1f5f9' }, rotation: { label: 'Rotation', color: '#0369a1', bg: '#e0f2fe' }, location: { label: 'Location', color: '#1E5BFF', bg: '#eff6ff' }, hybrid: { label: 'Hybrid', color: '#b45309', bg: '#fef3c7' } }
const MEDAL = ['🥇', '🥈', '🥉']
const ICON = {
  eye: <EyeIcon className="w-4 h-4" />,
  users: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  click: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>,
  image: <PhotoIcon className="w-4 h-4" />,
}

function tr(today: number, yesterday: number): 'up' | 'down' | 'flat' { return today > yesterday ? 'up' : today < yesterday ? 'down' : 'flat' }
function formatDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) }

const FACT_DOT: Record<string, string> = {
  success: '#16a34a',
  warning: '#d97706',
  info:    '#2563eb',
  neutral: '#94a3b8',
}

/**
 * Compact single-line status pill: ● Label · Value
 * All FactPills are h-8, same border/background, only the leading dot color
 * differs by tone. Consistent heights across the row.
 */
function FactPill({ label, value, tone = 'neutral', href }: {
  label: string
  value: string
  tone?: 'success' | 'warning' | 'info' | 'neutral'
  href?: string
}) {
  const inner = (
    <div className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs transition-colors"
      style={{ background: 'white', border: '1px solid #e2e8f0' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: FACT_DOT[tone] }} />
      <span className="text-[11px] font-medium leading-none" style={{ color: '#94a3b8' }}>{label}</span>
      <span className="text-xs font-normal leading-none" style={{ color: 'var(--foreground)' }}>{value}</span>
    </div>
  )
  if (href) return <Link href={href} className="inline-flex hover:brightness-[0.98] transition">{inner}</Link>
  return inner
}

const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#ea580c']
function DetailCard({ title, accent, bgTint, icon, items, emptyText }: {
  title: string
  accent: string
  bgTint: string
  icon: React.ReactNode
  items: { key: string; label: string; value: number; mono?: boolean }[]
  emptyText: string
}) {
  const max = items.reduce((m, i) => Math.max(m, i.value), 0) || 1
  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: bgTint, borderBottom: '1px solid #e2e8f0' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'white', color: accent }}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold" style={{ color: accent }}>{title}</h3>
        {items.length > 0 && <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'white', color: accent }}>{items.length}</span>}
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-xs py-6 text-center" style={{ color: '#94a3b8' }}>{emptyText}</p>
        ) : items.slice(0, 8).map((it, i) => (
          <div key={it.key} className="flex items-center gap-2.5 py-2" style={{ borderBottom: i < Math.min(items.length, 8) - 1 ? '1px solid #f8fafc' : 'none' }}>
            <span className="w-5 flex-shrink-0 text-center">
              {i < 3 ? <span className="text-xs">{['🥇','🥈','🥉'][i]}</span> : <span className="text-[10px] font-semibold" style={{ color: '#cbd5e1' }}>#{i + 1}</span>}
            </span>
            <span className={`text-xs truncate flex-1 ${it.mono ? 'font-mono' : ''}`} style={{ color: '#475569' }}>{it.label}</span>
            <div className="w-14 flex-shrink-0">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / max) * 100}%`, background: i < 3 ? MEDAL_COLORS[i] : accent }} />
              </div>
            </div>
            <span className="text-xs font-semibold flex-shrink-0 tabular-nums w-10 text-right" style={{ color: 'var(--foreground)' }}>{it.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function PeriodSelector({ value, onChange }: { value: string; onChange: (v: '7d' | '30d' | '90d') => void }) {
  return (<div className="flex items-center rounded-md border overflow-hidden h-9" style={{ borderColor: '#e2e8f0' }}>{[{ v: '7d' as const, l: '7d' }, { v: '30d' as const, l: '30d' }, { v: '90d' as const, l: '90d' }].map((p, i) => (<button key={p.v} onClick={() => onChange(p.v)} className="px-3 h-full text-xs font-medium transition-colors" style={{ background: value === p.v ? 'var(--primary)' : 'white', color: value === p.v ? 'white' : '#64748b', borderLeft: i > 0 ? '1px solid #e2e8f0' : undefined }}>{p.l}</button>))}</div>)
}

export default function WebsitesPage() {
  const { role } = useUser()
  const { t } = useLanguage()
  const isWriter = role === 'writer'
  const canAddWebsite = role === 'admin' || role === 'designer'
  const [addOpen, setAddOpen] = useState(false)
  const [sortKey, setSortKey] = useState<'domain' | 'views' | 'trend' | 'sessions' | 'clicks' | 'phones' | 'active_phones' | 'blog' | 'published_blog'>('views')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'domain' ? 'asc' : 'desc') }
  }

  function refreshSites() {
    Promise.all([fetch('/api/websites').then(r => r.json()), fetch('/api/companies').then(r => r.json())]).then(([s, c]) => { if (Array.isArray(s)) setSites(s); if (Array.isArray(c)) setCompanies(c) }).catch(() => {})
  }
  const searchParams = useSearchParams()
  const router = useRouter()
  const openCompany = searchParams.get('company') ?? ''
  const openWebsite = searchParams.get('website') ?? ''
  const compareSites = (searchParams.get('compare') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const [compareOpen, setCompareOpen] = useState(false)

  const [sites, setSites] = useState<WebsiteSummary[]>([])
  const [companies, setCompanies] = useState<CompanyInfo[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [recentPhones, setRecentPhones] = useState<RecentPhone[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  useEffect(() => {
    Promise.all([fetch('/api/websites').then(r => r.json()), fetch('/api/companies').then(r => r.json())]).then(([s, c]) => { if (Array.isArray(s)) setSites(s); if (Array.isArray(c)) setCompanies(c); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ period }); if (openWebsite) params.set('website', openWebsite)
    fetch(`/api/analytics?${params}`).then(r => r.json()).then(d => { if (d.summary) setAnalytics(d) }).catch(() => {})
  }, [period, openWebsite])

  useEffect(() => {
    if (!openCompany && !openWebsite) { setRecentPosts([]); setRecentPhones([]); return }

    if (openWebsite) {
      // Level 3: single website
      const wp = `?website=${encodeURIComponent(openWebsite)}`
      Promise.all([fetch(`/api/blog${wp}`).then(r => r.json()), fetch(`/api/phone-numbers${wp}`).then(r => r.json())]).then(([p, ph]) => { if (Array.isArray(p)) setRecentPosts(p.slice(0, 5)); if (Array.isArray(ph)) setRecentPhones(ph.slice(0, 5)) }).catch(() => {})
    } else if (openCompany && companies.length > 0) {
      // Level 2: fetch for each website in this company, merge and take latest 5
      const companyDomains = companies.find(c => c.name === openCompany)?.company_websites.map(w => w.domain) ?? []
      if (companyDomains.length === 0) { setRecentPosts([]); setRecentPhones([]); return }
      Promise.all(companyDomains.map(d =>
        Promise.all([
          fetch(`/api/blog?website=${encodeURIComponent(d)}`).then(r => r.json()),
          fetch(`/api/phone-numbers?website=${encodeURIComponent(d)}`).then(r => r.json()),
        ])
      )).then(results => {
        const allPosts = results.flatMap(([p]) => Array.isArray(p) ? p : []).sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 5)
        const allPhones = results.flatMap(([, ph]) => Array.isArray(ph) ? ph : []).slice(0, 5)
        setRecentPosts(allPosts)
        setRecentPhones(allPhones)
      }).catch(() => {})
    }
  }, [openCompany, openWebsite, companies])

  const filteredSites = sites.filter(s => { if (!search) return true; const q = search.toLowerCase(); return s.domain.toLowerCase().includes(q) || (s.company_name ?? '').toLowerCase().includes(q) })

  function Stats() {
    if (!analytics) return null
    const { summary: s, today: t, yesterday: y, dailyStats } = analytics
    // Build per-metric series from dailyStats for sparklines (Wix Highlights style).
    // Sessions aren't in dailyStats — derive from pageviews trend as a proxy, or skip.
    const pvSeries = dailyStats.map(d => d.pageviews)
    const clickSeries = dailyStats.map(d => d.clicks)
    const impSeries = dailyStats.map(d => d.impressions)
    return (<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <StatCard label="Pageviews" value={s.pageviews} color="#2979d6" hint="Total pages viewed" icon={ICON.eye} today={t.pageviews} yesterday={y.pageviews} trend={tr(t.pageviews, y.pageviews)} series={pvSeries} />
      <StatCard label="Sessions" value={s.sessions} color="#16a34a" hint="Unique visitor sessions" icon={ICON.users} today={t.sessions} yesterday={y.sessions} trend={tr(t.sessions, y.sessions)} series={pvSeries} />
      <StatCard label="Clicks" value={s.clicks} color="#f59e0b" hint="Button clicks (WhatsApp, Call)" icon={ICON.click} today={t.clicks} yesterday={y.clicks} trend={tr(t.clicks, y.clicks)} series={clickSeries} />
      <StatCard label="Impressions" value={s.impressions} color="#1E5BFF" hint="Product/content views" icon={ICON.image} today={t.impressions} yesterday={y.impressions} trend={tr(t.impressions, y.impressions)} series={impSeries} />
    </div>)
  }

  function Chart() {
    if (!analytics) return null
    return (<div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5" style={{ gridAutoRows: '1fr' }}>
      <div className="lg:col-span-2 [&>div]:h-full"><SimpleChart data={analytics.dailyStats} /></div>
      <div className="[&>div]:h-full"><InsightsPanel insights={analytics.insights} /></div>
    </div>)
  }

  function SearchBar({ placeholder }: { placeholder?: string }) {
    return (<div className="mb-5"><div className="relative max-w-sm">
      <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder ?? 'Search…'} className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }} />
      {search && (<button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}><XMarkIcon className="w-2.5 h-2.5" /></button>)}
    </div></div>)
  }

  function RecentActivity({ companyFilter }: { companyFilter?: string }) {
    return (<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <span className="text-xs font-medium" style={{ color: '#475569' }}>Recent Blog Posts</span>
          <Link href={companyFilter ? `/blog?company=${encodeURIComponent(companyFilter)}` : openWebsite ? `/blog?website=${encodeURIComponent(openWebsite)}` : '/blog'} className="text-[10px] font-medium hover:underline" style={{ color: 'var(--primary)' }}>View all</Link>
        </div>
        {recentPosts.length === 0 ? <p className="px-4 py-6 text-center text-xs" style={{ color: '#94a3b8' }}>No posts yet</p> : recentPosts.map((post, i) => (
          <Link key={post.id} href={`/blog/${post.id}/edit`} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors" style={{ borderBottom: i < recentPosts.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div className="min-w-0 flex-1"><p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{post.title}</p><p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{post.website} · {formatDate(post.updated_at)}</p></div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-3 ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{post.status === 'published' ? 'Live' : 'Draft'}</span>
          </Link>
        ))}
      </div>
      {!isWriter && (<div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <span className="text-xs font-medium" style={{ color: '#475569' }}>Recent Phone Numbers</span>
          <Link href={companyFilter ? `/phone-numbers?company=${encodeURIComponent(companyFilter)}` : openWebsite ? `/phone-numbers?website=${encodeURIComponent(openWebsite)}` : '/phone-numbers'} className="text-[10px] font-medium hover:underline" style={{ color: 'var(--primary)' }}>View all</Link>
        </div>
        {recentPhones.length === 0 ? <p className="px-4 py-6 text-center text-xs" style={{ color: '#94a3b8' }}>No numbers yet</p> : recentPhones.map((phone, i) => (
          <div key={phone.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: i < recentPhones.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div className="min-w-0 flex-1"><p className="text-xs font-medium font-mono" style={{ color: 'var(--foreground)' }}>{phone.phone_number}</p><p className="text-[10px]" style={{ color: '#94a3b8' }}>{phone.website}</p></div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-3" style={phone.type === 'default' ? { background: 'var(--primary)', color: 'white' } : { background: '#f1f5f9', color: '#475569' }}>{phone.type === 'default' ? 'Default' : (phone.label ?? 'Custom')}</span>
          </div>
        ))}
      </div>)}
    </div>)
  }

  // ═══ LEVEL 4: Compare mode ═══
  if (compareSites.length >= 2) {
    function removeFromCompare(domain: string) {
      const remaining = compareSites.filter(d => d !== domain)
      if (remaining.length < 2) {
        // Drop out of compare mode — go back to single-site view for the remaining one
        const sole = remaining[0]
        if (sole) router.push(`/websites?website=${encodeURIComponent(sole)}`)
        else router.push('/websites')
        return
      }
      const qp = new URLSearchParams({ compare: remaining.join(','), period })
      router.push(`/websites?${qp.toString()}`)
    }

    const gridCols = compareSites.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'
    return (<div>
      <PageHeader
        title="Compare websites"
        description={
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs" style={{ color: '#94a3b8' }}>
              {compareSites.length} sites · same period applied to all
            </span>
          </div>
        }
        actions={<>
          <button onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 h-9 rounded-lg border transition-colors hover:bg-slate-50"
            style={{ borderColor: '#cbd5e1', color: '#475569' }}>
            <CalendarIcon className="w-4 h-4" />
            Change sites
          </button>
          <button onClick={() => router.push('/websites')}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 h-9 rounded-lg transition-colors hover:bg-slate-50"
            style={{ color: '#64748b' }}>
            Exit compare
          </button>
          <PeriodSelector value={period} onChange={setPeriod} />
        </>}
      />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} preselect={compareSites} />
      <div className={`grid ${gridCols} gap-4 items-start`}>
        {compareSites.map(domain => (
          <ComparisonColumn
            key={domain}
            domain={domain}
            period={period}
            canRemove={compareSites.length > 1}
            onRemove={() => removeFromCompare(domain)}
          />
        ))}
      </div>
    </div>)
  }

  // ═══ LEVEL 1: Company folders ═══
  if (!openCompany && !openWebsite) {
    const companyStats = companies.map(c => {
      const domains = c.company_websites.map(w => w.domain)
      const cs = filteredSites.filter(s => domains.includes(s.domain))
      const stats = (analytics?.websiteStats ?? []).filter(s => domains.includes(s.website))
      return { ...c, site_count: cs.length, total_phones: cs.reduce((s, x) => s + x.phone_count, 0), total_blogs: cs.reduce((s, x) => s + x.blog_count, 0), pageviews: stats.reduce((s, w) => s + w.pageviews, 0), sessions: stats.reduce((s, w) => s + w.sessions, 0), clicks: stats.reduce((s, w) => s + w.clicks, 0) }
    }).sort((a, b) => b.pageviews - a.pageviews)
    const filtered = search ? companyStats.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : companyStats
    const maxPv = Math.max(...filtered.map(c => c.pageviews), 1)

    return (<div>
      <PageHeader title={t('page.websites.title')} description={t('page.websites.description')} actions={<>
        <button onClick={() => setCompareOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 h-9 rounded-lg border transition-colors hover:bg-slate-50"
          style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          <CalendarIcon className="w-4 h-4" />
          Compare
        </button>
        {canAddWebsite && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <PlusIcon className="w-4 h-4" />
            Add Website
          </button>
        )}
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </>} />
      <AddWebsiteModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refreshSites} />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} />
      <SearchBar placeholder="Search companies…" />
      <div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-semibold text-slate-700">Company Performance</h2><Tooltip text="Companies ranked by pageviews. Click to view websites."><svg className="w-3.5 h-3.5 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></Tooltip></div>
      {loading ? <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div> : viewMode === 'list' ? (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((c, i) => { const isTop3 = i < 3 && c.pageviews > 0; return (
            <Link key={c.id} href={`/websites?company=${encodeURIComponent(c.name)}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', background: isTop3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fdf4ef') : undefined }}>
              <div className="w-10 text-center flex-shrink-0">{isTop3 ? <span className="text-xl">{MEDAL[i]}</span> : <span className="text-sm font-bold" style={{ color: '#94a3b8' }}>#{i + 1}</span>}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p><div className="flex gap-3 mt-1 text-xs" style={{ color: '#64748b' }}><span>{c.site_count} sites</span><span>{c.sessions.toLocaleString()} sessions</span><span>{c.clicks.toLocaleString()} clicks</span></div></div>
              <div className="w-40 flex-shrink-0"><MiniBar value={c.pageviews} max={maxPv} color={isTop3 ? (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#ea580c') : 'var(--primary)'} /></div>
              <ChevronRightIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </Link>) })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => { const isTop3 = i < 3 && c.pageviews > 0; return (
            <Link key={c.id} href={`/websites?company=${encodeURIComponent(c.name)}`} className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0', background: isTop3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fdf4ef') : undefined }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>{isTop3 ? <span className="text-lg">{MEDAL[i]}</span> : <BuildingOfficeIcon className="w-5 h-5" />}</div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p><div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px]" style={{ color: '#64748b' }}><span>{c.site_count} sites</span><span>{c.pageviews.toLocaleString()} views</span>{c.clicks > 0 && <span>{c.clicks} clicks</span>}</div></div>
              </div>
            </Link>) })}
        </div>
      )}
    </div>)
  }

  // ═══ LEVEL 2: Company websites ═══
  if (openCompany && !openWebsite) {
    const currentCompany = companies.find(c => c.name === openCompany)
    const companyDomains = new Set(currentCompany?.company_websites.map(w => w.domain) ?? [])
    const unsortedCompanySites = filteredSites.filter(s => companyDomains.has(s.domain))
    const getSortValue = (site: WebsiteSummary): number | string => {
      const ws = (analytics?.websiteStats ?? []).find(w => w.website === site.domain)
      switch (sortKey) {
        case 'domain': return site.domain
        case 'views': return ws?.pageviews ?? 0
        case 'trend': {
          const t = ws?.trend ?? 'flat'
          const p = ws?.trend_pct ?? 0
          return t === 'up' ? p : t === 'down' ? -p : 0
        }
        case 'sessions': return ws?.sessions ?? 0
        case 'clicks': return ws?.clicks ?? 0
        case 'phones': return site.phone_count
        case 'active_phones': return site.active_phone_count
        case 'blog': return site.blog_count
        case 'published_blog': return site.published_blog_count
      }
    }
    const companySites = [...unsortedCompanySites].sort((a, b) => {
      const av = getSortValue(a); const bv = getSortValue(b)
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

    const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
      <svg className={`w-3.5 h-3.5 ml-1 ${active ? 'text-[var(--primary)]' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4" style={{ opacity: !active || dir === 'asc' ? 1 : 0.3 }} />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 15l4 4 4-4" style={{ opacity: !active || dir === 'desc' ? 1 : 0.3 }} />
      </svg>
    )
    const Th = ({ label, col }: { label: string; col?: typeof sortKey }) => {
      const base = "px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left"
      if (!col) return <th className={base} style={{ color: '#94a3b8' }}>{label}</th>
      return (
        <th className={`${base} cursor-pointer select-none hover:text-[var(--primary)] transition-colors`} style={{ color: '#94a3b8' }} onClick={() => toggleSort(col)}>
          <span className="inline-flex items-center">{label}<SortIcon active={sortKey === col} dir={sortKey === col ? sortDir : 'asc'} /></span>
        </th>
      )
    }

    return (<div>
      <PageHeader title={openCompany} description={`${companySites.length} website${companySites.length !== 1 ? 's' : ''}`} actions={<>
        <button onClick={() => setCompareOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 h-9 rounded-lg border transition-colors hover:bg-slate-50"
          style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          <CalendarIcon className="w-4 h-4" />
          Compare
        </button>
        {canAddWebsite && currentCompany && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <PlusIcon className="w-4 h-4" />
            Add Website
          </button>
        )}
      </>} />
      {currentCompany && <AddWebsiteModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refreshSites} presetCompany={{ id: currentCompany.id, name: currentCompany.name }} />}
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} preselect={companySites.map(s => s.domain).slice(0, 1)} />
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Websites</h2>
      {loading ? <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div> : companySites.length === 0 ? <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>No websites found.</div> : (
        <div className="rounded-xl border overflow-hidden bg-white mb-6" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto" style={{ maxHeight: '60vh' }}><table className="w-full text-sm min-w-[800px]"><thead><tr className="sticky top-0 z-10" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <Th label="Website" col="domain" />
            {!isWriter && <Th label="Leads Mode" />}
            <Th label="Views" col="views" />
            <Th label="Trend" col="trend" />
            <Th label="Sessions" col="sessions" />
            <Th label="Clicks" col="clicks" />
            {!isWriter && <Th label="Phones" col="phones" />}
            {!isWriter && <Th label="Active" col="active_phones" />}
            <Th label="Blog" col="blog" />
            <Th label="Published" col="published_blog" />
            <Th label="" />
          </tr></thead><tbody>
            {companySites.map((site, i) => { const ws = (analytics?.websiteStats ?? []).find(w => w.website === site.domain); const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null; return (
              <tr key={site.domain} className="hover:bg-[#f8fafc] transition-colors relative hover:z-20" style={{ borderBottom: i < companySites.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <td className="px-4 py-3.5"><Link href={`/websites?website=${encodeURIComponent(site.domain)}&company=${encodeURIComponent(openCompany)}`} className="text-sm font-medium hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</Link></td>
                {!isWriter && <td className="px-4 py-3.5">{lm ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>}
                <td className="px-4 py-3.5"><span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{ws?.pageviews.toLocaleString() ?? '0'}</span></td>
                <td className="px-4 py-3.5">
                  {ws && ws.pageviews > 0 ? (
                    ws.trend === 'up' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: '#16a34a' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        {ws.trend_pct}%
                      </span>
                    ) : ws.trend === 'down' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: '#dc2626' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        {ws.trend_pct}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#94a3b8' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                        flat
                      </span>
                    )
                  ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                </td>
                <td className="px-4 py-3.5"><span className="text-xs" style={{ color: '#64748b' }}>{ws?.sessions.toLocaleString() ?? '0'}</span></td>
                <td className="px-4 py-3.5"><span className="text-xs" style={{ color: '#f59e0b' }}>{ws?.clicks.toLocaleString() ?? '0'}</span></td>
                {!isWriter && <td className="px-4 py-3.5"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span></td>}
                {!isWriter && <td className="px-4 py-3.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.active_phone_count}</span></td>}
                <td className="px-4 py-3.5"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span></td>
                <td className="px-4 py-3.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.published_blog_count}</span></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 justify-center">
                    <Link href={`/websites?website=${encodeURIComponent(site.domain)}&company=${encodeURIComponent(openCompany)}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 h-7 rounded-md text-white transition-opacity hover:opacity-90"
                      style={{ background: 'var(--primary)' }} title="Open site dashboard">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M7 20V13m5 7V8m5 12v-5" />
                      </svg>
                      Dashboard
                    </Link>
                    <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="group/tip relative w-7 h-7 flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Open website">
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </a>
                    {!isWriter && <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`} className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Phone numbers">
                      <PhoneIcon className="w-3.5 h-3.5" />
                    </Link>}
                    <Link href={`/blog?website=${encodeURIComponent(site.domain)}`} className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Blog posts">
                      <DocumentTextIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>) })}
          </tbody></table></div>
        </div>
      )}
    </div>)
  }

  // ═══ LEVEL 3: Website detail ═══
  const siteInfo = sites.find(s => s.domain === openWebsite)
  const siteUrl = `https://${openWebsite}`
  const thumbUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=600`
  const todayStats = analytics?.today
  const yesterdayStats = analytics?.yesterday
  const trackerSeenToday = (todayStats?.pageviews ?? 0) > 0 || (todayStats?.clicks ?? 0) > 0
  const trackerSeenYesterday = (yesterdayStats?.pageviews ?? 0) > 0
  const lm = siteInfo?.leads_mode && LEADS_MODE[siteInfo.leads_mode] ? LEADS_MODE[siteInfo.leads_mode] : null

  return (<div>
    {/* Site hero. Wix-style large card with thumbnail, name, status pills, actions */}
    <div className="mb-5 rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
      <div className="flex items-stretch flex-col md:flex-row">
        {/* Thumbnail */}
        <a href={siteUrl} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 block relative md:border-r overflow-hidden"
          style={{ borderColor: '#e2e8f0', width: '100%', maxWidth: 240, height: 150, background: '#f8fafc' }}
          title={`Open ${openWebsite}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt={openWebsite} loading="lazy"
            className="w-full h-full object-cover object-top transition-transform hover:scale-105" />
        </a>

        {/* Identity + status + actions */}
        <div className="min-w-0 flex-1 p-5 flex flex-col justify-center gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate" style={{ color: 'var(--foreground)' }}>
                  {openWebsite.replace(/^www\./, '').split('.')[0].split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: trackerSeenToday ? '#dcfce7' : '#f1f5f9', color: trackerSeenToday ? '#15803d' : '#94a3b8' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${trackerSeenToday ? 'animate-pulse' : ''}`} style={{ background: trackerSeenToday ? '#22c55e' : '#cbd5e1' }} />
                  {trackerSeenToday ? 'Live' : 'Quiet'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap" style={{ color: '#64748b' }}>
                <a href={siteUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-[var(--primary)] truncate"
                  style={{ color: '#64748b' }}>
                  <span className="truncate">{siteUrl}</span>
                  <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0" />
                </a>
                {siteInfo?.company_name && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <span>{siteInfo.company_name}</span>
                  </>
                )}
                {analytics?.firstEventAt && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <span>Live since {formatDate(analytics.firstEventAt)}</span>
                  </>
                )}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-md border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
                <CalendarIcon className="w-3.5 h-3.5" />
                Compare
              </button>
              <PeriodSelector value={period} onChange={setPeriod} />
            </div>
          </div>

          {/* Quick-fact strip. Clean single-line pills, all h-8 */}
          <div className="flex flex-wrap items-center gap-2">
            <FactPill
              label="Tracker"
              value={trackerSeenToday ? 'Active today' : trackerSeenYesterday ? 'Active yesterday' : 'No recent activity'}
              tone={trackerSeenToday ? 'success' : trackerSeenYesterday ? 'neutral' : 'warning'}
            />
            {!isWriter && lm && (
              <FactPill label="Leads mode" value={lm.label} tone="info" />
            )}
            {!isWriter && siteInfo && (
              <FactPill
                label="Phones"
                value={`${siteInfo.active_phone_count} Active`}
                tone={siteInfo.active_phone_count > 0 ? 'success' : 'neutral'}
                href={`/phone-numbers?website=${encodeURIComponent(openWebsite)}`}
              />
            )}
            {siteInfo && (
              <FactPill
                label="Blog"
                value={`${siteInfo.published_blog_count} Published`}
                tone={siteInfo.published_blog_count > 0 ? 'info' : 'neutral'}
                href={`/blog?website=${encodeURIComponent(openWebsite)}`}
              />
            )}
            {todayStats && (
              <FactPill
                label="Today"
                value={`${todayStats.pageviews.toLocaleString()} Views · ${todayStats.clicks} Clicks`}
                tone={todayStats.pageviews >= (yesterdayStats?.pageviews ?? 0) ? 'success' : 'warning'}
              />
            )}
          </div>
        </div>
      </div>
    </div>

    <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} preselect={[openWebsite]} />
    <Stats />
    <Chart />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      {/* Top Pages. Blue */}
      <DetailCard
        title="Top Pages"
        accent="#2979d6"
        bgTint="#eff6ff"
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>}
        items={(analytics?.topPages ?? []).map(p => ({ key: p.path, label: p.path, value: p.count, mono: true }))}
        emptyText="No page data yet"
      />
      {/* Top Referrers. Green */}
      <DetailCard
        title="Top Referrers"
        accent="#16a34a"
        bgTint="#f0fdf4"
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
        items={(analytics?.topReferrers ?? []).map(r => ({ key: r.source, label: r.source, value: r.count }))}
        emptyText="No referrer data. Most visitors came direct"
      />
      {/* Top Clicks. Amber */}
      <DetailCard
        title="Top Clicks"
        accent="#f59e0b"
        bgTint="#fffbeb"
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>}
        items={(analytics?.topClicks ?? []).map(c => ({ key: c.label, label: c.label, value: c.count }))}
        emptyText="No clicks yet. Add window.uwc() calls to CTA buttons"
      />
      {/* Devices & Browsers. Purple */}
      <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#faf5ff', borderBottom: '1px solid #e2e8f0' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'white', color: '#1E5BFF' }}>
            <ComputerDesktopIcon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: '#1E5BFF' }}>Visitor Mix</h3>
        </div>
        <div className="p-5 grid grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#94a3b8' }}>Devices</p>
            {Object.keys(analytics?.devices ?? {}).length === 0 ? (
              <p className="text-xs" style={{ color: '#cbd5e1' }}>—</p>
            ) : Object.entries(analytics?.devices ?? {}).sort(([,a],[,b]) => b - a).map(([d, c]) => {
              const total = Object.values(analytics?.devices ?? {}).reduce((s, v) => s + v, 0) || 1
              const pct = Math.round((c / total) * 100)
              const icon = d === 'mobile' ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                : d === 'tablet' ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.5h.01M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              return (
                <div key={d} className="flex items-center gap-2 py-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" style={{ color: '#1E5BFF' }}>{icon}</svg>
                  <span className="text-xs capitalize flex-1" style={{ color: '#475569' }}>{d}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c}</span>
                  <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>({pct}%)</span>
                </div>
              )
            })}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#94a3b8' }}>Browsers</p>
            {Object.keys(analytics?.browsers ?? {}).length === 0 ? (
              <p className="text-xs" style={{ color: '#cbd5e1' }}>—</p>
            ) : Object.entries(analytics?.browsers ?? {}).sort(([,a],[,b]) => b - a).map(([b, c]) => {
              const total = Object.values(analytics?.browsers ?? {}).reduce((s, v) => s + v, 0) || 1
              const pct = Math.round((c / total) * 100)
              return (
                <div key={b} className="flex items-center gap-2 py-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" style={{ color: '#1E5BFF' }}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" /></svg>
                  <span className="text-xs flex-1" style={{ color: '#475569' }}>{b}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c}</span>
                  <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>

    <SearchConsoleCard domain={openWebsite} period={period} />

  </div>)
}


/* ─── Search Console data card ──────────────────────────────── */

interface GscRow { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }
interface GscResponse { connected: boolean; rows: GscRow[]; summary: { clicks: number; impressions: number } | null; error?: string; needsReconnect?: boolean }

async function startGscReconnect(domain: string) {
  const res = await fetch(`/api/integrations/gsc/connect?domain=${encodeURIComponent(domain)}`)
  const data = await res.json()
  if (res.ok && data.url) window.location.href = data.url
}

function SearchConsoleCard({ domain, period }: { domain: string; period: string }) {
  const [data, setData] = useState<GscResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/analytics/search?website=${encodeURIComponent(domain)}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [domain, period])

  function Header({ rightSlot }: { rightSlot?: React.ReactNode }) {
    return (
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#eff6ff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white">
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <h3 className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>Search Console</h3>
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>
    )
  }

  function Container({ children }: { children: React.ReactNode }) {
    return <div className="mt-5 rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>{children}</div>
  }

  if (loading) {
    return (
      <Container>
        <Header />
        <div className="p-8 text-center text-xs" style={{ color: '#94a3b8' }}>Loading search data…</div>
      </Container>
    )
  }

  if (!data?.connected) {
    return (
      <Container>
        <Header />
        <div className="p-5 flex items-center gap-3">
          <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs" style={{ color: '#64748b' }}>
            See how people find this site from Google search. <span style={{ color: '#475569', fontWeight: 500 }}>Connect in the Integrations section below</span>.
          </p>
        </div>
      </Container>
    )
  }

  if (data.needsReconnect) {
    return (
      <Container>
        <Header rightSlot={<span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>Reconnect needed</span>} />
        <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs" style={{ color: '#64748b' }}>
            Google revoked Webcore&apos;s access to Search Console for this site (token expired or permission removed).
            Reconnect to restore search analytics.
          </p>
          <button type="button" onClick={() => startGscReconnect(domain)}
            className="text-[11px] font-medium px-3 py-1.5 rounded-md text-white transition-opacity hover:opacity-90 flex-shrink-0"
            style={{ background: 'var(--primary)' }}>
            Reconnect Search Console
          </button>
        </div>
      </Container>
    )
  }

  if (data.error === 'property_not_selected' || data.error === 'no_refresh_token') {
    const msg = data.error === 'property_not_selected'
      ? "Connected, but we couldn't find a matching GSC property automatically. Reconnect to retry, or manual picker is coming soon."
      : 'The refresh token is missing. Please reconnect Search Console.'
    return (
      <Container>
        <Header rightSlot={<span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>Setup needed</span>} />
        <div className="p-5 text-xs" style={{ color: '#64748b' }}>{msg}</div>
      </Container>
    )
  }

  if (data.error) {
    return (
      <Container>
        <Header rightSlot={<span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>Error</span>} />
        <div className="p-5 text-xs" style={{ color: '#b91c1c' }}>{data.error}</div>
      </Container>
    )
  }

  const rows = data.rows ?? []
  const totalClicks = data.summary?.clicks ?? 0
  const totalImpressions = data.summary?.impressions ?? 0
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  // Weighted average position by impressions
  const weightedPosSum = rows.reduce((s, r) => s + r.position * r.impressions, 0)
  const avgPosition = totalImpressions > 0 ? weightedPosSum / totalImpressions : 0

  const topQueries = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, 10)
  const maxImpr = topQueries.reduce((m, r) => Math.max(m, r.impressions), 0) || 1

  if (rows.length === 0) {
    return (
      <Container>
        <Header rightSlot={<span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#15803d' }}>Connected</span>} />
        <div className="p-8 text-center text-xs" style={{ color: '#94a3b8' }}>No search data in this period yet. Google usually takes 1–2 days to show fresh data.</div>
      </Container>
    )
  }

  return (
    <Container>
      <Header rightSlot={<span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#15803d' }}>Connected</span>} />
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b" style={{ borderColor: '#f1f5f9' }}>
        <GscStat label="Clicks" value={totalClicks.toLocaleString()} color="#2979d6" />
        <GscStat label="Impressions" value={totalImpressions.toLocaleString()} color="#1E5BFF" />
        <GscStat label="CTR" value={`${overallCtr.toFixed(1)}%`} color="#16a34a" />
        <GscStat label="Avg position" value={avgPosition.toFixed(1)} color="#f59e0b" />
      </div>
      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#94a3b8' }}>Top search queries</p>
        {topQueries.map((r, i) => {
          const q = r.keys?.[0] ?? '(unknown)'
          const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0
          return (
            <div key={i} className="flex items-center gap-2.5 py-2" style={{ borderBottom: i < topQueries.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <span className="w-5 flex-shrink-0 text-center">
                {i < 3 ? <span className="text-xs">{['🥇','🥈','🥉'][i]}</span> : <span className="text-[10px] font-semibold" style={{ color: '#cbd5e1' }}>#{i + 1}</span>}
              </span>
              <span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{q}</span>
              <div className="w-16 flex-shrink-0 hidden sm:block">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(r.impressions / maxImpr) * 100}%`, background: i < 3 ? ['#f59e0b','#94a3b8','#ea580c'][i] : '#2979d6' }} />
                </div>
              </div>
              <span className="text-[11px] font-medium tabular-nums w-14 text-right flex-shrink-0" style={{ color: '#64748b' }}>{r.impressions.toLocaleString()} impr</span>
              <span className="text-[11px] font-semibold tabular-nums w-12 text-right flex-shrink-0" style={{ color: 'var(--foreground)' }}>{r.clicks} clk</span>
              <span className="text-[11px] tabular-nums w-14 text-right flex-shrink-0 hidden sm:inline" style={{ color: '#94a3b8' }}>{ctr.toFixed(1)}%</span>
              <span className="text-[11px] tabular-nums w-10 text-right flex-shrink-0 hidden md:inline" style={{ color: '#94a3b8' }}>#{r.position.toFixed(0)}</span>
            </div>
          )
        })}
      </div>
    </Container>
  )
}


function GscStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}

