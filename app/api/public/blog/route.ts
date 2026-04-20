import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PUBLIC endpoint — no auth required for reads.
 * External websites call this to fetch their published blog posts.
 *
 * Usage:
 *   GET /api/public/blog?website=example.com
 *   GET /api/public/blog?website=example.com&language=en
 *   GET /api/public/blog?website=example.com&slug=wheelchair-guide
 *   GET /api/public/blog?website=example.com&slug=wheelchair-guide&language=ms
 *
 * Only published posts are returned.
 *
 * List response (no slug): array of posts with title/excerpt/cover only (light)
 * Single response (with slug): full post with all translations nested under `translations`
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickTranslation(translations: any[], preferred: string | null) {
  if (!translations?.length) return null
  if (preferred) {
    const match = translations.find(t => t.language === preferred)
    if (match) return match
  }
  return translations.find(t => t.language === 'en') ?? translations[0]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const slug = searchParams.get('slug')
  const language = searchParams.get('language')

  if (!website) {
    return NextResponse.json({ error: 'website parameter is required' }, { status: 400, headers: CORS })
  }

  const service = createServiceClient()

  // Single post by slug — returns full content with all translations
  if (slug) {
    const { data: post } = await service
      .from('blog_posts')
      .select('id, website, slug, cover_image_url, published_at, created_at, updated_at, blog_translations(language, title, content, excerpt, meta_title, meta_description)')
      .eq('website', website)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: CORS })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translations = (post as any).blog_translations ?? []

    // If language specified, return only that translation flattened
    if (language) {
      const tr = pickTranslation(translations, language)
      if (!tr) return NextResponse.json({ error: 'Translation not found' }, { status: 404, headers: CORS })
      return NextResponse.json({
        id: post.id,
        website: post.website,
        slug: post.slug,
        cover_image_url: post.cover_image_url,
        published_at: post.published_at,
        updated_at: post.updated_at,
        language: tr.language,
        title: tr.title,
        content: tr.content,
        excerpt: tr.excerpt,
        meta_title: tr.meta_title,
        meta_description: tr.meta_description,
      }, { headers: CORS })
    }

    // Default: return post with nested translations by language
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translationsByLang: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    translations.forEach((t: any) => {
      translationsByLang[t.language] = {
        title: t.title,
        content: t.content,
        excerpt: t.excerpt,
        meta_title: t.meta_title,
        meta_description: t.meta_description,
      }
    })

    return NextResponse.json({
      id: post.id,
      website: post.website,
      slug: post.slug,
      cover_image_url: post.cover_image_url,
      published_at: post.published_at,
      updated_at: post.updated_at,
      languages: Object.keys(translationsByLang),
      translations: translationsByLang,
    }, { headers: CORS })
  }

  // List view — light payload (no full content)
  const { data, error } = await service
    .from('blog_posts')
    .select('id, slug, cover_image_url, published_at, updated_at, blog_translations(language, title, excerpt)')
    .eq('website', website)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data ?? []).map((post: any) => {
    const tr = pickTranslation(post.blog_translations ?? [], language)
    return {
      id: post.id,
      slug: post.slug,
      cover_image_url: post.cover_image_url,
      published_at: post.published_at,
      updated_at: post.updated_at,
      language: tr?.language ?? null,
      title: tr?.title ?? '(Untitled)',
      excerpt: tr?.excerpt ?? '',
      languages: (post.blog_translations ?? []).map((t: { language: string }) => t.language),
    }
  })

  return NextResponse.json(result, { headers: CORS })
}
