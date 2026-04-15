'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useToast } from '@/contexts/ToastContext'
import ViewToggle, { type ViewMode } from '@/components/ViewToggle'

interface Company { id: string; name: string; company_websites: { domain: string }[] }
interface WebsiteSummary { domain: string; company_name: string | null }
interface Product {
  id: string
  website: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  sale_price: number | null
  rental_price: number | null
  sort_order: number
  is_active: boolean
  photo_count: number
  sub_product_count: number
  photos: { id: string; url: string; alt_text: string | null }[]
}

function formatPrice(v: number | null) {
  if (v === null || v === undefined) return null
  return `RM ${Number(v).toFixed(2)}`
}

export default function ProductsPage() {
  const { t } = useLanguage()
  const confirm = useConfirm()
  const toast = useToast()
  const searchParams = useSearchParams()
  const openCompany = searchParams.get('company') ?? ''
  const openWebsite = searchParams.get('website') ?? ''

  const [companies, setCompanies] = useState<Company[]>([])
  const [websites, setWebsites] = useState<WebsiteSummary[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/websites').then(r => r.json()),
    ]).then(([c, w]) => {
      if (Array.isArray(c)) setCompanies(c)
      if (Array.isArray(w)) setWebsites(w)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fetchProducts = useCallback(async () => {
    if (!openWebsite) return
    setProductsLoading(true)
    const res = await fetch(`/api/products?website=${encodeURIComponent(openWebsite)}&parent_id=null`)
    const data = await res.json()
    if (Array.isArray(data)) setProducts(data)
    setProductsLoading(false)
  }, [openWebsite])

  useEffect(() => { if (openWebsite) fetchProducts() }, [openWebsite, fetchProducts])

  async function deleteProduct(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete product',
      message: `This will permanently delete "${name}" and all its sub-products and photos. This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`"${name}" deleted`, 'Deleted')
      fetchProducts()
    } else {
      toast.error('Failed to delete product', 'Delete failed')
    }
  }

  // Company folder view
  if (!openCompany && !openWebsite) {
    const companyStats = companies.map(c => ({
      ...c,
      site_count: c.company_websites.length,
    }))
    const filtered = search
      ? companyStats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      : companyStats

    return (
      <div>
        <PageHeader
          title={t('page.products.title')}
          description={t('page.products.description')}
          actions={<ViewToggle value={viewMode} onChange={setViewMode} />}
        />
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <Link key={c.id} href={`/products?company=${encodeURIComponent(c.name)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                    <span className="text-[10px]" style={{ color: '#475569' }}>{c.site_count} {c.site_count === 1 ? 'website' : 'websites'}</span>
                  </div>
                  <svg className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {filtered.map((c, i) => (
              <Link key={c.id} href={`/products?company=${encodeURIComponent(c.name)}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-sm font-semibold truncate flex-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                <span className="text-xs flex-shrink-0" style={{ color: '#64748b' }}>{c.site_count} websites</span>
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Company website view
  if (openCompany && !openWebsite) {
    const companyDomains = new Set(companies.find(c => c.name === openCompany)?.company_websites.map(w => w.domain) ?? [])
    const companySites = websites.filter(w => companyDomains.has(w.domain))

    return (
      <div>
        <PageHeader
          title={openCompany}
          description="Select a website to manage its products"
          actions={<ViewToggle value={viewMode} onChange={setViewMode} />}
        />
        {loading ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
        ) : companySites.length === 0 ? (
          <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>No websites found for this company.</div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companySites.map(site => (
              <Link key={site.domain} href={`/products?website=${encodeURIComponent(site.domain)}`}
                className="group block rounded-xl border bg-white p-5 hover:shadow-sm transition-all hover:border-slate-300" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                      <circle cx="12" cy="12" r="9"/><path d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path d="M12 3c0 0 3 4 3 9s-3 9-3 9"/><path d="M3 12h18"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                  </div>
                  <svg className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            {companySites.map((site, i) => (
              <Link key={site.domain} href={`/products?website=${encodeURIComponent(site.domain)}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] transition-colors"
                style={{ borderBottom: i < companySites.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9"/><path d="M12 3c0 0-3 4-3 9s3 9 3 9"/><path d="M3 12h18"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold truncate flex-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--foreground)' }}>{site.domain}</p>
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }} strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Website products view
  const filtered = products.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        title={openWebsite}
        description={`${products.length} product${products.length !== 1 ? 's' : ''} on this website`}
        actions={
          <Link
            href={`/products/new?website=${encodeURIComponent(openWebsite)}${openCompany ? `&company=${encodeURIComponent(openCompany)}` : ''}`}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('button.addProduct')}
          </Link>
        }
      />

      {/* Search */}
      {products.length > 3 && (
        <div className="mb-5">
          <div className="relative max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none" style={{ borderColor: '#cbd5e1', background: 'white' }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {productsLoading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{products.length === 0 ? 'No products yet. Add your first one.' : 'No products match your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(product => (
            <div key={product.id} className="rounded-xl border bg-white overflow-hidden hover:shadow-sm transition-all" style={{ borderColor: '#e2e8f0' }}>
              {/* Thumbnail */}
              {product.photos.length > 0 ? (
                <div className="h-40 bg-slate-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.photos[0].url} alt={product.photos[0].alt_text ?? product.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center" style={{ background: '#f8fafc' }}>
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#e2e8f0' }} strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{product.name}</h3>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>/{product.slug}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: product.is_active ? '#16a34a' : '#94a3b8' }} />
                    {product.is_active ? 'Active' : 'Off'}
                  </span>
                </div>

                {/* Pricing */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {product.sale_price !== null && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                      Sale: {formatPrice(product.sale_price)}
                    </span>
                  )}
                  {product.rental_price !== null && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                      Rental: {formatPrice(product.rental_price)}
                    </span>
                  )}
                  {product.sale_price === null && product.rental_price === null && (
                    <span className="text-xs" style={{ color: '#94a3b8' }}>No pricing set</span>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: '#94a3b8' }}>
                  <span>{product.photo_count} photo{product.photo_count !== 1 ? 's' : ''}</span>
                  {product.sub_product_count > 0 && <span>{product.sub_product_count} sub-product{product.sub_product_count !== 1 ? 's' : ''}</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <Link
                    href={`/products/${product.id}/edit`}
                    className="flex-1 text-center text-xs font-medium py-1.5 rounded-md border border-[#e2e8f0] text-[#475569] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteProduct(product.id, product.name)}
                    className="flex-1 text-center text-xs font-medium py-1.5 rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:bg-[#ef4444] hover:border-white hover:text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{filtered.length} of {products.length} products</p>
    </div>
  )
}
