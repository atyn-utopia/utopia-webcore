'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'

interface Props { domain: string }

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

/**
 * Per-site Settings card. Lets admin/designer rename the canonical domain
 * recorded in webcore — useful when a site moves from a temporary
 * *.vercel.app URL onto a real domain. The rename cascades across every
 * table that keys off `website` (phone_numbers, products, blog_posts,
 * page_events, audit_logs, etc.) so analytics history and existing rows
 * follow the new name instead of orphaning under the old one.
 */
export default function RenameDomainCard({ domain }: Props) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)

  const cleaned = next.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const valid = cleaned.length > 0 && cleaned !== domain && DOMAIN_RE.test(cleaned)

  async function handleRename() {
    if (!valid || saving) return
    const ok = await confirm({
      title: 'Rename this site?',
      message: (
        <div className="space-y-2 text-sm">
          <p>The recorded domain will change from</p>
          <p className="font-mono text-xs px-2 py-1 rounded bg-slate-100">{domain}</p>
          <p>to</p>
          <p className="font-mono text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{cleaned}</p>
          <p className="text-xs text-slate-500 mt-2">
            All phone numbers, products, blog posts, analytics events, and audit history attached to this site will move with it. The change is irreversible — to undo, rename it back manually.
          </p>
        </div>
      ),
      confirmLabel: 'Rename',
      variant: 'info',
    })
    if (!ok) return

    setSaving(true)
    try {
      const res = await fetch('/api/company-websites/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: domain, to: cleaned }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        vercel?: {
          enabled: boolean
          projectId: string | null
          addedNewDomain: boolean
          redeployedDeploymentId: string | null
          warnings: string[]
        }
      }
      if (!res.ok) {
        toast.error(data.error || `Rename failed (${res.status})`, 'Rename failed')
        return
      }
      // Compose a result message that reflects what Vercel actually did.
      const v = data.vercel
      let detail = `${domain} → ${cleaned}`
      if (v?.enabled && v.projectId) {
        const parts: string[] = []
        if (v.addedNewDomain) parts.push('Vercel domain attached')
        if (v.redeployedDeploymentId) parts.push('redeploy triggered')
        if (parts.length) detail += ` · ${parts.join(' · ')}`
        if (v.warnings.length) detail += ` · ${v.warnings.length} warning${v.warnings.length === 1 ? '' : 's'}`
      } else if (v?.enabled && !v.projectId) {
        detail += ' · Vercel project not found (manual attach needed)'
      }
      toast.success(detail, 'Domain renamed')
      // Re-route the URL to the new domain so the page keeps loading data
      // for the right site.
      router.replace(`/site-settings?website=${encodeURIComponent(cleaned)}`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message, 'Rename failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Domain</h3>
        <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
          Change the recorded domain. All linked rows (phones, products, posts, analytics, audit) move with it.
        </p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Current</label>
          <p className="font-mono text-sm px-3 py-2 rounded-md" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
            {domain}
          </p>
        </div>
        <div className="flex items-center justify-center text-slate-300">
          <ArrowRightIcon className="w-4 h-4 rotate-90" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>New domain</label>
          <Input
            type="text"
            value={next}
            onChange={e => setNext(e.target.value)}
            placeholder="e.g. cat-rumah-malaysia.com"
            autoComplete="off"
            spellCheck={false}
          />
          {next && !valid && (
            <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#b91c1c' }}>
              <ExclamationTriangleIcon className="w-3 h-3" />
              {cleaned === domain ? 'New domain matches current' : 'Not a valid hostname'}
            </p>
          )}
        </div>
      </div>
      <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <Button variant="primary" size="md" disabled={!valid} loading={saving} onClick={handleRename}>
          {saving ? 'Renaming…' : 'Rename'}
        </Button>
      </div>
    </div>
  )
}
