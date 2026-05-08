'use client'

export default function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[11px] font-medium text-white opacity-0 group-hover/tip:opacity-100 transition-opacity z-30 w-48 text-center leading-relaxed" style={{ background: '#1e293b' }}>
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4" style={{ borderTopColor: '#1e293b' }} />
      </div>
    </div>
  )
}
