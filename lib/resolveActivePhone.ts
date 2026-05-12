import { createServiceClient } from '@/lib/supabase/service'
import { formatWhatsAppText } from '@/lib/formatWhatsApp'

/**
 * Server-side phone resolution shared by /api/public/phone-numbers/resolve
 * (the JSON API designers can call themselves) and /api/public/whatsapp-redirect
 * (the 302 endpoint customer CTAs link to so rotation happens per click
 * without designers having to wire up async resolution in the browser).
 *
 * Resolution order:
 *   1. Active phones with location_slug = <location> (weighted random)
 *   2. Active phones with location_slug = 'all' (weighted random)
 *   3. Admin 'default' row for the website (returned as 'default_fallback',
 *      may be is_active=false). Skipped if fallbackDefault is false.
 *
 * `null` when nothing matches (no defaults configured either).
 */
export interface ResolvedPhone {
  phone_number: string
  whatsapp_text: string
  type: string
  label: string | null
  location_slug: string
  source: 'location' | 'all' | 'default_fallback'
}

interface PhoneRow {
  phone_number: string
  whatsapp_text: string
  type: string
  label: string | null
  location_slug: string
  percentage: number | null
}

function weightedPick(phones: PhoneRow[]): PhoneRow {
  if (phones.length === 1) return phones[0]
  const total = phones.reduce((s, p) => s + (p.percentage ?? 100), 0)
  let rand = Math.random() * total
  for (const p of phones) {
    rand -= p.percentage ?? 100
    if (rand <= 0) return p
  }
  return phones[0]
}

function toResolved(row: PhoneRow, website: string, source: ResolvedPhone['source']): ResolvedPhone {
  return {
    phone_number: row.phone_number,
    whatsapp_text: formatWhatsAppText({ website, locationSlug: row.location_slug, whatsappText: row.whatsapp_text }),
    type: row.type,
    label: row.label,
    location_slug: row.location_slug,
    source,
  }
}

export async function resolveActivePhone({
  website,
  location,
  fallbackDefault = true,
}: {
  website: string
  location?: string | null
  fallbackDefault?: boolean
}): Promise<ResolvedPhone | null> {
  const service = createServiceClient()

  // 1. Specific location.
  if (location && location !== 'all') {
    const { data: locPhones } = await service
      .from('phone_numbers')
      .select('phone_number, whatsapp_text, type, label, location_slug, percentage')
      .eq('website', website)
      .eq('location_slug', location)
      .eq('is_active', true)
    if (locPhones && locPhones.length > 0) {
      return toResolved(weightedPick(locPhones as PhoneRow[]), website, 'location')
    }
  }

  // 2. location_slug = 'all'.
  const { data: allPhones } = await service
    .from('phone_numbers')
    .select('phone_number, whatsapp_text, type, label, location_slug, percentage')
    .eq('website', website)
    .eq('location_slug', 'all')
    .eq('is_active', true)
  if (allPhones && allPhones.length > 0) {
    return toResolved(weightedPick(allPhones as PhoneRow[]), website, 'all')
  }

  // 3. Default fallback.
  if (fallbackDefault) {
    const { data: defaultPhones } = await service
      .from('phone_numbers')
      .select('phone_number, whatsapp_text, type, label, location_slug, percentage')
      .eq('website', website)
      .eq('type', 'default')
      .limit(1)
    if (defaultPhones && defaultPhones.length > 0) {
      return toResolved(defaultPhones[0] as PhoneRow, website, 'default_fallback')
    }
  }

  return null
}
