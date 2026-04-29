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

  return (
    <div className="relative group">
      <Link
        href={`/websites?website=${encodeURIComponent(domain)}`}
        className="block rounded-xl border bg-white overflow-hidden transition-all hover:shadow-md"
        style={{ borderColor: '#e2e8f0' }}
      >
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: '#f8fafc' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt={domain} loading="lazy"
            className="w-full h-full object-cover object-top" />
          {/* PREMIUM-style badge anchored top-left, matching the screenshot */}
          <div className="absolute top-0 left-3">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md"
              style={{ background: '#7c3aed', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
              Premium
            </div>
          </div>
        </div>
        <div className="px-3 py-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--foreground)' }}>{friendlyName}</p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: '#94a3b8' }}>{siteUrl}</p>
          </div>
          {/* Spacer for the three-dots button positioned absolute below */}
          <div className="w-7 h-7 flex-shrink-0" aria-hidden />
        </div>
      </Link>
      {/* Three-dots button overlaid as a sibling (NOT nested inside <a>) so the
          button can have its own click handler without nesting interactive
          elements. */}
      <button
        type="button"
        aria-label="Site actions"
        onClick={() => {
          // TODO: open actions popover (open external, copy domain, remove from webcore)
        }}
        className="absolute bottom-2.5 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100"
        style={{ border: '1px solid #e2e8f0', color: '#94a3b8', background: 'white' }}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
    </div>
  )
}
