import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/validateApiKey'

/**
 * PUBLIC endpoints for blog posts.
 *
 * Reads (no auth — just the domain):
 *   GET /api/public/blog?website=example.com
 *   GET /api/public/blog?website=example.com&language=en
 *   GET /api/public/blog?website=example.com&slug=my-post
 *   GET /api/public/blog?website=example.com&slug=my-post&language=ms
 *
 * Writes (require X-API-Key header with `write` permission on the website):
 *   POST   /api/public/blog     { website, slug, status?, cover_image_url?, translations: [...] }
 *   PATCH  /api/public/blog     { id, ...postFields, translations?: [...] }
 *   DELETE /api/public/blog     { id }
 *
 * Only published posts are returned to anonymous readers. Writers can create
 * drafts; to make a post visible on designer sites, set status='published'.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
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

  if (!website) return json({ error: 'website parameter is required' }, 400)

  const service = createServiceClient()

  if (slug) {
    const { data: post } = await service
      .from('blog_posts')
      .select('id, website, slug, cover_image_url, published_at, created_at, updated_at, blog_translations(language, title, content, excerpt, meta_title, meta_description)')
      .eq('website', website)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (!post) return json({ error: 'Post not found' }, 404)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translations = (post as any).blog_translations ?? []

    if (language) {
      const tr = pickTranslation(translations, language)
      if (!tr) return json({ error: 'Translation not found' }, 404)
      return json({
        id: post.id, website: post.website, slug: post.slug,
        cover_image_url: post.cover_image_url, published_at: post.published_at, updated_at: post.updated_at,
        language: tr.language, title: tr.title, content: tr.content, excerpt: tr.excerpt,
        meta_title: tr.meta_title, meta_description: tr.meta_description,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translationsByLang: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    translations.forEach((t: any) => {
      translationsByLang[t.language] = {
        title: t.title, content: t.content, excerpt: t.excerpt,
        meta_title: t.meta_title, meta_description: t.meta_description,
      }
    })

    return json({
      id: post.id, website: post.website, slug: post.slug,
      cover_image_url: post.cover_image_url, published_at: post.published_at, updated_at: post.updated_at,
      languages: Object.keys(translationsByLang), translations: translationsByLang,
    })
  }

  // List view
  const { data, error } = await service
    .from('blog_posts')
    .select('id, slug, cover_image_url, published_at, updated_at, blog_translations(language, title, excerpt)')
    .eq('website', website)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) return json({ error: error.message }, 500)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data ?? []).map((post: any) => {
    const tr = pickTranslation(post.blog_translations ?? [], language)
    return {
      id: post.id, slug: post.slug,
      cover_image_url: post.cover_image_url, published_at: post.published_at, updated_at: post.updated_at,
      language: tr?.language ?? null, title: tr?.title ?? '(Untitled)', excerpt: tr?.excerpt ?? '',
      languages: (post.blog_translations ?? []).map((t: { language: string }) => t.language),
    }
  })

  return json(result)
}

interface TranslationInput {
  language: string
  title: string
  content?: string
  excerpt?: string
  meta_title?: string
  meta_description?: string
}

/**
 * POST /api/public/blog — create a new blog post
 * Header: X-API-Key
 * Body: { website, slug, status?='draft', cover_image_url?, translations: [...] }
 */
export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const body = await request.json()
  const { website, slug, status, cover_image_url, translations } = body

  if (!website || !slug) return json({ error: 'website and slug are required' }, 400)
  if (!Array.isArray(translations) || translations.length === 0) {
    return json({ error: 'at least one translation is required' }, 400)
  }

  const keyInfo = await validateApiKey(apiKey, 'write', website)
  if (!keyInfo) return json({ error: 'Invalid or unauthorized API key' }, 401)

  const service = createServiceClient()

  // Resolve the author as the user who created the API key — gives every post an owner
  const { data: keyRow } = await service.from('api_keys').select('created_by').eq('id', keyInfo.id).single()

  const { data: existing } = await service
    .from('blog_posts').select('id').eq('website', website).eq('slug', slug).maybeSingle()
  if (existing) return json({ error: `slug "${slug}" already exists for this website` }, 409)

  const postStatus = status === 'published' ? 'published' : 'draft'
  const { data: post, error: postErr } = await service
    .from('blog_posts')
    .insert({
      website,
      slug,
      cover_image_url: cover_image_url ?? null,
      status: postStatus,
      published_at: postStatus === 'published' ? new Date().toISOString() : null,
      author_id: keyRow?.created_by ?? null,
    })
    .select()
    .single()
  if (postErr) return json({ error: postErr.message }, 500)

  const rows = (translations as TranslationInput[]).map(t => ({
    post_id: post.id,
    language: t.language,
    title: t.title ?? '',
    content: t.content ?? '',
    excerpt: t.excerpt ?? '',
    meta_title: t.meta_title ?? '',
    meta_description: t.meta_description ?? '',
  }))
  const { error: transErr } = await service.from('blog_translations').insert(rows)
  if (transErr) return json({ error: transErr.message }, 500)

  return json(post, 201)
}

/**
 * PATCH /api/public/blog — update a post and/or upsert specific translations by language
 */
export async function PATCH(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const body = await request.json()
  const { id, translations, ...postFields } = body

  if (!id) return json({ error: 'id is required' }, 400)

  const service = createServiceClient()
  const { data: before } = await service.from('blog_posts').select('website, slug').eq('id', id).single()
  if (!before) return json({ error: 'post not found' }, 404)

  const keyInfo = await validateApiKey(apiKey, 'write', before.website)
  if (!keyInfo) return json({ error: 'Invalid or unauthorized API key' }, 401)

  if (postFields.slug && postFields.slug !== before.slug) {
    const { data: dup } = await service
      .from('blog_posts').select('id').eq('website', before.website).eq('slug', postFields.slug).maybeSingle()
    if (dup) return json({ error: `slug "${postFields.slug}" already exists for this website` }, 409)
  }

  if (postFields.status === 'published' && !postFields.published_at) {
    postFields.published_at = new Date().toISOString()
  } else if (postFields.status === 'draft') {
    postFields.published_at = null
  }

  const allowed = ['slug', 'status', 'cover_image_url', 'published_at']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in postFields) patch[k] = postFields[k]
  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString()
    const { error } = await service.from('blog_posts').update(patch).eq('id', id)
    if (error) return json({ error: error.message }, 500)
  }

  if (Array.isArray(translations) && translations.length > 0) {
    for (const t of translations as TranslationInput[]) {
      if (!t.language) continue
      const { data: existingT } = await service
        .from('blog_translations').select('id').eq('post_id', id).eq('language', t.language).maybeSingle()
      const fields = {
        title: t.title ?? '',
        content: t.content ?? '',
        excerpt: t.excerpt ?? '',
        meta_title: t.meta_title ?? '',
        meta_description: t.meta_description ?? '',
      }
      if (existingT) {
        await service.from('blog_translations').update(fields).eq('id', existingT.id)
      } else {
        await service.from('blog_translations').insert({ post_id: id, language: t.language, ...fields })
      }
    }
  }

  return json({ success: true })
}

/**
 * DELETE /api/public/blog — delete a post (and its translations via cascade if set, otherwise first)
 */
export async function DELETE(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const body = await request.json()
  const { id } = body

  if (!id) return json({ error: 'id is required' }, 400)

  const service = createServiceClient()
  const { data: before } = await service.from('blog_posts').select('website').eq('id', id).single()
  if (!before) return json({ error: 'post not found' }, 404)

  const keyInfo = await validateApiKey(apiKey, 'write', before.website)
  if (!keyInfo) return json({ error: 'Invalid or unauthorized API key' }, 401)

  // Delete translations first in case the FK isn't cascading
  await service.from('blog_translations').delete().eq('post_id', id)
  const { error } = await service.from('blog_posts').delete().eq('id', id)
  if (error) return json({ error: error.message }, 500)

  return json({ success: true })
}
