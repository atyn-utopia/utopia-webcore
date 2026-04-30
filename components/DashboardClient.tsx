'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCoxy } from '@/contexts/CoxyContext'
import type { UserRole } from '@/contexts/UserContext'
import type { TranslationKey } from '@/lib/i18n/en'
import AddWebsiteModal from '@/components/AddWebsiteModal'

type CompanyFolder = { id: string; name: string; logoUrl: string | null; domains: string[] }

interface Props {
  role: UserRole
  isScoped: boolean
  websiteCount: number
  phoneCount: number | null
  postCount: number | null
  productCount: number | null
  companies: CompanyFolder[]
}

export default function DashboardClient({ role, isScoped, websiteCount, phoneCount, postCount, productCount, companies }: Props) {
  const { t } = useLanguage()
  const { setOpen: openCoxy } = useCoxy()
  const [addOpen, setAddOpen] = useState(false)
  const isWriter = role === 'writer'
  const canAddWebsite = role === 'admin' || role === 'designer'

  const welcomeKey = `dashboard.welcome.${role}` as TranslationKey

  return (
    <div>
      {/* Welcome banner — Coxy floats in the top-right of the page now (see CoxyWidget) */}
      <div className="rounded-xl overflow-hidden mb-8 relative border" style={{ background: 'linear-gradient(to right, #f0f4f8, #ffffff)', borderColor: '#e2e8f0', minHeight: '140px' }}>
        <div className="relative z-10 p-6 sm:p-8 pr-32 sm:pr-48">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('dashboard.welcome')}</h1>
          <p className="text-sm text-slate-500 max-w-md">{t(welcomeKey)}</p>
          <button
            onClick={() => openCoxy(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:bg-white"
            style={{ border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.7)', color: '#475569' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Ask Coxy
          </button>
        </div>
      </div>

      {/* Stats — info only, not links */}
      <div className={`grid grid-cols-1 ${isWriter || isScoped ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-4 mb-8`}>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f1f5f9' }}>
              <svg className="w-4.5 h-4.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M2 7h20" /><path strokeLinecap="round" d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('dashboard.stats.websites')}</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-0.5">{websiteCount}</p>
          <p className="text-xs text-slate-400">{t('dashboard.stats.websites.desc')}</p>
        </div>

        {!isWriter && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <svg className="w-4.5 h-4.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('dashboard.stats.phoneNumbers')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-0.5">{phoneCount ?? 0}</p>
            <p className="text-xs text-slate-400">{t('dashboard.stats.phoneNumbers.desc')}</p>
          </div>
        )}

        {!isWriter && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#fef3c7' }}>
                <svg className="w-4.5 h-4.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Products</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-0.5">{productCount ?? 0}</p>
            <p className="text-xs text-slate-400">Catalog items across websites</p>
          </div>
        )}

        {!isScoped && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                <svg className="w-4.5 h-4.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('dashboard.stats.blogPosts')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-0.5">{postCount ?? 0}</p>
            <p className="text-xs text-slate-400">{t('dashboard.stats.blogPosts.desc')}</p>
          </div>
        )}
      </div>

      {/* Companies — primary navigation into per-site work */}
      {(companies.length > 0 || canAddWebsite) && (
        <>
          <div className="flex items-center justify-between mt-8 mb-3 gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold text-slate-700">Companies</h2>
              {companies.length > 0 && (
                <span className="text-[11px]" style={{ color: '#94a3b8' }}>{companies.length} folder{companies.length === 1 ? '' : 's'}</span>
              )}
            </div>
            {canAddWebsite && (
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--primary)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Website
              </button>
            )}
          </div>
          {companies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {companies.map(c => (
                <Link
                  key={c.id}
                  href={`/company/${c.id}`}
                  className="group rounded-xl border bg-white p-4 transition-all hover:border-[var(--primary)] hover:shadow-sm"
                  style={{ borderColor: '#e2e8f0' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: c.logoUrl ? '#f8fafc' : '#fef3c7', border: c.logoUrl ? '1px solid #f1f5f9' : 'none' }}>
                      {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="#d97706" viewBox="0 0 24 24" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>{c.domains.length} website{c.domains.length === 1 ? '' : 's'}</p>
                    </div>
                    <svg className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: 'var(--primary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-white p-8 text-center" style={{ borderColor: '#e2e8f0' }}>
              <p className="text-sm" style={{ color: '#64748b' }}>No companies yet. Click <strong>Add Website</strong> to create one.</p>
            </div>
          )}
        </>
      )}

      {canAddWebsite && <AddWebsiteModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); window.location.reload() }} />}
    </div>
  )
}
