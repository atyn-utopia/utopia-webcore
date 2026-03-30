'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface CrumbItem {
  label: string
  href?: string
}

function getCrumbs(pathname: string): CrumbItem[] {
  if (pathname === '/') return []
  if (pathname === '/phone-numbers') return [{ label: 'Phone Numbers' }]
  if (pathname === '/phone-numbers/new') return [{ label: 'Phone Numbers', href: '/phone-numbers' }, { label: 'Add Number' }]
  if (pathname === '/blog') return [{ label: 'Blog Posts' }]
  if (pathname === '/blog/new') return [{ label: 'Blog Posts', href: '/blog' }, { label: 'New Post' }]
  if (/^\/blog\/.+\/edit$/.test(pathname)) return [{ label: 'Blog Posts', href: '/blog' }, { label: 'Edit Post' }]
  return []
}

export default function Breadcrumb() {
  const pathname = usePathname()
  const router = useRouter()
  const crumbs = getCrumbs(pathname)

  return (
    <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--card)', color: '#64648a' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = '#64648a' }}
        aria-label="Go back"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Home */}
      <Link
        href="/"
        className="flex items-center transition-colors flex-shrink-0"
        style={{ color: crumbs.length === 0 ? 'var(--primary)' : '#7dbdd0' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = crumbs.length === 0 ? 'var(--primary)' : '#7dbdd0'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#b8dde8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="transition-colors"
                style={{ color: '#7dbdd0' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#7dbdd0'}
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium" style={{ color: isLast ? 'var(--primary)' : 'var(--foreground)' }}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
