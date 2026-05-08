'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import RemoveFromWebcoreCard from '@/components/RemoveFromWebcoreCard'
import RenameDomainCard from '@/components/RenameDomainCard'
import SiteApiKeysCard from '@/components/SiteApiKeysCard'
import SiteDeploymentsCard from '@/components/SiteDeploymentsCard'
import { useUser } from '@/contexts/UserContext'

export default function SiteSettingsPage() {
  return (
    <Suspense>
      <SiteSettingsInner />
    </Suspense>
  )
}

function SiteSettingsInner() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('website') ?? ''
  const { role } = useUser()
  const canRemove = role === 'admin' || role === 'designer'

  if (!domain) {
    return (
      <div>
        <PageHeader title="Settings" description="Pick a website from the home dashboard to manage its settings." />
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#64748b' }}>No website selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description={<span>For <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{domain}</code></span>}
      />

      {canRemove ? (
        <div className="space-y-4">
          <RenameDomainCard domain={domain} />
          <SiteApiKeysCard domain={domain} />
          <SiteDeploymentsCard domain={domain} />
          <RemoveFromWebcoreCard domain={domain} />
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#64748b' }}>No site-level settings available for your role yet.</p>
        </div>
      )}
    </div>
  )
}
