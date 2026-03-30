'use client'

import { WebsiteProvider } from '@/contexts/WebsiteContext'
import Sidebar from './Sidebar'
import Breadcrumb from './Breadcrumb'

interface AdminShellProps {
  userEmail: string
  children: React.ReactNode
}

export default function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <WebsiteProvider>
      <div className="flex h-screen" style={{ background: '#ffffff' }}>
        <Sidebar userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto p-8" style={{ background: '#ffffff' }}>
          <Breadcrumb />
          {children}
        </main>
      </div>
    </WebsiteProvider>
  )
}
