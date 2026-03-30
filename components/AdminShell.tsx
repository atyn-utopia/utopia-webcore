'use client'

import { WebsiteProvider } from '@/contexts/WebsiteContext'
import Sidebar from './Sidebar'

interface AdminShellProps {
  userEmail: string
  children: React.ReactNode
}

export default function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <WebsiteProvider>
      <div className="flex h-screen" style={{ background: 'var(--background)' }}>
        <Sidebar userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </WebsiteProvider>
  )
}
