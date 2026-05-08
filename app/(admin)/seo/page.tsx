'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { matchPattern, suggestPatterns } from '@/lib/seoPattern'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Spinner, LoadingOverlay } from '@/components/ui/Spinner'

import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Language = 'en' | 'ms' | 'zh'
const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ms', label: 'BM' },
  { code: 'zh', label: '中文' },
]

interface Override {
  id: string
  website: string
  path: string
  language: Language
  is_pattern: boolean
  title: string | null
  description: string | null
  og_image: string | null
  updated_at: string
}

interface AltOverride { id: string; image_src: string; alt: string; updated_at: string }

interface SiteProfile { website: string; brand_name: string; location: string; keywords: string[]; languages: Language[]; updated_at: string }

interface SitemapResult { ok: boolean; source: 'sitemap' | 'sitemap_index' | 'fallback'; paths: string[]; error?: string }

interface Integration { id: string; website: string; provider: string; property_id: string | null; connected_at: string; updated_at: string }

interface AuditIssue { type: 'error' | 'warn' | 'info'; category: 'meta' | 'images' | 'headings' | 'social'; message: string; detail?: string }
interface AuditResult {
  url: string
  fetchedAt: string
  ok: boolean
  status?: number
  error?: string
  meta: { title: string | null; titleLength: number; description: string | null; descriptionLength: number; canonical: string | null; robots: string | null; ogImage: string | null; ogTitle: string | null; ogDescription: string | null; twitterImage: string | null }
  headings: { h1Count: number; total: number; h1Texts: string[]; byLevel?: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number }; texts?: { h2: string[]; h3: string[] } }
  images: { total: number; missingAlt: number; emptyAlt: number; samples: { src: string; alt: string | null; reason: 'missing' | 'empty' }[] }
  issues: AuditIssue[]
}

type TaskStatus = 'done' | 'warn' | 'error' | 'unknown'

// ---------------------------------------------------------------------------
// Page entry
// ---------------------------------------------------------------------------

export default function SeoPage() {
  return (
    <Suspense>
      <SeoInner />
    </Suspense>
  )
}

function SeoInner() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('website') ?? ''
  const toast = useToast()

  const [overrides, setOverrides] = useState<Override[]>([])
  const [altOverrides, setAltOverrides] = useState<AltOverride[]>([])
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [addingRow, setAddingRow] = useState<Partial<Override> | null>(null)
  const [profile, setProfile] = useState<SiteProfile | null>(null)
  const [sitemap, setSitemap] = useState<SitemapResult | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [language, setLanguage] = useState<Language>('en')
  const [editingProfile, setEditingProfile] = useState(false)

  function loadOverrides() {
    if (!domain) return
    fetch(`/api/seo?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setOverrides(d) })
      .catch(() => {})
  }
  function loadAlts() {
    if (!domain) return
    fetch(`/api/seo/alt-overrides?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setAltOverrides(d) })
      .catch(() => {})
  }
  function loadProfile() {
    if (!domain) return
    fetch(`/api/seo/profile?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d === 'object') setProfile(d) })
      .catch(() => {})
  }
  function loadSitemap() {
    if (!domain) return
    fetch(`/api/seo/sitemap?website=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSitemap(d) })
      .catch(() => {})
  }
  function loadIntegrations() {
    if (!domain) return
    fetch(`/api/integrations?domain=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setIntegrations(d) })
      .catch(() => {})
  }
  async function runAudit(path: string) {
    if (!domain) return
    setAuditing(true)
    try {
      const res = await fetch('/api/seo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, path }),
      })
      const data = await res.json()
      if (res.ok) setAudit(data)
      else toast.error(data.error ?? 'Audit failed', 'Audit failed')
    } catch (e) {
      toast.error((e as Error).message, 'Audit failed')
    } finally {
      setAuditing(false)
    }
  }

  // Initial load — pull overrides, alt-overrides, and audit the homepage in
  // parallel. The homepage audit drives the Step 1 task statuses; other pages
  // are evaluated against override state only (re-running the audit per page
  // is too expensive for a list view — a per-task "Run audit" action handles
  // those).
  useEffect(() => {
    if (!domain) return
    loadOverrides()
    loadAlts()
    loadProfile()
    loadSitemap()
    loadIntegrations()
    runAudit('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])

  // Languages the site has opted into via the brand profile. Falls back to
  // ['en'] until the profile loads or if it's never been configured.
  const enabledLanguages: Language[] = profile && profile.languages.length > 0
    ? profile.languages.filter((l): l is Language => l === 'en' || l === 'ms' || l === 'zh')
    : ['en']

  // If the active language is no longer available (profile changed, BM was
  // disabled, etc.) snap back to the first enabled one. Hook lives above the
  // domain early-return so the hook order stays constant across renders.
  useEffect(() => {
    if (!enabledLanguages.includes(language)) setLanguage(enabledLanguages[0] ?? 'en')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledLanguages.join(',')])

  if (!domain) {
    return (
      <div>
        <PageHeader title="SEO" description="Pick a website from the home dashboard to manage its SEO." />
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#64748b' }}>No website selected.</p>
        </div>
      </div>
    )
  }

  const homepageOverride = overrides.find(o => o.path === '/' && o.language === language) ?? null
  const onRefresh = () => { loadOverrides(); loadAlts(); runAudit('/') }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <PageHeader
            title="SEO Setup Checklist"
            description={<span>Complete all SEO tasks to help <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{domain}</code> get found in search results and AI chat responses.</span>}
          />
        </div>
        <LanguageToggle value={language} onChange={setLanguage} enabled={enabledLanguages} onManage={() => setEditingProfile(true)} />
      </div>

      <BusinessInfoBar domain={domain} profile={profile} editing={editingProfile} onEditingChange={setEditingProfile} onSaved={loadProfile} />

      <div className="space-y-3 mt-4">
        <Step1Card
          domain={domain}
          audit={audit}
          override={homepageOverride}
          auditing={auditing}
          profile={profile}
          language={language}
          gscIntegration={integrations.find(i => i.provider === 'gsc') ?? null}
          onRefresh={onRefresh}
          onRunAudit={() => runAudit('/')}
        />
        <Step2Card
          domain={domain}
          overrides={overrides}
          altOverrides={altOverrides}
          audit={audit}
          sitemap={sitemap}
          profile={profile}
          language={language}
          onRefresh={onRefresh}
          onAdd={prefill => setAddingRow(prefill ?? { path: '/', language, title: '', description: '', og_image: '' })}
        />
        <Step3Card domain={domain} />
      </div>

      {addingRow && (
        <SeoOverrideModal
          domain={domain}
          row={addingRow}
          onClose={() => setAddingRow(null)}
          onSaved={() => { setAddingRow(null); onRefresh() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Language toggle — pinned to the top right of the page header
// ---------------------------------------------------------------------------

function LanguageToggle({ value, onChange, enabled, onManage }: { value: Language; onChange: (l: Language) => void; enabled: Language[]; onManage: () => void }) {
  const visible = LANGUAGES.filter(l => enabled.includes(l.code))
  const hasMore = enabled.length < LANGUAGES.length
  return (
    <div className="inline-flex items-center rounded-full p-0.5 mt-1 flex-shrink-0" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
      {visible.map(({ code, label }) => {
        const active = value === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className="text-[11px] font-semibold tracking-wider px-3 h-7 rounded-full transition-colors"
            style={{
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'white' : '#64748b',
            }}
            aria-pressed={active}
          >
            {label}
          </button>
        )
      })}
      {hasMore && (
        <button
          type="button"
          onClick={onManage}
          title="Add another language"
          className="text-[11px] font-semibold w-7 h-7 rounded-full transition-colors hover:bg-white"
          style={{ color: 'var(--primary)' }}
        >
          +
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Business info bar — brand / location / keywords with inline edit modal
// ---------------------------------------------------------------------------

function BusinessInfoBar({ domain, profile, editing, onEditingChange, onSaved }: { domain: string; profile: SiteProfile | null; editing: boolean; onEditingChange: (next: boolean) => void; onSaved: () => void }) {
  const brand = profile?.brand_name || '—'
  const location = profile?.location || '—'
  const keywords = profile && profile.keywords.length > 0 ? profile.keywords.join(', ') : '—'

  return (
    <>
      <div className="rounded-xl border bg-white px-5 py-3 flex items-center gap-6 flex-wrap" style={{ borderColor: '#e2e8f0' }}>
        <InfoCell label="Business or Brand Name" value={brand} />
        <span style={{ color: '#e2e8f0' }}>|</span>
        <InfoCell label="Location" value={location} />
        <span style={{ color: '#e2e8f0' }}>|</span>
        <InfoCell label="Keywords" value={keywords} wide />
        <button
          type="button"
          onClick={() => onEditingChange(true)}
          title="Edit Brand Profile"
          className="ml-auto w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ color: 'var(--primary)' }}
        >
          <PencilSquareIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      {editing && (
        <BrandProfileModal
          domain={domain}
          profile={profile}
          onClose={() => onEditingChange(false)}
          onSaved={() => { onEditingChange(false); onSaved() }}
        />
      )}
    </>
  )
}

function InfoCell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 flex items-center ${wide ? 'flex-1' : ''}`}>
      <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{label}</span>
      <span className="text-xs ml-1.5 truncate" style={{ color: '#94a3b8' }}>: {value}</span>
    </div>
  )
}

function BrandProfileModal({ domain, profile, onClose, onSaved }: { domain: string; profile: SiteProfile | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [brandName, setBrandName] = useState(profile?.brand_name ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [keywordsText, setKeywordsText] = useState((profile?.keywords ?? []).join(', '))
  const [languages, setLanguages] = useState<Language[]>(
    profile?.languages && profile.languages.length > 0
      ? profile.languages.filter((l): l is Language => l === 'en' || l === 'ms' || l === 'zh')
      : ['en']
  )
  const [saving, setSaving] = useState(false)

  function toggleLang(code: Language) {
    setLanguages(prev => {
      // Don't allow removing the last enabled language — every site needs one.
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter(l => l !== code) : prev
      }
      return [...prev, code]
    })
  }

  async function save() {
    setSaving(true)
    try {
      const keywords = keywordsText
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
        .slice(0, 32)
      const res = await fetch('/api/seo/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, brand_name: brandName.trim(), location: location.trim(), keywords, languages }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success('Brand profile saved.', 'Saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <LoadingOverlay visible={saving} label="Saving brand profile…" />
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Edit Brand Profile</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-slate-100" style={{ color: '#94a3b8' }}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Business or brand name</label>
            <Input
              size="lg"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Aircond Service & Pasang Aircond"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Location / market</label>
            <Input
              size="lg"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Malaysia, Klang Valley"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Keywords (comma-separated)</label>
            <Textarea
              value={keywordsText}
              onChange={e => setKeywordsText(e.target.value)}
              placeholder="aircond installation, aircond service, pasang aircond"
              rows={3}
            />
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>These ground the AI title-suggestion endpoint and will surface in the audit&apos;s keyword check.</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Site languages</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(({ code, label }) => {
                const checked = languages.includes(code)
                return (
                  <label key={code} className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 rounded-full cursor-pointer transition-colors" style={{ background: checked ? '#eff6ff' : 'white', border: `1px solid ${checked ? '#bfdbfe' : '#e2e8f0'}`, color: checked ? 'var(--primary)' : '#475569' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleLang(code)} className="w-3 h-3" />
                    <span className="font-semibold tracking-wider">{label}</span>
                    <span className="text-[10px]" style={{ color: '#94a3b8' }}>{code === 'en' ? 'English' : code === 'ms' ? 'Bahasa Malaysia' : 'Mandarin'}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>Pick the languages this site publishes in. The EN | BM toggle on the SEO checklist only shows the languages enabled here.</p>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2 bg-slate-50 border-t border-slate-100">
          <Button variant="ghost" size="lg" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="lg" onClick={save} loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepCard — collapsible container with progress bar
// ---------------------------------------------------------------------------

function StepCard({
  step,
  title,
  subtitle,
  done,
  total,
  children,
  defaultOpen = false,
}: {
  step: number
  title: string
  subtitle?: string
  done: number
  total: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done >= total

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Step {step}: {title}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {total > 0 && <ProgressPill done={done} total={total} complete={complete} pct={pct} />}
          <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: '1px solid #e2e8f0', color: '#94a3b8' }}>
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ProgressPill({ done, total, complete, pct }: { done: number; total: number; complete: boolean; pct: number }) {
  return (
    <div className="inline-flex items-center gap-2 h-7 px-2.5 rounded-full" style={{ border: '1px solid #e2e8f0', background: 'white' }}>
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: complete ? '#16a34a' : 'var(--primary)' }} />
      </div>
      {complete ? (
        <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white" style={{ background: '#16a34a' }}>
          <CheckIcon className="w-2.5 h-2.5" />
        </span>
      ) : (
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#475569' }}>{done}/{total}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task — single row with status icon + expandable body
// ---------------------------------------------------------------------------

function Task({
  status,
  title,
  hint,
  children,
}: {
  status: TaskStatus
  title: React.ReactNode
  hint?: React.ReactNode
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const expandable = !!children

  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      <button
        type="button"
        onClick={() => expandable && setOpen(v => !v)}
        disabled={!expandable}
        className={`w-full flex items-center gap-3 px-5 py-3 text-left ${expandable ? 'hover:bg-slate-50' : 'cursor-default'} transition-colors`}
      >
        <StatusIcon status={status} />
        <span className="flex-1 text-sm" style={{ color: 'var(--foreground)' }}>{title}</span>
        {hint && <span className="text-xs" style={{ color: '#94a3b8' }}>{hint}</span>}
        {expandable && (
          <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {expandable && open && (
        <div className="px-5 py-4" style={{ background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') return (
    <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white" style={{ background: '#16a34a' }}>
      <CheckIcon className="w-3 h-3" />
    </span>
  )
  if (status === 'error') return (
    <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold" style={{ background: '#dc2626' }}>!</span>
  )
  if (status === 'warn') return (
    <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold" style={{ background: '#f59e0b' }}>!</span>
  )
  return (
    <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ border: '1.5px solid #cbd5e1' }} />
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Homepage readiness
// ---------------------------------------------------------------------------

function Step1Card({
  domain,
  audit,
  override,
  auditing,
  profile,
  language,
  gscIntegration,
  onRefresh,
  onRunAudit,
}: {
  domain: string
  audit: AuditResult | null
  override: Override | null
  auditing: boolean
  profile: SiteProfile | null
  language: Language
  gscIntegration: Integration | null
  onRefresh: () => void
  onRunAudit: () => void
}) {
  // Compute task statuses from audit + override state.
  // A task is "done" if either an admin override is set OR the live page already
  // has good content. Audit data can be null on initial load — show 'unknown'.
  const titleStatus: TaskStatus = override?.title || (audit?.meta.title && audit.meta.titleLength >= 30 && audit.meta.titleLength <= 60)
    ? 'done'
    : audit?.meta.title ? 'warn' : audit ? 'error' : 'unknown'

  const descStatus: TaskStatus = override?.description || (audit?.meta.description && audit.meta.descriptionLength >= 70 && audit.meta.descriptionLength <= 160)
    ? 'done'
    : audit?.meta.description ? 'warn' : audit ? 'error' : 'unknown'

  const ogStatus: TaskStatus = override?.og_image || audit?.meta.ogImage ? 'done' : audit ? 'warn' : 'unknown'

  // Heading status: needs exactly one h1 AND at least one h2 sub-section.
  // h1=1 with no h2 = warn (only the page title, no structure).
  const headingStatus: TaskStatus = audit
    ? audit.headings.h1Count === 0
      ? 'error'
      : audit.headings.h1Count > 1
        ? 'warn'
        : (audit.headings.byLevel?.h2 ?? 0) === 0
          ? 'warn'
          : 'done'
    : 'unknown'

  const indexStatus: TaskStatus = audit ? (audit.meta.robots && /noindex/i.test(audit.meta.robots) ? 'error' : 'done') : 'unknown'

  const canonicalStatus: TaskStatus = audit ? (audit.meta.canonical ? 'done' : 'warn') : 'unknown'

  // GSC: 'done' once an integration row with a chosen property exists. A row
  // without property_id means the user authorised but didn't pick the
  // property — still 'warn' until they finish that flow.
  const gscStatus: TaskStatus = gscIntegration
    ? gscIntegration.property_id ? 'done' : 'warn'
    : 'warn'

  const tasks: TaskStatus[] = [titleStatus, descStatus, ogStatus, headingStatus, indexStatus, canonicalStatus, gscStatus]
  const done = tasks.filter(s => s === 'done').length

  return (
    <StepCard
      step={1}
      title="Get the homepage ready for Google Search"
      done={done}
      total={tasks.length}
      defaultOpen
    >
      <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
        <div className="flex items-center gap-2">
          {auditing && <Spinner size="sm" />}
          <p className="text-[11px]" style={{ color: '#94a3b8' }}>
            {auditing ? 'Auditing homepage…' : audit ? `Audited ${new Date(audit.fetchedAt).toLocaleTimeString()}` : 'Not yet audited'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRunAudit}
          loading={auditing}
        >
          {auditing ? 'Running…' : 'Re-run audit'}
        </Button>
      </div>

      <Task
        status={titleStatus}
        title="Set the homepage's title for search results"
        hint={audit?.meta.title ? `${audit.meta.titleLength} chars` : undefined}
      >
        <TitleEditor key={language} domain={domain} path="/" language={language} current={audit?.meta.title} override={override?.title ?? null} otherFields={override} profile={profile} onSaved={onRefresh} />
      </Task>

      <Task
        status={descStatus}
        title="Add the homepage's description for search results"
        hint={audit?.meta.description ? `${audit.meta.descriptionLength} chars` : undefined}
      >
        <DescriptionEditor key={language} domain={domain} path="/" language={language} current={audit?.meta.description} override={override?.description ?? null} otherFields={override} onSaved={onRefresh} />
      </Task>

      <Task
        status={headingStatus}
        title="Use proper heading structure (<h1>, <h2>, <h3>…)"
        hint={audit ? `${audit.headings.total} heading${audit.headings.total === 1 ? '' : 's'} on page` : undefined}
      >
        <HeadingDetail audit={audit} domain={domain} language={language} />
      </Task>

      <Task
        status={indexStatus}
        title="Allow indexing to make this homepage visible in search results"
      >
        <IndexingDetail domain={domain} path="/" robots={audit?.meta.robots ?? null} gscIntegration={gscIntegration} />
      </Task>

      <Task
        status={ogStatus}
        title="Add a social share image (used for WhatsApp, Facebook, Twitter previews)"
      >
        <OgImageEditor key={language} domain={domain} path="/" language={language} current={audit?.meta.ogImage} override={override?.og_image ?? null} otherFields={override} onSaved={onRefresh} />
      </Task>

      <Task
        status={canonicalStatus}
        title="Set a canonical URL"
      >
        <ReadOnlyExplainer
          why="A canonical URL tells Google which version of a page to index when the same content can be reached from multiple URLs."
          how={audit?.meta.canonical
            ? `Current canonical: ${audit.meta.canonical}`
            : 'No <link rel="canonical"> found. Add one in the designer site\'s <head>, pointing to the preferred URL of this page.'}
        />
      </Task>

      <Task
        status={gscStatus}
        title={<span>Connect this site to <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Google Search Console</span></span>}
        hint={gscIntegration?.property_id ? gscIntegration.property_id : undefined}
      >
        <div className="space-y-2">
          {gscIntegration?.property_id ? (
            <>
              <p className="text-xs" style={{ color: '#16a34a' }}>
                <CheckIcon className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                Connected to <code className="font-mono text-[11px]">{gscIntegration.property_id}</code>
              </p>
              <a
                href={`/integrations?website=${encodeURIComponent(domain)}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
              >
                Manage in Integrations
                <ArrowRightIcon className="w-3 h-3" />
              </a>
            </>
          ) : gscIntegration ? (
            <>
              <p className="text-xs" style={{ color: '#a16207' }}>Authorised, but no property selected yet. Pick the right Search Console property to finish the connection.</p>
              <a
                href={`/integrations?website=${encodeURIComponent(domain)}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--primary)' }}
              >
                Pick property
                <ArrowRightIcon className="w-3 h-3" />
              </a>
            </>
          ) : (
            <>
              <p className="text-xs" style={{ color: '#475569' }}>Search Console reports indexing errors, search performance, and lets you submit sitemaps.</p>
              <a
                href={`/integrations?website=${encodeURIComponent(domain)}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--primary)' }}
              >
                Open Integrations
                <ArrowRightIcon className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </Task>
    </StepCard>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Per-page optimization
// ---------------------------------------------------------------------------

function Step2Card({
  domain,
  overrides,
  altOverrides,
  audit,
  sitemap,
  profile,
  language,
  onRefresh,
  onAdd,
}: {
  domain: string
  overrides: Override[]
  altOverrides: AltOverride[]
  audit: AuditResult | null
  sitemap: SitemapResult | null
  profile: SiteProfile | null
  language: Language
  onRefresh: () => void
  onAdd: (prefill?: Partial<Override>) => void
}) {
  // Page list = sitemap paths ∪ override paths ∪ homepage. The sitemap is the
  // authoritative source of "every page that exists on this site"; overrides
  // cover any extra pages an admin has registered manually. Pattern rows
  // (is_pattern=true) live in a separate section above the per-page list,
  // so we exclude them from the page enumeration here.
  const exactOverrides = overrides.filter(o => !o.is_pattern)
  const patternOverrides = overrides.filter(o => o.is_pattern)
  const allPaths = new Set<string>(['/'])
  ;(sitemap?.paths ?? []).forEach(p => allPaths.add(p))
  exactOverrides.forEach(o => allPaths.add(o.path))

  // Hide paths that are already covered by an active-language pattern. They
  // appear under the "Patterns" section instead, so listing them again as
  // standalone tasks is just noise. Homepage is always shown so the audit
  // tasks (alt text, h1, etc.) stay visible. An exact-path override beats
  // any pattern, so paths with their own override stay too.
  const activePatterns = patternOverrides.filter(p => p.language === language)
  const exactPathSet = new Set(exactOverrides.filter(o => o.language === language).map(o => o.path))
  const hiddenByPattern: string[] = []
  const visibleAfterPattern: string[] = []
  for (const p of allPaths) {
    const exempt = p === '/' || exactPathSet.has(p)
    const matched = !exempt && activePatterns.some(pat => matchPattern(pat.path, p) !== null)
    if (matched) hiddenByPattern.push(p)
    else visibleAfterPattern.push(p)
  }
  const orderedPaths = visibleAfterPattern.sort((a, b) => a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b))
  // Truncate the visible list to keep the section scannable. The "See all"
  // affordance (next to the "Add page" button) reveals the rest.
  const COLLAPSE_LIMIT = 5
  const [showAll, setShowAll] = useState(false)
  const visiblePaths = showAll ? orderedPaths : orderedPaths.slice(0, COLLAPSE_LIMIT)
  const hiddenCount = orderedPaths.length - visiblePaths.length

  // Detect groups of similar paths the user could replace with one pattern.
  // Skips paths already covered by exact overrides or existing patterns so we
  // don't suggest something the admin already set up.
  const suggestions = suggestPatterns(
    [...allPaths],
    new Set(orderedPaths.filter(p => exactPathSet.has(p))),
    activePatterns.map(p => p.path),
  ).slice(0, 3)

  // Per-task tally:
  //   - title set (override.title not null)
  //   - description set
  //   - alt: for the homepage we use the audit's samples (now uncapped at 200)
  //     compared against saved overrides. Other paths don't have audit data.
  const altOverrideSrcs = new Set(altOverrides.map(a => a.image_src))

  let totalTasks = 0
  let doneTasks = 0
  // Count saved patterns toward the active-language total so the progress
  // pill reflects their existence; one row per pattern.
  for (const p of patternOverrides) {
    if (p.language === language) {
      totalTasks += 1
      if (p.title || p.description) doneTasks += 1
    }
  }
  for (const path of orderedPaths) {
    const o = exactOverrides.find(x => x.path === path && x.language === language) ?? null
    totalTasks += 2 // title + description per page
    if (o?.title) doneTasks++
    if (o?.description) doneTasks++
    if (path === '/') {
      totalTasks += 1
      // Done = no audit-found missing images remain uncovered by overrides.
      // (Sample cap is 200 in the audit endpoint so this reflects reality
      // unless the page has >200 images, which would be extreme.)
      const stillMissing = audit ? audit.images.samples.filter(s => s.reason === 'missing' && !altOverrideSrcs.has(s.src)).length : Infinity
      if (audit && stillMissing === 0) doneTasks++
    }
  }

  return (
    <StepCard
      step={2}
      title="Optimize the site pages for search engines"
      subtitle="Complete these tasks to make the site pages easier to find in search results."
      done={doneTasks}
      total={totalTasks}
    >
      {/* Pattern suggestions. Surfaces the feature when the sitemap reveals
          groups of similar paths. One click pre-fills the modal so admins
          don't have to remember the syntax. */}
      {suggestions.length > 0 && (
        <div className="px-5 py-3" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#a16207' }}>
            <LightBulbIcon className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Set one rule, apply to many pages
          </p>
          <p className="text-[11px] mb-2" style={{ color: '#92400e' }}>The sitemap shows groups of similar pages. Save one pattern and the title/description applies to every match. No need to fill them in one by one.</p>
          <div className="space-y-1.5">
            {suggestions.map(s => (
              <button
                key={s.pattern}
                type="button"
                onClick={() => onAdd({ path: s.pattern, language, is_pattern: true, title: '', description: '', og_image: '' })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors hover:bg-amber-100"
                style={{ background: 'white', border: '1px solid #fde68a' }}
              >
                <code className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--primary)' }}>{s.pattern}</code>
                <span className="text-[11px]" style={{ color: '#64748b' }}>covers {s.matches.length} pages: <span className="font-mono">{s.matches.slice(0, 3).map(m => m.split('/').pop()).join(', ')}{s.matches.length > 3 ? `, +${s.matches.length - 3} more` : ''}</span></span>
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--primary)', color: 'white' }}>Set up</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pattern rules. Listed first so admins see the meta-rules that affect
          every matching page below. Filtered to the active language. */}
      {activePatterns.length > 0 && (
        <div>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: '#eff6ff', borderBottom: '1px solid #f1f5f9' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Patterns</span>
            <span className="text-[10px]" style={{ color: '#94a3b8' }}>
              {hiddenByPattern.length > 0
                ? `Apply to ${hiddenByPattern.length} matching page${hiddenByPattern.length === 1 ? '' : 's'} (hidden from the list below)`
                : 'Apply to every page that matches the wildcard'}
            </span>
          </div>
          {activePatterns.map(p => (
            <PatternRow key={p.id} domain={domain} override={p} matchedPaths={hiddenByPattern} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {visiblePaths.map(path => {
        const o = exactOverrides.find(x => x.path === path && x.language === language) ?? null
        const otherLangs = exactOverrides.filter(x => x.path === path && x.language !== language).map(x => x.language)
        const friendly = path === '/' ? 'Homepage' : path
        return (
          <div key={path}>
            <div className="px-5 py-2.5 flex items-center justify-between gap-2" style={{ background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold" style={{ color: '#475569' }}>{friendly}</span>
                {otherLangs.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: '#dbeafe', color: '#1e40af' }} title={`Also saved in: ${otherLangs.join(', ')}`}>
                    +{otherLangs.map(l => l === 'ms' ? 'BM' : l === 'zh' ? '中' : l.toUpperCase()).join('/')}
                  </span>
                )}
              </div>
              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }}>{path}</code>
            </div>
            <Task
              status={o?.title ? 'done' : 'warn'}
              title={<span>Set the <strong>{friendly}</strong> page&apos;s title for search results</span>}
            >
              <TitleEditor key={`${language}-${path}`} domain={domain} path={path} language={language} current={path === '/' ? audit?.meta.title : null} override={o?.title ?? null} otherFields={o} profile={profile} onSaved={onRefresh} />
            </Task>
            <Task
              status={o?.description ? 'done' : 'warn'}
              title={<span>Add the <strong>{friendly}</strong> page&apos;s meta description</span>}
            >
              <DescriptionEditor key={`${language}-${path}`} domain={domain} path={path} language={language} current={path === '/' ? audit?.meta.description : null} override={o?.description ?? null} otherFields={o} onSaved={onRefresh} />
            </Task>
            {path === '/' && audit && (() => {
              const stillMissing = audit.images.samples.filter(s => s.reason === 'missing' && !altOverrideSrcs.has(s.src)).length
              return (
              <Task
                status={stillMissing === 0 ? 'done' : 'error'}
                title="Add alt text to all images on the homepage"
                hint={stillMissing > 0 ? `${stillMissing} still missing` : undefined}
              >
                <AltTextEditor domain={domain} audit={audit} altOverrides={altOverrides} onRefresh={onRefresh} />
              </Task>
              )
            })()}
          </div>
        )
      })}

      <div className="px-5 py-3 flex items-center justify-center gap-2 flex-wrap" style={{ background: '#fafbfc' }}>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs font-medium px-3 h-8 rounded-full border transition-colors hover:bg-white"
            style={{ borderColor: '#e2e8f0', color: 'var(--primary)', background: 'white' }}
          >
            See all tasks ({orderedPaths.length})
          </button>
        )}
        {showAll && orderedPaths.length > COLLAPSE_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-xs font-medium px-3 h-8 rounded-full border transition-colors hover:bg-white"
            style={{ borderColor: '#e2e8f0', color: '#64748b', background: 'white' }}
          >
            Collapse
          </button>
        )}
        <button
          type="button"
          onClick={() => onAdd()}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full border transition-colors hover:bg-white"
          style={{ borderColor: '#e2e8f0', color: 'var(--primary)', background: 'white' }}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add another page override
        </button>
        {sitemap && (
          <span className="text-[10px]" style={{ color: '#94a3b8' }}>
            {sitemap.ok ? `Loaded ${sitemap.paths.length} pages from sitemap.xml` : `sitemap.xml not found. Manually-added pages only`}
          </span>
        )}
      </div>
    </StepCard>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Site health checks + ongoing maintenance tips
// ---------------------------------------------------------------------------

type HealthCheck = {
  domain: string
  favicon: { ok: boolean; status: number | null; foundAt: string | null }
  robots: { ok: boolean; status: number | null }
  sitemap: { ok: boolean; status: number | null }
  https: { ok: boolean; status: number | null }
  tracker: { ok: boolean; eventCount7d: number }
  revalidate: { configured: boolean; url: string | null }
  productsCount: number
  gscConnected: boolean
}

function Step3Card({ domain }: { domain: string }) {
  const [data, setData] = useState<HealthCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runChecks = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/seo/health-check?domain=${encodeURIComponent(domain)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: HealthCheck) => setData(d))
      .catch(e => setError((e as Error).message || 'Failed to load checks'))
      .finally(() => setLoading(false))
  }, [domain])

  useEffect(() => { runChecks() }, [runChecks])

  // Score: count automated checks that passed, out of those that apply.
  const checks = useMemo(() => {
    if (!data) return [] as { key: string; ok: boolean; label: string; detail: string; href?: string; applicable: boolean }[]
    return [
      {
        key: 'https',
        ok: data.https.ok,
        applicable: true,
        label: 'Site responds over HTTPS',
        detail: data.https.ok
          ? `Root URL returns ${data.https.status}. SSL is active.`
          : `Could not reach https://${domain}. Verify DNS/SSL.`,
      },
      {
        key: 'favicon',
        ok: data.favicon.ok,
        applicable: true,
        label: 'Favicon present',
        detail: data.favicon.ok
          ? `Found at ${data.favicon.foundAt}. Browser tabs and search results show your icon.`
          : 'No favicon found at /favicon.ico, /icon.png, or /apple-touch-icon.png. Upload one — search results render the missing icon as a generic globe.',
      },
      {
        key: 'robots',
        ok: data.robots.ok,
        applicable: true,
        label: 'robots.txt reachable',
        detail: data.robots.ok
          ? 'Crawlers can read crawl rules.'
          : 'No robots.txt at the root. Without one, search engines guess what they can index.',
      },
      {
        key: 'sitemap',
        ok: data.sitemap.ok,
        applicable: true,
        label: 'sitemap.xml reachable',
        detail: data.sitemap.ok
          ? 'Sitemap is served. Submit it in Search Console so Google fetches it on every change.'
          : `No sitemap at /sitemap.xml. Generate one — Google indexes pages much faster when a sitemap lists them.`,
      },
      {
        key: 'tracker',
        ok: data.tracker.ok,
        applicable: true,
        label: 'Webcore tracker connected',
        detail: data.tracker.ok
          ? `${data.tracker.eventCount7d.toLocaleString()} events in the last 7 days. Analytics + lead attribution working.`
          : 'No tracker events received in the last 7 days. The tracker JS may be missing or blocked — without it, the dashboards show nothing for this site.',
      },
      {
        key: 'revalidate',
        ok: data.revalidate.configured,
        applicable: data.productsCount > 0,
        label: 'Product / blog revalidation wired',
        detail: data.revalidate.configured
          ? `Webhook posts to ${data.revalidate.url}. Edits in Webcore appear on the live site within seconds.`
          : `No revalidate URL configured. With ${data.productsCount} products on this site, edits won't reach the live page until the host rebuilds. Add a webhook in Settings → Revalidation.`,
      },
      // GSC connection lives in Step 1 already — don't duplicate it here.
    ]
  }, [data, domain])

  const applicable = checks.filter(c => c.applicable)
  const done = applicable.filter(c => c.ok).length
  const total = applicable.length

  return (
    <StepCard
      step={3}
      title="Site health and ongoing SEO"
      subtitle="Automated checks for the things that quietly break — plus the maintenance habits that keep rankings from drifting."
      done={done}
      total={total}
    >
      <div className="px-5 py-4 space-y-4">
        {/* Header strip with refresh */}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: '#64748b' }}>
            {loading
              ? 'Running checks…'
              : error
                ? <span style={{ color: '#b91c1c' }}>Couldn&apos;t run checks: {error}</span>
                : `${done} of ${total} passing`}
          </p>
          <button
            onClick={runChecks}
            disabled={loading}
            className="text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ color: 'var(--primary)' }}
          >
            {loading ? 'Refreshing…' : 'Re-run checks'}
          </button>
        </div>

        {/* Automated checks */}
        {!loading && !error && data && (
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {applicable.map((c, i) => (
              <div
                key={c.key}
                className="flex items-start gap-3 px-4 py-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}
              >
                <span
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: c.ok ? '#dcfce7' : '#fef2f2',
                    color: c.ok ? '#15803d' : '#b91c1c',
                  }}
                >
                  {c.ok ? <CheckIcon className="w-3 h-3" /> : <XMarkIcon className="w-3 h-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{c.detail}</p>
                </div>
                {c.href && !c.ok && (
                  <Link
                    href={c.href}
                    className="text-[11px] font-semibold whitespace-nowrap mt-0.5"
                    style={{ color: 'var(--primary)' }}
                  >
                    Set up &rsaquo;
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Maintenance tips — non-automated, ongoing reminders */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Ongoing maintenance</p>
          <Tip
            title="Submit the sitemap to Search Console"
            body={<>Paste <code className="font-mono text-[11px] px-1 py-0.5 rounded" style={{ background: '#f1f5f9' }}>{`https://${domain}/sitemap.xml`}</code> into Search Console &rsaquo; Sitemaps. Google re-fetches it on every publish, so new pages get indexed within hours instead of weeks.</>}
          />
          <Tip
            title="Re-run the audit weekly"
            body="Designer changes can quietly introduce broken canonicals, oversized images, and stripped alt text. A weekly Step 1+2 audit catches regressions before they hurt rankings."
          />
          <Tip
            title="Watch the Coverage report"
            body="Search Console &rsaquo; Pages flags URLs it can't index. Any non-zero count in &lsquo;Why pages aren't indexed&rsquo; deserves a look."
          />
          <Tip
            title="Validate structured data"
            body={<>Open <a href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(`https://${domain}`)}`} target="_blank" rel="noopener" className="underline" style={{ color: 'var(--primary)' }}>Rich Results Test</a> for the homepage and a key product/blog page. Schema errors silently strip eligibility for rich snippets.</>}
          />
          <Tip
            title="Check Core Web Vitals"
            body={<>Run <a href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(`https://${domain}`)}`} target="_blank" rel="noopener" className="underline" style={{ color: 'var(--primary)' }}>PageSpeed Insights</a> monthly. LCP &lt; 2.5s, CLS &lt; 0.1, INP &lt; 200ms — anything worse and Google ranks competitors above you on mobile.</>}
          />
          <Tip
            title="Publish fresh content on a cadence"
            body="Search engines reward sites that update regularly. Use the Blog and Products tabs to publish at least a couple of items per month per site."
          />
        </div>
      </div>
    </StepCard>
  )
}

function Tip({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: '#fef3c7', color: '#a16207' }}>
        <LightBulbIcon className="w-3 h-3" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{body}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Title editor — title input + Google SERP preview, with Apply button
// ---------------------------------------------------------------------------

interface OtherOverrideFields {
  description?: string | null
  og_image?: string | null
}

function TitleEditor({ domain, path, language, current, override, otherFields, profile, onSaved }: { domain: string; path: string; language: Language; current: string | null | undefined; override: string | null; otherFields: OtherOverrideFields | null; profile: SiteProfile | null; onSaved: () => void }) {
  const toast = useToast()
  const [value, setValue] = useState(override ?? current ?? '')
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)

  async function suggest() {
    setSuggesting(true)
    try {
      const res = await fetch('/api/seo/suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, path, language, current_title: value || current || '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not generate suggestions', 'Suggestion failed')
        return
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (e) {
      toast.error((e as Error).message, 'Suggestion failed')
    } finally {
      setSuggesting(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path,
          language,
          title: value.trim() || null,
          description: otherFields?.description ?? null,
          og_image: otherFields?.og_image ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success('Title saved. Applies on the live site within seconds.', 'SEO override saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const tooLong = value.length > 60
  const tooShort = value.length > 0 && value.length < 30
  const hasKeywords = profile && profile.keywords.length > 0
  const matchesKeyword = hasKeywords && value && profile!.keywords.some(k => value.toLowerCase().includes(k.toLowerCase()))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
        <p className="text-xs mb-3" style={{ color: '#475569' }}>A clear, concise title helps Google explain what this page offers and brings more relevant visitors.</p>
        <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>How to do it</h4>
        <p className="text-[11px] mb-2" style={{ color: '#64748b' }}>{current ? <>Current title: <span className="font-mono">{current}</span></> : 'No title currently set on the live page.'}</p>

        {suggestions.length > 0 && (
          <div className="mb-3 space-y-1.5 rounded-md p-2.5" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>AI suggestions (click to use)</p>
            {suggestions.map((s, i) => (
              <label key={i} className="flex items-start gap-2 text-xs cursor-pointer rounded px-1.5 py-1 hover:bg-slate-50" style={{ color: '#475569' }}>
                <input
                  type="radio"
                  name={`title-suggestion-${path}`}
                  checked={chosen === s}
                  onChange={() => { setChosen(s); setValue(s) }}
                  className="mt-0.5"
                />
                <span className="flex-1">{s}</span>
                <span className="text-[10px] tabular-nums" style={{ color: '#94a3b8' }}>{s.length}</span>
              </label>
            ))}
          </div>
        )}

        <Input
          size="lg"
          value={value}
          onChange={e => { setValue(e.target.value); setChosen(null) }}
          placeholder="Enter a title…"
          invalid={tooLong}
        />
        <p className="text-[10px] mt-1" style={{ color: tooLong ? '#b91c1c' : tooShort ? '#a16207' : '#94a3b8' }}>
          {value.length}/60 · {tooLong ? 'Google may truncate over 60 characters.' : tooShort ? 'Aim for 50 to 60 characters.' : 'Looking good.'}
        </p>

        {hasKeywords && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px]">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: matchesKeyword ? '#dcfce7' : '#fef3c7', color: matchesKeyword ? '#16a34a' : '#a16207' }}>
              {matchesKeyword
                ? <><CheckIcon className="w-2.5 h-2.5" /> includes a target keyword</>
                : <><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg> add at least one keyword</>}
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={save}
            loading={saving}
            disabled={!value.trim()}
            className="!rounded-full"
          >
            Apply & Publish
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={suggest}
            loading={suggesting}
            title={hasKeywords ? 'Generate AI title suggestions' : 'Set keywords in the brand profile for better suggestions'}
            className="!rounded-full"
            iconLeft={
              <LightBulbIcon className="w-3.5 h-3.5" />
            }
          >
            {suggesting ? 'Thinking…' : 'Suggest titles'}
          </Button>
        </div>
      </div>
      <GooglePreview domain={domain} path={path} title={value || current || domain} description={otherFields?.description ?? null} />
    </div>
  )
}

function DescriptionEditor({ domain, path, language, current, override, otherFields, onSaved }: { domain: string; path: string; language: Language; current: string | null | undefined; override: string | null; otherFields: { title?: string | null; og_image?: string | null } | null; onSaved: () => void }) {
  const toast = useToast()
  const [value, setValue] = useState(override ?? current ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path,
          language,
          title: otherFields?.title ?? null,
          description: value.trim() || null,
          og_image: otherFields?.og_image ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success('Description saved.', 'SEO override saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const tooLong = value.length > 160
  const tooShort = value.length > 0 && value.length < 70

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
        <p className="text-xs mb-3" style={{ color: '#475569' }}>The meta description is the snippet Google shows under the title in search results. A strong description increases click-through.</p>
        <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>How to do it</h4>
        <Textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Write a one or two sentence summary of this page…"
          rows={3}
          invalid={tooLong}
        />
        <p className="text-[10px] mt-1" style={{ color: tooLong ? '#b91c1c' : tooShort ? '#a16207' : '#94a3b8' }}>
          {value.length}/160 · {tooLong ? 'Google truncates over 160 characters.' : tooShort ? 'Aim for 120 to 160 characters.' : 'Looking good.'}
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={save}
          loading={saving}
          className="mt-3 !rounded-full"
        >
          Apply & Publish
        </Button>
      </div>
      <GooglePreview domain={domain} path={path} title={otherFields?.title ?? current ?? domain} description={value || current || ''} />
    </div>
  )
}

function OgImageEditor({ domain, path, language, current, override, otherFields, onSaved }: { domain: string; path: string; language: Language; current: string | null | undefined; override: string | null; otherFields: { title?: string | null; description?: string | null } | null; onSaved: () => void }) {
  const toast = useToast()
  const [value, setValue] = useState(override ?? current ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/seo/upload?website=${encodeURIComponent(domain)}`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed', 'Upload failed')
        return
      }
      setValue(data.url)
      toast.success('Uploaded. Click Apply to publish.', 'Uploaded')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path,
          language,
          title: otherFields?.title ?? null,
          description: otherFields?.description ?? null,
          og_image: value.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success('Social image saved.', 'SEO override saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
      <p className="text-xs" style={{ color: '#475569' }}>WhatsApp, Facebook, Twitter, and LinkedIn use the og:image when someone shares a link to this page. A strong image makes the link more clickable.</p>
      <div className="flex items-center gap-3">
        <div className="w-24 h-14 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <PhotoIcon className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              disabled={saving}
            >
              {value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button variant="ghost" size="md" onClick={() => setValue('')}>
                Clear
              </Button>
            )}
          </div>
          <Input
            type="url"
            size="md"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="…or paste an image URL"
            className="mt-1.5"
          />
        </div>
      </div>
      <p className="text-[10px]" style={{ color: '#94a3b8' }}>PNG / JPG / WebP / GIF · max 4 MB · 1200 × 630 is ideal.</p>
      <Button variant="primary" size="md" onClick={save} loading={saving} className="!rounded-full">
        Apply & Publish
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alt-text editor — list of images with inline alt input
// ---------------------------------------------------------------------------

function AltTextEditor({ domain, audit, altOverrides, onRefresh }: { domain: string; audit: AuditResult; altOverrides: AltOverride[]; onRefresh: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const overrideMap = new Map(altOverrides.map(a => [a.image_src, a.alt]))
  const remaining = audit.images.samples.filter(s => !overrideMap.has(s.src))
  const filled = altOverrides.length

  async function save(src: string, alt: string) {
    const res = await fetch('/api/seo/alt-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website: domain, image_src: src, alt }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Save failed', 'Save failed')
      return false
    }
    toast.success('Alt text saved.', 'Saved')
    onRefresh()
    return true
  }

  async function remove(src: string) {
    const ok = await confirm({
      title: 'Remove alt-text override?',
      message: 'The image will fall back to whatever alt the designer site sets in code (or none).',
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/seo/alt-overrides?website=${encodeURIComponent(domain)}&image_src=${encodeURIComponent(src)}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Delete failed', 'Delete failed')
      return
    }
    toast.success('Override removed.', 'Removed')
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
      <p className="text-xs" style={{ color: '#475569' }}>Alt text helps screen readers describe images to users with visual impairments and gives Google more context for image search.</p>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium" style={{ color: '#475569' }}>{filled}/{filled + remaining.length} filled</p>
      </div>

      {remaining.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Needs alt text</p>
          {remaining.map((img, i) => (
            <AltRow key={i} domain={domain} imageSrc={img.src} reason={img.reason} onSave={save} />
          ))}
        </div>
      )}

      {altOverrides.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Saved overrides ({altOverrides.length})</p>
          {altOverrides.map(o => (
            <AltRow key={o.id} domain={domain} imageSrc={o.image_src} initialAlt={o.alt} onSave={save} onDelete={remove} />
          ))}
        </div>
      )}

      {remaining.length === 0 && altOverrides.length === 0 && (
        <p className="text-xs" style={{ color: '#94a3b8' }}>No images flagged. Re-run the audit if you&apos;ve added images recently.</p>
      )}
    </div>
  )
}

function AltRow({
  domain,
  imageSrc,
  initialAlt,
  reason,
  onSave,
  onDelete,
}: {
  domain: string
  imageSrc: string
  initialAlt?: string
  reason?: 'missing' | 'empty'
  onSave: (src: string, alt: string) => Promise<boolean>
  onDelete?: (src: string) => void
}) {
  const [value, setValue] = useState(initialAlt ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = value !== (initialAlt ?? '')
  const previewSrc = imageSrc.startsWith('http') ? imageSrc : `https://${domain}${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`

  async function save() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(imageSrc, value.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-md" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <div className="w-12 h-12 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: '#f1f5f9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewSrc} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-mono truncate" style={{ color: '#475569' }} title={imageSrc}>{imageSrc}</p>
        {reason && (
          <p className="text-[10px] mt-0.5" style={{ color: reason === 'missing' ? '#b91c1c' : '#94a3b8' }}>
            {reason === 'missing' ? 'No alt attribute' : 'Empty alt (decorative)'}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <Input
            size="md"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Describe this image for screen readers and search engines"
            onKeyDown={e => { if (e.key === 'Enter' && dirty && !saving) save() }}
            className="flex-1"
          />
          <Button
            variant="primary"
            size="md"
            onClick={save}
            loading={saving}
            disabled={!dirty || !value.trim()}
          >
            Save
          </Button>
          {onDelete && initialAlt !== undefined && (
            <Button variant="danger" size="md" onClick={() => onDelete(imageSrc)}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Read-only explainer — for tasks webcore can't fix remotely (h1, robots, canonical)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pattern row — displays a saved pattern override with edit + delete
// ---------------------------------------------------------------------------

function PatternRow({ domain, override, matchedPaths, onRefresh }: { domain: string; override: Override; matchedPaths?: string[]; onRefresh: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(override.title ?? '')
  const [description, setDescription] = useState(override.description ?? '')
  const [saving, setSaving] = useState(false)

  // Filter the supplied matched-paths list down to ones THIS pattern actually
  // captures. The parent passes the union of all matched paths so we have to
  // re-filter per pattern.
  const myMatches = (matchedPaths ?? []).filter(p => matchPattern(override.path, p) !== null)

  // Show what {match} would render as for a sample slug
  const sampleSubst = (s: string) => s.replace(/\{match\}/g, 'Shah Alam')

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path: override.path,
          language: override.language,
          is_pattern: true,
          title: title.trim() || null,
          description: description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success(`Updated pattern ${data.path}`, 'Saved')
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Remove pattern ${override.path}?`,
      message: 'Pages matching this pattern will fall back to whatever metadata the designer site renders.',
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/seo?website=${encodeURIComponent(domain)}&path=${encodeURIComponent(override.path)}&language=${override.language}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Delete failed', 'Delete failed')
      return
    }
    toast.success('Pattern removed.', 'Removed')
    onRefresh()
  }

  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white" style={{ background: 'var(--primary)' }}>
          <BoltIcon className="w-2.5 h-2.5" />
        </span>
        <code className="flex-1 text-xs font-mono truncate" style={{ color: '#475569' }}>{override.path}</code>
        {myMatches.length > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a' }} title={myMatches.slice(0, 10).join('\n') + (myMatches.length > 10 ? `\n…and ${myMatches.length - 10} more` : '')}>
            {myMatches.length} match{myMatches.length === 1 ? '' : 'es'}
          </span>
        )}
        <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#dbeafe', color: '#1e40af' }}>{override.language === 'ms' ? 'BM' : override.language === 'zh' ? '中文' : 'EN'}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 py-4 space-y-3" style={{ background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: '#475569' }}>Title template</label>
            <Input
              size="md"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="{match} Aircond Service | Brand"
            />
            {title.includes('{match}') && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--primary)' }}>Preview: <strong>{sampleSubst(title)}</strong></p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: '#475569' }}>Description template</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Find {match} aircond services. Same-day install…"
            />
            {description.includes('{match}') && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--primary)' }}>Preview: <strong>{sampleSubst(description)}</strong></p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={save} loading={saving}>Save</Button>
            <Button variant="danger" size="sm" onClick={remove}>Remove</Button>
            <p className="text-[10px] ml-auto" style={{ color: '#94a3b8' }}>Use <code className="font-mono">{'{match}'}</code> to insert the wildcard portion.</p>
          </div>
          {myMatches.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Matching pages ({myMatches.length})</p>
              <div className="flex flex-wrap gap-1">
                {myMatches.slice(0, 24).map(p => (
                  <code key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#475569' }}>{p}</code>
                ))}
                {myMatches.length > 24 && (
                  <span className="text-[10px]" style={{ color: '#94a3b8' }}>… +{myMatches.length - 24} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heading detail — per-level breakdown + structural recommendation
// ---------------------------------------------------------------------------

function HeadingDetail({ audit, domain, language }: { audit: AuditResult | null; domain: string; language: Language }) {
  if (!audit) return <p className="text-xs" style={{ color: '#94a3b8' }}>Audit hasn&apos;t finished.</p>
  const levels = audit.headings.byLevel ?? { h1: audit.headings.h1Count, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }
  const tips: string[] = []
  if (levels.h1 === 0) tips.push('Add exactly one <h1> as the page\'s main title.')
  else if (levels.h1 > 1) tips.push(`Reduce to one <h1>. Found ${levels.h1}; use <h2>/<h3> for sub-sections.`)
  if (levels.h1 === 1 && levels.h2 === 0) tips.push('Break the page content into <h2> sections so search engines understand the hierarchy.')
  if (levels.h3 > 0 && levels.h2 === 0) tips.push('Skipped level: <h3> appears without an <h2>. Use h1 → h2 → h3 in order.')
  if (tips.length === 0) tips.push('Heading structure looks healthy.')

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
        <p className="text-xs mt-1" style={{ color: '#475569' }}>Headings tell Google and screen readers how the page is organised. A single <code className="font-mono text-[11px]">h1</code> describes the page; <code className="font-mono text-[11px]">h2</code>/<code className="font-mono text-[11px]">h3</code> mark sub-sections. Skipping levels or dumping everything into one heading hurts both SEO and accessibility.</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map(l => (
          <div key={l} className="rounded-md p-2 text-center" style={{ background: levels[l] > 0 ? '#eff6ff' : '#fafbfc', border: `1px solid ${levels[l] > 0 ? '#bfdbfe' : '#f1f5f9'}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: levels[l] > 0 ? 'var(--primary)' : '#cbd5e1' }}>{l}</p>
            <p className="text-base font-semibold tabular-nums" style={{ color: levels[l] > 0 ? 'var(--foreground)' : '#cbd5e1' }}>{levels[l]}</p>
          </div>
        ))}
      </div>

      {audit.headings.h1Texts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Current &lt;h1&gt; ({audit.headings.h1Texts.length})</p>
          <ul className="space-y-1">
            {audit.headings.h1Texts.map((t, i) => (
              <li key={i} className="text-xs px-2 py-1 rounded font-mono truncate" style={{ background: '#fafbfc', border: '1px solid #f1f5f9', color: '#475569' }} title={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {audit.headings.texts && audit.headings.texts.h2.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Current &lt;h2&gt; ({audit.headings.texts.h2.length}{levels.h2 > audit.headings.texts.h2.length ? ` of ${levels.h2}` : ''})</p>
          <div className="space-y-1">
            {audit.headings.texts.h2.map((t, i) => (
              <HeadingRow key={i} text={t} level={2} domain={domain} language={language} />
            ))}
          </div>
        </div>
      )}

      {audit.headings.texts && audit.headings.texts.h3.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Current &lt;h3&gt; ({audit.headings.texts.h3.length}{levels.h3 > audit.headings.texts.h3.length ? ` of ${levels.h3}` : ''})</p>
          <div className="space-y-1">
            {audit.headings.texts.h3.slice(0, 8).map((t, i) => (
              <HeadingRow key={i} text={t} level={3} domain={domain} language={language} />
            ))}
            {audit.headings.texts.h3.length > 8 && <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>… +{audit.headings.texts.h3.length - 8} more</p>}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>How to do it</h4>
        <ul className="text-xs space-y-1 mt-1" style={{ color: '#475569' }}>
          {tips.map((t, i) => <li key={i}>· {t}</li>)}
        </ul>
        <p className="text-[10px] mt-2" style={{ color: '#94a3b8' }}>Headings live in the designer site&apos;s code. Unlike alt text, Webcore can&apos;t safely rewrite them at runtime. Use the <strong>Suggest</strong> button per heading to generate stronger phrasings, then paste them into the designer code.</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heading row — current text + Suggest action that fetches AI alternatives
// ---------------------------------------------------------------------------

function HeadingRow({ text, level, domain, language }: { text: string; level: 2 | 3; domain: string; language: Language }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [copied, setCopied] = useState<number | null>(null)

  async function fetchSuggestions() {
    if (suggestions.length > 0) {
      setOpen(v => !v)
      return
    }
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetch('/api/seo/suggest-heading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, level, current_heading: text, language }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not generate suggestions', 'Suggestion failed')
        setOpen(false)
        return
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } finally {
      setLoading(false)
    }
  }

  async function copy(s: string, i: number) {
    try {
      await navigator.clipboard.writeText(s)
      setCopied(i)
      setTimeout(() => setCopied(c => (c === i ? null : c)), 1500)
    } catch {
      toast.error('Could not copy to clipboard', 'Copy failed')
    }
  }

  return (
    <div className="rounded-md" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#eff6ff', color: 'var(--primary)' }}>h{level}</span>
        <span className="flex-1 text-xs truncate" style={{ color: '#475569' }} title={text}>{text}</span>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={loading}
          className="text-[11px] font-medium px-2 h-6 rounded transition-colors hover:bg-white disabled:opacity-50"
          style={{ border: '1px solid #e2e8f0', color: '#475569', background: 'white' }}
        >
          {loading ? '…' : open && suggestions.length > 0 ? 'Hide' : 'Suggest'}
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <div className="px-2 pb-2 space-y-1" style={{ borderTop: '1px dashed #e2e8f0' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider pt-1.5" style={{ color: '#94a3b8' }}>Alternatives (click to copy)</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => copy(s, i)}
              className="w-full flex items-center gap-2 text-left rounded px-2 py-1.5 transition-colors hover:bg-white"
              style={{ background: 'white', border: '1px solid #e2e8f0' }}
            >
              <span className="flex-1 text-xs" style={{ color: 'var(--foreground)' }}>{s}</span>
              <span className="text-[10px] font-medium flex-shrink-0" style={{ color: copied === i ? '#16a34a' : 'var(--primary)' }}>
                {copied === i ? '✓ Copied' : 'Copy'}
              </span>
            </button>
          ))}
          <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>Paste into the designer code, redeploy, then re-run the audit to confirm.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Indexing detail — robots check + GSC URL Inspection deep link
// ---------------------------------------------------------------------------

function IndexingDetail({ domain, path, robots, gscIntegration }: { domain: string; path: string; robots: string | null; gscIntegration: Integration | null }) {
  const url = `https://${domain}${path === '/' ? '' : path}`
  const noindex = robots ? /noindex/i.test(robots) : false
  // GSC URL Inspection deep link. The resource_id format depends on whether
  // the GSC property is a domain property (sc-domain:example.com) or a
  // URL-prefix property (https://example.com/). We can't guess — different
  // accounts have different setups. So:
  //   - If the user has connected GSC and we have property_id, use it.
  //   - Otherwise omit resource_id; GSC will show a property picker.
  // Either way the URL ends up at the right inspection screen instead of 404ing.
  const propertyId = gscIntegration?.property_id ?? null
  const params = new URLSearchParams()
  if (propertyId) params.set('resource_id', propertyId)
  params.set('id', url)
  const inspectUrl = `https://search.google.com/search-console/inspect?${params.toString()}`

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
        <p className="text-xs mt-1" style={{ color: '#475569' }}>If the page sets <code className="font-mono text-[11px]">robots=noindex</code>, search engines will skip it entirely. Once it&apos;s open for indexing, you can ask Google to crawl it sooner via Search Console&apos;s URL Inspection tool.</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>How to do it</h4>
        <p className="text-xs mt-1" style={{ color: noindex ? '#b91c1c' : '#475569' }}>
          {noindex
            ? 'The page is currently set to "noindex". Remove this from the <meta name="robots"> tag in the designer code, then redeploy.'
            : 'No "noindex" detected. The page is open for indexing.'}
        </p>
        <a
          href={inspectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full text-white transition-opacity hover:opacity-90 mt-3"
          style={{ background: 'var(--primary)' }}
        >
          <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          Request indexing on Google
          <ArrowRightIcon className="w-3 h-3" />
        </a>
        <p className="text-[10px] mt-2" style={{ color: '#94a3b8' }}>Opens Search Console&apos;s URL Inspection for <code className="font-mono">{url}</code>. {propertyId ? <>Pre-filled for property <code className="font-mono">{propertyId}</code>.</> : <>Pick the right property when prompted, then click <strong>Request Indexing</strong>.</>}</p>
      </div>
    </div>
  )
}

function ReadOnlyExplainer({ why, how }: { why: string; how: string }) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
        <p className="text-xs mt-1" style={{ color: '#475569' }}>{why}</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>How to do it</h4>
        <p className="text-xs mt-1" style={{ color: '#475569' }}>{how}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Google SERP preview — title + URL + description box that mimics a search result
// ---------------------------------------------------------------------------

function GooglePreview({ domain, path, title, description }: { domain: string; path: string; title: string | null; description: string | null }) {
  const url = `https://${domain}${path === '/' ? '' : path}`
  return (
    <div className="rounded-md p-3" style={{ background: '#fafbfc', border: '1px solid #e2e8f0' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Google preview</p>
      <div className="flex items-start gap-2 mb-1">
        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#1E5BFF' }}>
          {domain[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] truncate" style={{ color: '#475569' }}>{domain.replace(/^www\./, '').split('.')[0]}</p>
          <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{url}</p>
        </div>
      </div>
      <p className="text-base font-medium leading-snug mb-1" style={{ color: '#1a0dab' }}>
        {title || <span style={{ color: '#cbd5e1' }}>(no title set)</span>}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: '#475569', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {description || <span style={{ color: '#cbd5e1' }}>(no description set)</span>}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add-page modal — kept for the "Add another page override" affordance
// ---------------------------------------------------------------------------

function SeoOverrideModal({ domain, row, onClose, onSaved }: { domain: string; row: Partial<Override>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [path, setPath] = useState(row.path ?? '/')
  const [title, setTitle] = useState(row.title ?? '')
  const [description, setDescription] = useState(row.description ?? '')
  const [isPattern, setIsPattern] = useState(row.is_pattern ?? false)
  const [saving, setSaving] = useState(false)
  const language: Language = (row.language as Language) ?? 'en'

  // Live preview of how the {match} placeholder substitutes for a pattern.
  const previewCapture = isPattern ? 'shah-alam' : ''
  const titlePreview = isPattern && previewCapture ? title.replace(/\{match\}/g, 'Shah Alam') : title
  const descPreview = isPattern && previewCapture ? description.replace(/\{match\}/g, 'Shah Alam') : description

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path: path.trim() || '/',
          language,
          is_pattern: isPattern,
          title: title.trim() || null,
          description: description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success(`Saved ${data.is_pattern ? 'pattern' : 'override'} for ${data.path}`, 'SEO override saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <LoadingOverlay visible={saving} label="Saving page override…" />
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Add Another Page</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-slate-100" style={{ color: '#94a3b8' }}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <label className="flex items-start gap-2 text-xs cursor-pointer rounded-md p-2.5" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
            <input
              type="checkbox"
              checked={isPattern}
              onChange={e => setIsPattern(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>Apply to many pages with a pattern</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>Use <code className="font-mono">*</code> as a wildcard (e.g. <code className="font-mono">/aircond-service-*</code>) and <code className="font-mono">{'{match}'}</code> in the title/description to insert the captured value (e.g. <code className="font-mono">{'{match} Aircond Service | Brand'}</code> → <em>Shah Alam Aircond Service | Brand</em>).</p>
            </div>
          </label>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{isPattern ? 'Path pattern' : 'Page path'}</label>
            <Input
              size="lg"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder={isPattern ? '/aircond-service-*' : '/products'}
              className="font-mono"
            />
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>
              {isPattern
                ? <>Must contain a single <code>*</code> wildcard. The matched portion becomes <code>{'{match}'}</code>.</>
                : <>Use a leading slash. Examples: <code>/products</code>, <code>/blog/some-post</code>.</>}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Title (optional)</label>
            <Input
              size="lg"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isPattern ? '{match} Aircond Service | Brand' : 'Leave blank to use the live title'}
            />
            {isPattern && title.includes('{match}') && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--primary)' }}>Preview: <strong>{titlePreview}</strong></p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Description (optional)</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={isPattern ? 'Find {match} aircond services. Same-day install…' : 'Leave blank to use the live description'}
            />
            {isPattern && description.includes('{match}') && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--primary)' }}>Preview: <strong>{descPreview}</strong></p>
            )}
          </div>
          <p className="text-[10px]" style={{ color: '#94a3b8' }}>{isPattern ? 'Pattern overrides apply to every URL that matches. Exact-path overrides always win when both exist.' : 'Once added, the page appears in the Step 2 list and you can fill in title, description, and alt text from there.'}</p>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2 bg-slate-50 border-t border-slate-100">
          <Button variant="ghost" size="lg" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="lg" onClick={save} loading={saving} disabled={!path.trim()}>
            Add page
          </Button>
        </div>
      </div>
    </div>
  )
}
