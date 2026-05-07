'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import IntegrationsCard from '@/components/IntegrationsCard'

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsPageInner />
    </Suspense>
  )
}

function IntegrationsPageInner() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('website') ?? ''

  if (!domain) {
    return (
      <div>
        <PageHeader title="Integrations" description="Pick a website from the home dashboard to manage its integrations." />
        <div className="rounded-xl border bg-white p-10 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#64748b' }}>No website selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Integrations"
        description={<span>For <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{domain}</code>. Google Search Console + live revalidation webhook.</span>}
      />
      <IntegrationsCard domain={domain} />
    </div>
  )
}
