'use client'

interface SelectFilterProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export default function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a7a8a' }}>{label}</label>
      <div className="relative inline-block">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="cursor-pointer text-sm rounded-lg border focus:outline-none"
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            borderColor: 'var(--border)',
            background: 'white',
            color: 'var(--foreground)',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            paddingLeft: '0.75rem',
            paddingRight: '2.25rem',
            minWidth: '140px',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg
          className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: '#7dbdd0' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
