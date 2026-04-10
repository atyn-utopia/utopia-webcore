'use client'

export type ViewMode = 'grid' | 'list'

export default function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center h-9 rounded-lg border overflow-hidden" style={{ borderColor: '#cbd5e1' }}>
      <button
        type="button"
        onClick={() => onChange('list')}
        className="w-9 h-full flex items-center justify-center transition-colors"
        style={{ background: value === 'list' ? 'var(--primary)' : 'white', color: value === 'list' ? 'white' : '#94a3b8' }}
        title="List view"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        className="w-9 h-full flex items-center justify-center transition-colors"
        style={{ background: value === 'grid' ? 'var(--primary)' : 'white', color: value === 'grid' ? 'white' : '#94a3b8', borderLeft: '1px solid #cbd5e1' }}
        title="Grid view"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  )
}
