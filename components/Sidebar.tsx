'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWebsite } from '@/contexts/WebsiteContext'

interface SidebarProps {
  userEmail: string
}

const navItems = [
  {
    href: '/websites',
    label: 'Websites',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth="2"/>
        <path strokeWidth="2" d="M12 3c0 0-3 4-3 9s3 9 3 9"/>
        <path strokeWidth="2" d="M12 3c0 0 3 4 3 9s-3 9-3 9"/>
        <path strokeWidth="2" d="M3 12h18"/>
      </svg>
    ),
  },
  {
    href: '/phone-numbers',
    label: 'Phone Numbers',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    href: '/blog',
    label: 'Blog Posts',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function Sidebar({ userEmail }: SidebarProps) {
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
    <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          {/* Globe icon */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
              <path strokeWidth="1.5" d="M12 3c0 0-3 4-3 9s3 9 3 9"/>
              <path strokeWidth="1.5" d="M12 3c0 0 3 4 3 9s-3 9-3 9"/>
              <path strokeWidth="1.5" d="M3 12h18"/>
              <path strokeWidth="1.5" d="M4.5 7.5h15"/>
              <path strokeWidth="1.5" d="M4.5 16.5h15"/>
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight">Utopia Webcore</span>
            <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>Web & Content Ops</p>
          </div>
        </div>
      </div>

      {/* Website selector */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sidebar-muted)' }}>
          Website
        </label>
        <div className="relative">
          <select
            value={selectedWebsite}
            onChange={e => setSelectedWebsite(e.target.value)}
            className="w-full text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:outline-none cursor-pointer"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--sidebar-text)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <option value="" style={{ background: '#434371' }}>All websites</option>
            {websites.map(w => (
              <option key={w} value={w} style={{ background: '#434371' }}>{w}</option>
            ))}
          </select>
          <svg className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--sidebar-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
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
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {userEmail[0]?.toUpperCase()}
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--sidebar-muted)' }}>{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; (e.currentTarget as HTMLElement).style.color = '#ffffff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
