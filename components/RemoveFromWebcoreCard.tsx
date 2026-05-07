'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useToast } from '@/contexts/ToastContext'

/**
 * Danger-zone card: unlink a domain from webcore. Phone numbers, products,
 * blog posts, etc. stay in the DB by design (matches the auto-sweep) — only
 * the company_websites link is removed.
 */
export default function RemoveFromWebcoreCard({ domain }: { domain: string }) {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function remove() {
    const ok = await confirm({
      title: `Remove ${domain} from webcore?`,
      message: `This unlinks ${domain} from its company so it stops appearing in dropdowns and analytics. Phone numbers, products, blog posts, and tracking events for this domain stay in the database. Re-adding the site will surface them again. The action is logged in /audit.`,
      confirmLabel: 'Remove from webcore',
      variant: 'danger',
    })
    if (!ok) return

    setBusy(true)
    try {
      const res = await fetch(`/api/company-websites?domain=${encodeURIComponent(domain)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to remove', 'Remove failed')
        return
      }
      const orphans = data.orphans ?? {}
      const kept: string[] = []
      if (orphans.phone_numbers) kept.push(`${orphans.phone_numbers} phone${orphans.phone_numbers === 1 ? '' : 's'}`)
      if (orphans.products) kept.push(`${orphans.products} product${orphans.products === 1 ? '' : 's'}`)
      if (orphans.blog_posts) kept.push(`${orphans.blog_posts} blog post${orphans.blog_posts === 1 ? '' : 's'}`)
      if (orphans.website_integrations) kept.push(`${orphans.website_integrations} integration${orphans.website_integrations === 1 ? '' : 's'}`)
      if (orphans.api_keys) kept.push(`${orphans.api_keys} API key${orphans.api_keys === 1 ? '' : 's'}`)
      const msg = kept.length > 0 ? `Removed ${domain}. Kept in DB: ${kept.join(', ')}.` : `Removed ${domain}.`
      toast.success(msg, 'Website removed')
      router.push('/')
    } catch (e) {
      toast.error((e as Error).message, 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#fecaca' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', borderTopLeftRadius: 11, borderTopRightRadius: 11 }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'white', color: '#b91c1c' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold" style={{ color: '#b91c1c' }}>Danger zone</h3>
        </div>
      </div>
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Remove this site from webcore</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748b' }}>
            Use when this site has been deleted from Vercel (or you otherwise no longer want webcore tracking it). Unlinks the domain from its company; data stays in the DB and is recoverable by re-adding the site.
          </p>
        </div>
        <button
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center justify-center text-xs font-medium px-3 h-9 rounded-md text-white transition-opacity disabled:opacity-50 flex-shrink-0"
          style={{ background: '#dc2626' }}
        >
          {busy ? 'Removing…' : 'Remove from webcore'}
        </button>
      </div>
    </div>
  )
}
