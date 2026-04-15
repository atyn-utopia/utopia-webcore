'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'

interface ProductFormProps {
  mode: 'new' | 'edit'
  productId?: string
  initialData?: Record<string, string>
}

interface Photo { id: string; url: string; alt_text: string | null; sort_order: number }
interface SubProduct { id: string; name: string; slug: string; sale_price: number | null; rental_price: number | null; is_active: boolean; photos: Photo[] }

function toSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ProductForm({ mode, productId, initialData = {} }: ProductFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const toast = useToast()
  const confirm = useConfirm()

  const [companies, setCompanies] = useState<{ id: string; name: string; company_websites: { domain: string }[] }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [website, setWebsite] = useState(initialData.website ?? '')
  const [parentId] = useState(initialData.parent_id ?? '')

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugLocked, setSlugLocked] = useState(false)
  const [description, setDescription] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [rentalPrice, setRentalPrice] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [newPhotoUrl, setNewPhotoUrl] = useState('')
  const [subProducts, setSubProducts] = useState<SubProduct[]>([])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch companies
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setCompanies(data)
        if (initialData.company) {
          const match = data.find((c: { name: string }) => c.name === initialData.company)
          if (match) setSelectedCompany(match.id)
        } else if (initialData.website) {
          const match = data.find((c: { company_websites: { domain: string }[] }) => c.company_websites.some(w => w.domain === initialData.website))
          if (match) setSelectedCompany(match.id)
        }
      }
    }).catch(() => {})
  }, [initialData.company, initialData.website])

  // Load existing product in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !productId) return
    fetch(`/api/products/${productId}`).then(r => r.json()).then(data => {
      if (data.id) {
        setName(data.name ?? '')
        setSlug(data.slug ?? '')
        setSlugLocked(true)
        setDescription(data.description ?? '')
        setSalePrice(data.sale_price != null ? String(data.sale_price) : '')
        setRentalPrice(data.rental_price != null ? String(data.rental_price) : '')
        setIsActive(data.is_active ?? true)
        setWebsite(data.website ?? '')
        setPhotos(data.photos ?? [])
        setSubProducts(data.sub_products ?? [])
        // Auto-select company
        const match = companies.find(c => c.company_websites.some(w => w.domain === data.website))
        if (match) setSelectedCompany(match.id)
      }
    }).catch(() => {})
  }, [mode, productId, companies])

  const companyWebsites = companies.find(c => c.id === selectedCompany)?.company_websites ?? []

  // Auto-slug from name
  useEffect(() => {
    if (!slugLocked && name) setSlug(toSlug(name))
  }, [name, slugLocked])

  function validate() {
    const e: Record<string, string> = {}
    if (!website) e.website = 'Website is required'
    if (!name.trim()) e.name = 'Name is required'
    if (!slug.trim()) e.slug = 'Slug is required'
    return e
  }

  async function handleSave() {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    setSaved(false)

    const payload = {
      website,
      parent_id: parentId || null,
      name: name.trim(),
      slug: toSlug(slug),
      description: description.trim() || null,
      sale_price: salePrice ? parseFloat(salePrice) : null,
      rental_price: rentalPrice ? parseFloat(rentalPrice) : null,
      is_active: isActive,
    }

    const url = mode === 'edit' ? `/api/products/${productId}` : '/api/products'
    const method = mode === 'edit' ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (res.ok) {
      const data = await res.json()
      setSaved(true)
      toast.success(mode === 'new' ? 'Product created' : 'Product saved', 'Saved')
      if (mode === 'new') router.push(`/products/${data.id}/edit`)
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Save failed', 'Error')
    }
  }

  async function addPhoto() {
    if (!newPhotoUrl.trim() || !productId) return
    const res = await fetch(`/api/products/${productId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newPhotoUrl.trim() }),
    })
    if (res.ok) {
      const photo = await res.json()
      setPhotos(prev => [...prev, photo])
      setNewPhotoUrl('')
      toast.success('Photo added')
    } else {
      toast.error('Failed to add photo')
    }
  }

  async function removePhoto(photoId: string) {
    const ok = await confirm({
      title: 'Remove photo',
      message: 'This photo will be permanently removed.',
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/products/${productId}/photos?photo_id=${photoId}`, { method: 'DELETE' })
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      toast.success('Photo removed')
    }
  }

  async function deleteSubProduct(sub: SubProduct) {
    const ok = await confirm({
      title: 'Delete sub-product',
      message: `This will permanently delete "${sub.name}". This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/products/${sub.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSubProducts(prev => prev.filter(s => s.id !== sub.id))
      toast.success(`"${sub.name}" deleted`, 'Deleted')
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={mode === 'new' ? t('page.products.new') : t('page.products.edit')}
        description={mode === 'new' ? 'Add a new product or service to a website' : `Editing ${name || 'product'}`}
        actions={
          <>
            {saved && <span className="text-xs text-green-600 font-medium mr-2">Saved</span>}
            <button type="button" onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity disabled:opacity-50"
              style={{ background: 'var(--primary)' }}>
              {saving ? 'Saving…' : mode === 'new' ? 'Create Product' : 'Save Changes'}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Name + slug */}
          <div className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: '#e2e8f0' }}>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Product Name<span className="text-red-500 ml-0.5">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electric Wheelchair"
                className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors"
                style={{ borderColor: errors.name ? '#fca5a5' : '#cbd5e1' }} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: '#475569' }}>Slug<span className="text-red-500 ml-0.5">*</span></label>
                {mode === 'edit' && (
                  <button type="button" onClick={() => setSlugLocked(!slugLocked)}
                    className="text-[10px] font-medium" style={{ color: 'var(--primary)' }}>
                    {slugLocked ? 'Edit' : 'Lock'}
                  </button>
                )}
              </div>
              <input type="text" value={slug} onChange={e => { setSlug(e.target.value); if (mode === 'new') setSlugLocked(false) }}
                disabled={slugLocked}
                className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors disabled:opacity-60 font-mono"
                style={{ borderColor: errors.slug ? '#fca5a5' : '#cbd5e1' }} />
              {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Product description…"
                rows={4}
                className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors resize-y"
                style={{ borderColor: '#cbd5e1' }} />
            </div>
          </div>

          {/* Photos (edit mode only) */}
          {mode === 'edit' && (
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Photos</h3>
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {photos.map(photo => (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border" style={{ borderColor: '#e2e8f0' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.alt_text ?? ''} className="w-full h-28 object-cover" />
                      <button type="button" onClick={() => removePhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)}
                  placeholder="Paste image URL (https://...)"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none"
                  style={{ borderColor: '#cbd5e1' }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhoto() } }} />
                <button type="button" onClick={addPhoto}
                  className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  style={{ borderColor: '#cbd5e1', color: '#475569' }}>
                  Add Photo
                </button>
              </div>
            </div>
          )}

          {/* Sub-products (edit mode only) */}
          {mode === 'edit' && !parentId && (
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Sub-Products</h3>
                <Link
                  href={`/products/new?website=${encodeURIComponent(website)}&parent_id=${productId}`}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  style={{ borderColor: '#cbd5e1', color: '#475569' }}
                >
                  + Add Sub-Product
                </Link>
              </div>
              {subProducts.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: '#94a3b8' }}>No sub-products yet.</p>
              ) : (
                <div className="space-y-2">
                  {subProducts.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: '#f1f5f9' }}>
                      {sub.photos.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sub.photos[0].url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f8fafc' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#e2e8f0' }} strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{sub.name}</p>
                        <div className="flex gap-2 mt-0.5">
                          {sub.sale_price != null && <span className="text-[10px]" style={{ color: '#0369a1' }}>RM {Number(sub.sale_price).toFixed(2)}</span>}
                          {sub.rental_price != null && <span className="text-[10px]" style={{ color: '#7c3aed' }}>Rental: RM {Number(sub.rental_price).toFixed(2)}</span>}
                        </div>
                      </div>
                      <Link href={`/products/${sub.id}/edit`}
                        className="text-xs font-medium px-2.5 py-1 rounded-md border border-[#e2e8f0] text-[#475569] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]">
                        Edit
                      </Link>
                      <button type="button" onClick={() => deleteSubProduct(sub)}
                        className="text-xs font-medium px-2.5 py-1 rounded-md border border-[#e2e8f0] text-[#94a3b8] transition-colors hover:bg-[#ef4444] hover:border-white hover:text-white">
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Website selector */}
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Company</label>
                <div className="relative">
                  <select value={selectedCompany}
                    onChange={e => { setSelectedCompany(e.target.value); setWebsite('') }}
                    disabled={mode === 'edit'}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer disabled:opacity-60"
                    style={{ borderColor: '#cbd5e1', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Website</label>
                <div className="relative">
                  <select value={website}
                    onChange={e => setWebsite(e.target.value)}
                    disabled={!selectedCompany || mode === 'edit'}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none cursor-pointer disabled:opacity-60"
                    style={{ borderColor: errors.website ? '#fca5a5' : '#cbd5e1', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                    <option value="">{selectedCompany ? 'Select website…' : 'Select a company first'}</option>
                    {companyWebsites.map(w => <option key={w.domain} value={w.domain}>{w.domain}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website}</p>}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Pricing</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Sale Price (RM)</label>
                <input type="number" step="0.01" min="0" value={salePrice} onChange={e => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Rental Price (RM)</label>
                <input type="number" step="0.01" min="0" value={rentalPrice} onChange={e => setRentalPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2e8f0' }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Status</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={() => setIsActive(!isActive)}
                className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: isActive ? '#16a34a' : '#cbd5e1' }}>
                <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow"
                  style={{ transform: isActive ? 'translateX(16px)' : 'translateX(0)' }} />
              </button>
              <span className="text-sm" style={{ color: '#475569' }}>{isActive ? 'Active' : 'Inactive'}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
