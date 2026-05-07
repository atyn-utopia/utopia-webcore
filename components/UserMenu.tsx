'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser, type UserRole } from '@/contexts/UserContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import type { TranslationKey } from '@/lib/i18n/en'
import { QuestionMarkCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/solid'

const ROLE_KEY: Record<UserRole, TranslationKey> = {
  admin: 'role.admin',
  designer: 'role.designer',
  external_designer: 'role.external_designer',
  writer: 'role.writer',
  indoor_sales: 'role.indoor_sales',
  manager: 'role.manager',
}

/**
 * Wix-style avatar dropdown for the top-right of the header. Shows the user's
 * initial; click opens a panel with profile info + a sign-out button.
 */
export default function UserMenu() {
  const router = useRouter()
  const { name, email, role } = useUser()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error(error.message, 'Sign out failed')
        return
      }
      router.push('/login')
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message, 'Sign out failed')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all"
        style={{
          background: '#1E5BFF',
          boxShadow: open ? '0 0 0 2px rgba(255,255,255,0.4)' : 'none',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${name} · ${t(ROLE_KEY[role] ?? 'role.admin')}`}
      >
        {name[0]?.toUpperCase() ?? '?'}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-64 rounded-md shadow-lg z-50 overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
          {/* Identity header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#1E5BFF' }}>
              {name[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{name}</p>
              <p className="text-[11px] truncate" style={{ color: '#64748b' }}>{email}</p>
            </div>
          </div>

          {/* Role + meta */}
          <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#eff6ff', color: '#1e40af' }}>
              {t(ROLE_KEY[role] ?? 'role.admin')}
            </span>
          </div>

          {/* Menu items. Help link is the only useful destination right now */}
          <div className="py-1">
            <Link
              href="/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs transition-colors hover:bg-slate-50"
              style={{ color: '#475569' }}
            >
              <QuestionMarkCircleIcon className="w-4 h-4" />
              Help &amp; feedback
            </Link>
          </div>

          {/* Sign out */}
          <div style={{ borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
              style={{ color: '#b91c1c' }}
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              {signingOut ? '…' : t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
