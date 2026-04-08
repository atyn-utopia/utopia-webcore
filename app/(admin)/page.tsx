import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ count: phoneCount }, { count: postCount }, { data: websitesData }] = await Promise.all([
    supabase.from('phone_numbers').select('*', { count: 'exact', head: true }),
    supabase.from('blog_posts').select('*', { count: 'exact', head: true }),
    supabase.from('phone_numbers').select('website'),
  ])
  const websiteCount = new Set((websitesData ?? []).map((r: { website: string }) => r.website)).size

  return (
    <div>
      {/* Welcome banner */}
      <div className="rounded-xl overflow-hidden mb-8 relative border" style={{ background: 'linear-gradient(to right, #f0f4f8, #ffffff)', borderColor: '#e2e8f0', minHeight: '140px' }}>
        <div className="relative z-10 p-6 sm:p-8 pr-32 sm:pr-48">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Welcome back!</h1>
          <p className="text-sm text-slate-500 max-w-md">Manage your websites, phone numbers, and blog content all in one place.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/character.gif"
          alt=""
          className="absolute right-0 bottom-0 h-full object-contain object-right-bottom pointer-events-none"
          style={{ maxHeight: '140px' }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link href="/websites" className="group block rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f1f5f9' }}>
              <svg className="w-4.5 h-4.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M2 7h20" />
                <path strokeLinecap="round" d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Websites</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-0.5">{websiteCount}</p>
          <p className="text-xs text-slate-400">Manage all connected sites</p>
        </Link>

        <Link href="/phone-numbers" className="group block rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#eff6ff' }}>
              <svg className="w-4.5 h-4.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Phone Numbers</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-0.5">{phoneCount ?? 0}</p>
          <p className="text-xs text-slate-400">WhatsApp rotation pool across all sites</p>
        </Link>

        <Link href="/blog" className="group block rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
              <svg className="w-4.5 h-4.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Blog Posts</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-0.5">{postCount ?? 0}</p>
          <p className="text-xs text-slate-400">SEO content published across websites</p>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/phone-numbers/new"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-blue-50">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Add Phone Number</p>
              <p className="text-xs text-slate-400">Add a new number to the WhatsApp rotation</p>
            </div>
          </Link>

          <Link
            href="/blog/new"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-green-50">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">New Blog Post</p>
              <p className="text-xs text-slate-400">Create SEO content for any website</p>
            </div>
          </Link>

          <Link
            href="/websites"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-100">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M2 7h20" strokeLinecap="round" />
                <path d="M8 21h8M12 17v4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Manage Websites</p>
              <p className="text-xs text-slate-400">View all connected sites and their data</p>
            </div>
          </Link>

          <Link
            href="/phone-numbers"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-100">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Configure Percentages</p>
              <p className="text-xs text-slate-400">Adjust lead distribution weights per site</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
