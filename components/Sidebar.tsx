'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useWebsite } from '@/contexts/WebsiteContext'
import type { UserRole } from '@/contexts/UserContext'
import { useLanguage } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/lib/i18n/en'
import {
  AcademicCapIcon,
  BoltIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  CubeIcon,
  GlobeAltIcon,
  HomeIcon,
  KeyIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  TicketIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'

interface SidebarProps {
  userRole: UserRole
  open?: boolean
  onClose?: () => void
  collapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
}

const navItems: { href: string; labelKey: TranslationKey; roles: UserRole[]; icon: React.ReactNode }[] = [
  { href: '/',              labelKey: 'nav.dashboard',    roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'], icon: <HomeIcon className="w-4 h-4" /> },
  { href: '/websites',      labelKey: 'nav.websites',     roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'], icon: <GlobeAltIcon className="w-4 h-4" /> },
  { href: '/phone-numbers', labelKey: 'nav.phoneNumbers', roles: ['admin', 'designer', 'external_designer', 'indoor_sales', 'manager'],            icon: <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" /> },
  { href: '/products',      labelKey: 'nav.products',     roles: ['admin', 'designer', 'external_designer'],                                       icon: <CubeIcon className="w-4 h-4" /> },
  { href: '/users',         labelKey: 'nav.users',        roles: ['admin'],                                                                         icon: <UsersIcon className="w-4 h-4" /> },
  { href: '/api-keys',      labelKey: 'nav.apiKeys',      roles: ['admin', 'designer', 'external_designer'],                                       icon: <KeyIcon className="w-4 h-4" /> },
  { href: '/audit',         labelKey: 'nav.audit',        roles: ['admin'],                                                                         icon: <ClipboardDocumentListIcon className="w-4 h-4" /> },
  { href: '/tickets',       labelKey: 'nav.tickets',      roles: ['admin'],                                                                         icon: <TicketIcon className="w-4 h-4" /> },
  { href: '/tutorial',      labelKey: 'nav.tutorial',     roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'], icon: <AcademicCapIcon className="w-4 h-4" /> },
  { href: '/help',          labelKey: 'nav.help',         roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'], icon: <QuestionMarkCircleIcon className="w-4 h-4" /> },
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
  { basePath: '/websites',      label: 'Dashboard',     roles: ['admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'], icon: <HomeIcon className="w-4 h-4" /> },
  { basePath: '/products',      label: 'Products',      roles: ['admin', 'designer', 'external_designer'],                                       icon: <CubeIcon className="w-4 h-4" /> },
  { basePath: '/phone-numbers', label: 'Phone Numbers', roles: ['admin', 'designer', 'external_designer', 'indoor_sales', 'manager'],            icon: <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" /> },
  { basePath: '/blog',          label: 'Blog',          roles: ['admin', 'designer', 'external_designer', 'writer'],                              icon: <PencilSquareIcon className="w-4 h-4" /> },
  { basePath: '/seo',           label: 'SEO',           roles: ['admin', 'designer', 'external_designer'],                                       icon: <MagnifyingGlassIcon className="w-4 h-4" /> },
  { basePath: '/integrations',  label: 'Integrations',  roles: ['admin', 'designer', 'external_designer'],                                       icon: <LinkIcon className="w-4 h-4" /> },
  { basePath: '/site-settings', label: 'Settings',      roles: ['admin', 'designer', 'external_designer'],                                       icon: <Cog6ToothIcon className="w-4 h-4" /> },
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
      {/* Floating edge collapse button. Wix-style pill on the sidebar's outer
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
          <ChevronRightIcon className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      )}

      {/* Top row. Quick Actions pill (full width when expanded, icon-only when collapsed) */}
      <div className="px-3 pt-4 pb-2 flex items-center gap-2">
        {!collapsed ? (
          <button
            onClick={() => setQuickActionsOpen(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-semibold transition-colors"
            style={{ background: 'white', color: '#0f172a' }}
            title="Quick actions"
          >
            <BoltIcon className="w-3.5 h-3.5" />
            Quick Actions
            <ChevronDownIcon className={`w-3 h-3 ml-0.5 opacity-60 transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <button
            onClick={() => onCollapsedChange?.(false)}
            className="mx-auto w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'white', color: '#0f172a' }}
            title="Quick actions (expand sidebar)"
          >
            <BoltIcon className="w-4 h-4" />
          </button>
        )}
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Actions popover. Only visible when sidebar expanded */}
      {!collapsed && quickActionsOpen && (
        <div className="mx-3 mb-2 rounded-lg p-2 space-y-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {(userRole === 'admin' || userRole === 'designer') && (
            <Link href="/?addWebsite=1" onClick={() => { setQuickActionsOpen(false); onClose?.() }} className="block px-2 py-1.5 text-xs rounded-md text-white/80 hover:bg-white/10 transition-colors">Add website</Link>
          )}
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
              <ChevronLeftIcon className="w-3 h-3" />
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
