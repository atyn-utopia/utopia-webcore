'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

interface ToastOptions {
  title?: string
  message: string
  variant?: ToastVariant
  duration?: number
}

interface Toast extends ToastOptions {
  id: string
}

interface ToastContextType {
  toast: (opts: ToastOptions) => void
  success: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  info: () => {},
  warning: () => {},
  error: () => {},
})

const VARIANT_STYLES: Record<ToastVariant, { iconBg: string; border: string; bg: string }> = {
  success: { iconBg: '#16a34a', border: '#86efac', bg: '#f0fdf4' },
  info:    { iconBg: '#2979d6', border: '#93c5fd', bg: '#eff6ff' },
  warning: { iconBg: '#f59e0b', border: '#fcd34d', bg: '#fffbeb' },
  error:   { iconBg: '#ef4444', border: '#fca5a5', bg: '#fef2f2' },
}

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const common = 'w-3.5 h-3.5 text-white'
  if (variant === 'success') {
    return (
      <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (variant === 'info') {
    return (
      <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  }
  if (variant === 'warning') {
    return (
      <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    )
  }
  return (
    <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: ToastOptions) => {
    const id = Math.random().toString(36).slice(2, 9)
    const entry: Toast = { id, variant: 'info', duration: 4000, ...opts }
    setToasts(prev => [...prev, entry])
    if (entry.duration && entry.duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), entry.duration)
    }
  }, [])

  const success = useCallback((message: string, title?: string) => toast({ message, title, variant: 'success' }), [toast])
  const info = useCallback((message: string, title?: string) => toast({ message, title, variant: 'info' }), [toast])
  const warning = useCallback((message: string, title?: string) => toast({ message, title, variant: 'warning' }), [toast])
  const error = useCallback((message: string, title?: string) => toast({ message, title, variant: 'error' }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, info, warning, error }}>
      {children}
      {/* Toast stack — centered below the top bar (h-16 = 64px) */}
      <div className="fixed left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none" style={{ top: '80px' }}>
        {toasts.map(t => {
          const variant = t.variant ?? 'info'
          const styles = VARIANT_STYLES[variant]
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto relative rounded-lg border py-2.5 pl-3 pr-9 shadow-md flex items-center gap-2.5 min-w-[420px] max-w-[640px]"
              style={{
                background: styles.bg,
                borderColor: styles.border,
                animation: 'toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: styles.iconBg }}>
                <VariantIcon variant={variant} />
              </div>
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-xs font-semibold leading-tight" style={{ color: '#0f172a' }}>{t.title}</p>}
                <p className={`text-xs leading-tight ${t.title ? 'mt-0.5' : ''}`} style={{ color: t.title ? '#475569' : '#0f172a' }}>{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="absolute top-1/2 -translate-y-1/2 right-2 w-5 h-5 flex items-center justify-center rounded hover:bg-white/60 transition-colors"
                style={{ color: '#64748b' }}
                aria-label="Dismiss"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
      <style jsx>{`
        @keyframes toastIn {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
