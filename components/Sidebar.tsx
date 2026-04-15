'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWebsite } from '@/contexts/WebsiteContext'
import type { UserRole } from '@/contexts/UserContext'
import { useLanguage } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/lib/i18n/en'

interface SidebarProps {
  userEmail: string
  userName: string
  userRole: UserRole
  open?: boolean
  onClose?: () => void
}

const ROLE_KEY: Record<UserRole, TranslationKey> = {
  admin: 'role.admin',
  designer: 'role.designer',
  writer: 'role.writer',
  indoor_sales: 'role.indoor_sales',
  manager: 'role.manager',
}

const navItems: { href: string; labelKey: TranslationKey; roles: UserRole[]; icon: React.ReactNode }[] = [
  {
    href: '/',
    labelKey: 'nav.dashboard',
    roles: ['admin', 'designer', 'writer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/websites',
    labelKey: 'nav.websites',
    roles: ['admin', 'designer', 'writer', 'indoor_sales', 'manager'],
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
    labelKey: 'nav.phoneNumbers',
    roles: ['admin', 'designer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 10.5c.3.6.8 1.2 1.4 1.7.6.5 1.2.9 1.9 1.1l.7-.7a.5.5 0 01.5-.1l1.3.5a.5.5 0 01.3.5v1a.5.5 0 01-.5.5C11.5 15 8.5 12 8.5 8.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.3l.5 1.3a.5.5 0 01-.1.5l-.9.9z" />
      </svg>
    ),
  },
  {
    href: '/products',
    labelKey: 'nav.products',
    roles: ['admin', 'designer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/blog',
    labelKey: 'nav.blogPosts',
    roles: ['admin', 'designer', 'writer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        <path strokeLinecap="round" strokeWidth={1.8} d="M7 13h3M7 9h7"/>
      </svg>
    ),
  },
  {
    href: '/users',
    labelKey: 'nav.users',
    roles: ['admin'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/audit',
    labelKey: 'nav.audit',
    roles: ['admin'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m-6-8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    href: '/tickets',
    labelKey: 'nav.tickets',
    roles: ['admin'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/help',
    labelKey: 'nav.help',
    roles: ['admin', 'designer', 'writer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function Sidebar({ userEmail, userName, userRole, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
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
        <div className="flex items-center justify-between w-full">
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
          {t('nav.manage')}
        </p>
        {navItems.filter(item => item.roles.includes(userRole)).map(item => {
          const active = item.href === '/' ? pathname === '/' : (pathname === item.href || pathname.startsWith(item.href + '/'))
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
              {t(item.labelKey)}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 pb-8 md:pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="px-3 mb-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
            {userName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{userName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--sidebar-muted)' }}>{t(ROLE_KEY[userRole] ?? 'role.admin')}</p>
          </div>
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
          {t('nav.signOut')}
        </button>
      </div>
    </aside>
  )
}
