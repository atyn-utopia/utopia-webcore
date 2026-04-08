'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WebsiteProvider } from '@/contexts/WebsiteContext'
import Sidebar from './Sidebar'
import Breadcrumb from './Breadcrumb'

interface AdminShellProps {
  userEmail: string
  children: React.ReactNode
}

export default function AdminShell({ userEmail, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <WebsiteProvider>
      <div className="flex h-screen" style={{ background: '#ffffff' }}>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          userEmail={userEmail}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-8" style={{ background: '#ffffff' }}>
          {/* Mobile header with hamburger */}
          <div className="flex items-center gap-3 mb-4 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Utopia Webcore</span>
                <p className="text-xs text-slate-500">Web & Content Ops</p>
              </div>
            </Link>
          </div>

          <div className="hidden md:-mt-8 md:-mx-8 md:px-8 md:flex md:items-center md:h-16 md:border-b md:border-[#e2e8f0]">
            <Breadcrumb />
          </div>
          <div className="hidden md:block md:mt-5" />
          {children}
        </main>
      </div>
    </WebsiteProvider>
  )
}
