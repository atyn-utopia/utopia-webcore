import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { matchPattern, substituteMatch } from '@/lib/seoPattern'

/**
 * PUBLIC endpoint — no auth required.
 *
 * Designer sites read this from their generateMetadata() / layout helper to
 * apply a per-page SEO override configured in the webcore admin.
 *
 *   GET /api/public/seo?website=DOMAIN&path=/some-page&lang=ms
 *     → { title, description, og_image, language } if an override exists for
 *       that (website, path, lang). Falls back to lang='en' if the requested
 *       language isn't set; returns 404 only when neither exists. The designer
 *       site is expected to fall back to its own default metadata after 404.
 *
 *   GET /api/public/seo?website=DOMAIN
 *     → list all overrides on the site. Mostly a debug/admin convenience;
 *       designer sites usually want the per-path lookup above.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function normalizePath(p: string): string {
  let v = p.trim()
  if (!v.startsWith('/')) v = `/${v}`
  if (v.length > 1) v = v.replace(/\/+$/, '')
  return v || '/'
}

const ALLOWED_LANGUAGES = new Set(['en', 'ms', 'zh'])
function normalizeLang(l: string | null): string | null {
  if (!l) return null
  const v = l.toLowerCase()
  return ALLOWED_LANGUAGES.has(v) ? v : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const path = searchParams.get('path')
  const requestedLang = normalizeLang(searchParams.get('lang'))

  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400, headers: CORS })

  const service = createServiceClient()

  if (path) {
    const normalisedPath = normalizePath(path)
    // Look up the requested language first, then fall back to 'en'. Within
    // each language, exact-path rows beat pattern rows. Return whichever
    // was matched so the designer site can record it.
    const langOrder = requestedLang && requestedLang !== 'en' ? [requestedLang, 'en'] : ['en']

    for (const lang of langOrder) {
      // 1. Exact match
      const { data: exact } = await service
        .from('seo_overrides')
        .select('title, description, og_image, language, is_pattern, path')
        .eq('website', website)
        .eq('path', normalisedPath)
        .eq('language', lang)
        .eq('is_pattern', false)
        .maybeSingle()
      if (exact) {
        return NextResponse.json({
          title: exact.title,
          description: exact.description,
          og_image: exact.og_image,
          language: exact.language,
        }, { headers: CORS })
      }

      // 2. Pattern fallback — pull all pattern rows for this lang and walk them.
      // Order by path length descending so more specific patterns
      // (e.g. /aircond-service-* beats /*) win.
      const { data: patterns } = await service
        .from('seo_overrides')
        .select('title, description, og_image, language, path')
        .eq('website', website)
        .eq('language', lang)
        .eq('is_pattern', true)
      if (patterns && patterns.length > 0) {
        const sorted = [...patterns].sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))
        for (const row of sorted) {
          const capture = matchPattern(row.path as string, normalisedPath)
          if (capture !== null) {
            return NextResponse.json({
              title: substituteMatch(row.title, capture),
              description: substituteMatch(row.description, capture),
              og_image: row.og_image,
              language: row.language,
              matched_pattern: row.path,
            }, { headers: CORS })
          }
        }
      }
    }
    return NextResponse.json({ error: 'No override' }, { status: 404, headers: CORS })
  }

  const { data, error } = await service
    .from('seo_overrides')
    .select('path, language, title, description, og_image, is_pattern, updated_at')
    .eq('website', website)
    .order('path')
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
  return NextResponse.json(data ?? [], { headers: CORS })
}
