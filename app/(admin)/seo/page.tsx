'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Override {
  id: string
  website: string
  path: string
  title: string | null
  description: string | null
  og_image: string | null
  updated_at: string
}

interface AltOverride { id: string; image_src: string; alt: string; updated_at: string }

interface AuditIssue { type: 'error' | 'warn' | 'info'; category: 'meta' | 'images' | 'headings' | 'social'; message: string; detail?: string }
interface AuditResult {
  url: string
  fetchedAt: string
  ok: boolean
  status?: number
  error?: string
  meta: { title: string | null; titleLength: number; description: string | null; descriptionLength: number; canonical: string | null; robots: string | null; ogImage: string | null; ogTitle: string | null; ogDescription: string | null; twitterImage: string | null }
  headings: { h1Count: number; total: number; h1Texts: string[] }
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
  const [adding, setAdding] = useState(false)

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
    runAudit('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])

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

  const homepageOverride = overrides.find(o => o.path === '/') ?? null
  const onRefresh = () => { loadOverrides(); loadAlts(); runAudit('/') }

  return (
    <div>
      <PageHeader
        title="The SEO Setup Checklist"
        description={<span>Complete all SEO tasks to help <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{domain}</code> get found in search results and AI chat responses.</span>}
      />

      <BusinessInfoBar />

      <div className="space-y-3 mt-4">
        <Step1Card
          domain={domain}
          audit={audit}
          override={homepageOverride}
          auditing={auditing}
          onRefresh={onRefresh}
          onRunAudit={() => runAudit('/')}
        />
        <Step2Card
          domain={domain}
          overrides={overrides}
          altOverrides={altOverrides}
          audit={audit}
          onRefresh={onRefresh}
          onAdd={() => setAdding(true)}
        />
        <Step3Card domain={domain} />
      </div>

      {adding && (
        <SeoOverrideModal
          domain={domain}
          row={{ path: '/', title: '', description: '', og_image: '' }}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Business info bar — placeholder for Phase 2 (brand/location/keywords schema)
// ---------------------------------------------------------------------------

function BusinessInfoBar() {
  return (
    <div className="rounded-xl border bg-white px-5 py-3 flex items-center gap-6 flex-wrap" style={{ borderColor: '#e2e8f0' }}>
      <InfoCell label="Business or Brand Name" value="—" />
      <span style={{ color: '#e2e8f0' }}>|</span>
      <InfoCell label="Location" value="—" />
      <span style={{ color: '#e2e8f0' }}>|</span>
      <InfoCell label="Keywords" value="—" wide />
      <button
        type="button"
        title="Coming soon — brand profile lets the audit suggest titles and check keyword usage."
        disabled
        className="ml-auto w-7 h-7 rounded-full flex items-center justify-center disabled:cursor-not-allowed"
        style={{ color: '#cbd5e1' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
    </div>
  )
}

function InfoCell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'flex-1' : ''}`}>
      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{label}</span>
      <span className="text-xs ml-1.5 truncate" style={{ color: '#94a3b8' }}>: {value}</span>
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
            <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
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
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
          <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: '#94a3b8' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
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
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
  onRefresh,
  onRunAudit,
}: {
  domain: string
  audit: AuditResult | null
  override: Override | null
  auditing: boolean
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

  const h1Status: TaskStatus = audit ? (audit.headings.h1Count === 1 ? 'done' : audit.headings.h1Count === 0 ? 'error' : 'warn') : 'unknown'

  const indexStatus: TaskStatus = audit ? (audit.meta.robots && /noindex/i.test(audit.meta.robots) ? 'error' : 'done') : 'unknown'

  const canonicalStatus: TaskStatus = audit ? (audit.meta.canonical ? 'done' : 'warn') : 'unknown'

  const tasks: TaskStatus[] = [titleStatus, descStatus, ogStatus, h1Status, indexStatus, canonicalStatus]
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
        <p className="text-[11px]" style={{ color: '#94a3b8' }}>
          {auditing ? 'Auditing homepage…' : audit ? `Audited ${new Date(audit.fetchedAt).toLocaleTimeString()}` : 'Not yet audited'}
        </p>
        <button
          type="button"
          onClick={onRunAudit}
          disabled={auditing}
          className="text-[11px] font-medium px-3 h-7 rounded-md border transition-colors hover:bg-slate-50 disabled:opacity-50"
          style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
        >
          {auditing ? 'Running…' : 'Re-run audit'}
        </button>
      </div>

      <Task
        status={titleStatus}
        title="Set the homepage's title for search results"
        hint={audit?.meta.title ? `${audit.meta.titleLength} chars` : undefined}
      >
        <TitleEditor domain={domain} path="/" current={audit?.meta.title} override={override?.title ?? null} otherFields={override} onSaved={onRefresh} />
      </Task>

      <Task
        status={descStatus}
        title="Add the homepage's description for search results"
        hint={audit?.meta.description ? `${audit.meta.descriptionLength} chars` : undefined}
      >
        <DescriptionEditor domain={domain} path="/" current={audit?.meta.description} override={override?.description ?? null} otherFields={override} onSaved={onRefresh} />
      </Task>

      <Task
        status={h1Status}
        title="Add an <h1> heading to the homepage"
        hint={audit ? `${audit.headings.h1Count} h1${audit.headings.h1Count === 1 ? '' : 's'} found` : undefined}
      >
        <ReadOnlyExplainer
          why="A single, descriptive <h1> tells Google and screen readers what the page is about."
          how={audit?.headings.h1Count === 0
            ? 'No <h1> on the homepage. Update the designer code to add one — webcore can\'t inject headings remotely.'
            : audit && audit.headings.h1Count > 1
              ? `Found ${audit.headings.h1Count} <h1> tags. Use only one main heading per page.`
              : 'Looks good — one <h1> per page is best.'}
        />
      </Task>

      <Task
        status={indexStatus}
        title="Allow indexing to make this homepage visible in search results"
      >
        <ReadOnlyExplainer
          why="If the page sets robots=noindex, search engines will skip it entirely."
          how={audit?.meta.robots && /noindex/i.test(audit.meta.robots)
            ? `The page is currently set to "noindex". Remove this from the <meta name="robots"> tag in the designer code.`
            : 'No "noindex" detected — the page is open for indexing.'}
        />
      </Task>

      <Task
        status={ogStatus}
        title="Add a social share image (used for WhatsApp, Facebook, Twitter previews)"
      >
        <OgImageEditor domain={domain} path="/" current={audit?.meta.ogImage} override={override?.og_image ?? null} otherFields={override} onSaved={onRefresh} />
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
        status="unknown"
        title={<span>Connect this site to <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Google Search Console</span></span>}
      >
        <div className="space-y-2">
          <p className="text-xs" style={{ color: '#475569' }}>Search Console reports indexing errors, search performance, and lets you submit sitemaps.</p>
          <a
            href={`/integrations?website=${encodeURIComponent(domain)}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-md text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            Open Integrations
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </a>
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
  onRefresh,
  onAdd,
}: {
  domain: string
  overrides: Override[]
  altOverrides: AltOverride[]
  audit: AuditResult | null
  onRefresh: () => void
  onAdd: () => void
}) {
  // Group every path that's been touched (override exists) plus the homepage.
  // Homepage always shown so users can edit it from here too.
  const paths = new Set<string>(['/'])
  overrides.forEach(o => paths.add(o.path))
  const orderedPaths = [...paths].sort()

  // Per-task tally:
  //   - title set (override.title not null)
  //   - description set
  //   - alt: for the homepage we use the audit's missingAlt count; for other
  //     paths we don't have audit data, so just show "—".
  const homepageMissingAlt = audit?.images.missingAlt ?? 0
  const altOverrideSrcs = new Set(altOverrides.map(a => a.image_src))

  let totalTasks = 0
  let doneTasks = 0
  for (const path of orderedPaths) {
    const o = overrides.find(x => x.path === path) ?? null
    totalTasks += 2 // title + description per page
    if (o?.title) doneTasks++
    if (o?.description) doneTasks++
    if (path === '/') {
      totalTasks += 1
      const remainingMissing = audit ? audit.images.samples.filter(s => s.reason === 'missing' && !altOverrideSrcs.has(s.src)).length : 0
      if (audit && remainingMissing === 0 && homepageMissingAlt === 0) doneTasks++
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
      {orderedPaths.map(path => {
        const o = overrides.find(x => x.path === path) ?? null
        const friendly = path === '/' ? 'Homepage' : path
        return (
          <div key={path}>
            <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
              <span className="text-xs font-semibold" style={{ color: '#475569' }}>{friendly}</span>
              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }}>{path}</code>
            </div>
            <Task
              status={o?.title ? 'done' : 'warn'}
              title={<span>Set the <strong>{friendly}</strong> page&apos;s title for search results</span>}
            >
              <TitleEditor domain={domain} path={path} current={path === '/' ? audit?.meta.title : null} override={o?.title ?? null} otherFields={o} onSaved={onRefresh} />
            </Task>
            <Task
              status={o?.description ? 'done' : 'warn'}
              title={<span>Add the <strong>{friendly}</strong> page&apos;s meta description</span>}
            >
              <DescriptionEditor domain={domain} path={path} current={path === '/' ? audit?.meta.description : null} override={o?.description ?? null} otherFields={o} onSaved={onRefresh} />
            </Task>
            {path === '/' && audit && (
              <Task
                status={(homepageMissingAlt === 0 || audit.images.samples.filter(s => s.reason === 'missing' && !altOverrideSrcs.has(s.src)).length === 0) ? 'done' : 'error'}
                title="Add alt text to all images on the homepage"
                hint={audit.images.missingAlt > 0 ? `${audit.images.missingAlt} missing` : undefined}
              >
                <AltTextEditor domain={domain} audit={audit} altOverrides={altOverrides} onRefresh={onRefresh} />
              </Task>
            )}
          </div>
        )
      })}

      <div className="px-5 py-3 flex items-center justify-center" style={{ background: '#fafbfc' }}>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full border transition-colors hover:bg-white"
          style={{ borderColor: '#e2e8f0', color: 'var(--primary)', background: 'white' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add another page override
        </button>
      </div>
    </StepCard>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Continued progress (educational/static)
// ---------------------------------------------------------------------------

function Step3Card({ domain }: { domain: string }) {
  return (
    <StepCard
      step={3}
      title="Keep building on this site's SEO progress"
      subtitle="SEO is a work in progress. Learn more about what it can do for this site."
      done={0}
      total={0}
    >
      <div className="px-5 py-4 space-y-3">
        <Tip
          title="Submit a sitemap to Google"
          body={<>Add <code className="font-mono text-[11px] px-1 py-0.5 rounded" style={{ background: '#f1f5f9' }}>{`https://${domain}/sitemap.xml`}</code> in Search Console &rsaquo; Sitemaps so Google can discover every page.</>}
        />
        <Tip
          title="Run the audit weekly"
          body="Designer-side changes can introduce regressions. A weekly re-audit catches new errors, broken canonicals, and missing alt text before they hurt rankings."
        />
        <Tip
          title="Watch the Coverage report"
          body="Search Console flags pages it can't index. Investigate any non-zero count under 'Pages → Why pages aren't indexed'."
        />
        <Tip
          title="Keep WhatsApp / blog / product content fresh"
          body="Search engines reward sites that update regularly. Use the webcore Blog and Products tabs to publish new content."
        />
      </div>
    </StepCard>
  )
}

function Tip({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md" style={{ background: '#fafbfc', border: '1px solid #f1f5f9' }}>
      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: '#fef3c7', color: '#a16207' }}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
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

function TitleEditor({ domain, path, current, override, otherFields, onSaved }: { domain: string; path: string; current: string | null | undefined; override: string | null; otherFields: OtherOverrideFields | null; onSaved: () => void }) {
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
      toast.success('Title saved — applies on the live site within seconds.', 'SEO override saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const tooLong = value.length > 60
  const tooShort = value.length > 0 && value.length < 30

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Why it&apos;s important</h4>
        <p className="text-xs mb-3" style={{ color: '#475569' }}>A clear, concise title helps Google explain what this page offers and brings more relevant visitors.</p>
        <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>How to do it</h4>
        <p className="text-[11px] mb-2" style={{ color: '#64748b' }}>{current ? <>Current title: <span className="font-mono">{current}</span></> : 'No title currently set on the live page.'}</p>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter a title…"
          className="w-full h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)]"
          style={{ borderColor: tooLong ? '#fecaca' : '#e2e8f0', background: 'white' }}
        />
        <p className="text-[10px] mt-1" style={{ color: tooLong ? '#b91c1c' : tooShort ? '#a16207' : '#94a3b8' }}>
          {value.length}/60 · {tooLong ? 'Google may truncate over 60 characters.' : tooShort ? 'Aim for 50–60 characters.' : 'Looking good.'}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !value.trim()}
          className="mt-3 text-xs font-medium px-3 h-8 rounded-full text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? 'Saving…' : 'Apply & Publish'}
        </button>
      </div>
      <GooglePreview domain={domain} path={path} title={value || current || domain} description={otherFields?.description ?? null} />
    </div>
  )
}

function DescriptionEditor({ domain, path, current, override, otherFields, onSaved }: { domain: string; path: string; current: string | null | undefined; override: string | null; otherFields: { title?: string | null; og_image?: string | null } | null; onSaved: () => void }) {
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
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Write a 1–2 sentence summary of this page…"
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:border-[var(--primary)] resize-y"
          style={{ borderColor: tooLong ? '#fecaca' : '#e2e8f0', background: 'white' }}
        />
        <p className="text-[10px] mt-1" style={{ color: tooLong ? '#b91c1c' : tooShort ? '#a16207' : '#94a3b8' }}>
          {value.length}/160 · {tooLong ? 'Google truncates over 160 characters.' : tooShort ? 'Aim for 120–160 characters.' : 'Looking good.'}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-3 text-xs font-medium px-3 h-8 rounded-full text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? 'Saving…' : 'Apply & Publish'}
        </button>
      </div>
      <GooglePreview domain={domain} path={path} title={otherFields?.title ?? current ?? domain} description={value || current || ''} />
    </div>
  )
}

function OgImageEditor({ domain, path, current, override, otherFields, onSaved }: { domain: string; path: string; current: string | null | undefined; override: string | null; otherFields: { title?: string | null; description?: string | null } | null; onSaved: () => void }) {
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
      toast.success('Uploaded — click Apply to publish.', 'Uploaded')
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
            <svg className="w-5 h-5" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving}
              className="text-xs font-medium px-3 h-8 rounded-md border transition-colors hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
            >
              {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => setValue('')}
                className="text-xs font-medium px-3 h-8 rounded-md border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#e2e8f0', color: '#94a3b8', background: 'white' }}
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="url"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="…or paste an image URL"
            className="w-full h-8 mt-1.5 px-3 text-xs rounded-md border outline-none focus:border-[var(--primary)]"
            style={{ borderColor: '#e2e8f0', background: 'white' }}
          />
        </div>
      </div>
      <p className="text-[10px]" style={{ color: '#94a3b8' }}>PNG / JPG / WebP / GIF · max 4 MB · 1200 × 630 is ideal.</p>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="text-xs font-medium px-3 h-8 rounded-full text-white transition-opacity disabled:opacity-40 hover:opacity-90"
        style={{ background: 'var(--primary)' }}
      >
        {saving ? 'Saving…' : 'Apply & Publish'}
      </button>
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
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Describe this image for screen readers and search engines"
            onKeyDown={e => { if (e.key === 'Enter' && dirty && !saving) save() }}
            className="flex-1 h-8 px-2.5 text-xs rounded border outline-none focus:border-[var(--primary)]"
            style={{ borderColor: '#e2e8f0', background: 'white' }}
          />
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !value.trim() || saving}
            className="text-[11px] font-medium px-2.5 h-8 rounded text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? '…' : 'Save'}
          </button>
          {onDelete && initialAlt !== undefined && (
            <button
              type="button"
              onClick={() => onDelete(imageSrc)}
              className="text-[11px] font-medium px-2.5 h-8 rounded border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              style={{ borderColor: '#e2e8f0', color: '#94a3b8', background: 'white' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Read-only explainer — for tasks webcore can't fix remotely (h1, robots, canonical)
// ---------------------------------------------------------------------------

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
        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
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
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: domain,
          path: path.trim() || '/',
          title: title.trim() || null,
          description: description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed', 'Save failed')
        return
      }
      toast.success(`Saved override for ${data.path}`, 'SEO override saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Add another page</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-slate-100" style={{ color: '#94a3b8' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Page path</label>
            <input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/products"
              className="w-full h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)]"
              style={{ borderColor: '#e2e8f0', background: 'white' }}
            />
            <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>Use a leading slash. Examples: <code>/products</code>, <code>/blog/some-post</code>.</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Leave blank to use the live title"
              className="w-full h-9 px-3 text-sm rounded-md border outline-none focus:border-[var(--primary)]"
              style={{ borderColor: '#e2e8f0', background: 'white' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Leave blank to use the live description"
              className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:border-[var(--primary)] resize-y"
              style={{ borderColor: '#e2e8f0', background: 'white' }}
            />
          </div>
          <p className="text-[10px]" style={{ color: '#94a3b8' }}>Once added, the page appears in the Step 2 list and you can fill in title, description, and alt text from there.</p>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button onClick={onClose} className="text-xs font-medium px-3 h-9 rounded-md transition-colors hover:bg-slate-100" style={{ color: '#475569' }}>Cancel</button>
          <button
            onClick={save}
            disabled={saving || !path.trim()}
            className="text-xs font-medium px-3 h-9 rounded-md text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? 'Saving…' : 'Add page'}
          </button>
        </div>
      </div>
    </div>
  )
}
