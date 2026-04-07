'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWebsite } from '@/contexts/WebsiteContext'

interface SidebarProps {
  userEmail: string
  open?: boolean
  onClose?: () => void
}

const navItems = [
  {
    href: '/websites',
    label: 'Websites',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="1.8"/>
        <path strokeWidth="1.8" strokeLinecap="round" d="M2 7h20"/>
        <circle cx="5" cy="5" r="0.8" fill="currentColor" stroke="none"/>
        <circle cx="7.5" cy="5" r="0.8" fill="currentColor" stroke="none"/>
        <circle cx="10" cy="5" r="0.8" fill="currentColor" stroke="none"/>
        <path strokeWidth="1.8" strokeLinecap="round" d="M8 21h8M12 17v4"/>
      </svg>
    ),
  },
  {
    href: '/phone-numbers',
    label: 'Phone Numbers',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 10.5c.3.6.8 1.2 1.4 1.7.6.5 1.2.9 1.9 1.1l.7-.7a.5.5 0 01.5-.1l1.3.5a.5.5 0 01.3.5v1a.5.5 0 01-.5.5C11.5 15 8.5 12 8.5 8.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.3l.5 1.3a.5.5 0 01-.1.5l-.9.9z" />
      </svg>
    ),
  },
  {
    href: '/blog',
    label: 'Blog Posts',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        <path strokeLinecap="round" strokeWidth={1.8} d="M7 13h3M7 9h7"/>
      </svg>
    ),
  },
]

export default function Sidebar({ userEmail, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedWebsite, setSelectedWebsite } = useWebsite()
  const [websites, setWebsites] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/websites')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setWebsites(data.map((item: { domain: string } | string) =>
            typeof item === 'string' ? item : item.domain
          ))
        }
      })
      .catch(() => {})
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={`w-60 flex-shrink-0 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <Link href="/" onClick={onClose} className="flex items-center gap-3">
            {/* Logo icon */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight">Utopia Webcore</span>
              <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>Web & Content Ops</p>
            </div>
          </Link>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--sidebar-muted)' }}>
          Manage
        </p>
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--sidebar-active)' : 'transparent',
                color: active ? '#ffffff' : 'var(--sidebar-text)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="px-3 mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
            {userEmail[0]?.toUpperCase()}
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--sidebar-muted)' }}>{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 sm:gap-3 w-full px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; (e.currentTarget as HTMLElement).style.color = '#ffffff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)' }}
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
