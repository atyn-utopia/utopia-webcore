import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB — og:image typically larger than logos
const BUCKET = 'seo-assets'

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'bin'
}

// POST /api/seo/upload?website=DOMAIN — multipart/form-data with `file`. Returns
// the public URL of the uploaded asset. The caller is expected to subsequently
// PATCH/POST /api/seo with the URL stored in og_image.
export async function POST(request: Request) {
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
  const ext = extFromMime(file.type)
  const path = `${website}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  let { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  // Bootstrap: if the bucket doesn't exist yet, create it (public read) and retry.
  if (uploadError && /bucket not found|the resource was not found/i.test(uploadError.message)) {
    const { error: createError } = await service.storage.createBucket(BUCKET, { public: true })
    if (createError && !/already exists/i.test(createError.message)) {
      return NextResponse.json({ error: `Could not create storage bucket: ${createError.message}` }, { status: 500 })
    }
    const retry = await service.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false })
    uploadError = retry.error
  }

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl })
}
