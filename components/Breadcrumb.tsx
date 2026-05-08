'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ChevronRightIcon } from '@heroicons/react/24/solid'
interface CrumbItem {
  label: string
  href?: string
}

interface SiteCompany { domain: string; company_id: string | null; company_name: string | null }

export default function Breadcrumb() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const website = searchParams.get('website') ?? ''
  const [postTitle, setPostTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [siteCompany, setSiteCompany] = useState<{ name: string; id: string | null } | null>(null)

  // Post title for blog edit/view pages
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

  // Company name for /company/[id]
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

  // Resolve the active website's company so the breadcrumb can read
  // home › Company › domain on every site-scoped page.
  useEffect(() => {
    if (!website) { setSiteCompany(null); return }
    fetch('/api/websites')
      .then(r => r.json())
      .then((rows: SiteCompany[]) => {
        if (!Array.isArray(rows)) return
        const found = rows.find(s => s.domain === website)
        if (found?.company_name) setSiteCompany({ name: found.company_name, id: found.company_id })
        else setSiteCompany(null)
      })
      .catch(() => setSiteCompany(null))
  }, [website])

  function getCrumbs(): CrumbItem[] {
    // ─── Site context (?website=…) ─────────────────────────────────────
    // Crumb chain: Home › Company › domain › [Page name]
    if (website) {
      const dashboardHref = `/websites?website=${encodeURIComponent(website)}`
      const crumbs: CrumbItem[] = []
      if (siteCompany?.name) {
        crumbs.push({ label: siteCompany.name, href: siteCompany.id ? `/company/${siteCompany.id}` : undefined })
      }

      // /websites with website param IS the per-site dashboard — domain is last
      if (pathname === '/websites') return [...crumbs, { label: website }]

      // For all other site-scoped pages, domain is a clickable middle crumb
      const siteCrumb: CrumbItem = { label: website, href: dashboardHref }

      if (pathname === '/products') return [...crumbs, siteCrumb, { label: 'Products' }]
      if (pathname === '/products/new') return [...crumbs, siteCrumb, { label: 'Products', href: `/products?website=${encodeURIComponent(website)}` }, { label: 'New Product' }]
      if (/^\/products\/.+\/edit$/.test(pathname)) return [...crumbs, siteCrumb, { label: 'Products', href: `/products?website=${encodeURIComponent(website)}` }, { label: 'Edit Product' }]

      if (pathname === '/phone-numbers') return [...crumbs, siteCrumb, { label: 'Phone Numbers' }]
      if (pathname === '/phone-numbers/edit') return [...crumbs, siteCrumb, { label: 'Phone Numbers', href: `/phone-numbers?website=${encodeURIComponent(website)}` }, { label: 'Manage' }]
      if (pathname === '/phone-numbers/new') return [...crumbs, siteCrumb, { label: 'Phone Numbers', href: `/phone-numbers?website=${encodeURIComponent(website)}` }, { label: 'Add Number' }]

      if (pathname === '/blog') return [...crumbs, siteCrumb, { label: 'Blog' }]
      if (pathname === '/blog/new') return [...crumbs, siteCrumb, { label: 'Blog', href: `/blog?website=${encodeURIComponent(website)}` }, { label: 'New Post' }]
      if (/^\/blog\/.+\/edit$/.test(pathname)) return [...crumbs, siteCrumb, { label: 'Blog', href: `/blog?website=${encodeURIComponent(website)}` }, { label: postTitle || 'Edit Post' }]
      if (/^\/blog\/.+\/view$/.test(pathname)) return [...crumbs, siteCrumb, { label: 'Blog', href: `/blog?website=${encodeURIComponent(website)}` }, { label: postTitle || 'Preview' }]

      if (pathname === '/integrations') return [...crumbs, siteCrumb, { label: 'Integrations' }]
      if (pathname === '/site-settings') return [...crumbs, siteCrumb, { label: 'Settings' }]
      if (pathname === '/seo') return [...crumbs, siteCrumb, { label: 'SEO' }]
      if (pathname === '/analytics') return [...crumbs, siteCrumb, { label: 'Analytics' }]
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
    if (pathname === '/phone-numbers/edit') return [{ label: 'Phone Numbers', href: '/phone-numbers' }, { label: 'Manage' }]
    if (pathname === '/phone-numbers/new') return [{ label: 'Phone Numbers', href: '/phone-numbers' }, { label: 'Add Number' }]

    if (pathname === '/blog') return [{ label: 'Blog' }]
    if (pathname === '/blog/new') return [{ label: 'Blog', href: '/blog' }, { label: 'New Post' }]
    if (/^\/blog\/.+\/edit$/.test(pathname)) return [{ label: 'Blog', href: '/blog' }, { label: postTitle || 'Edit Post' }]
    if (/^\/blog\/.+\/view$/.test(pathname)) return [{ label: 'Blog', href: '/blog' }, { label: postTitle || 'Preview' }]

    if (pathname === '/integrations') return [{ label: 'Integrations' }]
    if (pathname === '/site-settings') return [{ label: 'Settings' }]
    if (pathname === '/seo') return [{ label: 'SEO' }]
    if (pathname === '/analytics') return [{ label: 'Analytics' }]

    // /all/* power-user cross-site views
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

  // Dashboard home is its own destination — no breadcrumb needed there.
  if (pathname === '/') return null

  return (
    <nav className="flex items-center gap-2 text-sm min-w-0 mb-4" aria-label="Breadcrumb">
      {/* Home */}
      <Link
        href="/"
        className="flex items-center transition-colors flex-shrink-0"
        style={{ color: crumbs.length === 0 ? 'var(--foreground)' : '#94a3b8' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = crumbs.length === 0 ? 'var(--foreground)' : '#94a3b8'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      {/* On mobile, only the last two crumbs (parent + current) render so the
          breadcrumb stays one line. An ellipsis dot stands in for the
          collapsed middle crumbs to hint there's more depth. Desktop sees
          the full chain. */}
      {crumbs.length > 2 && (
        <span className="flex sm:hidden items-center gap-2 min-w-0 flex-shrink-0">
          <ChevronRightIcon className="w-3 h-3 flex-shrink-0" style={{ color: '#cbd5e1' }} />
          <span style={{ color: '#cbd5e1' }} title={`${crumbs.length - 2} more level${crumbs.length - 2 === 1 ? '' : 's'}`}>…</span>
        </span>
      )}

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const isParent = i === crumbs.length - 2
        const hideOnMobile = crumbs.length > 2 && !isLast && !isParent
        return (
          <span key={i} className={`${hideOnMobile ? 'hidden sm:flex' : 'flex'} items-center gap-2 min-w-0`}>
            <ChevronRightIcon className="w-3 h-3 flex-shrink-0" style={{ color: '#cbd5e1' }} />
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="transition-colors truncate max-w-[120px] sm:max-w-[200px]"
                style={{ color: '#94a3b8' }}
                title={crumb.label}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={`${isLast ? 'font-semibold truncate max-w-[180px] sm:max-w-[260px]' : 'font-medium'}`}
                style={{ color: isLast ? 'var(--foreground)' : '#94a3b8' }}
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
