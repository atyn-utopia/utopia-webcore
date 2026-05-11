'use client'

import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon, InformationCircleIcon, LightBulbIcon } from '@heroicons/react/24/solid'

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
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
          <LightBulbIcon className="w-4 h-4" />
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
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: style.border + '66' }}>
                  {insight.type === 'positive' && <ArrowTrendingUpIcon className="w-3.5 h-3.5" />}
                  {insight.type === 'negative' && <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                  {insight.type === 'warning' && <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                  {insight.type === 'neutral' && <InformationCircleIcon className="w-3.5 h-3.5" />}
                </div>
                <p className="text-xs leading-snug" style={{ color: '#475569' }}>{insight.text}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
          <LightBulbIcon className="w-8 h-8 mb-2" />
          <p className="text-xs font-medium mb-0.5" style={{ color: '#64748b' }}>No insights available yet</p>
          <p className="text-[10px] leading-relaxed" style={{ color: '#94a3b8' }}>Insights appear automatically once enough traffic data is collected.</p>
        </div>
      )}
    </div>
  )
}
