'use client'

import { useCoxy } from '@/contexts/CoxyContext'

/**
 * Wix-style AI pill that lives in the top header (desktop only). Clicking it
 * opens the Coxy chat panel via the shared CoxyContext, the same panel the
 * floating mascot uses on mobile.
 */
export default function AskCoxyPill() {
  const { setOpen } = useCoxy()
  return (
    <button
      onClick={() => setOpen(true)}
      className="hidden md:inline-flex items-center gap-1.5 h-9 pl-3.5 pr-4 rounded-full text-xs font-semibold text-white transition-all hover:brightness-110"
      style={{
        background: '#06b6d4',
        boxShadow: '0 1px 2px rgba(6, 182, 212, 0.45)',
      }}
      title="Ask Coxy"
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
      </svg>
      Ask Coxy
    </button>
  )
}
