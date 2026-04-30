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
  const website = searchParams.get('website') ?? ''
  const [postTitle, setPostTitle] = useState('')
  const [companyName, setCompanyName] = useState('')

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

  // Fetch company name for /company/[id]
  useEffect(() => {
    const match = pathname.match(/^\/company\/([^/]+)$/)
    if (!match) { setCompanyName(''); return }
    const id = match[1]
    fetch('/api/companies')
      .then(r => r.json())
      .then((rows: { id: string; name: string }[]) => {
        if (Array.isArray(rows)) {
          const found = rows.find(c => c.id === id)
          setCompanyName(found?.name ?? '')
        }
      })
      .catch(() => setCompanyName(''))
  }, [pathname])

  function getCrumbs(): CrumbItem[] {
    // ─── Site context (?website=…) — Home > {site} > {tab} ─────────────
    if (website) {
      const dashboardHref = `/websites?website=${encodeURIComponent(website)}`
      const siteCrumb: CrumbItem = { label: website, href: dashboardHref }

      // /websites with website param IS the per-site dashboard — just one crumb
      if (pathname === '/websites') return [{ label: website }]

      // Products under a site
      if (pathname === '/products') return [siteCrumb, { label: 'Products' }]
      if (pathname === '/products/new') return [siteCrumb, { label: 'Products', href: `/products?website=${encodeURIComponent(website)}` }, { label: 'New Product' }]
      if (/^\/products\/.+\/edit$/.test(pathname)) return [siteCrumb, { label: 'Products', href: `/products?website=${encodeURIComponent(website)}` }, { label: 'Edit Product' }]

      // Phone numbers under a site
      if (pathname === '/phone-numbers' || pathname === '/phone-numbers/edit') return [siteCrumb, { label: 'Phone Numbers' }]
      if (pathname === '/phone-numbers/new') return [siteCrumb, { label: 'Phone Numbers', href: `/phone-numbers?website=${encodeURIComponent(website)}` }, { label: 'Add Number' }]

      // Blog under a site
      if (pathname === '/blog') return [siteCrumb, { label: 'Blog' }]
      if (pathname === '/blog/new') return [siteCrumb, { label: 'Blog', href: `/blog?website=${encodeURIComponent(website)}` }, { label: 'New Post' }]
      if (/^\/blog\/.+\/edit$/.test(pathname)) return [siteCrumb, { label: 'Blog', href: `/blog?website=${encodeURIComponent(website)}` }, { label: postTitle || 'Edit Post' }]
      if (/^\/blog\/.+\/view$/.test(pathname)) return [siteCrumb, { label: 'Blog', href: `/blog?website=${encodeURIComponent(website)}` }, { label: postTitle || 'Preview' }]

      // Integrations under a site
      if (pathname === '/integrations') return [siteCrumb, { label: 'Integrations' }]

      // Analytics under a site
      if (pathname === '/analytics') return [siteCrumb, { label: 'Analytics' }]
    }

    // ─── Company folder ────────────────────────────────────────────────
    if (/^\/company\/[^/]+$/.test(pathname)) {
      return [{ label: companyName || 'Company' }]
    }

    // ─── Non-site-context (global pages) ───────────────────────────────
    if (pathname === '/websites') return [{ label: 'Websites' }]

    if (pathname === '/products') return [{ label: 'Products' }]
    if (pathname === '/products/new') return [{ label: 'Products', href: '/products' }, { label: 'New Product' }]
    if (/^\/products\/.+\/edit$/.test(pathname)) return [{ label: 'Products', href: '/products' }, { label: 'Edit Product' }]

    if (pathname === '/phone-numbers') return [{ label: 'Phone Numbers' }]
    if (pathname === '/phone-numbers/edit') return [{ label: 'Phone Numbers' }]
    if (pathname === '/phone-numbers/new') return [{ label: 'Phone Numbers', href: '/phone-numbers' }, { label: 'Add Number' }]

    if (pathname === '/blog') return [{ label: 'Blog' }]
    if (pathname === '/blog/new') return [{ label: 'Blog', href: '/blog' }, { label: 'New Post' }]
    if (/^\/blog\/.+\/edit$/.test(pathname)) return [{ label: 'Blog', href: '/blog' }, { label: postTitle || 'Edit Post' }]
    if (/^\/blog\/.+\/view$/.test(pathname)) return [{ label: 'Blog', href: '/blog' }, { label: postTitle || 'Preview' }]

    if (pathname === '/integrations') return [{ label: 'Integrations' }]
    if (pathname === '/analytics') return [{ label: 'Analytics' }]

    // /all/* power-user cross-site views
    if (pathname === '/all/websites') return [{ label: 'All Websites' }]
    if (pathname === '/all/phone-numbers') return [{ label: 'All Phone Numbers' }]
    if (pathname === '/all/blog') return [{ label: 'All Blog' }]

    // Admin tools
    if (pathname === '/users') return [{ label: 'Users' }]
    if (pathname === '/users/onboard') return [{ label: 'Users', href: '/users' }, { label: 'Onboard Designer' }]
    if (pathname === '/tickets') return [{ label: 'Tickets' }]
    if (pathname === '/api-keys') return [{ label: 'API Keys' }]
    if (pathname === '/audit') return [{ label: 'Audit Trail' }]
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
                className="transition-colors truncate max-w-[200px]"
                style={{ color: '#475569' }}
                title={crumb.label}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={`font-medium ${isLast ? 'truncate max-w-[240px]' : ''}`}
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
