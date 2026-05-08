'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCoxy } from '@/contexts/CoxyContext'
import type { UserRole } from '@/contexts/UserContext'
import type { TranslationKey } from '@/lib/i18n/en'
import AddWebsiteModal from '@/components/AddWebsiteModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  CubeIcon,
  PencilSquareIcon,
  PlusIcon,
  FolderIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  const isWriter = role === 'writer'
  const canAddWebsite = role === 'admin' || role === 'designer'

  // Auto-open the Add Website modal when ?addWebsite=1 is present so the
  // SiteSelector and Quick Actions can deep-link into the create flow.
  useEffect(() => {
    if (searchParams.get('addWebsite') === '1' && canAddWebsite) {
      setAddOpen(true)
      // Clean the param so a refresh doesn't re-open the modal.
      router.replace('/')
    }
  }, [searchParams, canAddWebsite, router])

  const welcomeKey = `dashboard.welcome.${role}` as TranslationKey

  return (
    <div>
      {/* Welcome banner. Coxy floats in the top-right of the page now (see CoxyWidget) */}
      <div className="rounded-xl overflow-hidden mb-8 relative border" style={{ background: 'linear-gradient(to right, #f0f4f8, #ffffff)', borderColor: '#e2e8f0', minHeight: '140px' }}>
        <div className="relative z-10 p-6 sm:p-8 pr-32 sm:pr-48">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('dashboard.welcome')}</h1>
          <p className="text-sm text-slate-500 max-w-md">{t(welcomeKey)}</p>
          <button
            onClick={() => openCoxy(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:bg-white"
            style={{ border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.7)', color: '#475569' }}
          >
            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
            Ask Coxy
          </button>
        </div>
      </div>

      {/* Stats. Info only, not links */}
      <div className={`grid grid-cols-1 ${isWriter || isScoped ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4 mb-8`}>
        <Card variant="default">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f1f5f9' }}>
              <GlobeAltIcon className="w-5 h-5 text-slate-500" />
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('dashboard.stats.websites')}</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-0.5">{websiteCount}</p>
          <p className="text-xs text-slate-400">{t('dashboard.stats.websites.desc')}</p>
        </Card>

        {!isWriter && (
          <Card variant="default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('dashboard.stats.phoneNumbers')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-0.5">{phoneCount ?? 0}</p>
            <p className="text-xs text-slate-400">{t('dashboard.stats.phoneNumbers.desc')}</p>
          </Card>
        )}

        {!isWriter && (
          <Card variant="default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100">
                <CubeIcon className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Products</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-0.5">{productCount ?? 0}</p>
            <p className="text-xs text-slate-400">Catalog items across websites</p>
          </Card>
        )}

        {/* Blog stat card removed from the dashboard per design call. The
            sidebar still links to /blog for the analytics view. */}
      </div>

      {/* Companies. Primary navigation into per-site work */}
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
              <Button
                variant="primary"
                size="md"
                onClick={() => setAddOpen(true)}
                iconLeft={<PlusIcon className="w-3.5 h-3.5" />}
              >
                Add Website
              </Button>
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
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: c.logoUrl ? '#f8fafc' : '#dbeafe', border: c.logoUrl ? '1px solid #f1f5f9' : 'none' }}>
                      {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <FolderIcon className="w-5 h-5" style={{ color: '#1E5BFF' }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>{c.domains.length} website{c.domains.length === 1 ? '' : 's'}</p>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--primary)' }} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="text-center !py-10">
              <p className="text-sm text-slate-500">No companies yet. Click <strong>Add Website</strong> to create one.</p>
            </Card>
          )}
        </>
      )}

      {canAddWebsite && <AddWebsiteModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); window.location.reload() }} />}
    </div>
  )
}
