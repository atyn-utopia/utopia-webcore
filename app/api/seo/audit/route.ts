import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import * as cheerio from 'cheerio'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

interface AuditIssue {
  type: 'error' | 'warn' | 'info'
  category: 'meta' | 'images' | 'headings' | 'social'
  message: string
  /** Optional element pointer for the UI — image src, heading text, etc. */
  detail?: string
}

interface AuditResult {
  url: string
  fetchedAt: string
  ok: boolean
  status?: number
  error?: string
  meta: {
    title: string | null
    titleLength: number
    description: string | null
    descriptionLength: number
    canonical: string | null
    robots: string | null
    ogImage: string | null
    ogTitle: string | null
    ogDescription: string | null
    twitterImage: string | null
  }
  headings: { h1Count: number; total: number; h1Texts: string[]; byLevel?: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number }; texts?: { h2: string[]; h3: string[] } }
  images: {
    total: number
    missingAlt: number
    emptyAlt: number
    /** First N image srcs with alt issues, for the UI to surface. */
    samples: { src: string; alt: string | null; reason: 'missing' | 'empty' }[]
  }
  issues: AuditIssue[]
}

function audit(html: string): Omit<AuditResult, 'url' | 'fetchedAt' | 'ok' | 'status' | 'error'> {
  const $ = cheerio.load(html)
  const issues: AuditIssue[] = []

  // Meta
  const title = ($('head > title').first().text() || null)?.trim() || null
  const description = $('meta[name="description"]').attr('content')?.trim() || null
  const canonical = $('link[rel="canonical"]').attr('href') || null
  const robots = $('meta[name="robots"]').attr('content') || null
  const ogTitle = $('meta[property="og:title"]').attr('content') || null
  const ogDescription = $('meta[property="og:description"]').attr('content') || null
  const ogImage = $('meta[property="og:image"]').attr('content') || null
  const twitterImage = $('meta[name="twitter:image"]').attr('content') || null

  if (!title) issues.push({ type: 'error', category: 'meta', message: 'Missing <title>' })
  else {
    if (title.length < 30) issues.push({ type: 'warn', category: 'meta', message: `Title is short (${title.length} chars) — aim for 50–60.`, detail: title })
    if (title.length > 60) issues.push({ type: 'warn', category: 'meta', message: `Title is long (${title.length} chars) — Google may truncate over 60.`, detail: title })
  }
  if (!description) issues.push({ type: 'error', category: 'meta', message: 'Missing meta description' })
  else if (description.length > 160) issues.push({ type: 'warn', category: 'meta', message: `Description is long (${description.length} chars) — Google may truncate over 160.`, detail: description })
  else if (description.length < 70) issues.push({ type: 'warn', category: 'meta', message: `Description is short (${description.length} chars) — aim for 120–160.`, detail: description })

  if (!canonical) issues.push({ type: 'warn', category: 'meta', message: 'No canonical URL set — search engines will guess.' })
  if (robots && /noindex/i.test(robots)) issues.push({ type: 'warn', category: 'meta', message: `robots meta says "noindex" — page won't be indexed.`, detail: robots })

  // Social
  if (!ogImage && !twitterImage) issues.push({ type: 'warn', category: 'social', message: 'No social share image (og:image / twitter:image) — link previews will be plain text.' })
  if (!ogTitle) issues.push({ type: 'info', category: 'social', message: 'No og:title — falls back to the page title for link previews.' })
  if (!ogDescription) issues.push({ type: 'info', category: 'social', message: 'No og:description — falls back to the meta description.' })

  // Headings — count by level so the UI can flag missing structure (a page
  // with only an <h1> usually means sub-sections aren't marked up properly).
  const h1List = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean)
  const h2List = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 12)
  const h3List = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 12)
  const byLevel = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
    h4: $('h4').length,
    h5: $('h5').length,
    h6: $('h6').length,
  }
  const totalHeadings = byLevel.h1 + byLevel.h2 + byLevel.h3 + byLevel.h4 + byLevel.h5 + byLevel.h6
  if (h1List.length === 0) issues.push({ type: 'error', category: 'headings', message: 'No <h1> on the page.' })
  else if (h1List.length > 1) issues.push({ type: 'warn', category: 'headings', message: `Multiple <h1> elements (${h1List.length}). Use one main heading per page.` })
  if (h1List.length === 1 && byLevel.h2 === 0) issues.push({ type: 'warn', category: 'headings', message: 'Only an <h1> — no <h2> sub-sections. Long pages should break content into <h2> sections so search engines understand the structure.' })
  if (byLevel.h3 > 0 && byLevel.h2 === 0) issues.push({ type: 'warn', category: 'headings', message: 'Skipped heading level — <h3> elements exist without any <h2>. Use h1 → h2 → h3 in order.' })

  // Images — return up to MAX_SAMPLES so the UI can accurately track which
  // images still need alt text. Capped (vs unlimited) only to keep the audit
  // payload bounded on extreme pages.
  const MAX_SAMPLES = 200
  const imgs = $('img')
  let missingAlt = 0
  let emptyAlt = 0
  const samples: { src: string; alt: string | null; reason: 'missing' | 'empty' }[] = []
  imgs.each((_, el) => {
    const src = $(el).attr('src') ?? '(no src)'
    const altAttr = $(el).attr('alt')
    if (altAttr === undefined) {
      missingAlt++
      if (samples.length < MAX_SAMPLES) samples.push({ src, alt: null, reason: 'missing' })
    } else if (altAttr.trim() === '') {
      emptyAlt++
      if (samples.length < MAX_SAMPLES) samples.push({ src, alt: '', reason: 'empty' })
    }
  })

  if (missingAlt > 0) issues.push({ type: 'error', category: 'images', message: `${missingAlt} image${missingAlt === 1 ? '' : 's'} missing alt attribute (screen readers will skip them).` })
  if (emptyAlt > 0) issues.push({ type: 'info', category: 'images', message: `${emptyAlt} image${emptyAlt === 1 ? '' : 's'} have empty alt="" (decorative — OK if intentional).` })

  return {
    meta: {
      title,
      titleLength: title?.length ?? 0,
      description,
      descriptionLength: description?.length ?? 0,
      canonical,
      robots,
      ogImage,
      ogTitle,
      ogDescription,
      twitterImage,
    },
    headings: { h1Count: h1List.length, total: totalHeadings, h1Texts: h1List.slice(0, 5), byLevel, texts: { h2: h2List, h3: h3List } },
    images: { total: imgs.length, missingAlt, emptyAlt, samples },
    issues,
  }
}

// POST /api/seo/audit  body: { website, path? }
// Fetches https://{website}{path} and runs a single-page audit.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { website, path } = body as { website?: string; path?: string }
  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  // Reject paths that could escape the site:
  //   - `..` segments (directory traversal in proxy URLs / odd resolvers)
  //   - leading `//` (protocol-relative — `https://site//evil.com` would fetch evil.com)
  //   - any whitespace or control chars
  let safePath = '/'
  if (typeof path === 'string' && path.startsWith('/')) {
    if (path.startsWith('//') || path.includes('..') || /[\s\x00-\x1f]/.test(path)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    safePath = path
  }
  const url = `https://${website}${safePath}`

  let html = ''
  let status = 0
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Webcore-SEO-Audit/1.0 (+https://utopia-webcore.vercel.app)' },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
    status = res.status
    if (!res.ok) {
      const result: AuditResult = {
        url,
        fetchedAt: new Date().toISOString(),
        ok: false,
        status,
        error: `Site returned HTTP ${status}`,
        meta: { title: null, titleLength: 0, description: null, descriptionLength: 0, canonical: null, robots: null, ogImage: null, ogTitle: null, ogDescription: null, twitterImage: null },
        headings: { h1Count: 0, total: 0, h1Texts: [] },
        images: { total: 0, missingAlt: 0, emptyAlt: 0, samples: [] },
        issues: [{ type: 'error', category: 'meta', message: `Page returned HTTP ${status} — could not audit.` }],
      }
      return NextResponse.json(result)
    }
    html = await res.text()
  } catch (e) {
    const result: AuditResult = {
      url,
      fetchedAt: new Date().toISOString(),
      ok: false,
      error: (e as Error).message,
      meta: { title: null, titleLength: 0, description: null, descriptionLength: 0, canonical: null, robots: null, ogImage: null, ogTitle: null, ogDescription: null, twitterImage: null },
      headings: { h1Count: 0, total: 0, h1Texts: [] },
      images: { total: 0, missingAlt: 0, emptyAlt: 0, samples: [] },
      issues: [{ type: 'error', category: 'meta', message: `Could not fetch ${url}: ${(e as Error).message}` }],
    }
    return NextResponse.json(result)
  }

  const parsed = audit(html)
  const result: AuditResult = {
    url,
    fetchedAt: new Date().toISOString(),
    ok: true,
    status,
    ...parsed,
  }
  return NextResponse.json(result)
}
