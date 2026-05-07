import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// GET /api/seo/health-check?domain=example.com
// Returns a battery of "is this site set up correctly" checks for SEO Step 3.
// All checks are best-effort — slow or unreachable origins resolve to ok:false
// rather than failing the whole response.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const domain = url.searchParams.get('domain')
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return NextResponse.json({ error: 'domain query param required' }, { status: 400 })
  }

  const origin = `https://${domain}`
  const service = createServiceClient()

  // Run checks in parallel. Each returns a serializable result.
  const [favicon, robots, sitemap, https, tracker, settings, products, integrations] = await Promise.all([
    probeFavicon(origin),
    probe(`${origin}/robots.txt`),
    probe(`${origin}/sitemap.xml`),
    probeRoot(origin),
    countTrackerEvents(service, domain),
    getWebsiteSettings(service, domain),
    countProducts(service, domain),
    countIntegrations(service, domain),
  ])

  return NextResponse.json({
    domain,
    favicon,
    robots,
    sitemap,
    https,
    tracker,
    revalidate: { configured: !!settings.revalidate_url, url: settings.revalidate_url ?? null },
    productsCount: products,
    gscConnected: integrations.some(i => i.provider === 'google_search_console'),
  })
}

async function probe(url: string): Promise<{ ok: boolean; status: number | null }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: null }
  }
}

async function probeFavicon(origin: string): Promise<{ ok: boolean; status: number | null; foundAt: string | null }> {
  const candidates = ['/favicon.ico', '/icon.png', '/icon.svg', '/apple-touch-icon.png']
  for (const path of candidates) {
    const res = await probe(`${origin}${path}`)
    if (res.ok) return { ok: true, status: res.status, foundAt: path }
  }
  return { ok: false, status: null, foundAt: null }
}

async function probeRoot(origin: string): Promise<{ ok: boolean; status: number | null }> {
  // Hitting the root tells us the site responds at all over HTTPS.
  return probe(origin)
}

async function countTrackerEvents(service: ReturnType<typeof createServiceClient>, website: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await service
    .from('page_events')
    .select('*', { count: 'exact', head: true })
    .eq('website', website)
    .gte('created_at', sevenDaysAgo)
  if (error) return { ok: false, eventCount7d: 0 }
  const n = count ?? 0
  return { ok: n > 0, eventCount7d: n }
}

async function getWebsiteSettings(service: ReturnType<typeof createServiceClient>, website: string) {
  const { data } = await service
    .from('website_settings')
    .select('revalidate_url')
    .eq('website', website)
    .maybeSingle()
  return { revalidate_url: (data as { revalidate_url?: string | null } | null)?.revalidate_url ?? null }
}

async function countProducts(service: ReturnType<typeof createServiceClient>, website: string) {
  const { count } = await service
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('website', website)
  return count ?? 0
}

async function countIntegrations(service: ReturnType<typeof createServiceClient>, website: string) {
  const { data } = await service
    .from('website_integrations')
    .select('provider')
    .eq('website', website)
  return (data ?? []) as { provider: string }[]
}
