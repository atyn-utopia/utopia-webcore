'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import SiteSelector from './SiteSelector'
import TopBar from './TopBar'

interface Props {
  onMobileMenuOpen?: () => void
}

/**
 * Wix-style top header. Black background, full width, sits above the sidebar
 * and main content. Holds:
 *   - Brand wordmark (Utopia Webcore)
 *   - Workspace divider + site selector dropdown
 *   - Right side: search, navigation buttons, language, notifications (TopBar)
 */
export default function HeaderBar({ onMobileMenuOpen }: Props) {
  return (
    <div
      className="flex-shrink-0 flex items-center h-14 px-3 sm:px-5 gap-3"
      style={{ background: 'var(--header-bg)', color: 'var(--header-text-strong)', borderBottom: '1px solid var(--header-divider)' }}
    >
      {/* Mobile hamburger — only visible on mobile to open the sidebar drawer */}
      {onMobileMenuOpen && (
        <button
          onClick={onMobileMenuOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--header-text)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--header-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #2979d6)' }}>
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
          </svg>
        </div>
        <span className="hidden sm:inline text-sm font-bold tracking-tight" style={{ color: 'var(--header-text-strong)' }}>
          UTOPIA WEBCORE
        </span>
      </Link>

      {/* Vertical divider */}
      <div className="hidden sm:block h-6 w-px flex-shrink-0" style={{ background: 'var(--header-divider)' }} />

      {/* Site selector */}
      <Suspense fallback={<div className="h-9 w-32 rounded-md" style={{ background: 'var(--header-hover)' }} />}>
        <SiteSelector />
      </Suspense>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right cluster — preserves existing TopBar functionality (search,
          back/forward, language, notifications). TopBar restyled for dark bg. */}
      <Suspense fallback={null}>
        <TopBar />
      </Suspense>
    </div>
  )
}
