'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { InformationCircleIcon } from '@heroicons/react/24/solid'
interface IntegrationRow { id: string; website: string; provider: string; property_id: string | null; connected_at: string }
interface GscProperty { siteUrl: string; permissionLevel: string; matched: boolean; selected: boolean }
interface RevalidationSettings {
  website: string
  revalidate_url: string | null
  revalidate_secret: string | null
}

/**
 * Stack of integration cards for a per-site context. Each integration sits in
 * its own bordered white card (Wix Settings style) so they can be added to
 * over time without a single umbrella growing unwieldy.
 */
export default function IntegrationsCard({ domain }: { domain: string }) {
  return (
    <div className="space-y-4">
      <GoogleSearchConsoleSection domain={domain} />
      <LiveRevalidationSection domain={domain} />
    </div>
  )
}

function SectionCard({ icon, title, status, children }: {
  icon: React.ReactNode
  title: React.ReactNode
  status?: { label: string; tone: 'connected' | 'idle' | 'loading' }
  children: React.ReactNode
}) {
  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
    connected: { bg: '#dcfce7', color: '#15803d' },
    idle: { bg: '#f1f5f9', color: '#64748b' },
    loading: { bg: '#f1f5f9', color: '#94a3b8' },
  }
  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'white' }}>{icon}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
          {status && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={STATUS_STYLE[status.tone]}>{status.label}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

function GoogleSearchConsoleSection({ domain }: { domain: string }) {
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<IntegrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [properties, setProperties] = useState<GscProperty[] | null>(null)
  const [propsLoading, setPropsLoading] = useState(false)
  const [propsError, setPropsError] = useState<string | null>(null)
  const [propsNeedsReconnect, setPropsNeedsReconnect] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [showVerifyHelp, setShowVerifyHelp] = useState(false)

  function load() {
    setLoading(true)
    fetch(`/api/integrations?domain=${encodeURIComponent(domain)}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [domain])

  async function loadProperties() {
    setPropsLoading(true)
    setPropsError(null)
    setPropsNeedsReconnect(false)
    try {
      const res = await fetch(`/api/integrations/gsc/properties?domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (!res.ok) {
        if (data.needsReconnect) {
          setPropsNeedsReconnect(true)
        } else {
          setPropsError(data.error ?? 'Failed to load properties')
        }
        return
      }
      setProperties(data.properties ?? [])
      const preselect = (data.properties ?? []).find((p: GscProperty) => p.selected) ?? (data.properties ?? []).find((p: GscProperty) => p.matched) ?? (data.properties ?? [])[0]
      if (preselect) setSelected(preselect.siteUrl)
    } catch (e) {
      setPropsError((e as Error).message)
    } finally {
      setPropsLoading(false)
    }
  }

  async function saveProperty() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/integrations/gsc/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, property_id: selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'error', text: data.error ?? 'Failed to save' })
        return
      }
      setFlash({ kind: 'success', text: 'Property saved. Data should appear shortly' })
      setShowPicker(false)
      load()
    } catch (e) {
      setFlash({ kind: 'error', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  function openPicker() {
    setShowPicker(true)
    if (!properties && !propsLoading) loadProperties()
  }

  useEffect(() => {
    const connected = searchParams.get('integration_connected')
    const err = searchParams.get('integration_error')
    if (connected) setFlash({ kind: 'success', text: `Connected ${connected.toUpperCase()}` })
    else if (err) setFlash({ kind: 'error', text: `Connection failed: ${err}` })
  }, [searchParams])

  const gsc = rows.find(r => r.provider === 'gsc')

  async function connectGsc() {
    setBusy(true)
    try {
      const res = await fetch(`/api/integrations/gsc/connect?domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (res.ok && data.url) window.location.href = data.url
      else setFlash({ kind: 'error', text: data.error ?? 'Failed to start OAuth' })
    } finally {
      setBusy(false)
    }
  }

  async function disconnectGsc() {
    if (!confirm('Disconnect Google Search Console for this website?')) return
    setBusy(true)
    const res = await fetch('/api/integrations/gsc/disconnect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
    setBusy(false)
    if (res.ok) { setFlash({ kind: 'success', text: 'Disconnected' }); load() }
    else setFlash({ kind: 'error', text: 'Disconnect failed' })
  }

  const status = loading ? { label: 'Loading…', tone: 'loading' as const } : gsc ? { label: 'Connected', tone: 'connected' as const } : { label: 'Not connected', tone: 'idle' as const }

  return (
    <SectionCard
      icon={<GoogleSearchConsoleGlyph />}
      title="Google Search Console"
      status={status}
    >
      {flash && (
        <div className="px-5 py-2 text-xs" style={{ background: flash.kind === 'success' ? '#f0fdf4' : '#fef2f2', color: flash.kind === 'success' ? '#15803d' : '#b91c1c', borderBottom: '1px solid #e2e8f0' }}>
          {flash.text}
        </div>
      )}

      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs" style={{ color: '#475569' }}>
            {gsc
              ? (gsc.property_id ? <>Property: <code className="font-mono px-1 py-0.5 rounded text-[10px]" style={{ background: '#f1f5f9' }}>{gsc.property_id}</code></> : 'No matching GSC property. Pick one manually below.')
              : 'Pull search impressions, clicks, and top queries from Google.'}
          </p>
          <button type="button" onClick={() => setShowVerifyHelp(v => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium mt-2 transition-colors hover:underline"
            style={{ color: 'var(--primary)' }}>
            <InformationCircleIcon className="w-3 h-3" />
            {showVerifyHelp ? 'Hide verification steps' : 'How does the designer verify this site in Search Console?'}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {gsc && (
            <button type="button" onClick={openPicker} disabled={busy}
              className="text-[11px] font-medium px-3 py-1.5 rounded-md border disabled:opacity-50 transition-colors hover:bg-slate-50"
              style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}>
              {gsc.property_id ? 'Change property' : 'Select property'}
            </button>
          )}
          {gsc ? (
            <button type="button" onClick={disconnectGsc} disabled={busy}
              className="text-[11px] font-medium px-3 py-1.5 rounded-md border disabled:opacity-50 transition-colors"
              style={{ borderColor: '#e2e8f0', color: '#b91c1c', background: 'white' }}>
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={connectGsc} disabled={busy}
              className="text-[11px] font-medium px-3 py-1.5 rounded-md text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              {busy ? 'Starting…' : 'Connect Search Console'}
            </button>
          )}
        </div>
      </div>

      {showVerifyHelp && (
        <div className="px-5 py-4 text-xs space-y-4" style={{ background: '#fafbfc', borderTop: '1px solid #e2e8f0', color: '#475569' }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>1. Meta tag method (easiest. Per-site)</p>
            <p className="mb-2" style={{ color: '#64748b' }}>Works when the designer uses our Next.js setup bundle.</p>
            <ol className="list-decimal ml-5 space-y-1" style={{ color: '#475569' }}>
              <li>Designer opens <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>search.google.com/search-console</a> → <strong>Add property</strong> → <strong>URL prefix</strong> → types <code className="px-1 rounded font-mono" style={{ background: '#f1f5f9' }}>https://{domain}</code></li>
              <li>Google shows: <code className="block mt-1 p-1.5 rounded font-mono text-[10px] break-all" style={{ background: '#f1f5f9' }}>&lt;meta name=&quot;google-site-verification&quot; content=&quot;aBcDeF123...&quot; /&gt;</code></li>
              <li>Designer copies just the <strong>content value</strong> (e.g. <code className="px-1 rounded font-mono" style={{ background: '#f1f5f9' }}>aBcDeF123...</code>) and pastes it into <code className="px-1 rounded font-mono" style={{ background: '#f1f5f9' }}>.env.local</code>:<br /><code className="block mt-1 p-1.5 rounded font-mono text-[10px]" style={{ background: '#f1f5f9' }}>NEXT_PUBLIC_GSC_VERIFICATION=aBcDeF123...</code></li>
              <li>Redeploy the designer site. The <code className="px-1 rounded font-mono" style={{ background: '#f1f5f9' }}>&lt;WebcoreTracker /&gt;</code> component in the setup bundle renders the meta tag automatically.</li>
              <li>Back in GSC → click <strong>Verify</strong> → ✅</li>
              <li>Come back here → click <strong>Select property</strong> above → pick the newly verified one.</li>
            </ol>
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>2. DNS TXT method (best. Covers the whole domain forever)</p>
            <p className="mb-2" style={{ color: '#64748b' }}>Do this if you control the domain&apos;s DNS. Once, per domain.</p>
            <ol className="list-decimal ml-5 space-y-1" style={{ color: '#475569' }}>
              <li>In GSC → <strong>Add property</strong> → <strong>Domain</strong> → types <code className="px-1 rounded font-mono" style={{ background: '#f1f5f9' }}>{domain.replace(/^www\./, '')}</code> (no https://)</li>
              <li>Google gives a TXT record like <code className="px-1 rounded font-mono text-[10px]" style={{ background: '#f1f5f9' }}>google-site-verification=AbCdEf...</code></li>
              <li>Add that TXT record at your DNS provider (Cloudflare, GoDaddy, Vercel DNS, etc.) on the root domain.</li>
              <li>Wait 1–10 min → click <strong>Verify</strong> in GSC.</li>
              <li>That single record verifies <strong>every subdomain + https + www</strong>. Any future site under this domain is already good to go.</li>
              <li>Property appears here as <code className="px-1 rounded font-mono" style={{ background: '#f1f5f9' }}>sc-domain:{domain.replace(/^www\./, '')}</code> → Select it above.</li>
            </ol>
          </div>
        </div>
      )}

      {showPicker && gsc && (
        <div className="px-5 py-4" style={{ background: '#fafbfc', borderTop: '1px solid #e2e8f0' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
            Pick the GSC property for {domain}
          </p>
          {propsLoading ? (
            <p className="text-xs py-3" style={{ color: '#94a3b8' }}>Loading your Search Console properties…</p>
          ) : propsNeedsReconnect ? (
            <div className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs" style={{ color: '#64748b' }}>
                Google revoked Webcore&apos;s access (token expired or permission removed). Reconnect to pick a property.
              </p>
              <button type="button" onClick={connectGsc} disabled={busy}
                className="text-[11px] font-medium px-3 py-1.5 rounded-md text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ background: 'var(--primary)' }}>
                Reconnect Search Console
              </button>
            </div>
          ) : propsError ? (
            <p className="text-xs py-3" style={{ color: '#b91c1c' }}>{propsError}</p>
          ) : !properties || properties.length === 0 ? (
            <div className="py-3 space-y-2">
              <p className="text-xs" style={{ color: '#64748b' }}>
                The connected Google account has <strong>no Search Console properties</strong>. Go to{' '}
                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>
                  search.google.com/search-console
                </a>{' '}
                first, add and verify your site, then come back and hit <strong>Change property</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e2e8f0', background: 'white', maxHeight: '240px', overflowY: 'auto' }}>
                {properties.map(p => (
                  <label key={p.siteUrl} className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-slate-50"
                    style={{ borderBottom: '1px solid #f1f5f9', background: selected === p.siteUrl ? '#eff6ff' : 'transparent' }}>
                    <input type="radio" name="gsc-property" value={p.siteUrl} checked={selected === p.siteUrl}
                      onChange={() => setSelected(p.siteUrl)} className="flex-shrink-0" />
                    <span className="text-xs font-mono flex-1 truncate" style={{ color: '#334155' }}>{p.siteUrl}</span>
                    {p.matched && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#15803d' }}>likely match</span>}
                    <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{p.permissionLevel.replace('site', '').toLowerCase() || p.permissionLevel}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowPicker(false)}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors hover:bg-slate-100"
                  style={{ color: '#475569' }}>Cancel</button>
                <button type="button" onClick={saveProperty} disabled={!selected || saving}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-md text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: 'var(--primary)' }}>
                  {saving ? 'Saving…' : 'Save property'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function GoogleSearchConsoleGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function LiveRevalidationSection({ domain }: { domain: string }) {
  const [settings, setSettings] = useState<RevalidationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function load() {
    setLoading(true)
    fetch(`/api/website-settings?website=${encodeURIComponent(domain)}`)
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setUrlInput(d?.revalidate_url ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [domain])

  async function save() {
    setSaving(true)
    setFlash(null)
    try {
      const trimmed = urlInput.trim()
      const res = await fetch('/api/website-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, revalidate_url: trimmed === '' ? null : trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'error', text: data.error ?? 'Failed to save' })
        return
      }
      setSettings(data)
      setUrlInput(data?.revalidate_url ?? '')
      setFlash({ kind: 'success', text: trimmed === '' ? 'Revalidation disabled' : 'Saved. Webcore will now ping this URL on every change' })
    } catch (e) {
      setFlash({ kind: 'error', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function rotate() {
    if (!confirm('Rotate the secret? You will need to update WEBCORE_REVALIDATE_SECRET in the designer site\'s .env and redeploy.')) return
    setRotating(true)
    setFlash(null)
    try {
      const res = await fetch('/api/website-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: domain, action: 'rotate_secret' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'error', text: data.error ?? 'Failed to rotate' })
        return
      }
      setSettings(data)
      setShowSecret(true)
      setFlash({ kind: 'success', text: 'New secret generated. Copy it into the designer site\'s .env now.' })
    } catch (e) {
      setFlash({ kind: 'error', text: (e as Error).message })
    } finally {
      setRotating(false)
    }
  }

  function copySecret() {
    if (!settings?.revalidate_secret) return
    navigator.clipboard.writeText(settings.revalidate_secret)
      .then(() => setFlash({ kind: 'success', text: 'Secret copied to clipboard' }))
      .catch(() => setFlash({ kind: 'error', text: 'Copy failed' }))
  }

  const isActive = !!settings?.revalidate_url
  const status = loading ? { label: 'Loading…', tone: 'loading' as const } : isActive ? { label: 'Active', tone: 'connected' as const } : { label: 'Not configured', tone: 'idle' as const }

  return (
    <SectionCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="#1E5BFF" viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      }
      title="Live Revalidation"
      status={status}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs" style={{ color: '#475569' }}>
            {isActive
              ? <>Pings <code className="font-mono px-1 py-0.5 rounded text-[10px]" style={{ background: '#f1f5f9' }}>{settings?.revalidate_url}</code> on every product / phone / blog change.</>
              : 'Push instant cache invalidation to the designer site when content changes here.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            disabled={loading}
            className="text-[11px] font-medium px-3 py-1.5 rounded-md border disabled:opacity-50 transition-colors hover:bg-slate-50"
            style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
          >
            {expanded ? 'Hide' : isActive ? 'Edit' : 'Configure'}
          </button>
        </div>
      </div>

      {expanded && !loading && (
        <div className="px-5 py-4" style={{ background: '#fafbfc', borderTop: '1px solid #e2e8f0' }}>
          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#475569' }}>Designer site revalidate URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://designersite.com/api/revalidate"
              className="flex-1 text-xs px-3 py-2 rounded-md outline-none focus:border-[var(--primary)]"
              style={{ border: '1px solid #e2e8f0', color: 'var(--foreground)', background: 'white' }}
              disabled={saving}
            />
            <button
              onClick={save}
              disabled={saving || urlInput === (settings?.revalidate_url ?? '')}
              className="text-xs font-medium px-3 py-2 rounded-md text-white disabled:opacity-40"
              style={{ background: 'var(--primary)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="text-[10px] mt-2 space-y-1" style={{ color: '#64748b' }}>
            <p><span className="font-semibold" style={{ color: '#475569' }}>What to paste:</span> the designer site&apos;s deployed origin + <code className="font-mono">/api/revalidate</code>. Example: <code className="font-mono px-1 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>https://{domain.replace(/^www\./, '')}/api/revalidate</code></p>
            <p><span className="font-semibold" style={{ color: '#475569' }}>Heads up:</span> the designer site must have <code className="font-mono">WEBCORE_REVALIDATE_SECRET</code> set in its production env (Vercel → Project → Settings → Environment Variables) and be redeployed. Without that, pings return 401 and content stays stale.</p>
            <p>Leave blank to disable.</p>
          </div>

          {settings?.revalidate_secret && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold" style={{ color: '#475569' }}>Secret (header: <code className="font-mono">X-Webcore-Secret</code>)</label>
                <button
                  onClick={() => setShowSecret(s => !s)}
                  className="text-[10px] font-medium underline"
                  style={{ color: '#64748b' }}
                >
                  {showSecret ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <div className="flex gap-2">
                <code className="flex-1 text-[11px] font-mono px-3 py-2 rounded-md truncate" style={{ background: 'white', border: '1px solid #e2e8f0', color: 'var(--foreground)' }}>
                  {showSecret ? settings.revalidate_secret : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={copySecret}
                  className="text-xs font-medium px-3 py-2 rounded-md border"
                  style={{ borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                >
                  Copy
                </button>
                <button
                  onClick={rotate}
                  disabled={rotating}
                  className="text-xs font-medium px-3 py-2 rounded-md border disabled:opacity-40"
                  style={{ borderColor: '#fecaca', color: '#b91c1c', background: 'white' }}
                >
                  {rotating ? '…' : 'Rotate'}
                </button>
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: '#94a3b8' }}>Paste this as <code className="font-mono">WEBCORE_REVALIDATE_SECRET</code> in the designer site&apos;s <code className="font-mono">.env.local</code>.</p>
            </div>
          )}

          {flash && (
            <div className="mt-3 px-3 py-2 rounded-md text-xs"
              style={{ background: flash.kind === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${flash.kind === 'success' ? '#bbf7d0' : '#fecaca'}`, color: flash.kind === 'success' ? '#166534' : '#b91c1c' }}>
              {flash.text}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
