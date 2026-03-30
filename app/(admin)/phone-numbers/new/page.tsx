'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewPhoneNumberPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    website: '',
    product_slug: '',
    location_slug: '',
    phone_number: '',
    label: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  function validate() {
    const e: Record<string, string> = {}
    if (!form.website.trim()) e.website = 'Website is required'
    if (!form.product_slug.trim()) e.product_slug = 'Product slug is required'
    if (!form.location_slug.trim()) e.location_slug = 'Location slug is required'
    if (!form.phone_number.trim()) e.phone_number = 'Phone number is required'
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
        product_slug: form.product_slug.trim(),
        location_slug: form.location_slug.trim(),
        phone_number: form.phone_number.trim(),
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

  function field(key: keyof typeof form, label: string, placeholder: string, hint?: string) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}{key !== 'label' && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type="text"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors[key] ? 'border-red-400' : 'border-slate-300'
          }`}
        />
        {errors[key] && <p className="mt-1 text-xs text-red-500">{errors[key]}</p>}
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/phone-numbers" className="text-slate-400 hover:text-slate-600 text-sm">
          ← Phone Numbers
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Add Phone Number</h1>
      <p className="text-sm text-slate-500 mb-8">Add a new number to the rotation pool for a specific website, product, and location.</p>

      {serverError && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg space-y-5">
        {field('website', 'Website', 'e.g. oxihome.my', 'The domain name of the website')}
        {field('product_slug', 'Product Slug', 'e.g. oxygen-machine', 'Lowercase, hyphenated')}
        {field('location_slug', 'Location Slug', 'e.g. kuala-lumpur', 'Lowercase, hyphenated')}
        {field('phone_number', 'Phone Number', 'e.g. 60123456789', 'Include country code, no spaces')}
        {field('label', 'Label (optional)', 'e.g. Agent A', 'Human-readable label for this number')}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Add Phone Number'}
          </button>
          <Link
            href="/phone-numbers"
            className="px-5 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
