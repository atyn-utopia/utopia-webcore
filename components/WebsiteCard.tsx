'use client'

import Link from 'next/link'
import { MapPinIcon, PhoneIcon } from '@heroicons/react/24/solid'

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
  const hasMeta = !!lm || (activePhones !== undefined && activePhones > 0)

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
      {/* External URL. Its own clickable link to the live site (new tab) */}
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
      {/* Compact metadata strip. Single line, slate icons + text — fits the
          narrow card width without wrapping or doubling-up colored dots. */}
      {hasMeta && (
        <div className="px-3 pt-2 pb-3 flex items-center gap-2 text-[11px]" style={{ color: '#64748b' }}>
          {lm && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPinIcon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{lm}</span>
            </span>
          )}
          {lm && activePhones !== undefined && activePhones > 0 && (
            <span style={{ color: '#cbd5e1' }}>·</span>
          )}
          {activePhones !== undefined && activePhones > 0 && (
            <span className="inline-flex items-center gap-1 truncate">
              <PhoneIcon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{activePhones} active</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
