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
      className="hidden md:inline-flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-md text-xs font-semibold text-white transition-all hover:brightness-110"
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        boxShadow: '0 1px 2px rgba(124, 58, 237, 0.4)',
      }}
      title="Ask Coxy"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/coxy.png" alt="" className="w-5 h-5 -ml-1 object-contain" aria-hidden />
      Ask Coxy
    </button>
  )
}
