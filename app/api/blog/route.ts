import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'
import { assertWriteAccess } from '@/lib/assertWriteAccess'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'
import { notifyWebsite } from '@/lib/notifyWebsite'

const BLOG_WRITE_ROLES = ['admin', 'designer', 'external_designer', 'writer'] as const

// GET /api/blog?website=&status=
// Admin-only listing — includes drafts. The public-facing reader uses /api/public/blog.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const status = searchParams.get('status')

  const scope = await getUserScope(user.id)
  const service = createServiceClient()
  let query = service
    .from('blog_posts')
    .select('id, website, slug, cover_image_url, status, published_at, created_at, updated_at, author_id, blog_translations(language, title, excerpt)')
    .order('created_at', { ascending: false })

  if (website) {
    if (scope.isScoped && !(scope.domains ?? []).includes(website)) return NextResponse.json([])
    query = query.eq('website', website)
  } else if (scope.isScoped) {
    const allowed = scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json([])
    query = query.in('website', allowed)
  }
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten: add title/excerpt from English translation (or first available)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data ?? []).map((post: any) => {
    const translations = post.blog_translations ?? []
    const en = translations.find((t: { language: string }) => t.language === 'en')
    const first = translations[0]
    const t = en || first
    return {
      ...post,
      title: t?.title ?? '(Untitled)',
      excerpt: t?.excerpt ?? '',
      languages: translations.map((tr: { language: string }) => tr.language),
      blog_translations: undefined,
    }
  })

  return NextResponse.json(result)
}

// POST /api/blog
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Malformed body' }, { status: 400 })
  const { website, slug, cover_image_url, status: postStatus, translations } = body

  if (typeof website !== 'string' || !website || typeof slug !== 'string' || !slug) {
    return NextResponse.json({ error: 'website and slug are required' }, { status: 400 })
  }

  const denied = await assertWriteAccess(user.id, website, [...BLOG_WRITE_ROLES])
  if (denied) return denied

  const service = createServiceClient()

  // Check for duplicate slug
  const { data: existing } = await service
    .from('blog_posts')
    .select('id')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `Slug "${slug}" already exists for website "${website}"` }, { status: 409 })
  }

  // Create post
  const { data: post, error: postError } = await service
    .from('blog_posts')
    .insert({
      website,
      slug,
      cover_image_url: cover_image_url ?? null,
      status: postStatus ?? 'draft',
      published_at: postStatus === 'published' ? new Date().toISOString() : null,
      author_id: user.id,
    })
    .select()
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  // Insert translations if provided
  if (Array.isArray(translations) && translations.length > 0) {
    const rows = translations.map((t: { language: string; title: string; content: string; excerpt: string; meta_title: string; meta_description: string }) => ({
      post_id: post.id,
      language: t.language,
      title: t.title ?? '',
      content: t.content ?? '',
      excerpt: t.excerpt ?? '',
      meta_title: t.meta_title ?? '',
      meta_description: t.meta_description ?? '',
    }))
    const { error: transError } = await service.from('blog_translations').insert(rows)
    if (transError) return NextResponse.json({ error: transError.message }, { status: 500 })
  }

  // Audit log
  const actor = await resolveActor(user.id)
  const enTitle = Array.isArray(translations) ? (translations.find((t: { language: string; title: string }) => t.language === 'en')?.title ?? translations[0]?.title) : null
  await writeAuditLog({
    actor,
    entityType: 'blog_post',
    entityId: post.id,
    action: 'create',
    website,
    label: enTitle ?? slug,
    metadata: {
      slug,
      status: post.status,
      languages: Array.isArray(translations) ? translations.map((t: { language: string }) => t.language) : [],
    },
  })

  void notifyWebsite(website, 'blog_post')

  return NextResponse.json(post, { status: 201 })
}
