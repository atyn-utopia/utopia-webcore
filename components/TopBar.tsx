'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

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
  const [showLang, setShowLang] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

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
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLang(false)
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
    <div className="flex items-center gap-1">
      {/* Universal search */}
      <div className="relative hidden sm:block" ref={searchRef}>
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }} strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search…"
            className="w-48 lg:w-64 pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-[var(--primary)] transition-colors"
            style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
          />
          {searching && <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-slate-300 border-t-[var(--primary)] animate-spin" />}
        </div>
        {showSearch && searchQuery && (
          <div className="absolute top-9 left-0 right-0 rounded-xl border shadow-lg z-50 overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
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
                        {r.type === 'blog' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: t.color }} strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                        {r.type === 'phone' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: t.color }} strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                        {r.type === 'website' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: t.color }} strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path d="M3 12h18"/></svg>}
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

      {/* Back */}
      <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors" style={{ color: '#94a3b8' }} title="Go back">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>

      {/* Forward */}
      <button onClick={() => router.forward()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors" style={{ color: '#94a3b8' }} title="Go forward">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* Language switcher */}
      <div className="relative" ref={langRef}>
        <button onClick={() => setShowLang(!showLang)} className="h-8 px-2 flex items-center gap-1 rounded-lg hover:bg-slate-100 transition-colors text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }} title={t('lang.switcher.title')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          {language === 'en' ? 'EN' : 'BM'}
        </button>
        {showLang && (
          <div className="absolute right-0 top-10 w-40 rounded-xl border shadow-lg z-50 overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
              {t('lang.switcher.title')}
            </div>
            {(['en', 'ms'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => { setLanguage(lang); setShowLang(false) }}
                className="w-full text-left px-3 py-2.5 text-xs font-medium flex items-center justify-between transition-colors hover:bg-slate-50"
                style={{ color: language === lang ? 'var(--primary)' : '#475569' }}
              >
                <span>{lang === 'en' ? t('lang.english') : t('lang.malay')}</span>
                {language === lang && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notification bell */}
      <div className="relative" ref={panelRef}>
        <button onClick={() => setShowPanel(!showPanel)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors relative" style={{ color: '#94a3b8' }} title="Notifications">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#ef4444' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {showPanel && (
          <div className="absolute right-0 top-10 w-80 rounded-xl border shadow-lg z-50" style={{ background: 'white', borderColor: '#e2e8f0' }}>
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
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#e2e8f0' }} strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
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
