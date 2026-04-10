'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import type { UserRole } from '@/contexts/UserContext'
import type { TranslationKey } from '@/lib/i18n/en'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecentPost = { id: string; website: string; slug: string; status: string; updated_at: string; blog_translations?: any[] }
type RecentPhone = { id: string; website: string; phone_number: string; label: string | null; type: string; updated_at: string }

interface Props {
  role: UserRole
  isScoped: boolean
  websiteCount: number
  phoneCount: number | null
  postCount: number | null
  recentPosts: RecentPost[]
  recentPhones: RecentPhone[]
}

export default function DashboardClient({ role, isScoped, websiteCount, phoneCount, postCount, recentPosts, recentPhones }: Props) {
  const { t } = useLanguage()
  const isWriter = role === 'writer'

  const welcomeKey = `dashboard.welcome.${role}` as TranslationKey

  return (
    <div>
      {/* Welcome banner */}
      <div className="rounded-xl overflow-hidden mb-8 relative border" style={{ background: 'linear-gradient(to right, #f0f4f8, #ffffff)', borderColor: '#e2e8f0', minHeight: '140px' }}>
        <div className="relative z-10 p-6 sm:p-8 pr-32 sm:pr-48">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('dashboard.welcome')}</h1>
          <p className="text-sm text-slate-500 max-w-md">{t(welcomeKey)}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character.gif" alt="" className="absolute right-0 bottom-0 h-full object-contain object-right-bottom pointer-events-none" style={{ maxHeight: '140px' }} />
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-1 ${isWriter || isScoped ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4 mb-8`}>
        <div className="relative rounded-xl border border-slate-200 bg-white p-5">
          <Link
            href="/all/websites"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            aria-label="View all websites"
            title="View all websites"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
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
          <div className="relative rounded-xl border border-slate-200 bg-white p-5">
            <Link
              href="/all/phone-numbers"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              aria-label="View all phone numbers"
              title="View all phone numbers"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
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

        {!isScoped && (
          <div className="relative rounded-xl border border-slate-200 bg-white p-5">
            <Link
              href="/all/blog"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              aria-label="View all blog posts"
              title="View all blog posts"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
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

      {/* Quick Actions */}
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{t('dashboard.quickActions')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isWriter && !isScoped && (
          <Link href="/phone-numbers/new" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-blue-50">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{t('dashboard.action.addPhone')}</p>
              <p className="text-xs text-slate-400">{t('dashboard.action.addPhone.desc')}</p>
            </div>
          </Link>
        )}

        {!isScoped && (
          <Link href="/blog/new" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-green-50">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{t('dashboard.action.newPost')}</p>
              <p className="text-xs text-slate-400">{t('dashboard.action.newPost.desc')}</p>
            </div>
          </Link>
        )}

        <Link href="/websites" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-100">
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M2 7h20" strokeLinecap="round" /><path d="M8 21h8M12 17v4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{isScoped ? t('dashboard.action.viewWebsites') : t('dashboard.action.manageWebsites')}</p>
            <p className="text-xs text-slate-400">{isScoped ? t('dashboard.action.viewWebsites.desc') : t('dashboard.action.manageWebsites.desc')}</p>
          </div>
        </Link>

        {!isWriter && (
          <Link href="/phone-numbers" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-blue-50">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{isScoped ? t('dashboard.action.viewPhones') : t('dashboard.action.configurePct')}</p>
              <p className="text-xs text-slate-400">{isScoped ? t('dashboard.action.viewPhones.desc') : t('dashboard.action.configurePct.desc')}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Recent Activity */}
      <h2 className="text-sm font-semibold text-slate-700 mt-8 mb-3">{t('dashboard.recentActivity')}</h2>
      <div className={`grid grid-cols-1 ${isWriter || isScoped ? '' : 'lg:grid-cols-2'} gap-4`}>
        {/* Recent Blog Posts */}
        {!isScoped && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <span className="text-xs font-medium" style={{ color: '#475569' }}>{t('dashboard.latestPosts')}</span>
            </div>
            <Link href="/blog" className="text-[10px] font-medium hover:underline" style={{ color: 'var(--primary)' }}>{t('dashboard.viewAll')}</Link>
          </div>
          {(recentPosts ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-xs" style={{ color: '#94a3b8' }}>{t('dashboard.noPosts')}</p>
          ) : (
            <div>
              {(recentPosts ?? []).map((post, i: number) => {
                const tr = post.blog_translations?.find((tt: { language: string }) => tt.language === 'en') ?? post.blog_translations?.[0]
                return (
                  <Link key={post.id} href={`/blog/${post.id}/edit`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    style={{ borderBottom: i < (recentPosts ?? []).length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{tr?.title ?? '(Untitled)'}</p>
                      <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{post.website}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {post.status === 'published' ? t('common.live') : t('common.draft')}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* Recent Phone Numbers */}
        {!isWriter && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span className="text-xs font-medium" style={{ color: '#475569' }}>{t('dashboard.latestPhones')}</span>
              </div>
              <Link href="/phone-numbers" className="text-[10px] font-medium hover:underline" style={{ color: 'var(--primary)' }}>{t('dashboard.viewAll')}</Link>
            </div>
            {(recentPhones ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-xs" style={{ color: '#94a3b8' }}>{t('dashboard.noPhones')}</p>
            ) : (
              <div>
                {(recentPhones ?? []).map((phone, i: number) => (
                  <div key={phone.id}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: i < (recentPhones ?? []).length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium font-mono" style={{ color: 'var(--foreground)' }}>{phone.phone_number}</p>
                      <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{phone.website}</p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-3"
                      style={phone.type === 'default' ? { background: 'var(--primary)', color: 'white' } : { background: '#f1f5f9', color: '#475569' }}>
                      {phone.type === 'default' ? 'Default' : (phone.label ?? 'Custom')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
