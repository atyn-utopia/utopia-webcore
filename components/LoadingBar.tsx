'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'

export default function LoadingBar() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timeout)
  }, [pathname])

  if (!loading) return null

  return (
    <>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
        <div
          className="h-full rounded-r-full"
          style={{
            background: 'linear-gradient(90deg, #1a3a6e, #2979d6)',
            animation: 'loadingBar 1.5s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes loadingBar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </>
  )
}
