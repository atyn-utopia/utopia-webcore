'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

interface WebsiteStat { website: string; pageviews: number; clicks: number; impressions: number; sessions: number }
interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }
interface TopItem { path?: string; source?: string; label?: string; count: number }

interface AnalyticsData {
  summary: { pageviews: number; clicks: number; impressions: number; sessions: number }
  websiteStats: WebsiteStat[]
  dailyStats: DailyStat[]
  topPages: TopItem[]
  topReferrers: TopItem[]
  topClicks: TopItem[]
  devices: Record<string, number>
  browsers: Record<string, number>
}

interface Company { id: string; name: string; company_websites: { domain: string }[] }

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
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
            <StatCard label="Pageviews" value={data.summary.pageviews} color="#2979d6"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
            <StatCard label="Sessions" value={data.summary.sessions} color="#16a34a"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <StatCard label="Clicks" value={data.summary.clicks} color="#f59e0b"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>} />
            <StatCard label="Impressions" value={data.summary.impressions} color="#7c3aed"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          </div>
        )}

        {/* Chart */}
        {data && <div className="mb-6"><SimpleChart data={data.dailyStats} /></div>}

        {/* Company performance ranking */}
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Company Performance</h2>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {companyPerf.map((c, i) => (
              <Link key={c.id} href={`/analytics?company=${encodeURIComponent(c.name)}`}
                className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < companyPerf.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 text-center">
                  <span className="text-lg font-bold" style={{ color: i < 3 ? 'var(--primary)' : '#94a3b8' }}>#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs" style={{ color: '#64748b' }}>{c.websiteCount} site{c.websiteCount !== 1 ? 's' : ''}</span>
                    <span className="text-xs" style={{ color: '#64748b' }}>{c.sessions.toLocaleString()} sessions</span>
                    <span className="text-xs" style={{ color: '#64748b' }}>{c.clicks.toLocaleString()} clicks</span>
                  </div>
                </div>
                <div className="w-48 flex-shrink-0">
                  <MiniBar value={c.pageviews} max={maxPv} color="var(--primary)" />
                </div>
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
            {companyPerf.length === 0 && (
              <p className="p-8 text-center text-sm" style={{ color: '#94a3b8' }}>No analytics data yet. Add the tracking script to your websites.</p>
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

        {data && <div className="mb-6"><SimpleChart data={data.dailyStats} /></div>}

        <h2 className="text-sm font-semibold text-slate-700 mb-3">Website Ranking</h2>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {websitePerf.map((w, i) => (
              <Link key={w.website} href={`/analytics?website=${encodeURIComponent(w.website)}`}
                className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < websitePerf.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 text-center">
                  <span className="text-lg font-bold" style={{ color: i < 3 ? 'var(--primary)' : '#94a3b8' }}>#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{w.website}</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs" style={{ color: '#64748b' }}>{w.sessions.toLocaleString()} sessions</span>
                    <span className="text-xs" style={{ color: '#f59e0b' }}>{w.clicks.toLocaleString()} clicks</span>
                    <span className="text-xs" style={{ color: '#7c3aed' }}>{w.impressions.toLocaleString()} impressions</span>
                  </div>
                </div>
                <div className="w-48 flex-shrink-0">
                  <MiniBar value={w.pageviews} max={maxPv} color="var(--primary)" />
                </div>
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
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
            <StatCard label="Pageviews" value={data.summary.pageviews} color="#2979d6"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
            <StatCard label="Sessions" value={data.summary.sessions} color="#16a34a"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <StatCard label="Clicks" value={data.summary.clicks} color="#f59e0b"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>} />
            <StatCard label="Impressions" value={data.summary.impressions} color="#7c3aed"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          </div>

          {/* Chart */}
          <div className="mb-6"><SimpleChart data={data.dailyStats} /></div>

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
