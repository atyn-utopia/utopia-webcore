import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_EDIT_ROLES = new Set(['admin', 'designer'])
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'])
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const BUCKET = 'company-logos'

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'image/gif') return 'gif'
  return 'bin'
}

// POST /api/companies/[id]/logo — multipart/form-data with `file`. Uploads to
// the company-logos bucket and updates companies.logo_url with the public URL.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_EDIT_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required (multipart/form-data)' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large — max ${Math.round(MAX_BYTES / 1024 / 1024)}MB` }, { status: 413 })
  }

  const service = createServiceClient()

  // Verify the company exists before doing anything storage-related
  const { data: company } = await service.from('companies').select('id').eq('id', id).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const ext = extFromMime(file.type)
  const path = `${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(path)
  const logo_url = urlData.publicUrl

  const { data: updated, error: updateError } = await service
    .from('companies')
    .update({ logo_url })
    .eq('id', id)
    .select()
    .single()
  if (updateError) {
    // Best-effort cleanup so we don't leave an orphan file
    await service.storage.from(BUCKET).remove([path]).catch(() => {})
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ company: updated, logo_url })
}

// DELETE /api/companies/[id]/logo — clear the logo_url. The previous file is
// left in the bucket; storage is cheap and re-upload can re-use the path.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  if (!ALLOWED_EDIT_ROLES.has(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service
    .from('companies')
    .update({ logo_url: null })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data })
}
