'use client'

import Link from 'next/link'

interface Props {
  domain: string
}

export default function WebsiteCard({ domain }: Props) {
  const siteUrl = `https://${domain}`
  const thumbUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=400`
  const friendlyName = domain.replace(/^www\./, '').split('.')[0]
    .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  const dashboardHref = `/websites?website=${encodeURIComponent(domain)}`

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
      {/* URL is its own clickable link → external site (new tab). Sibling of the
          dashboard Link so nested-anchor rules aren't violated. */}
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3 pb-2.5 text-[11px] truncate transition-colors hover:underline"
        style={{ color: '#94a3b8' }}
        title={`Open ${siteUrl}`}
      >
        {siteUrl}
      </a>
    </div>
  )
}
