import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { assertWriteAccess } from '@/lib/assertWriteAccess'
import { resolveActor, writeAuditLog, diffObjects, BLOG_FIELDS, type ChangesMap } from '@/lib/auditLog'
import { notifyWebsite } from '@/lib/notifyWebsite'

const BLOG_WRITE_ROLES = ['admin', 'designer', 'external_designer', 'writer'] as const

// GET /api/blog/[id] — get post with all translations
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service
    .from('blog_posts')
    .select('*, blog_translations(*)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/blog/[id] — update post + translations
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Malformed body' }, { status: 400 })
  const { translations, ...postFields } = body

  const service = createServiceClient()

  // Fetch full row + translations BEFORE any update so we can diff for audit log + validate scope
  const { data: beforeRow } = await service.from('blog_posts').select('*, blog_translations(*)').eq('id', id).single()
  if (!beforeRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const denied = await assertWriteAccess(user.id, beforeRow.website, [...BLOG_WRITE_ROLES])
  if (denied) return denied

  if (typeof postFields.website === 'string' && postFields.website !== beforeRow.website) {
    const moveDenied = await assertWriteAccess(user.id, postFields.website, [...BLOG_WRITE_ROLES])
    if (moveDenied) return moveDenied
  }

  // If changing slug, check for duplicates
  if (postFields.slug) {
    const { data: current } = await service.from('blog_posts').select('website, slug').eq('id', id).single()
    if (current && postFields.slug !== current.slug) {
      const { data: existing } = await service
        .from('blog_posts').select('id').eq('website', current.website).eq('slug', postFields.slug).maybeSingle()
      if (existing) {
        return NextResponse.json({ error: `Slug "${postFields.slug}" already exists for this website` }, { status: 409 })
      }
    }
  }

  // Handle publish/unpublish
  if (postFields.status === 'published' && !postFields.published_at) {
    postFields.published_at = new Date().toISOString()
  } else if (postFields.status === 'draft') {
    postFields.published_at = null
  }

  // Update post fields
  if (Object.keys(postFields).length > 0) {
    postFields.updated_at = new Date().toISOString()
    const { error } = await service.from('blog_posts').update(postFields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Upsert translations
  if (Array.isArray(translations)) {
    for (const t of translations) {
      const { error } = await service
        .from('blog_translations')
        .upsert({
          post_id: id,
          language: t.language,
          title: t.title ?? '',
          content: t.content ?? '',
          excerpt: t.excerpt ?? '',
          meta_title: t.meta_title ?? '',
          meta_description: t.meta_description ?? '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'post_id,language' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Return updated post with translations
  const { data } = await service.from('blog_posts').select('*, blog_translations(*)').eq('id', id).single()

  // Audit log
  const changes: ChangesMap = diffObjects(beforeRow, data, BLOG_FIELDS)
  // Diff translation titles and content (per language)
  if (Array.isArray(beforeRow?.blog_translations) && Array.isArray(data?.blog_translations)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beforeByLang: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(beforeRow.blog_translations as any[]).forEach(t => { beforeByLang[t.language] = t })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterByLang: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(data.blog_translations as any[]).forEach(t => { afterByLang[t.language] = t })
    const allLangs = new Set([...Object.keys(beforeByLang), ...Object.keys(afterByLang)])
    for (const lang of allLangs) {
      const fieldKeys = ['title', 'excerpt', 'content', 'meta_title', 'meta_description']
      const inner = diffObjects(beforeByLang[lang] ?? null, afterByLang[lang] ?? null, fieldKeys)
      for (const key of Object.keys(inner)) {
        changes[`${lang}.${key}`] = inner[key]
      }
    }
  }

  if (Object.keys(changes).length > 0) {
    const actor = await resolveActor(user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const en = (data?.blog_translations as any[])?.find(t => t.language === 'en') ?? (data?.blog_translations as any[])?.[0]
    await writeAuditLog({
      actor,
      entityType: 'blog_post',
      entityId: id,
      action: 'update',
      website: data?.website ?? null,
      label: en?.title ?? data?.slug ?? null,
      changes,
    })
  }

  if (data?.website) void notifyWebsite(data.website, 'blog_post')

  return NextResponse.json(data)
}

// DELETE /api/blog/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()

  // Snapshot before delete for audit + scope validation
  const { data: before } = await service.from('blog_posts').select('*, blog_translations(*)').eq('id', id).single()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const denied = await assertWriteAccess(user.id, before.website, [...BLOG_WRITE_ROLES])
  if (denied) return denied

  const { error } = await service.from('blog_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (before) {
    const actor = await resolveActor(user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const en = (before.blog_translations as any[])?.find(t => t.language === 'en') ?? (before.blog_translations as any[])?.[0]
    await writeAuditLog({
      actor,
      entityType: 'blog_post',
      entityId: id,
      action: 'delete',
      website: before.website,
      label: en?.title ?? before.slug,
      metadata: {
        slug: before.slug,
        status: before.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        languages: (before.blog_translations as any[])?.map(t => t.language) ?? [],
      },
    })
    void notifyWebsite(before.website, 'blog_post')
  }

  return NextResponse.json({ success: true })
}
