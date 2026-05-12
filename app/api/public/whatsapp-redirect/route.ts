import { NextResponse } from 'next/server'
import { resolveActivePhone } from '@/lib/resolveActivePhone'

/**
 * PUBLIC endpoint — no auth required.
 *
 * Customer-site WhatsApp CTAs link <a href> directly here. We resolve a
 * phone number server-side on every click (rotation + location), then 302
 * to https://wa.me/<phone>?text=<url-encoded text>.
 *
 *   GET /api/public/whatsapp-redirect?website=example.com
 *   GET /api/public/whatsapp-redirect?website=example.com&location=shah-alam
 *   GET /api/public/whatsapp-redirect?website=example.com&text=Hi%20there
 *
 * Why a redirect instead of returning JSON and having the designer call
 * window.open() client-side:
 *   - Survives static-rendered pages: designers can `<a href="…/whatsapp-redirect?…">`
 *     and rotation happens on every click without needing 'use client'.
 *   - Survives ISR / CDN caching: the customer-site URL is identical for
 *     every visitor, so it caches fine; the redirect endpoint itself is
 *     no-store so resolution is always fresh.
 *   - Survives bad designer code: there's no way to accidentally bake a
 *     wa.me URL into static HTML.
 *   - GTM-trackable: every WhatsApp click hits /api/public/whatsapp-redirect,
 *     so a single Link Click trigger filtering on Click URL contains
 *     "/api/public/whatsapp-redirect" lights up GA4 across every site.
 *
 * No CORS headers — this is a top-level navigation target (browser address
 * bar follows the 302), not an XHR target.
 *
 * Cache-Control: no-store, because if any intermediary cached the response
 * every visitor would get the same phone number, defeating rotation.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')?.trim().toLowerCase()
  const location = searchParams.get('location')
  const textOverride = searchParams.get('text')
  const fallbackDefault = searchParams.get('fallback_default') !== '0'

  if (!website) {
    return NextResponse.json({ error: 'website parameter is required' }, { status: 400 })
  }

  const resolved = await resolveActivePhone({ website, location, fallbackDefault })
  if (!resolved) {
    // No phones configured at all — bounce to wa.me with no number so the
    // user sees WhatsApp's "enter a number" UI rather than a webcore error
    // page. The first-party tracker still fired (the link click logged on
    // the customer site), so we have telemetry of the failed attempt.
    return NextResponse.redirect('https://wa.me/', {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Strip everything except digits — wa.me only accepts a bare international
  // number. e.g. '+60 12-345 6789' → '60123456789'.
  const digits = resolved.phone_number.replace(/\D/g, '')
  const text = (textOverride ?? resolved.whatsapp_text ?? '').trim()
  const url = text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`

  return NextResponse.redirect(url, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
