'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const steps = ['Enter Details', 'Set Location', 'Confirm']

const MY_STATES = [
  { label: 'Johor', slug: 'johor' },
  { label: 'Kedah', slug: 'kedah' },
  { label: 'Kelantan', slug: 'kelantan' },
  { label: 'Kuala Lumpur', slug: 'kuala-lumpur' },
  { label: 'Labuan', slug: 'labuan' },
  { label: 'Melaka', slug: 'melaka' },
  { label: 'Negeri Sembilan', slug: 'negeri-sembilan' },
  { label: 'Pahang', slug: 'pahang' },
  { label: 'Perak', slug: 'perak' },
  { label: 'Perlis', slug: 'perlis' },
  { label: 'Pulau Pinang', slug: 'pulau-pinang' },
  { label: 'Putrajaya', slug: 'putrajaya' },
  { label: 'Sabah', slug: 'sabah' },
  { label: 'Sarawak', slug: 'sarawak' },
  { label: 'Selangor', slug: 'selangor' },
  { label: 'Terengganu', slug: 'terengganu' },
]

function InputField({
  label, value, onChange, placeholder, hint, error, required = true
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: string
  error?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors"
        style={{ borderColor: error ? '#fca5a5' : '#cbd5e1', background: 'white' }}
        onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
        onBlur={e => e.currentTarget.style.borderColor = error ? '#fca5a5' : '#cbd5e1'}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs" style={{ color: '#475569' }}>{hint}</p>}
    </div>
  )
}

export default function NewPhoneNumberPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillWebsite = searchParams.get('website') ?? ''
  const prefillCompany = searchParams.get('company') ?? ''
  const [companies, setCompanies] = useState<{ id: string; name: string; company_websites: { domain: string }[] }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [form, setForm] = useState({
    website: prefillWebsite,
    location_slug: '',
    phone_number: '',
    whatsapp_text: '',
    percentage: '100',
    label: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [existingTexts, setExistingTexts] = useState<string[]>([])

  // Fetch companies
  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCompanies(data)
          // Auto-select company from URL params
          if (prefillCompany) {
            const match = data.find((c: { name: string }) => c.name === prefillCompany)
            if (match) setSelectedCompany(match.id)
          } else if (prefillWebsite) {
            const match = data.find((c: { company_websites: { domain: string }[] }) =>
              c.company_websites.some(w => w.domain === prefillWebsite)
            )
            if (match) setSelectedCompany(match.id)
          }
        }
      })
      .catch(() => {})
  }, [prefillWebsite])

  const companyWebsites = companies.find(c => c.id === selectedCompany)?.company_websites ?? []

  const fetchExistingTexts = useCallback(async (website: string) => {
    if (!website.trim()) { setExistingTexts([]); return }
    const res = await fetch(`/api/phone-numbers?website=${encodeURIComponent(website.trim())}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      const texts = [...new Set(data.map((n: { whatsapp_text?: string }) => n.whatsapp_text).filter(Boolean))] as string[]
      setExistingTexts(texts)
      const activeCount = data.filter((n: { is_active?: boolean }) => n.is_active !== false).length
      const suggested = Math.floor(100 / (activeCount + 1))
      setForm(f => ({ ...f, percentage: String(suggested || 1) }))
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchExistingTexts(form.website), 400)
    return () => clearTimeout(timeout)
  }, [form.website, fetchExistingTexts])

  function validate() {
    const e: Record<string, string> = {}
    if (!selectedCompany) e.website = 'Please select a company and website'
    else if (!form.website.trim()) e.website = 'Please select a website'
    if (!form.phone_number.trim()) e.phone_number = 'Phone number is required'
    if (!form.whatsapp_text.trim()) e.whatsapp_text = 'WhatsApp text is required'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    setServerError('')
    const res = await fetch('/api/phone-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: form.website.trim(),

        location_slug: form.location_slug || 'all',
        phone_number: form.phone_number.trim(),
        type: 'custom',
        whatsapp_text: form.whatsapp_text.trim(),
        percentage: parseInt(form.percentage) || 100,
        label: form.label.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      router.push('/phone-numbers')
    } else {
      const d = await res.json()
      setServerError(d.error ?? 'Something went wrong')
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="max-w-xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Add Phone Number</h1>
        <p className="text-xs sm:text-sm mb-6" style={{ color: '#475569' }}>Add a new number to the rotation pool for a website and location.</p>

        {/* Main card */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#cbd5e1' }}>

          {/* Card header */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Phone Number Details</span>
          </div>

          {/* Step indicator */}
          <div className="px-5 pt-5 pb-4 flex items-center" style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            {steps.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={i === 0
                      ? { background: 'var(--primary)', color: 'white' }
                      : { background: '#f1f5f9', color: '#475569' }
                    }
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap" style={{ color: i === 0 ? 'var(--primary)' : '#475569' }}>
                    {step}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px mx-3" style={{ background: i === 0 ? 'var(--primary)' : '#f1f5f9' }} />
                )}
              </div>
            ))}
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4" style={{ background: 'white' }}>

              {serverError && (
                <div className="p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>
                  {serverError}
                </div>
              )}

              {/* Company dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Company<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedCompany}
                    onChange={e => {
                      setSelectedCompany(e.target.value)
                      setForm(f => ({ ...f, website: '' }))
                    }}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors cursor-pointer"
                    style={{ borderColor: errors.website ? '#fca5a5' : '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.currentTarget.style.borderColor = errors.website ? '#fca5a5' : '#cbd5e1'}
                  >
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Website dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Website<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    disabled={!selectedCompany}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: errors.website ? '#fca5a5' : '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.currentTarget.style.borderColor = errors.website ? '#fca5a5' : '#cbd5e1'}
                  >
                    <option value="">{selectedCompany ? 'Select website…' : 'Select a company first'}</option>
                    {companyWebsites.map(w => <option key={w.domain} value={w.domain}>{w.domain}</option>)}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website}</p>}
                {!selectedCompany && <p className="mt-1 text-xs" style={{ color: '#475569' }}>Choose a company to see its websites</p>}
              </div>

              {/* Location dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Location <span className="text-xs font-normal" style={{ color: '#475569' }}>(optional)</span>
                </label>
                <div className="relative">
                  <select
                    value={form.location_slug}
                    onChange={e => setForm(f => ({ ...f, location_slug: e.target.value }))}
                    className="w-full text-sm rounded-lg border focus:outline-none cursor-pointer"
                    style={{
                      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                      borderColor: '#cbd5e1', background: 'white', color: '#475569',
                      padding: '0.625rem 2.5rem 0.625rem 0.75rem',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <option value="">All locations (no filter)</option>
                    {MY_STATES.map(s => (
                      <option key={s.slug} value={s.slug}>{s.label}</option>
                    ))}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#475569' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <p className="mt-1 text-xs" style={{ color: '#475569' }}>Leave blank to apply this number to all locations</p>
              </div>

              <InputField
                label="Phone Number"
                value={form.phone_number}
                onChange={v => setForm(f => ({ ...f, phone_number: v }))}
                placeholder="e.g. 60123456789"
                hint="Include country code, no spaces or dashes"
                error={errors.phone_number}
              />
              <div>
                <InputField
                  label="WhatsApp Text"
                  value={form.whatsapp_text}
                  onChange={v => setForm(f => ({ ...f, whatsapp_text: v }))}
                  placeholder="e.g. Hi, I'd like to enquire about…"
                  hint="Pre-filled message when a visitor clicks the WhatsApp button"
                  error={errors.whatsapp_text}
                />
                {existingTexts.length > 0 && !form.whatsapp_text && (
                  <div className="mt-2 rounded-lg border p-3" style={{ borderColor: '#cbd5e1', background: '#f8fafc' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: '#475569' }}>
                      Existing texts for this website — click to use:
                    </p>
                    <div className="space-y-1.5">
                      {existingTexts.map((text, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, whatsapp_text: text }))}
                          className="block w-full text-left text-xs px-3 py-2 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          style={{ borderColor: '#cbd5e1', color: '#475569', background: 'white' }}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Lead Percentage<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.percentage}
                    onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))}
                    className="w-20 px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors"
                    style={{ borderColor: '#cbd5e1', background: 'white' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                  <span className="text-sm" style={{ color: '#475569' }}>%</span>
                </div>
                <p className="mt-1 text-xs" style={{ color: '#475569' }}>
                  All active numbers under the same website must total exactly 100%. You may need to adjust existing numbers after adding this one.
                </p>
              </div>
              <InputField
                label="Label"
                value={form.label}
                onChange={v => setForm(f => ({ ...f, label: v }))}
                placeholder="e.g. Agent A"
                hint="Optional — helps identify this number in the list"
                required={false}
              />
            </div>

            {/* Info boxes */}
            <div className="grid grid-cols-2 gap-3 px-5 pb-5" style={{ background: 'white' }}>
              <div className="rounded-lg border p-3" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-orange-700">Important</span>
                </div>
                <ul className="space-y-1">
                  {['Domain must match exactly', 'Include country code (60…)', 'No spaces or dashes in number'].map(t => (
                    <li key={t} className="text-xs text-orange-700 flex items-start gap-1">
                      <span className="mt-0.5">•</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border p-3" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-green-700">How rotation works</span>
                </div>
                <ul className="space-y-1">
                  {['Add multiple numbers per location', 'One is picked at random per click', 'Toggle active to pause a number'].map(t => (
                    <li key={t} className="text-xs text-green-700 flex items-start gap-1">
                      <span className="mt-0.5">•</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #cbd5e1', background: 'white' }}>
              <Link
                href="/phone-numbers"
                className="text-sm px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: '#cbd5e1', color: '#475569' }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="text-sm font-semibold px-6 py-2.5 rounded-lg text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--primary)', minWidth: '160px' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary)'}
              >
                {saving ? 'Saving…' : 'Add Phone Number'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
