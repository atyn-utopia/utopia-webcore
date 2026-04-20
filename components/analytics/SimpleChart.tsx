'use client'

import { useState } from 'react'

interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }

const WIDTH = 600
const HEIGHT = 160
const PAD = { top: 12, right: 12, bottom: 20, left: 12 }

export default function SimpleChart({ data }: { data: DailyStat[] }) {
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) return null

  const maxVal = Math.max(...data.map(d => d.pageviews), 1)
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const step = data.length > 1 ? plotW / (data.length - 1) : 0

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? i * step : plotW / 2),
    y: PAD.top + plotH - (d.pageviews / maxVal) * plotH,
    d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Daily Pageviews</h3>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#chart-fill)" />
          <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

          {points.map((p, i) => (
            <g key={p.d.date}>
              <circle cx={p.x} cy={p.y} r="3" fill="white" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <rect
                x={p.x - step / 2}
                y={PAD.top}
                width={Math.max(step, 8)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}

          {hover !== null && (
            <line
              x1={points[hover].x}
              x2={points[hover].x}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute px-2 py-1 rounded text-[10px] font-medium text-white whitespace-nowrap z-10 -translate-x-1/2 -translate-y-full"
            style={{
              background: '#1e293b',
              left: `${(points[hover].x / WIDTH) * 100}%`,
              top: `${(points[hover].y / HEIGHT) * 100}%`,
              marginTop: -6,
            }}
          >
            {points[hover].d.date.slice(5)}: {points[hover].d.pageviews} views
          </div>
        )}
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-[10px]" style={{ color: '#94a3b8' }}>{data[0]?.date.slice(5)}</span>
        <span className="text-[10px]" style={{ color: '#94a3b8' }}>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}
