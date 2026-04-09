'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setLoading(false)
      setError(authError.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 1500)
    }
  }

  // Full-screen success animation
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)', animation: 'scaleIn 0.4s ease' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ animation: 'checkDraw 0.5s ease 0.3s both' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)', animation: 'fadeUp 0.4s ease 0.4s both' }}>Welcome back!</p>
          <p className="text-xs mt-1" style={{ color: '#94a3b8', animation: 'fadeUp 0.4s ease 0.5s both' }}>Redirecting to dashboard…</p>
          <div className="mt-4 w-32 h-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0', animation: 'fadeUp 0.4s ease 0.6s both' }}>
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #1a3a6e, #2979d6)', animation: 'progressBar 1.2s ease 0.6s both' }} />
          </div>
        </div>
        <style>{`
          @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes checkDraw { from { stroke-dasharray: 30; stroke-dashoffset: 30; opacity: 0; } to { stroke-dashoffset: 0; opacity: 1; } }
          @keyframes fadeUp { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-sm">
        {/* Logo & System Description */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1e293b' }}>Utopia Webcore</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Web & Content Operations Platform</p>
          <p className="text-xs mt-3 text-center leading-relaxed max-w-xs" style={{ color: '#94a3b8' }}>
            Centralized management for website phone numbers, blog content, and multi-site operations. Authorized personnel only.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border bg-white p-6" style={{ borderColor: '#e2e8f0' }}>
          <h2 className="text-lg font-semibold mb-5" style={{ color: '#1e293b' }}>Sign in</h2>

          {error && (
            <div className="mb-4 p-2.5 rounded-lg border text-xs" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors disabled:opacity-50"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }}
                onFocus={e => e.currentTarget.style.borderColor = '#2979d6'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors disabled:opacity-50"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }}
                onFocus={e => e.currentTarget.style.borderColor = '#2979d6'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2.5 rounded-lg text-sm transition-all disabled:cursor-not-allowed"
              style={{ background: '#1e293b' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#94a3b8' }}>
          Utopia Webcore v1.0 — Internal Use Only
        </p>
      </div>
    </div>
  )
}
