'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Top-of-page navigation progress strip. 2px indeterminate bar that flashes
 * brand blue for ~700ms after every route change. Lives directly under the
 * HeaderBar (rendered by AdminShell), so it has nowhere to sit on
 * unauthenticated screens — by design, those pages don't need it.
 *
 * The bar is always in the DOM at h-0.5 to avoid layout shift; only the
 * inner gradient stripe animates in/out.
 */
export default function LoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(timeout)
  }, [pathname, searchParams])

  return (
    <div
      className="relative h-0.5 flex-shrink-0 overflow-hidden"
      style={{ background: 'transparent' }}
      aria-hidden
    >
      {loading && (
        <div
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
            animation: 'loadingBarSlide 700ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        />
      )}
      <style>{`
        @keyframes loadingBarSlide {
          0%   { transform: translateX(-100%); opacity: 0.6; }
          50%  { opacity: 1; }
          100% { transform: translateX(400%); opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
