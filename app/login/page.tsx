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
    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #434371 0%, #2d2b5e 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
              <path strokeWidth="1.5" d="M12 3c0 0-3 4-3 9s3 9 3 9"/>
              <path strokeWidth="1.5" d="M12 3c0 0 3 4 3 9s-3 9-3 9"/>
              <path strokeWidth="1.5" d="M3 12h18"/>
              <path strokeWidth="1.5" d="M4.5 7.5h15"/>
              <path strokeWidth="1.5" d="M4.5 16.5h15"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Utopia Webcore</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Web & Content Operations</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#1a1a2e' }}>Sign in</h2>
          <p className="text-sm text-slate-500 mb-6">Enter your credentials to continue</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a2e' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-shadow"
                style={{ borderColor: '#e4e3f2' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67,67,113,0.15)'}
                onBlur={e => e.currentTarget.style.boxShadow = 'none'}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a2e' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none transition-shadow"
                style={{ borderColor: '#e4e3f2' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67,67,113,0.15)'}
                onBlur={e => e.currentTarget.style.boxShadow = 'none'}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
