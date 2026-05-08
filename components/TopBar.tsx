'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  GlobeAltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BellIcon,
} from '@heroicons/react/24/solid'

interface Notification {
  id: string
  message: string
  time: string
  read: boolean
}

interface SearchResult {
  type: 'blog' | 'phone' | 'website'
  id: string
  title: string
  subtitle: string
  href: string
}

export default function TopBar() {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/tickets').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setNotifications(data.slice(0, 10).map((t: { id: string; subject: string; created_at: string; status: string }) => ({
          id: t.id, message: t.subject, time: t.created_at, read: t.status === 'closed',
        })))
      }
    }).catch(() => {})
  }, [])

  // Close panels on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowPanel(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Universal search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const [blogs, phones, websites] = await Promise.all([
        fetch('/api/blog').then(r => r.json()),
        fetch('/api/phone-numbers').then(r => r.json()),
        fetch('/api/websites').then(r => r.json()),
      ])
      const results: SearchResult[] = []
      const ql = q.toLowerCase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (Array.isArray(blogs)) blogs.filter((p: any) => p.title?.toLowerCase().includes(ql) || p.website?.toLowerCase().includes(ql) || p.slug?.toLowerCase().includes(ql)).slice(0, 3).forEach((p: any) => {
        results.push({ type: 'blog', id: p.id, title: p.title, subtitle: p.website, href: `/blog/${p.id}/edit` })
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (Array.isArray(phones)) phones.filter((n: any) => n.phone_number?.includes(ql) || n.website?.toLowerCase().includes(ql) || (n.label ?? '').toLowerCase().includes(ql)).slice(0, 3).forEach((n: any) => {
        results.push({ type: 'phone', id: n.id, title: n.phone_number, subtitle: n.website, href: `/phone-numbers?website=${encodeURIComponent(n.website)}` })
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (Array.isArray(websites)) websites.filter((s: any) => s.domain?.toLowerCase().includes(ql) || (s.company_name ?? '').toLowerCase().includes(ql)).slice(0, 3).forEach((s: any) => {
        results.push({ type: 'website', id: s.domain, title: s.domain, subtitle: s.company_name ?? 'Unassigned', href: `/websites?company=${encodeURIComponent(s.company_name ?? '')}` })
      })
      setSearchResults(results)
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => doSearch(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, doSearch])

  const unreadCount = notifications.filter(n => !n.read).length

  function clearAll() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }

  function formatTime(d: string) {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const TYPE_ICON: Record<string, { color: string; bg: string }> = {
    blog: { color: '#16a34a', bg: '#f0fdf4' },
    phone: { color: '#2563eb', bg: '#eff6ff' },
    website: { color: '#475569', bg: '#f1f5f9' },
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Universal search */}
      <div className="relative hidden sm:block" ref={searchRef}>
        <div className="relative">
          <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search for sites, posts, phones…"
            className="w-48 lg:w-72 pl-8 pr-3 py-2 text-xs rounded-md focus:outline-none transition-colors placeholder:text-white/40"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'var(--header-text-strong)' }}
          />
          {searching && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/loading-animation.gif"
              alt=""
              width={14}
              height={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ width: 14, height: 14 }}
              aria-hidden
            />
          )}
        </div>
        {showSearch && searchQuery && (
          <div className="absolute top-11 left-0 right-0 rounded-md border shadow-lg z-50 overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
            {searchResults.length === 0 && !searching ? (
              <p className="px-4 py-4 text-xs text-center" style={{ color: '#94a3b8' }}>No results for &quot;{searchQuery}&quot;</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {searchResults.map(r => {
                  const t = TYPE_ICON[r.type]
                  return (
                    <Link key={`${r.type}-${r.id}`} href={r.href} onClick={() => { setShowSearch(false); setSearchQuery('') }}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #f8fafc' }}>
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: t.bg }}>
                        {r.type === 'blog' && <PencilSquareIcon className="w-3 h-3" style={{ color: t.color }} />}
                        {r.type === 'phone' && <ChatBubbleOvalLeftEllipsisIcon className="w-3 h-3" style={{ color: t.color }} />}
                        {r.type === 'website' && <GlobeAltIcon className="w-3 h-3" style={{ color: t.color }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.title}</p>
                        <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{r.subtitle}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Back / Forward — hidden on mobile (browser swipe-back covers this and
          the header was overflowing with hamburger + logo + selector + 4 icons
          + avatar at iPhone widths). */}
      <button onClick={() => router.back()} className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-colors" style={{ color: 'var(--header-text)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--header-hover)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'} title="Go back">
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      <button onClick={() => router.forward()} className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-colors" style={{ color: 'var(--header-text)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--header-hover)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'} title="Go forward">
        <ChevronRightIcon className="w-4 h-4" />
      </button>

      {/* Language switcher. Simple toggle */}
      <button
        onClick={() => setLanguage(language === 'en' ? 'ms' : 'en')}
        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors text-[11px] font-semibold leading-none"
        style={{ color: 'var(--header-text)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--header-hover)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        title={t('lang.switcher.title')}
      >
        {language === 'en' ? 'EN' : 'BM'}
      </button>

      {/* Notification bell */}
      <div className="relative" ref={panelRef}>
        <button onClick={() => setShowPanel(!showPanel)} className="w-9 h-9 flex items-center justify-center rounded-full transition-colors relative" style={{ color: 'var(--header-text)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--header-hover)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'} title="Notifications">
          <BellIcon className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#ef4444' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {showPanel && (
          <div className="absolute right-0 top-11 w-80 rounded-md border shadow-lg z-50" style={{ background: 'white', borderColor: '#e2e8f0' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Notifications</span>
                {unreadCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fef2f2', color: '#ef4444' }}>{unreadCount} new</span>}
              </div>
              {unreadCount > 0 && <button onClick={clearAll} className="text-[10px] font-medium hover:underline" style={{ color: 'var(--primary)' }}>Mark all read</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <BellIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#e2e8f0' }} />
                  <p className="text-xs" style={{ color: '#94a3b8' }}>No notifications</p>
                </div>
              ) : notifications.map((n, i) => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors" style={{ borderBottom: i < notifications.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'opacity-0' : ''}`} style={{ background: '#3b82f6' }} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${n.read ? '' : 'font-medium'}`} style={{ color: n.read ? '#94a3b8' : 'var(--foreground)' }}>{n.message}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#cbd5e1' }}>{formatTime(n.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
