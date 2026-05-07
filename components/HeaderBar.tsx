'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import SiteSelector from './SiteSelector'
import TopBar from './TopBar'
import UserMenu from './UserMenu'
import AskCoxyPill from './AskCoxyPill'
import { Logo } from './ui/Logo'
import { Bars3Icon } from '@heroicons/react/24/solid'

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
      {/* Mobile hamburger. Only visible on mobile to open the sidebar drawer */}
      {onMobileMenuOpen && (
        <button
          onClick={onMobileMenuOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--header-text)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--header-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          aria-label="Open menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
      )}

      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
        <Logo size={32} rounded="md" />
        <div className="hidden sm:block leading-tight">
          <span className="block text-sm font-bold tracking-tight" style={{ color: 'var(--header-text-strong)' }}>Utopia Webcore</span>
          <span className="block text-[10px]" style={{ color: 'var(--header-text)' }}>Web &amp; Content Ops</span>
        </div>
      </Link>

      {/* Vertical divider */}
      <div className="hidden sm:block h-6 w-px flex-shrink-0" style={{ background: 'var(--header-divider)' }} />

      {/* Site selector */}
      <Suspense fallback={<div className="h-9 w-32 rounded-md" style={{ background: 'var(--header-hover)' }} />}>
        <SiteSelector />
      </Suspense>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right cluster. Preserves existing TopBar functionality (search,
          back/forward, language, notifications). TopBar restyled for dark bg. */}
      <Suspense fallback={null}>
        <TopBar />
      </Suspense>

      {/* Ask Coxy pill. Desktop only; mobile keeps the floating mascot */}
      <AskCoxyPill />

      {/* Avatar + sign-out menu (Wix-style top-right) */}
      <div className="ml-1 pl-2" style={{ borderLeft: '1px solid var(--header-divider)' }}>
        <UserMenu />
      </div>
    </div>
  )
}
