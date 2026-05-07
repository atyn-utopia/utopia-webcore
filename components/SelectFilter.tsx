'use client'

import { ChevronDownIcon } from '@heroicons/react/24/solid'

interface SelectFilterProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export default function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{label}</label>
      <div className="relative inline-block">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="cursor-pointer text-sm rounded-lg border focus:outline-none"
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            borderColor: '#cbd5e1',
            background: 'white',
            color: '#475569',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            paddingLeft: '0.75rem',
            paddingRight: '2.25rem',
            minWidth: '140px',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDownIcon className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  )
}
