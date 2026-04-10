'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ConfirmVariant = 'danger' | 'warning' | 'info'

interface ConfirmOptions {
  title?: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: async () => false,
})

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const VARIANT_STYLES: Record<ConfirmVariant, { btn: string; btnHover: string }> = {
  danger: { btn: '#ef4444', btnHover: '#dc2626' },
  warning: { btn: '#f59e0b', btnHover: '#d97706' },
  info: { btn: '#2979d6', btnHover: '#1e60b8' },
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  function handleCancel() {
    if (pending) {
      pending.resolve(false)
      setPending(null)
    }
  }

  function handleConfirm() {
    if (pending) {
      pending.resolve(true)
      setPending(null)
    }
  }

  const variant = pending?.variant ?? 'danger'
  const styles = VARIANT_STYLES[variant]

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease' }}
          onClick={handleCancel}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6"
            style={{
              animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <h3
              className="text-[18px] font-semibold text-center mb-2 tracking-tight"
              style={{ color: '#0f172a', letterSpacing: '-0.01em' }}
            >
              {pending.title ?? 'Are you sure?'}
            </h3>

            {/* Message */}
            <div
              className="text-[13px] text-center leading-relaxed mb-5 font-light"
              style={{ color: '#64748b' }}
            >
              {pending.message}
            </div>

            {/* Buttons — full width split */}
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 text-[13px] font-medium px-4 py-2.5 rounded-lg border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#e2e8f0', color: '#0f172a', background: 'white' }}
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                autoFocus
                className="flex-1 text-[13px] font-medium px-4 py-2.5 rounded-lg text-white transition-colors shadow-sm"
                style={{ background: styles.btn }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = styles.btnHover)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = styles.btn)}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes popIn {
              from { transform: scale(0.92) translateY(8px); opacity: 0; }
              to { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm
}
