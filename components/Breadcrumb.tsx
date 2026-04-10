'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface CrumbItem {
  label: string
  href?: string
}

export default function Breadcrumb() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const company = searchParams.get('company') ?? ''
  const website = searchParams.get('website') ?? ''
  const [postTitle, setPostTitle] = useState('')

  // Fetch post title for blog edit/view pages
  useEffect(() => {
    const match = pathname.match(/^\/blog\/([^/]+)\/(edit|view)$/)
    if (match) {
      fetch(`/api/blog/${match[1]}`)
        .then(r => r.json())
        .then(data => {
          const t = data.blog_translations?.find((t: { language: string }) => t.language === 'en') ?? data.blog_translations?.[0]
          setPostTitle(t?.title ?? 'Post')
        })
        .catch(() => setPostTitle('Post'))
    } else {
      setPostTitle('')
    }
  }, [pathname])

  function getCrumbs(): CrumbItem[] {
    // Websites
    if (pathname === '/websites' && company) {
      return [{ label: 'Websites', href: '/websites' }, { label: company }]
    }
    if (pathname === '/websites') return [{ label: 'Websites' }]

    // Phone Numbers
    if (pathname === '/phone-numbers/new') {
      const crumbs: CrumbItem[] = [{ label: 'Phone Numbers', href: '/phone-numbers' }]
      if (company) crumbs.splice(1, 0, { label: company, href: `/phone-numbers?company=${encodeURIComponent(company)}` })
      crumbs.push({ label: 'Add Number' })
      return crumbs
    }
    if (pathname === '/phone-numbers' && company) {
      return [{ label: 'Phone Numbers', href: '/phone-numbers' }, { label: company }]
    }
    if (pathname === '/phone-numbers') return [{ label: 'Phone Numbers' }]

    // Blog
    if (pathname === '/blog/new') {
      return [{ label: 'Blog Posts', href: '/blog' }, { label: 'New Post' }]
    }
    if (/^\/blog\/.+\/view$/.test(pathname)) {
      return [{ label: 'Blog Posts', href: '/blog' }, { label: postTitle || 'Preview' }]
    }
    if (/^\/blog\/.+\/edit$/.test(pathname)) {
      return [{ label: 'Blog Posts', href: '/blog' }, { label: postTitle || 'Edit Post' }]
    }
    if (pathname === '/blog' && website) {
      const crumbs: CrumbItem[] = [{ label: 'Blog Posts', href: '/blog' }]
      if (company) crumbs.push({ label: company, href: `/blog?company=${encodeURIComponent(company)}` })
      crumbs.push({ label: website })
      return crumbs
    }
    if (pathname === '/blog' && company) {
      return [{ label: 'Blog Posts', href: '/blog' }, { label: company }]
    }
    if (pathname === '/blog') return [{ label: 'Blog Posts' }]

    // All listing pages
    if (pathname === '/all/websites') return [{ label: 'All Websites' }]
    if (pathname === '/all/phone-numbers') return [{ label: 'All Phone Numbers' }]
    if (pathname === '/all/blog') return [{ label: 'All Blog Posts' }]

    // Others
    if (pathname === '/users') return [{ label: 'Users' }]
    if (pathname === '/tickets') return [{ label: 'Tickets' }]
    if (pathname === '/help') return [{ label: 'Help & Feedback' }]
    return []
  }

  const crumbs = getCrumbs()

  return (
    <nav className="flex items-center gap-2 text-sm min-w-0" aria-label="Breadcrumb">
      {/* Home */}
      <Link
        href="/"
        className="flex items-center transition-colors flex-shrink-0"
        style={{ color: crumbs.length === 0 ? 'var(--primary)' : '#475569' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = crumbs.length === 0 ? 'var(--primary)' : '#475569'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-2 min-w-0">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="transition-colors truncate max-w-[150px]"
                style={{ color: '#475569' }}
                title={crumb.label}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={`font-medium ${isLast ? 'truncate max-w-[200px]' : ''}`}
                style={{ color: isLast ? 'var(--primary)' : 'var(--foreground)' }}
                title={crumb.label}
              >
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
