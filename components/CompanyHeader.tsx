'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import EditCompanyModal from './EditCompanyModal'

interface Props {
  id: string
  name: string
  logoUrl: string | null
}

const ALLOWED_EDIT_ROLES = new Set(['admin', 'designer'])

/**
 * Header strip for the /company/[id] page: logo + name, with an Edit button
 * for admin/designer that opens the company-edit modal. The page itself
 * server-renders the data; this client component owns the edit interaction.
 */
export default function CompanyHeader({ id, name, logoUrl }: Props) {
  const { role } = useUser()
  const router = useRouter()
  const canEdit = ALLOWED_EDIT_ROLES.has(role)
  const [editing, setEditing] = useState(false)
  const [optimistic, setOptimistic] = useState<{ name: string; logoUrl: string | null } | null>(null)

  const displayName = optimistic?.name ?? name
  const displayLogo = optimistic !== null ? optimistic.logoUrl : logoUrl

  return (
    <div className="mb-5 flex items-center gap-3 flex-wrap">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: '#fef3c7', border: '1px solid #f1f5f9' }}>
        {displayLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayLogo} alt="" className="w-full h-full object-contain" />
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="#d97706" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        )}
      </div>
      <h1 className="text-xl font-semibold tracking-tight truncate min-w-0 flex-1" style={{ color: 'var(--foreground)' }}>{displayName}</h1>
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-md border transition-colors hover:bg-slate-50 flex-shrink-0"
          style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit company
        </button>
      )}

      <EditCompanyModal
        open={editing}
        company={{ id, name: displayName, logo_url: displayLogo }}
        onClose={() => setEditing(false)}
        onSaved={next => {
          setOptimistic({ name: next.name, logoUrl: next.logo_url })
          router.refresh()
        }}
      />
    </div>
  )
}
