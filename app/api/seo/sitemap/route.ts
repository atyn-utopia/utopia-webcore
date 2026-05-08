import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])
const MAX_PATHS = 200

interface SitemapResult {
  ok: boolean
  source: 'sitemap' | 'sitemap_index' | 'fallback'
  paths: string[]
  error?: string
}

// Strip <!-- comments --> and CDATA, then pull <loc>...</loc> values.
// Cheerio would be more robust but adds parser overhead — sitemaps are
// well-defined enough that a regex is fine for this use case.
function extractLocs(xml: string): string[] {
  const cleaned = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  const matches = cleaned.match(/<loc>\s*([^<]+?)\s*<\/loc>/gi) ?? []
  return matches.map(m => m.replace(/<loc>\s*|\s*<\/loc>/gi, '').trim()).filter(Boolean)
}

async function fetchXml(url: string, ms = 8000): Promise<{ status: number; body: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Webcore-SEO-Sitemap/1.0 (+https://webcore.utopiaai.my)' },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!res.ok) return { status: res.status, body: '' }
    return { status: res.status, body: await res.text() }
  } catch {
    return null
  }
}

// GET /api/seo/sitemap?website=DOMAIN
// Fetches https://{website}/sitemap.xml; if the result is a sitemap-index,
// follows up to 5 child sitemaps. Returns paths normalised to start with `/`.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  const root = await fetchXml(`https://${website}/sitemap.xml`)
  if (!root || !root.body) {
    const result: SitemapResult = { ok: false, source: 'fallback', paths: ['/'], error: root ? `sitemap returned HTTP ${root.status}` : 'sitemap fetch failed' }
    return NextResponse.json(result)
  }

  const isIndex = /<sitemapindex[\s>]/i.test(root.body)
  const collected = new Set<string>()

  if (isIndex) {
    const childUrls = extractLocs(root.body).slice(0, 5)
    for (const child of childUrls) {
      const c = await fetchXml(child)
      if (c?.body) extractLocs(c.body).forEach(u => collected.add(u))
      if (collected.size >= MAX_PATHS) break
    }
  } else {
    extractLocs(root.body).forEach(u => collected.add(u))
  }

  // Normalise: strip the protocol+host, keep just the path. Skip URLs that
  // don't belong to this domain (some sitemaps include external links).
  const paths: string[] = []
  for (const url of collected) {
    try {
      const u = new URL(url)
      if (!u.hostname.endsWith(website.replace(/^www\./, '')) && u.hostname !== website) continue
      let p = u.pathname || '/'
      if (p.length > 1) p = p.replace(/\/+$/, '')
      paths.push(p || '/')
    } catch {
      // Bare paths in the sitemap (unusual) — accept if they start with '/'.
      if (typeof url === 'string' && url.startsWith('/')) paths.push(url)
    }
    if (paths.length >= MAX_PATHS) break
  }

  // Dedupe + sort with '/' first.
  const unique = Array.from(new Set(paths))
  unique.sort((a, b) => a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b))

  const result: SitemapResult = {
    ok: true,
    source: isIndex ? 'sitemap_index' : 'sitemap',
    paths: unique.length > 0 ? unique : ['/'],
  }
  return NextResponse.json(result)
}
