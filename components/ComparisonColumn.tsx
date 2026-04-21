'use client'

import { useEffect, useState } from 'react'
import SimpleChart from '@/components/analytics/SimpleChart'

interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }

interface AnalyticsData {
  summary: { pageviews: number; clicks: number; impressions: number; sessions: number }
  today: { pageviews: number; clicks: number; impressions: number; sessions: number }
  yesterday: { pageviews: number; clicks: number; impressions: number; sessions: number }
  websiteStats: { website: string; pageviews: number; clicks: number; impressions: number; sessions: number; trend: 'up' | 'down' | 'flat'; trend_pct: number }[]
  dailyStats: DailyStat[]
  topPages: { path: string; count: number }[]
  topClicks: { label: string; count: number }[]
}

interface GscResponse {
  connected: boolean
  rows: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[]
  summary: { clicks: number; impressions: number } | null
  error?: string
}

interface ComparisonColumnProps {
  domain: string
  period: string
  onRemove: () => void
  canRemove: boolean
}

function trend(today: number, yesterday: number): 'up' | 'down' | 'flat' {
  return today > yesterday ? 'up' : today < yesterday ? 'down' : 'flat'
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${dir === 'up' ? 'text-green-600 bg-green-50' : dir === 'down' ? 'text-red-500 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
      {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'}
    </span>
  )
}

const STAT_META = [
  { key: 'pageviews', label: 'Pageviews', color: '#2979d6' },
  { key: 'sessions', label: 'Sessions', color: '#16a34a' },
  { key: 'clicks', label: 'Clicks', color: '#f59e0b' },
  { key: 'impressions', label: 'Impressions', color: '#7c3aed' },
] as const

export default function ComparisonColumn({ domain, period, onRemove, canRemove }: ComparisonColumnProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [gsc, setGsc] = useState<GscResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/analytics?period=${period}&website=${encodeURIComponent(domain)}`).then(r => r.json()).catch(() => null),
      fetch(`/api/analytics/search?website=${encodeURIComponent(domain)}&period=${period}`).then(r => r.json()).catch(() => null),
    ]).then(([a, g]) => {
      if (cancelled) return
      if (a && a.summary) setAnalytics(a)
      if (g) setGsc(g)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [domain, period])

  return (
    <div className="flex flex-col rounded-xl bg-white overflow-hidden h-full" style={{ border: '1px solid #e2e8f0' }}>
      {/* Column header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid #e2e8f0', background: '#fafbfc' }}>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{domain}</h3>
          <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-light underline underline-offset-2 transition-colors hover:text-[var(--primary)]"
            style={{ color: '#94a3b8' }}>
            Visit
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${domain} from comparison`}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-red-50 hover:text-red-600"
            style={{ color: '#94a3b8' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-center py-6" style={{ color: '#94a3b8' }}>Loading…</p>
        ) : !analytics ? (
          <p className="text-xs text-center py-6" style={{ color: '#94a3b8' }}>No data available.</p>
        ) : (
          <>
            {/* Mini stat grid */}
            <div className="grid grid-cols-2 gap-2">
              {STAT_META.map(m => {
                const today = analytics.today[m.key]
                const yest = analytics.yesterday[m.key]
                return (
                  <div key={m.key} className="rounded-lg p-2.5" style={{ border: '1px solid #f1f5f9', background: '#fafbfc' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>{m.label}</span>
                      <TrendArrow dir={trend(today, yest)} />
                    </div>
                    <div className="text-lg font-bold tabular-nums" style={{ color: m.color }}>
                      {analytics.summary[m.key].toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chart */}
            {analytics.dailyStats.length > 0 && (
              <div>
                <SimpleChart data={analytics.dailyStats} />
              </div>
            )}

            {/* Top Pages (5) */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Top pages</p>
              {analytics.topPages.length === 0 ? (
                <p className="text-xs" style={{ color: '#cbd5e1' }}>—</p>
              ) : (
                <ul className="space-y-1.5">
                  {analytics.topPages.slice(0, 5).map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono truncate flex-1" style={{ color: '#475569' }}>{p.path}</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{p.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Top Clicks (5) */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Top clicks</p>
              {analytics.topClicks.length === 0 ? (
                <p className="text-xs" style={{ color: '#cbd5e1' }}>—</p>
              ) : (
                <ul className="space-y-1.5">
                  {analytics.topClicks.slice(0, 5).map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate flex-1" style={{ color: '#475569' }}>{c.label}</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{c.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* GSC Top Queries (5) — only if connected + data */}
            {gsc?.connected && gsc.rows.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Top search queries
                </p>
                <ul className="space-y-1.5">
                  {[...gsc.rows].sort((a, b) => b.impressions - a.impressions).slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate flex-1" style={{ color: '#475569' }}>{r.keys?.[0] ?? '(unknown)'}</span>
                      <span className="tabular-nums" style={{ color: '#94a3b8' }}>{r.impressions.toLocaleString()} impr</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{r.clicks}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
