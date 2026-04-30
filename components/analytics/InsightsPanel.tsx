'use client'

interface Insight { icon: string; text: string; type: 'positive' | 'negative' | 'neutral' | 'warning' }

const INSIGHT_STYLES: Record<string, { border: string; bg: string }> = {
  positive: { border: '#bbf7d0', bg: '#f0fdf4' },
  negative: { border: '#fecaca', bg: '#fef2f2' },
  warning: { border: '#fed7aa', bg: '#fffbeb' },
  neutral: { border: '#e2e8f0', bg: '#f8fafc' },
}

export default function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
          <svg className="w-4 h-4" fill="none" stroke="#d97706" viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Daily Insights</h3>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>Auto</span>
      </div>
      {insights.length > 0 ? (
        <div className="space-y-2 flex-1 overflow-y-auto">
          {insights.map((insight, i) => {
            const style = INSIGHT_STYLES[insight.type] ?? INSIGHT_STYLES.neutral
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: style.bg }}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: style.border + '66' }}>
                  {insight.type === 'positive' && <svg className="w-3.5 h-3.5" fill="none" stroke="#16a34a" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  {insight.type === 'negative' && <svg className="w-3.5 h-3.5" fill="none" stroke="#dc2626" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
                  {insight.type === 'warning' && <svg className="w-3.5 h-3.5" fill="none" stroke="#d97706" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
                  {insight.type === 'neutral' && <svg className="w-3.5 h-3.5" fill="none" stroke="#475569" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                </div>
                <p className="text-xs leading-snug" style={{ color: '#475569' }}>{insight.text}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
          <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#e2e8f0' }} strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-xs font-medium mb-0.5" style={{ color: '#64748b' }}>No insights available yet</p>
          <p className="text-[10px] leading-relaxed" style={{ color: '#94a3b8' }}>Insights appear automatically once enough traffic data is collected.</p>
        </div>
      )}
    </div>
  )
}
