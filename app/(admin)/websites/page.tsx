'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useLanguage } from '@/contexts/LanguageContext'
import PageHeader from '@/components/PageHeader'
import ViewToggle, { type ViewMode } from '@/components/ViewToggle'
import AddWebsiteModal from '@/components/AddWebsiteModal'
import StatCard from '@/components/analytics/StatCard'
import SimpleChart from '@/components/analytics/SimpleChart'
import InsightsPanel from '@/components/analytics/InsightsPanel'
import MiniBar from '@/components/analytics/MiniBar'
import Tooltip from '@/components/analytics/Tooltip'

interface WebsiteSummary { domain: string; company_id: string | null; company_name: string | null; leads_mode: string | null; phone_count: number; active_phone_count: number; blog_count: number; published_blog_count: number }
interface CompanyInfo { id: string; name: string; company_websites: { domain: string }[] }
interface WebsiteStat { website: string; pageviews: number; clicks: number; impressions: number; sessions: number }
interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }
interface Insight { icon: string; text: string; type: 'positive' | 'negative' | 'neutral' | 'warning' }
interface DayStats { pageviews: number; clicks: number; impressions: number; sessions: number }
interface AnalyticsData { summary: { pageviews: number; clicks: number; impressions: number; sessions: number }; today: DayStats; yesterday: DayStats; insights: Insight[]; websiteStats: WebsiteStat[]; dailyStats: DailyStat[]; topPages: { path: string; count: number }[]; topReferrers: { source: string; count: number }[]; topClicks: { label: string; count: number }[]; devices: Record<string, number>; browsers: Record<string, number> }
interface RecentPost { id: string; website: string; title: string; status: string; updated_at: string; slug: string }
interface RecentPhone { id: string; website: string; phone_number: string; label: string | null; type: string }

const LEADS_MODE: Record<string, { label: string; color: string; bg: string }> = { single: { label: 'Single', color: '#475569', bg: '#f1f5f9' }, rotation: { label: 'Rotation', color: '#0369a1', bg: '#e0f2fe' }, location: { label: 'Location', color: '#7c3aed', bg: '#ede9fe' }, hybrid: { label: 'Hybrid', color: '#b45309', bg: '#fef3c7' } }
const MEDAL = ['🥇', '🥈', '🥉']
const ICON = {
  eye: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  users: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  click: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>,
  image: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
}

function tr(today: number, yesterday: number): 'up' | 'down' | 'flat' { return today > yesterday ? 'up' : today < yesterday ? 'down' : 'flat' }
function formatDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) }
function PeriodSelector({ value, onChange }: { value: string; onChange: (v: '7d' | '30d' | '90d') => void }) {
  return (<div className="flex items-center rounded-lg border overflow-hidden h-9" style={{ borderColor: '#cbd5e1' }}>{[{ v: '7d' as const, l: '7d' }, { v: '30d' as const, l: '30d' }, { v: '90d' as const, l: '90d' }].map((p, i) => (<button key={p.v} onClick={() => onChange(p.v)} className="px-3 h-full text-xs font-medium transition-colors" style={{ background: value === p.v ? 'var(--primary)' : 'white', color: value === p.v ? 'white' : '#64748b', borderLeft: i > 0 ? '1px solid #cbd5e1' : undefined }}>{p.l}</button>))}</div>)
}

export default function WebsitesPage() {
  const { role } = useUser()
  const { t } = useLanguage()
  const isWriter = role === 'writer'
  const canAddWebsite = role === 'admin' || role === 'designer'
  const [addOpen, setAddOpen] = useState(false)

  function refreshSites() {
    Promise.all([fetch('/api/websites').then(r => r.json()), fetch('/api/companies').then(r => r.json())]).then(([s, c]) => { if (Array.isArray(s)) setSites(s); if (Array.isArray(c)) setCompanies(c) }).catch(() => {})
  }
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''
  const openWebsite = searchParams.get('website') ?? ''

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
    const { summary: s, today: t, yesterday: y } = analytics
    return (<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <StatCard label="Pageviews" value={s.pageviews} color="#2979d6" hint="Total pages viewed" icon={ICON.eye} today={t.pageviews} yesterday={y.pageviews} trend={tr(t.pageviews, y.pageviews)} />
      <StatCard label="Sessions" value={s.sessions} color="#16a34a" hint="Unique visitor sessions" icon={ICON.users} today={t.sessions} yesterday={y.sessions} trend={tr(t.sessions, y.sessions)} />
      <StatCard label="Clicks" value={s.clicks} color="#f59e0b" hint="Button clicks (WhatsApp, Call)" icon={ICON.click} today={t.clicks} yesterday={y.clicks} trend={tr(t.clicks, y.clicks)} />
      <StatCard label="Impressions" value={s.impressions} color="#7c3aed" hint="Product/content views" icon={ICON.image} today={t.impressions} yesterday={y.impressions} trend={tr(t.impressions, y.impressions)} />
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
      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder ?? 'Search…'} className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }} />
      {search && (<button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}
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
        {canAddWebsite && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Website
          </button>
        )}
        <PeriodSelector value={period} onChange={setPeriod} />
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </>} />
      <AddWebsiteModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refreshSites} />
      <Stats />
      <Chart />
      <SearchBar placeholder="Search companies…" />
      <div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-semibold text-slate-700">Company Performance</h2><Tooltip text="Companies ranked by pageviews. Click to view websites."><svg className="w-3.5 h-3.5 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></Tooltip></div>
      {loading ? <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div> : viewMode === 'list' ? (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((c, i) => { const isTop3 = i < 3 && c.pageviews > 0; return (
            <Link key={c.id} href={`/websites?company=${encodeURIComponent(c.name)}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', background: isTop3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fdf4ef') : undefined }}>
              <div className="w-10 text-center flex-shrink-0">{isTop3 ? <span className="text-xl">{MEDAL[i]}</span> : <span className="text-sm font-bold" style={{ color: '#94a3b8' }}>#{i + 1}</span>}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p><div className="flex gap-3 mt-1 text-xs" style={{ color: '#64748b' }}><span>{c.site_count} sites</span><span>{c.sessions.toLocaleString()} sessions</span><span>{c.clicks.toLocaleString()} clicks</span></div></div>
              <div className="w-40 flex-shrink-0"><MiniBar value={c.pageviews} max={maxPv} color={isTop3 ? (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#ea580c') : 'var(--primary)'} /></div>
              <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>) })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => { const isTop3 = i < 3 && c.pageviews > 0; return (
            <Link key={c.id} href={`/websites?company=${encodeURIComponent(c.name)}`} className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0', background: isTop3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fdf4ef') : undefined }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>{isTop3 ? <span className="text-lg">{MEDAL[i]}</span> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}</div>
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
    const companySites = filteredSites.filter(s => companyDomains.has(s.domain))

    return (<div>
      <PageHeader title={openCompany} description={`${companySites.length} website${companySites.length !== 1 ? 's' : ''}`} actions={<>
        {canAddWebsite && currentCompany && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Website
          </button>
        )}
        <PeriodSelector value={period} onChange={setPeriod} />
      </>} />
      {currentCompany && <AddWebsiteModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refreshSites} presetCompany={{ id: currentCompany.id, name: currentCompany.name }} />}
      <Stats />
      <Chart />
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Websites</h2>
      {loading ? <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div> : companySites.length === 0 ? <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>No websites found.</div> : (
        <div className="rounded-xl border overflow-hidden bg-white mb-6" style={{ borderColor: '#e2e8f0' }}>
          <div className="overflow-x-auto" style={{ maxHeight: '60vh' }}><table className="w-full text-sm min-w-[800px]"><thead><tr className="sticky top-0 z-10" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Website</th>
            {!isWriter && <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Leads Mode</th>}
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Views</th>
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Sessions</th>
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Clicks</th>
            {!isWriter && <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Phones</th>}
            {!isWriter && <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Active</th>}
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Blog</th>
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-left" style={{ color: '#94a3b8' }}>Published</th>
            <th className="px-4 py-3 text-[10px] sm:text-xs font-medium whitespace-nowrap text-center" style={{ color: '#94a3b8' }}></th>
          </tr></thead><tbody>
            {companySites.map((site, i) => { const ws = (analytics?.websiteStats ?? []).find(w => w.website === site.domain); const lm = site.leads_mode && LEADS_MODE[site.leads_mode] ? LEADS_MODE[site.leads_mode] : null; return (
              <tr key={site.domain} className="hover:bg-[#f8fafc] transition-colors relative hover:z-20" style={{ borderBottom: i < companySites.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <td className="px-4 py-3.5"><Link href={`/websites?website=${encodeURIComponent(site.domain)}&company=${encodeURIComponent(openCompany)}`} className="text-sm font-medium hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</Link></td>
                {!isWriter && <td className="px-4 py-3.5">{lm ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: lm.bg, color: lm.color }}>{lm.label}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>}
                <td className="px-4 py-3.5"><span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{ws?.pageviews.toLocaleString() ?? '0'}</span></td>
                <td className="px-4 py-3.5"><span className="text-xs" style={{ color: '#64748b' }}>{ws?.sessions.toLocaleString() ?? '0'}</span></td>
                <td className="px-4 py-3.5"><span className="text-xs" style={{ color: '#f59e0b' }}>{ws?.clicks.toLocaleString() ?? '0'}</span></td>
                {!isWriter && <td className="px-4 py-3.5"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.phone_count}</span></td>}
                {!isWriter && <td className="px-4 py-3.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.active_phone_count > 0 ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.active_phone_count}</span></td>}
                <td className="px-4 py-3.5"><span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{site.blog_count}</span></td>
                <td className="px-4 py-3.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={site.published_blog_count > 0 ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#94a3b8' }}>{site.published_blog_count}</span></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 justify-center">
                    <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="group/tip relative w-7 h-7 flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Open website">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    {!isWriter && <Link href={`/phone-numbers?website=${encodeURIComponent(site.domain)}`} className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Phone numbers">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </Link>}
                    <Link href={`/blog?website=${encodeURIComponent(site.domain)}`} className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Blog posts">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </Link>
                  </div>
                </td>
              </tr>) })}
          </tbody></table></div>
        </div>
      )}
      <RecentActivity companyFilter={openCompany} />
    </div>)
  }

  // ═══ LEVEL 3: Website detail ═══
  const siteInfo = sites.find(s => s.domain === openWebsite)
  return (<div>
    <PageHeader title={openWebsite} description={`Detailed overview · last ${period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}`} actions={<PeriodSelector value={period} onChange={setPeriod} />} />
    <Stats />
    <Chart />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}><h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Top Pages</h3>{(analytics?.topPages ?? []).length === 0 ? <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No data</p> : (analytics?.topPages ?? []).map((p, i) => (<div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < (analytics?.topPages ?? []).length - 1 ? '1px solid #f1f5f9' : 'none' }}><span className="text-xs font-mono truncate flex-1" style={{ color: '#475569' }}>{p.path}</span><span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{p.count}</span></div>))}</div>
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}><h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Top Referrers</h3>{(analytics?.topReferrers ?? []).length === 0 ? <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No referrer data</p> : (analytics?.topReferrers ?? []).map((r, i) => (<div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < (analytics?.topReferrers ?? []).length - 1 ? '1px solid #f1f5f9' : 'none' }}><span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{r.source}</span><span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{r.count}</span></div>))}</div>
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}><h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Top Clicks</h3>{(analytics?.topClicks ?? []).length === 0 ? <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No click data</p> : (analytics?.topClicks ?? []).map((c, i) => (<div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < (analytics?.topClicks ?? []).length - 1 ? '1px solid #f1f5f9' : 'none' }}><span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{c.label}</span><span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{c.count}</span></div>))}</div>
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}><h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Devices & Browsers</h3>
        <div className="space-y-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Devices</p>{Object.entries(analytics?.devices ?? {}).sort(([,a],[,b]) => b - a).map(([d, c]) => (<div key={d} className="flex items-center justify-between py-1"><span className="text-xs capitalize" style={{ color: '#475569' }}>{d}</span><span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c}</span></div>))}</div>
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}><p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Browsers</p>{Object.entries(analytics?.browsers ?? {}).sort(([,a],[,b]) => b - a).map(([b, c]) => (<div key={b} className="flex items-center justify-between py-1"><span className="text-xs" style={{ color: '#475569' }}>{b}</span><span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c}</span></div>))}</div></div>
      </div>
    </div>

    <RecentActivity />

    {siteInfo && !isWriter && (
      <div className="mt-5 rounded-xl border bg-white p-4 flex items-center justify-between" style={{ borderColor: '#e2e8f0' }}>
        <div><p className="text-xs font-medium" style={{ color: '#475569' }}>Phone Numbers</p><p className="text-[10px]" style={{ color: '#94a3b8' }}>{siteInfo.phone_count} total · {siteInfo.active_phone_count} active{siteInfo.leads_mode && LEADS_MODE[siteInfo.leads_mode] ? ` · ${LEADS_MODE[siteInfo.leads_mode].label} mode` : ''}</p></div>
        <Link href={`/phone-numbers/edit?website=${encodeURIComponent(openWebsite)}`} className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#e2e8f0] text-[#475569] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]">Manage</Link>
      </div>
    )}
  </div>)
}
