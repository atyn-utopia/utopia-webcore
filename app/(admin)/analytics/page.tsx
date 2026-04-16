'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

interface WebsiteStat { website: string; pageviews: number; clicks: number; impressions: number; sessions: number }
interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }
interface TopItem { path?: string; source?: string; label?: string; count: number }

interface Insight { icon: string; text: string; type: 'positive' | 'negative' | 'neutral' | 'warning' }
interface DayStats { pageviews: number; clicks: number; impressions: number; sessions: number }
interface AnalyticsData {
  summary: { pageviews: number; clicks: number; impressions: number; sessions: number }
  today: DayStats
  yesterday: DayStats
  insights: Insight[]
  websiteStats: WebsiteStat[]
  dailyStats: DailyStat[]
  topPages: TopItem[]
  topReferrers: TopItem[]
  topClicks: TopItem[]
  devices: Record<string, number>
  browsers: Record<string, number>
}

interface Company { id: string; name: string; company_websites: { domain: string }[] }

const MEDAL = ['🥇', '🥈', '🥉']

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[11px] font-medium text-white opacity-0 group-hover/tip:opacity-100 transition-opacity z-30 w-48 text-center leading-relaxed" style={{ background: '#1e293b' }}>
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4" style={{ borderTopColor: '#1e293b' }} />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, hint, today, yesterday, trend }: {
  label: string; value: number; icon: React.ReactNode; color: string; hint?: string
  today?: number; yesterday?: number; trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <span className="text-xs font-medium" style={{ color: '#64748b' }}>{label}</span>
          {hint && (
            <Tooltip text={hint}>
              <svg className="w-3.5 h-3.5 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Tooltip>
          )}
        </div>
        {trend && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${trend === 'up' ? 'text-green-600 bg-green-50' : trend === 'down' ? 'text-red-500 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value.toLocaleString()}</p>
      {(today !== undefined || yesterday !== undefined) && (
        <p className="text-[10px]" style={{ color: '#94a3b8' }}>
          {today !== undefined && <span>{today.toLocaleString()} today</span>}
          {today !== undefined && yesterday !== undefined && <span> · </span>}
          {yesterday !== undefined && <span>{yesterday.toLocaleString()} yesterday</span>}
        </p>
      )}
    </div>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full" style={{ background: '#f1f5f9' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-12 text-right" style={{ color: '#475569' }}>{value.toLocaleString()}</span>
    </div>
  )
}

const INSIGHT_STYLES: Record<string, { border: string; bg: string }> = {
  positive: { border: '#bbf7d0', bg: '#f0fdf4' },
  negative: { border: '#fecaca', bg: '#fef2f2' },
  warning: { border: '#fed7aa', bg: '#fffbeb' },
  neutral: { border: '#e2e8f0', bg: '#f8fafc' },
}

function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <div className="rounded-xl border bg-white p-5 mb-6" style={{ borderColor: '#e2e8f0' }}>
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f59e0b' }} strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Daily Insights</h3>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>Auto-generated</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const style = INSIGHT_STYLES[insight.type] ?? INSIGHT_STYLES.neutral
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: style.border, background: style.bg }}>
              <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
              <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>{insight.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SimpleChart({ data }: { data: DailyStat[] }) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.pageviews), 1)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Daily Pageviews</h3>
      <div className="flex items-end gap-1 h-32">
        {data.map(d => {
          const h = Math.max((d.pageviews / maxVal) * 100, 2)
          return (
            <div key={d.date} className="flex-1 group relative flex flex-col items-center justify-end">
              <div className="w-full rounded-t transition-all" style={{ height: `${h}%`, background: 'var(--primary)', minHeight: '2px', opacity: 0.8 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'} />
              <div className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 rounded text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background: '#1e293b' }}>
                {d.date.slice(5)}: {d.pageviews} views
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[10px]" style={{ color: '#94a3b8' }}>{data[0]?.date.slice(5)}</span>
        <span className="text-[10px]" style={{ color: '#94a3b8' }}>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''
  const openWebsite = searchParams.get('website') ?? ''

  const [companies, setCompanies] = useState<Company[]>([])
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(d => { if (Array.isArray(d)) setCompanies(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ period })
    if (openWebsite) params.set('website', openWebsite)
    fetch(`/api/analytics?${params}`).then(r => r.json()).then(d => {
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [period, openWebsite])

  const periods = [
    { value: '7d' as const, label: '7 days' },
    { value: '30d' as const, label: '30 days' },
    { value: '90d' as const, label: '90 days' },
  ]

  // Company overview — group websiteStats by company
  if (!openCompany && !openWebsite) {
    const companyPerf = companies.map(c => {
      const domains = new Set(c.company_websites.map(w => w.domain))
      const stats = (data?.websiteStats ?? []).filter(s => domains.has(s.website))
      return {
        ...c,
        pageviews: stats.reduce((s, w) => s + w.pageviews, 0),
        clicks: stats.reduce((s, w) => s + w.clicks, 0),
        sessions: stats.reduce((s, w) => s + w.sessions, 0),
        websiteCount: stats.length,
      }
    }).sort((a, b) => b.pageviews - a.pageviews)

    const maxPv = Math.max(...companyPerf.map(c => c.pageviews), 1)

    return (
      <div>
        <PageHeader
          title="Analytics"
          description="Website traffic and engagement across all companies"
          actions={
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#cbd5e1' }}>
              {periods.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className="px-3 h-9 text-xs font-medium transition-colors"
                  style={{ background: period === p.value ? 'var(--primary)' : 'white', color: period === p.value ? 'white' : '#64748b', borderLeft: p.value !== '7d' ? '1px solid #cbd5e1' : undefined }}>
                  {p.label}
                </button>
              ))}
            </div>
          }
        />

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Pageviews" value={data.summary.pageviews} color="#2979d6" hint="Total number of pages viewed across all websites"
              today={data.today.pageviews} yesterday={data.yesterday.pageviews}
              trend={data.today.pageviews > data.yesterday.pageviews ? 'up' : data.today.pageviews < data.yesterday.pageviews ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
            <StatCard label="Sessions" value={data.summary.sessions} color="#16a34a" hint="Unique visitor sessions (one session per browser tab)"
              today={data.today.sessions} yesterday={data.yesterday.sessions}
              trend={data.today.sessions > data.yesterday.sessions ? 'up' : data.today.sessions < data.yesterday.sessions ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <StatCard label="Clicks" value={data.summary.clicks} color="#f59e0b" hint="Button clicks tracked by your websites (e.g. WhatsApp, Call)"
              today={data.today.clicks} yesterday={data.yesterday.clicks}
              trend={data.today.clicks > data.yesterday.clicks ? 'up' : data.today.clicks < data.yesterday.clicks ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>} />
            <StatCard label="Impressions" value={data.summary.impressions} color="#7c3aed" hint="Product or content views tracked by your websites"
              today={data.today.impressions} yesterday={data.yesterday.impressions}
              trend={data.today.impressions > data.yesterday.impressions ? 'up' : data.today.impressions < data.yesterday.impressions ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          </div>
        )}

        {/* Chart + Insights side by side on large screens */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="lg:col-span-2"><SimpleChart data={data.dailyStats} /></div>
            <InsightsPanel insights={data.insights} />
          </div>
        )}

        {/* Company performance ranking */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Company Performance</h2>
          <Tooltip text="Companies ranked by total pageviews. Click to see individual website performance.">
            <svg className="w-3.5 h-3.5 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Tooltip>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {companyPerf.map((c, i) => {
              const isTop3 = i < 3 && c.pageviews > 0
              return (
                <Link key={c.id} href={`/analytics?company=${encodeURIComponent(c.name)}`}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fafc] transition-colors"
                  style={{
                    borderBottom: i < companyPerf.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: isTop3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fdf4ef') : undefined,
                  }}>
                  <div className="w-10 text-center flex-shrink-0">
                    {isTop3 ? (
                      <span className="text-xl">{MEDAL[i]}</span>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: '#94a3b8' }}>#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                      {isTop3 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                          background: i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : '#fed7aa',
                          color: i === 0 ? '#92400e' : i === 1 ? '#475569' : '#9a3412',
                        }}>
                          {i === 0 ? 'Top Performer' : i === 1 ? '2nd Place' : '3rd Place'}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1">
                      <Tooltip text="Total websites with traffic in this period">
                        <span className="text-xs cursor-help" style={{ color: '#64748b' }}>{c.websiteCount} site{c.websiteCount !== 1 ? 's' : ''}</span>
                      </Tooltip>
                      <Tooltip text="Unique visitor sessions">
                        <span className="text-xs cursor-help" style={{ color: '#64748b' }}>{c.sessions.toLocaleString()} sessions</span>
                      </Tooltip>
                      <Tooltip text="WhatsApp, call, and other button clicks">
                        <span className="text-xs cursor-help" style={{ color: '#64748b' }}>{c.clicks.toLocaleString()} clicks</span>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="w-48 flex-shrink-0">
                    <Tooltip text={`${c.pageviews.toLocaleString()} pageviews`}>
                      <div className="w-full"><MiniBar value={c.pageviews} max={maxPv} color={isTop3 ? (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#ea580c') : 'var(--primary)'} /></div>
                    </Tooltip>
                  </div>
                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
            {companyPerf.length === 0 && (
              <div className="p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#e2e8f0' }} strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>No analytics data yet</p>
                <p className="text-xs mt-1" style={{ color: '#cbd5e1' }}>Add the tracking script to your websites to start collecting data</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Company website ranking
  if (openCompany && !openWebsite) {
    const companyDomains = new Set(companies.find(c => c.name === openCompany)?.company_websites.map(w => w.domain) ?? [])
    const websitePerf = (data?.websiteStats ?? [])
      .filter(s => companyDomains.has(s.website))
      .sort((a, b) => b.pageviews - a.pageviews)
    const maxPv = Math.max(...websitePerf.map(w => w.pageviews), 1)

    return (
      <div>
        <PageHeader
          title={openCompany}
          description="Website performance comparison"
          actions={
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#cbd5e1' }}>
              {periods.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className="px-3 h-9 text-xs font-medium transition-colors"
                  style={{ background: period === p.value ? 'var(--primary)' : 'white', color: period === p.value ? 'white' : '#64748b', borderLeft: p.value !== '7d' ? '1px solid #cbd5e1' : undefined }}>
                  {p.label}
                </button>
              ))}
            </div>
          }
        />

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="lg:col-span-2"><SimpleChart data={data.dailyStats} /></div>
            <InsightsPanel insights={data.insights} />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Website Ranking</h2>
          <Tooltip text="Websites ranked by pageviews. Click to see detailed analytics for each website.">
            <svg className="w-3.5 h-3.5 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Tooltip>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {websitePerf.map((w, i) => {
              const isTop3 = i < 3 && w.pageviews > 0
              return (
              <Link key={w.website} href={`/analytics?website=${encodeURIComponent(w.website)}`}
                className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fafc] transition-colors"
                style={{
                  borderBottom: i < websitePerf.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: isTop3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fdf4ef') : undefined,
                }}>
                <div className="w-10 text-center flex-shrink-0">
                  {isTop3 ? <span className="text-xl">{MEDAL[i]}</span> : <span className="text-sm font-bold" style={{ color: '#94a3b8' }}>#{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{w.website}</p>
                  <div className="flex gap-4 mt-1">
                    <Tooltip text="Unique visitor sessions"><span className="text-xs cursor-help" style={{ color: '#64748b' }}>{w.sessions.toLocaleString()} sessions</span></Tooltip>
                    <Tooltip text="Button clicks (WhatsApp, Call, etc.)"><span className="text-xs cursor-help" style={{ color: '#f59e0b' }}>{w.clicks.toLocaleString()} clicks</span></Tooltip>
                    <Tooltip text="Product or content views"><span className="text-xs cursor-help" style={{ color: '#7c3aed' }}>{w.impressions.toLocaleString()} impressions</span></Tooltip>
                  </div>
                </div>
                <div className="w-48 flex-shrink-0">
                  <Tooltip text={`${w.pageviews.toLocaleString()} pageviews`}>
                    <div className="w-full"><MiniBar value={w.pageviews} max={maxPv} color={isTop3 ? (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#ea580c') : 'var(--primary)'} /></div>
                  </Tooltip>
                </div>
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              )
            })}
            {websitePerf.length === 0 && (
              <p className="p-8 text-center text-sm" style={{ color: '#94a3b8' }}>No data for this company yet.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Single website detail
  return (
    <div>
      <PageHeader
        title={openWebsite}
        description={`Detailed analytics for the last ${period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}`}
        actions={
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#cbd5e1' }}>
            {periods.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className="px-3 h-9 text-xs font-medium transition-colors"
                style={{ background: period === p.value ? 'var(--primary)' : 'white', color: period === p.value ? 'white' : '#64748b', borderLeft: p.value !== '7d' ? '1px solid #cbd5e1' : undefined }}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : !data ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>No data available.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Pageviews" value={data.summary.pageviews} color="#2979d6" hint="Total pages viewed on this website"
              today={data.today.pageviews} yesterday={data.yesterday.pageviews}
              trend={data.today.pageviews > data.yesterday.pageviews ? 'up' : data.today.pageviews < data.yesterday.pageviews ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
            <StatCard label="Sessions" value={data.summary.sessions} color="#16a34a" hint="Unique visitor sessions on this website"
              today={data.today.sessions} yesterday={data.yesterday.sessions}
              trend={data.today.sessions > data.yesterday.sessions ? 'up' : data.today.sessions < data.yesterday.sessions ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <StatCard label="Clicks" value={data.summary.clicks} color="#f59e0b" hint="WhatsApp, call, and other tracked button clicks"
              today={data.today.clicks} yesterday={data.yesterday.clicks}
              trend={data.today.clicks > data.yesterday.clicks ? 'up' : data.today.clicks < data.yesterday.clicks ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>} />
            <StatCard label="Impressions" value={data.summary.impressions} color="#7c3aed" hint="Product or content impression events"
              today={data.today.impressions} yesterday={data.yesterday.impressions}
              trend={data.today.impressions > data.yesterday.impressions ? 'up' : data.today.impressions < data.yesterday.impressions ? 'down' : 'flat'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          </div>

          {/* Chart + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="lg:col-span-2"><SimpleChart data={data.dailyStats} /></div>
            <InsightsPanel insights={data.insights} />
          </div>

          {/* Detailed breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top pages */}
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Top Pages</h3>
              {data.topPages.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No data</p>
              ) : data.topPages.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < data.topPages.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span className="text-xs font-mono truncate flex-1" style={{ color: '#475569' }}>{p.path}</span>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{p.count}</span>
                </div>
              ))}
            </div>

            {/* Top referrers */}
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Top Referrers</h3>
              {data.topReferrers.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No referrer data</p>
              ) : data.topReferrers.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < data.topReferrers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{r.source}</span>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{r.count}</span>
                </div>
              ))}
            </div>

            {/* Top clicks */}
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Top Clicks</h3>
              {data.topClicks.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No click data</p>
              ) : data.topClicks.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < data.topClicks.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{c.label}</span>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{c.count}</span>
                </div>
              ))}
            </div>

            {/* Devices + Browsers */}
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Devices & Browsers</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Devices</p>
                  {Object.entries(data.devices).sort(([, a], [, b]) => b - a).map(([device, count]) => (
                    <div key={device} className="flex items-center justify-between py-1">
                      <span className="text-xs capitalize" style={{ color: '#475569' }}>{device}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{count}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Browsers</p>
                  {Object.entries(data.browsers).sort(([, a], [, b]) => b - a).map(([browser, count]) => (
                    <div key={browser} className="flex items-center justify-between py-1">
                      <span className="text-xs" style={{ color: '#475569' }}>{browser}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
