'use client'

import { useMemo, useState } from 'react'

interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }

type SeriesKey = 'pageviews' | 'clicks' | 'impressions'

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'pageviews', label: 'Pageviews', color: '#2979d6' },
  { key: 'clicks', label: 'Clicks', color: '#f59e0b' },
  { key: 'impressions', label: 'Impressions', color: '#1E5BFF' },
]

const WIDTH = 600
const HEIGHT = 200
const PAD = { top: 14, right: 16, bottom: 28, left: 36 }

export default function SimpleChart({ data }: { data: DailyStat[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())

  const totals = useMemo(() => ({
    pageviews: data.reduce((s, d) => s + d.pageviews, 0),
    clicks: data.reduce((s, d) => s + d.clicks, 0),
    impressions: data.reduce((s, d) => s + d.impressions, 0),
  }), [data])

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <ChartIcon />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Activity over time</h3>
        </div>
        <div className="h-40 flex items-center justify-center text-xs" style={{ color: '#94a3b8' }}>
          No activity in this period yet.
        </div>
      </div>
    )
  }

  const visibleSeries = SERIES.filter(s => !hidden.has(s.key))
  const maxVal = Math.max(1, ...data.flatMap(d => visibleSeries.map(s => d[s.key])))
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const step = data.length > 1 ? plotW / (data.length - 1) : 0

  function pointsFor(key: SeriesKey) {
    return data.map((d, i) => ({
      x: PAD.left + (data.length > 1 ? i * step : plotW / 2),
      y: PAD.top + plotH - (d[key] / maxVal) * plotH,
    }))
  }

  function pathFor(key: SeriesKey) {
    return pointsFor(key).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  }

  // Y-axis ticks
  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const v = (maxVal * (tickCount - i)) / tickCount
    return { value: Math.round(v), y: PAD.top + (plotH * i) / tickCount }
  })

  // X-axis labels — ~5 evenly spaced
  const xLabelStride = Math.max(1, Math.floor(data.length / 5))
  const xLabels = data.map((d, i) => i % xLabelStride === 0 || i === data.length - 1 ? i : null).filter((i): i is number => i !== null)

  function toggle(key: SeriesKey) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      if (next.size === SERIES.length) next.delete(key) // keep at least one visible
      return next
    })
  }

  const hoverPoint = hover !== null ? pointsFor('pageviews')[hover] : null
  const hoverPctLeft = hoverPoint ? (hoverPoint.x / WIDTH) * 100 : 0
  const flipTooltip = hoverPctLeft > 65

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-2.5">
          <ChartIcon />
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Activity over time</h3>
            <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>{data.length} day{data.length === 1 ? '' : 's'} of tracking events</p>
          </div>
        </div>
        {/* Legend. Click to toggle. All chips h-7 for consistency */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {SERIES.map(s => {
            const active = !hidden.has(s.key)
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background: active ? `${s.color}10` : '#f8fafc',
                  color: active ? s.color : '#cbd5e1',
                  border: `1px solid ${active ? `${s.color}30` : '#e2e8f0'}`,
                }}
                title={active ? `Hide ${s.label.toLowerCase()}` : `Show ${s.label.toLowerCase()}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: active ? s.color : '#cbd5e1' }} />
                {s.label}
                <span className="text-[10px] tabular-nums opacity-70">{totals[s.key].toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative flex-1 min-h-[180px]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full" preserveAspectRatio="none">
          {/* Y grid + tick labels */}
          {yTicks.map(t => (
            <g key={t.y}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={t.y} y2={t.y} stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{t.value.toLocaleString()}</text>
            </g>
          ))}

          {/* Areas */}
          {visibleSeries.map(s => {
            const pts = pointsFor(s.key)
            const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
            const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(2)},${PAD.top + plotH} L${pts[0].x.toFixed(2)},${PAD.top + plotH} Z`
            const gradId = `chart-fill-${s.key}`
            return (
              <g key={s.key}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#${gradId})`} />
              </g>
            )
          })}

          {/* Lines on top of areas */}
          {visibleSeries.map(s => (
            <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Hover dots */}
          {hover !== null && visibleSeries.map(s => {
            const p = pointsFor(s.key)[hover]
            return <circle key={`dot-${s.key}`} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          })}

          {/* Hit zones */}
          {data.map((d, i) => {
            const x = PAD.left + (data.length > 1 ? i * step : plotW / 2)
            return (
              <rect
                key={d.date}
                x={x - step / 2}
                y={PAD.top}
                width={Math.max(step, 8)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}

          {/* Hover guide line */}
          {hover !== null && (
            <line
              x1={pointsFor('pageviews')[hover].x}
              x2={pointsFor('pageviews')[hover].x}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* X-axis labels */}
          {xLabels.map(i => {
            const x = PAD.left + (data.length > 1 ? i * step : plotW / 2)
            return <text key={data[i].date} x={x} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{formatDay(data[i].date)}</text>
          })}
        </svg>

        {/* Tooltip */}
        {hoverPoint && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-md shadow-lg p-2.5 min-w-[140px]"
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              left: `${hoverPctLeft}%`,
              top: 8,
              transform: flipTooltip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>
              {formatFullDate(data[hover].date)}
            </p>
            {visibleSeries.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-3 py-0.5">
                <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#475569' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{data[hover][s.key].toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChartIcon() {
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
      <svg className="w-4 h-4" fill="none" stroke="#2979d6" viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
  )
}

function formatDay(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

function formatFullDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
