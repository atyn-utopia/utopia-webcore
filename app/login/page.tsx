'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language, setLanguage } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Pick up auth errors set by /auth/callback when an OAuth flow fails or
  // the user isn't on the invite list.
  useEffect(() => {
    const authError = searchParams.get('auth_error')
    if (!authError) return
    if (authError === 'not_invited') setError(t('login.error.notInvited'))
    else if (authError === 'missing_code' || authError === 'no_user') setError(t('login.error.callback'))
    else setError(authError)
    // Clean the URL so the error doesn't persist on subsequent navigations.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_error')
      window.history.replaceState({}, '', url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError(t('login.error.empty'))
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
      }, 1200)
    }
  }

  async function handleGoogle() {
    setError('')
    setOauthLoading(true)
    const supabase = createClient()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` },
    })
    if (oauthError) {
      setOauthLoading(false)
      setError(oauthError.message)
    }
    // On success, Supabase navigates the user out to Google's consent screen,
    // so we don't reset oauthLoading — we'll be unmounted before that matters.
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[var(--primary)]" style={{ animation: 'scaleIn 0.4s ease' }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ animation: 'checkDraw 0.5s ease 0.3s both' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900" style={{ animation: 'fadeUp 0.4s ease 0.4s both' }}>{t('login.welcomeBack')}</p>
          <p className="text-xs mt-1 text-slate-500" style={{ animation: 'fadeUp 0.4s ease 0.5s both' }}>{t('login.redirecting')}</p>
        </div>
        <style>{`
          @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes checkDraw { from { stroke-dasharray: 30; stroke-dashoffset: 30; opacity: 0; } to { stroke-dashoffset: 0; opacity: 1; } }
          @keyframes fadeUp { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-slate-900">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{t('login.title')}</h1>
          <p className="text-[13px] mt-1 text-slate-500">{t('login.subtitle')}</p>

          <div className="mt-5 inline-flex items-center rounded-full p-0.5 bg-white border border-slate-200">
            {(['en', 'ms'] as const).map(lang => {
              const active = language === lang
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className="text-[11px] font-semibold tracking-wider px-3 h-6 rounded-full transition-colors"
                  style={{ background: active ? 'var(--primary)' : 'transparent', color: active ? 'white' : '#64748b' }}
                  aria-pressed={active}
                >
                  {lang === 'en' ? 'EN' : 'BM'}
                </button>
              )
            })}
          </div>
        </div>

        <Card padding={false} className="overflow-hidden">
          <div className="px-6 pt-6 pb-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">{t('login.signIn')}</h2>

            {error && (
              <div className="mb-4 p-2.5 rounded-md text-xs leading-relaxed bg-red-50 border border-red-100 text-red-700" role="alert">
                {error}
              </div>
            )}

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleGoogle}
              loading={oauthLoading}
              disabled={loading || oauthLoading}
              iconLeft={
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
            >
              {t('login.continueWithGoogle')}
            </Button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{t('login.or')}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium mb-1 text-slate-600">{t('login.email')}</label>
                <Input
                  type="email"
                  size="lg"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading || oauthLoading}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1 text-slate-600">{t('login.password')}</label>
                <Input
                  type="password"
                  size="lg"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading || oauthLoading}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                disabled={loading || oauthLoading}
                className="mt-1"
              >
                {loading ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </form>
          </div>
        </Card>

        <p className="text-center text-[11px] mt-5 text-slate-400">
          {t('login.footer')}
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <LanguageProvider>
      <Suspense fallback={null}>
        <LoginPageInner />
      </Suspense>
    </LanguageProvider>
  )
}
