import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// POST /api/public/track — record a page event (no auth)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { website, event_type, path, referrer, device, browser, session_id, label } = body

    if (!website || !event_type) {
      return NextResponse.json({ error: 'website and event_type are required' }, { status: 400 })
    }

    if (!['pageview', 'click', 'impression'].includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }

    // Hash the IP for privacy (no raw IP stored)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ipHash = crypto.createHash('sha256').update(ip + website).digest('hex').slice(0, 16)

    const service = createServiceClient()
    await service.from('page_events').insert({
      website,
      event_type,
      path: path || '/',
      referrer: referrer || null,
      label: label || null,
      device: device || null,
      browser: browser || null,
      ip_hash: ipHash,
      session_id: session_id || null,
    })

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch {
    return new NextResponse(null, { status: 204 }) // Swallow errors — never block the user
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
