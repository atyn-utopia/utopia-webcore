import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')

  const service = createServiceClient()
  if (website) {
    const { data } = await service.from('website_settings').select('*').eq('website', website).maybeSingle()
    return NextResponse.json(data ?? { website, offering_type: 'products' })
  }

  const { data, error } = await service.from('website_settings').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { website, offering_type } = await request.json()
  if (!website || !offering_type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['products', 'services'].includes(offering_type)) return NextResponse.json({ error: 'Invalid offering_type' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('website_settings')
    .upsert({ website, offering_type }, { onConflict: 'website' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
