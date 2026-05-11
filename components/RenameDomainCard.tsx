'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowRightIcon, CheckCircleIcon, ChevronDownIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/solid'

interface Props { domain: string }

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

type Mode = 'zone' | 'custom'
type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken'; reason: string }
  | { state: 'invalid'; reason: string }

function normalize(d: string) {
  return d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function suggestSubdomainFrom(domain: string): string {
  // cat-rumah-malaysia.vercel.app → cat-rumah-malaysia
  const head = domain.split('.')[0] ?? ''
  return head.replace(/[^a-z0-9-]/g, '')
}

/**
 * Per-site Settings card. Builds the new domain via either:
 *   - Zone picker (subdomain input + dropdown of team-owned apex domains)
 *   - Custom mode (free-form full hostname)
 *
 * Live availability check fires while typing — green pill when free, red
 * with a reason when already taken (in webcore or on Vercel). On submit,
 * the rename cascades through every webcore table that keys off `website`
 * and (if VERCEL_API_TOKEN is configured) attaches the new domain to the
 * matching Vercel project + triggers a redeploy.
 */
export default function RenameDomainCard({ domain }: Props) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [mode, setMode] = useState<Mode>('zone')
  const [zones, setZones] = useState<string[]>([])
  const [zonesReady, setZonesReady] = useState(false)
  const [vercelEnabled, setVercelEnabled] = useState(false)
  const [subdomain, setSubdomain] = useState(suggestSubdomainFrom(domain))
  const [zone, setZone] = useState('')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [avail, setAvail] = useState<Availability>({ state: 'idle' })
  const checkRef = useRef<AbortController | null>(null)

  // Pull team-owned zones once.
  useEffect(() => {
    fetch('/api/company-websites/zones')
      .then(r => r.ok ? r.json() : { zones: [], vercelEnabled: false })
      .then((data: { zones: string[]; vercelEnabled: boolean }) => {
        setZones(data.zones)
        setVercelEnabled(data.vercelEnabled)
        if (data.zones.length > 0) {
          // Default to .utopiaai.my when present, else first zone.
          const preferred = data.zones.find(z => z === 'utopiaai.my') ?? data.zones[0]
          setZone(preferred)
        } else {
          setMode('custom')
        }
      })
      .catch(() => { setMode('custom') })
      .finally(() => setZonesReady(true))
  }, [])

  // Compute candidate hostname based on current mode.
  const candidate = useMemo(() => {
    if (mode === 'zone') {
      const sub = subdomain.trim().toLowerCase()
      if (!sub || !zone) return ''
      return `${sub}.${zone}`
    }
    return normalize(custom)
  }, [mode, subdomain, zone, custom])

  // Local validation (cheap) — rejects obviously bad strings before hitting
  // the server so the availability check doesn't fire on every keystroke.
  const localValid = useMemo(() => {
    if (!candidate) return null
    if (candidate === domain) return 'New hostname matches the current one'
    if (mode === 'zone' && subdomain && !SUBDOMAIN_RE.test(subdomain)) return 'Subdomain must be lowercase letters, digits, or dashes'
    if (!DOMAIN_RE.test(candidate)) return 'Not a valid hostname'
    return null
  }, [candidate, domain, mode, subdomain])

  // Debounced server-side availability check.
  useEffect(() => {
    checkRef.current?.abort()
    if (!candidate) { setAvail({ state: 'idle' }); return }
    if (localValid) { setAvail({ state: 'invalid', reason: localValid }); return }

    const ctrl = new AbortController()
    checkRef.current = ctrl
    setAvail({ state: 'checking' })
    const t = setTimeout(() => {
      fetch(`/api/company-websites/check-domain?name=${encodeURIComponent(candidate)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then((data: { available: boolean; reason?: string }) => {
          if (ctrl.signal.aborted) return
          setAvail(data.available ? { state: 'available' } : { state: 'taken', reason: data.reason ?? 'Already in use' })
        })
        .catch(e => {
          if ((e as Error).name === 'AbortError') return
          setAvail({ state: 'idle' })
        })
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [candidate, localValid])

  const submittable = avail.state === 'available' && !saving

  async function handleRename() {
    if (!submittable) return
    const ok = await confirm({
      title: 'Rename this site?',
      message: (
        <div className="space-y-2 text-sm">
          <p>The recorded domain will change from</p>
          <p className="font-mono text-xs px-2 py-1 rounded bg-slate-100">{domain}</p>
          <p>to</p>
          <p className="font-mono text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{candidate}</p>
          <p className="text-xs text-slate-500 mt-2">
            All phone numbers, products, blog posts, analytics events, and audit history attached to this site will move with it.{vercelEnabled ? ' The new hostname will also be attached to the matching Vercel project and a fresh production deploy will be triggered.' : ''}
          </p>
        </div>
      ),
      confirmLabel: 'Rename',
      variant: 'info',
    })
    if (!ok) return

    setSaving(true)
    try {
      const res = await fetch('/api/company-websites/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: domain, to: candidate }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        vercel?: { enabled: boolean; projectId: string | null; addedNewDomain: boolean; removedOldDomain: boolean; redeployedDeploymentId: string | null; warnings: string[] }
        gscNeedsReconnect?: boolean
      }
      if (!res.ok) {
        toast.error(data.error || `Rename failed (${res.status})`, 'Rename failed')
        return
      }
      const v = data.vercel
      let detail = `${domain} → ${candidate}`
      if (v?.enabled && v.projectId) {
        const parts: string[] = []
        if (v.addedNewDomain) parts.push('Vercel domain attached')
        if (v.removedOldDomain) parts.push('old domain detached')
        if (v.redeployedDeploymentId) parts.push('redeploy triggered')
        if (parts.length) detail += ` · ${parts.join(' · ')}`
        if (v.warnings.length) detail += ` · ${v.warnings.length} warning${v.warnings.length === 1 ? '' : 's'}`
      } else if (v?.enabled && !v.projectId) {
        detail += ' · Vercel project not found (manual attach needed)'
      }
      toast.success(detail, 'Domain renamed')
      // Google Search Console properties are bound to a specific hostname on
      // Google's side and can't be renamed via API — the user must add a
      // fresh property for the new domain.
      if (data.gscNeedsReconnect) {
        toast.info(
          'Open the Integrations tab and click Connect Google Search Console again for the new hostname.',
          'Re-link Search Console'
        )
      }
      router.replace(`/site-settings?website=${encodeURIComponent(candidate)}`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message, 'Rename failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Domain</h3>
        <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
          Change the recorded domain. All linked rows (phones, products, posts, analytics, audit) move with it{vercelEnabled ? '. Vercel will also attach the new hostname and trigger a redeploy.' : '.'}
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Current</label>
          <p className="font-mono text-sm px-3 py-2 rounded-full" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
            {domain}
          </p>
        </div>

        <div className="flex items-center justify-center text-slate-300">
          <ArrowRightIcon className="w-4 h-4 rotate-90" />
        </div>

        {/* Mode toggle */}
        {zonesReady && zones.length > 0 && (
          <div className="inline-flex items-center rounded-full border p-0.5 text-xs" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
            {(['zone', 'custom'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-3 py-1 rounded-full transition-colors"
                style={{
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? 'var(--foreground)' : '#94a3b8',
                  fontWeight: mode === m ? 600 : 500,
                  boxShadow: mode === m ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                }}
              >
                {m === 'zone' ? 'Subdomain of team zone' : 'Custom domain'}
              </button>
            ))}
          </div>
        )}

        {/* Zone mode — subdomain input and zone dropdown share one border so
            they read as a single compound field (like an email input). */}
        {mode === 'zone' && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>New domain</label>
            <div
              className="flex items-stretch rounded-md border bg-white transition-colors focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15"
              style={{ borderColor: '#e2e8f0' }}
            >
              <input
                type="text"
                value={subdomain}
                onChange={e => setSubdomain(e.target.value.toLowerCase())}
                placeholder="subdomain"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 h-8 pl-3 pr-1 text-xs bg-transparent outline-none placeholder:text-slate-400 text-slate-900"
              />
              <span className="self-center text-xs px-0.5 select-none" style={{ color: '#cbd5e1' }}>.</span>
              <div className="relative flex-shrink-0" style={{ borderLeft: '1px solid #f1f5f9' }}>
                <select
                  value={zone}
                  onChange={e => setZone(e.target.value)}
                  className="appearance-none h-8 pl-3 pr-8 text-xs bg-transparent outline-none cursor-pointer text-slate-900"
                >
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <ChevronDownIcon className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </div>
        )}

        {/* Custom mode */}
        {mode === 'custom' && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>New domain</label>
            <Input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="e.g. cat-rumah-malaysia.com"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {/* Live availability indicator */}
        {candidate && (
          <AvailabilityPill state={avail} hostname={candidate} />
        )}
      </div>

      <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <Button variant="primary" size="md" disabled={!submittable} loading={saving} onClick={handleRename}>
          {saving ? 'Renaming…' : 'Rename'}
        </Button>
      </div>
    </div>
  )
}

function AvailabilityPill({ state, hostname }: { state: Availability; hostname: string }) {
  if (state.state === 'idle') return null

  if (state.state === 'checking') {
    return (
      <p className="text-[11px] inline-flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#cbd5e1' }} />
        Checking <span className="font-mono">{hostname}</span>…
      </p>
    )
  }

  if (state.state === 'available') {
    return (
      <p className="text-[11px] inline-flex items-center gap-1.5" style={{ color: '#15803d' }}>
        <CheckCircleIcon className="w-3.5 h-3.5" />
        <span><span className="font-mono">{hostname}</span> is available</span>
      </p>
    )
  }

  if (state.state === 'invalid') {
    return (
      <p className="text-[11px] inline-flex items-center gap-1.5" style={{ color: '#b91c1c' }}>
        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
        {state.reason}
      </p>
    )
  }

  // taken
  return (
    <p className="text-[11px] inline-flex items-center gap-1.5" style={{ color: '#b91c1c' }}>
      <XCircleIcon className="w-3.5 h-3.5" />
      <span><span className="font-mono">{hostname}</span> · {state.reason}</span>
    </p>
  )
}
