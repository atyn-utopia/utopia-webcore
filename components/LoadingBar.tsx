'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Page-transition loading veil. Shown for ~600ms after every route change
 * so the user sees something happen even when the next page is still
 * fetching data. Uses the brand /loading-animation.gif on a soft white
 * backdrop. The GIF ships white so CSS invert flips it to black against
 * the light backdrop.
 */
export default function LoadingBar() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timeout)
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)' }}>
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-animation.gif"
          alt=""
          width={56}
          height={56}
          style={{ width: 56, height: 56, filter: 'invert(1)' }}
          aria-hidden
          draggable={false}
        />
        <span className="text-xs font-medium text-slate-400">Loading…</span>
      </div>
    </div>
  )
}
