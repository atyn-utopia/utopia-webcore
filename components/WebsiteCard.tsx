'use client'

import Link from 'next/link'

interface Props {
  domain: string
  leadsMode?: string | null
  activePhones?: number
}

const LEADS_MODE_LABEL: Record<string, string> = {
  single: 'Single',
  rotation: 'Rotation',
  location: 'Location',
  hybrid: 'Hybrid',
}

export default function WebsiteCard({ domain, leadsMode, activePhones }: Props) {
  const siteUrl = `https://${domain}`
  const thumbUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=400`
  const friendlyName = domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  const dashboardHref = `/websites?website=${encodeURIComponent(domain)}`
  const lm = leadsMode && LEADS_MODE_LABEL[leadsMode] ? LEADS_MODE_LABEL[leadsMode] : null

  return (
    <div className="rounded-xl border bg-white overflow-hidden transition-all hover:shadow-md" style={{ borderColor: '#e2e8f0' }}>
      <Link href={dashboardHref} className="block group">
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: '#f8fafc' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt={domain} loading="lazy"
            className="w-full h-full object-cover object-top" />
          {/* Status badge anchored top-left, screenshot tab-down style */}
          <div className="absolute top-0 left-3">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md"
              style={{ background: '#16a34a', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
              Active
            </div>
          </div>
        </div>
        <div className="px-3 pt-2.5">
          <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--foreground)' }}>{friendlyName}</p>
        </div>
      </Link>
      {/* External URL — its own clickable link to the live site (new tab) */}
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3 mt-0.5 text-[11px] truncate transition-colors hover:underline"
        style={{ color: '#94a3b8' }}
        title={`Open ${siteUrl}`}
      >
        {siteUrl}
      </a>
      {/* Status pills — match the per-site hero FactPill style */}
      {(lm || (activePhones !== undefined && activePhones > 0)) && (
        <div className="px-3 pt-2 pb-3 flex flex-wrap items-center gap-1.5">
          {lm && <CardPill label="Leads mode" value={lm} dot="#2563eb" />}
          {activePhones !== undefined && activePhones > 0 && <CardPill label="Phones" value={`${activePhones} Active`} dot="#16a34a" />}
        </div>
      )}
    </div>
  )
}

function CardPill({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px]" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span className="font-medium leading-none" style={{ color: '#94a3b8' }}>{label}</span>
      <span className="leading-none" style={{ color: 'var(--foreground)' }}>{value}</span>
    </span>
  )
}
