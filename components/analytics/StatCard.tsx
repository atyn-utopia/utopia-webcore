'use client'

import Tooltip from './Tooltip'

export default function StatCard({ label, value, icon, color, hint, today, yesterday, trend, series }: {
  label: string; value: number; icon: React.ReactNode; color: string; hint?: string
  today?: number; yesterday?: number; trend?: 'up' | 'down' | 'flat'
  /** Optional time-series of values for a Wix-style sparkline under the big number. */
  series?: number[]
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
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-slate-900 mb-0">{value.toLocaleString()}</p>
        {series && series.length > 1 && <Sparkline values={series} color={color} />}
      </div>
      {(today !== undefined || yesterday !== undefined) && (
        <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>
          {today !== undefined && <span>{today.toLocaleString()} today</span>}
          {today !== undefined && yesterday !== undefined && <span> · </span>}
          {yesterday !== undefined && <span>{yesterday.toLocaleString()} yesterday</span>}
        </p>
      )}
    </div>
  )
}

/** Tiny inline SVG sparkline. Area + stroke, fills the trailing space of the
 *  StatCard's big-number row. Wix uses a similar treatment on Analytics
 *  Highlights. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 84
  const height = 28
  const pad = 1
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = (width - pad * 2) / (values.length - 1)

  const points = values.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (height - pad * 2) * (1 - (v - min) / range)
    return [x, y] as const
  })
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${(width - pad).toFixed(2)},${(height - pad).toFixed(2)} L${pad},${(height - pad).toFixed(2)} Z`
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
