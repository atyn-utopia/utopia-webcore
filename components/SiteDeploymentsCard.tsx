'use client'

import { useEffect, useState } from 'react'
import { ArrowTopRightOnSquareIcon, RocketLaunchIcon } from '@heroicons/react/24/solid'

interface Deployment {
  id: string
  url: string
  state: string
  target: string | null
  createdAt: number
  creator: { uid: string; username: string | null; name: string | null } | null
  commit: { message: string | null; ref: string | null; sha: string | null; repo: string | null } | null
}

interface Props { domain: string }

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  READY:        { label: 'Ready',     color: '#15803d', bg: '#dcfce7' },
  ERROR:        { label: 'Failed',    color: '#b91c1c', bg: '#fef2f2' },
  CANCELED:     { label: 'Canceled',  color: '#64748b', bg: '#f1f5f9' },
  BUILDING:     { label: 'Building',  color: '#92400e', bg: '#fef3c7' },
  QUEUED:       { label: 'Queued',    color: '#92400e', bg: '#fef3c7' },
  INITIALIZING: { label: 'Init',      color: '#92400e', bg: '#fef3c7' },
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Recent deploys card for /site-settings?website=<domain>. Reads the
 * matching Vercel project's deployment history and shows who shipped
 * each build, with the commit message + branch when the project is
 * connected to Git. Hidden when no Vercel token is set or the domain
 * isn't on a project this token can see.
 */
export default function SiteDeploymentsCard({ domain }: Props) {
  const [data, setData] = useState<Deployment[] | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/company-websites/deployments?domain=${encodeURIComponent(domain)}&limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { deployments?: Deployment[]; projectId?: string | null; reason?: string } | null) => {
        if (cancelled) return
        if (!d) { setData([]); return }
        setData(d.deployments ?? [])
        if (!d.projectId && d.reason) setReason(d.reason)
      })
      .catch(() => { if (!cancelled) setData([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [domain])

  // No Vercel token configured — hide the card entirely. No point teasing
  // a feature that won't work without infra.
  if (!loading && reason === 'vercel-token-missing') return null
  // No project found for this domain (custom host or different team) —
  // also hide; the surface is for admins to see git-author history when
  // the site lives on this team.
  if (!loading && reason === 'no-project') return null

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <RocketLaunchIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#1E5BFF' }} />
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recent Deploys</h3>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
            Latest builds on Vercel — who shipped, what commit, current state.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-xs" style={{ color: '#94a3b8' }}>Loading…</div>
      ) : !data || data.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs" style={{ color: '#94a3b8' }}>No deploys recorded yet.</div>
      ) : (
        <div>
          {data.map((d, i) => {
            const state = STATE_META[d.state] ?? { label: d.state, color: '#64748b', bg: '#f1f5f9' }
            const isProd = d.target === 'production'
            return (
              <div
                key={d.id}
                className="px-5 py-3 flex items-start gap-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: state.bg, color: state.color }}
                    >
                      {state.label}
                    </span>
                    {isProd && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#eff6ff', color: '#1E5BFF' }}>
                        Prod
                      </span>
                    )}
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {d.creator?.name || d.creator?.username || 'Unknown deployer'}
                    </span>
                    {d.creator?.username && d.creator.name && (
                      <span className="text-[11px]" style={{ color: '#94a3b8' }}>@{d.creator.username}</span>
                    )}
                  </div>
                  {d.commit?.message && (
                    <p className="text-xs mt-1 truncate" style={{ color: '#475569' }} title={d.commit.message}>
                      {d.commit.message.split('\n')[0]}
                    </p>
                  )}
                  <p className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: '#94a3b8' }}>
                    <span>{relTime(d.createdAt)}</span>
                    {d.commit?.ref && (
                      <>
                        <span>·</span>
                        <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{d.commit.ref}</code>
                      </>
                    )}
                    {d.commit?.sha && (
                      <>
                        <span>·</span>
                        <code className="font-mono text-[10px]">{d.commit.sha.slice(0, 7)}</code>
                      </>
                    )}
                  </p>
                </div>
                <a
                  href={`https://${d.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] flex-shrink-0"
                  style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                  title={`Open ${d.url}`}
                >
                  Open
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
