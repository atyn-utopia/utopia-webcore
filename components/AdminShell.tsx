'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { WebsiteProvider } from '@/contexts/WebsiteContext'
import { UserProvider, type UserRole } from '@/contexts/UserContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { CoxyProvider } from '@/contexts/CoxyContext'
import Sidebar from './Sidebar'
import Breadcrumb from './Breadcrumb'
import HeaderBar from './HeaderBar'
import CoxyWidget from './CoxyWidget'

interface AdminShellProps {
  userEmail: string
  userName: string
  userRole: UserRole
  children: React.ReactNode
}

export default function AdminShell({ userEmail, userName, userRole, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showBeta, setShowBeta] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Persist desktop sidebar collapsed state across navigations
  useEffect(() => {
    try {
      const v = localStorage.getItem('sidebar-collapsed')
      if (v === '1') setCollapsed(true)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  useEffect(() => {
    if (userRole === 'admin') return
    fetch('/api/settings?key=beta_banner')
      .then(r => r.json())
      .then(data => { if (data.value === 'on') setShowBeta(true) })
      .catch(() => {})
  }, [userRole])

  return (
    <LanguageProvider>
    <ToastProvider>
    <ConfirmProvider>
    <UserProvider value={{ email: userEmail, name: userName, role: userRole }}>
    <WebsiteProvider>
    <CoxyProvider>
      <div className="flex flex-col h-screen" style={{ background: 'var(--page-bg)' }}>
        {/* Beta banner. Full width above everything */}
        {showBeta && (
          <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between gap-3" style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d' }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800">
                <strong>Beta Testing</strong>. This system is in beta. Found a bug?{' '}
                <Link href="/help" className="underline font-medium">Submit a ticket</Link>
              </p>
            </div>
            <button onClick={() => setShowBeta(false)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Wix-style top header bar */}
        <HeaderBar onMobileMenuOpen={() => setSidebarOpen(true)} />

        <div className="flex flex-1 min-h-0">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          userRole={userRole}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />

        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
          <div className="p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-8">
            {/* Inline breadcrumb sits in the gray content area, just above
                the page title. Visible on every page including dashboards */}
            <div className="mb-4">
              <Breadcrumb />
            </div>
            {children}
          </div>
        </main>
        </div>
        <CoxyWidget />
      </div>
    </CoxyProvider>
    </WebsiteProvider>
    </UserProvider>
    </ConfirmProvider>
    </ToastProvider>
    </LanguageProvider>
  )
}
