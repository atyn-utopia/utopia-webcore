'use client'

interface DailyStat { date: string; pageviews: number; clicks: number; impressions: number }

export default function SimpleChart({ data }: { data: DailyStat[] }) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.pageviews), 1)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Daily Pageviews</h3>
      <div className="flex items-stretch gap-1 h-32">
        {data.map(d => {
          const h = Math.max((d.pageviews / maxVal) * 100, 2)
          return (
            <div key={d.date} className="flex-1 h-full group relative flex flex-col items-center justify-end">
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
