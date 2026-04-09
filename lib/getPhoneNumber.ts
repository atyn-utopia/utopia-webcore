/**
 * getPhoneNumber — shared helper for front-end websites
 *
 * Copy this file to each website project at lib/getPhoneNumber.ts
 * and set the SITE constant for each website.
 *
 * Usage:
 *   import { getPhoneNumber } from '@/lib/getPhoneNumber'
 *   const phone = await getPhoneNumber('kuala-lumpur')
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Set these per website project:
const SITE = process.env.NEXT_PUBLIC_SITE_SLUG!      // e.g. 'oxihome.my'
const FALLBACK_PHONE = process.env.NEXT_PUBLIC_FALLBACK_PHONE ?? '60123456789'

export async function getPhoneNumber(locationSlug: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('phone_number, percentage')
    .eq('website', SITE)
    .eq('location_slug', locationSlug)
    .eq('is_active', true)

  if (error || !data || data.length === 0) {
    return FALLBACK_PHONE
  }

  // Weighted random selection based on percentage
  const totalWeight = data.reduce((s, r) => s + (r.percentage ?? 100), 0)
  let rand = Math.random() * totalWeight
  for (const row of data) {
    rand -= row.percentage ?? 100
    if (rand <= 0) return row.phone_number
  }
  return data[0].phone_number
}

/**
 * Client-side version — calls a local API route to avoid exposing
 * Supabase keys in client bundles when using server components.
 */
export async function fetchPhoneNumber(locationSlug: string): Promise<string> {
  const res = await fetch(
    `/api/phone?location=${encodeURIComponent(locationSlug)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return FALLBACK_PHONE
  const data = await res.json()
  return data.phone_number ?? FALLBACK_PHONE
}
