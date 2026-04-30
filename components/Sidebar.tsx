'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useWebsite } from '@/contexts/WebsiteContext'
import type { UserRole } from '@/contexts/UserContext'
import { useLanguage } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/lib/i18n/en'

interface SidebarProps {
  userRole: UserRole
  open?: boolean
  onClose?: () => void
  collapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
}

const navItems: { href: string; labelKey: TranslationKey; roles: UserRole[]; icon: React.ReactNode }[] = [
  {
    href: '/',
    labelKey: 'nav.dashboard',
    roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/websites',
    labelKey: 'nav.websites',
    roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'],
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
    roles: ['admin', 'designer', 'external_designer', 'indoor_sales', 'manager'],
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
    roles: ['admin', 'designer', 'external_designer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/blog',
    labelKey: 'nav.blogPosts',
    roles: ['admin', 'designer', 'external_designer', 'writer'],
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
    href: '/api-keys',
    labelKey: 'nav.apiKeys',
    roles: ['admin', 'designer', 'external_designer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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
    roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

// Site-scoped nav: rendered when the URL has ?website=DOMAIN. Tabs target the
// existing global pages with the filter pre-applied. Active state matches the
// pathname only (the website param is shared across all of them).
type SiteNavItem = {
  basePath: string
  hash?: string
  label: string
  roles: UserRole[]
  icon: React.ReactNode
}

const siteNavItems: SiteNavItem[] = [
  {
    basePath: '/websites',
    label: 'Dashboard',
    roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    basePath: '/products',
    label: 'Products',
    roles: ['admin', 'designer', 'external_designer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    basePath: '/phone-numbers',
    label: 'Phone Numbers',
    roles: ['admin', 'designer', 'external_designer', 'indoor_sales', 'manager'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    basePath: '/blog',
    label: 'Blog',
    roles: ['admin', 'designer', 'external_designer', 'writer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        <path strokeLinecap="round" strokeWidth={1.8} d="M7 13h3M7 9h7"/>
      </svg>
    ),
  },
  {
    basePath: '/integrations',
    label: 'Integrations',
    roles: ['admin', 'designer', 'external_designer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    basePath: '/site-settings',
    label: 'Settings',
    roles: ['admin', 'designer', 'external_designer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

// Items that always show in the bottom group, regardless of site context.
// /blog is intentionally excluded — it's now a per-site tab too, so listing it
// in both groups would duplicate.
const ALWAYS_VISIBLE_HREFS = new Set(['/api-keys', '/help', '/users', '/audit', '/tickets'])

// Hrefs that are now reached exclusively via the per-site nav (Companies → site →
// scoped tab). Hidden from the global sidebar so the home page is the canonical
// entry point. The routes still work; users can deep-link or use stat-card
// shortcuts on the home page for cross-site views.
const HIDDEN_FROM_GLOBAL_NAV = new Set(['/websites', '/phone-numbers', '/products'])

export default function Sidebar({ userRole, open, onClose, collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { selectedWebsite, setSelectedWebsite } = useWebsite()
  const [websites, setWebsites] = useState<string[]>([])
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)

  const websiteParam = searchParams?.get('website') ?? ''
  const inSiteContext = websiteParam.length > 0

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

  const sidebarWidth = collapsed ? 'md:w-16' : 'md:w-60'

  // Auto-close the Quick Actions popover whenever the sidebar collapses
  useEffect(() => { if (collapsed) setQuickActionsOpen(false) }, [collapsed])

  return (
    <aside
      className={`group/sidebar w-60 flex-shrink-0 flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-200 md:relative md:translate-x-0 ${sidebarWidth} ${open ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Floating edge collapse button — Wix-style pill on the sidebar's outer
          edge. Always visible (not hover-only) so it's discoverable. */}
      {onCollapsedChange && (
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className="hidden md:flex absolute top-6 -right-3 z-10 w-6 h-6 items-center justify-center rounded-full shadow-md transition-all"
          style={{ background: 'var(--sidebar-bg)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = '#0f172a' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-bg)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Top row — Quick Actions pill (full width when expanded, icon-only when collapsed) */}
      <div className="px-3 pt-4 pb-2 flex items-center gap-2">
        {!collapsed ? (
          <button
            onClick={() => setQuickActionsOpen(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-semibold transition-colors"
            style={{ background: 'white', color: '#0f172a' }}
            title="Quick actions"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Actions
            <svg className={`w-3 h-3 ml-0.5 opacity-60 transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        ) : (
          <button
            onClick={() => onCollapsedChange?.(false)}
            className="mx-auto w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'white', color: '#0f172a' }}
            title="Quick actions (expand sidebar)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>
        )}
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Quick Actions popover — only visible when sidebar expanded */}
      {!collapsed && quickActionsOpen && (
        <div className="mx-3 mb-2 rounded-lg p-2 space-y-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <Link href="/api-keys" onClick={() => { setQuickActionsOpen(false); onClose?.() }} className="block px-2 py-1.5 text-xs rounded-md text-white/80 hover:bg-white/10 transition-colors">Generate API key</Link>
          <Link href="/blog/new" onClick={() => { setQuickActionsOpen(false); onClose?.() }} className="block px-2 py-1.5 text-xs rounded-md text-white/80 hover:bg-white/10 transition-colors">New blog post</Link>
          <Link href="/users/onboard" onClick={() => { setQuickActionsOpen(false); onClose?.() }} className="block px-2 py-1.5 text-xs rounded-md text-white/80 hover:bg-white/10 transition-colors">Onboard designer</Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {inSiteContext ? (
          <>
            {/* Site-context header */}
            <Link
              href="/"
              onClick={onClose}
              title={collapsed ? 'Back to home' : undefined}
              className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2 px-3'} py-1.5 mb-2 text-[10px] font-medium uppercase tracking-wider rounded-md transition-colors`}
              style={{ color: 'var(--sidebar-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-muted)' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {!collapsed && 'Back to home'}
            </Link>
            {!collapsed && (
              <div className="px-3 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--sidebar-muted)' }}>Site</p>
                <p className="text-xs font-mono truncate" style={{ color: '#ffffff' }} title={websiteParam}>{websiteParam}</p>
              </div>
            )}

            {/* Site-scoped tabs */}
            {siteNavItems.filter(item => item.roles.includes(userRole)).map(item => {
              const href = `${item.basePath}?website=${encodeURIComponent(websiteParam)}${item.hash ? `#${item.hash}` : ''}`
              const active = pathname === item.basePath || pathname.startsWith(item.basePath + '/')
              return (
                <Link
                  key={item.label}
                  href={href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium transition-colors`}
                  style={{
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--sidebar-text)',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {item.icon}
                  {!collapsed && item.label}
                </Link>
              )
            })}

            {/* Always-visible bottom group */}
            <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--sidebar-muted)' }}>Tools</p>}
              {navItems.filter(item => ALWAYS_VISIBLE_HREFS.has(item.href) && item.roles.includes(userRole)).map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium transition-colors`}
                    style={{
                      background: active ? 'var(--sidebar-active)' : 'transparent',
                      color: active ? '#ffffff' : 'var(--sidebar-text)',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {item.icon}
                    {!collapsed && t(item.labelKey)}
                  </Link>
                )
              })}
            </div>
          </>
        ) : (
          <>
            {!collapsed && (
              <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--sidebar-muted)' }}>
                {t('nav.manage')}
              </p>
            )}
            {navItems.filter(item => item.roles.includes(userRole) && !HIDDEN_FROM_GLOBAL_NAV.has(item.href)).map(item => {
              const active = item.href === '/' ? pathname === '/' : (pathname === item.href || pathname.startsWith(item.href + '/'))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium transition-colors`}
                  style={{
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--sidebar-text)',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {item.icon}
                  {!collapsed && t(item.labelKey)}
                </Link>
              )
            })}
          </>
        )}
      </nav>

    </aside>
  )
}
