import { createServiceClient } from '@/lib/supabase/service'

/**
 * Auto-detect and update leads_mode for a website based on its active phone numbers.
 *
 * Rules:
 * - single:   1 active number, location = 'all'
 * - rotation: Multiple active numbers, all location = 'all'
 * - location: All active numbers have specific locations (none are 'all')
 * - hybrid:   Mix of 'all' location numbers AND specific location numbers
 */
export async function updateLeadsMode(websiteDomain: string) {
  const service = createServiceClient()

  // Get all active phone numbers for this website
  const { data: numbers } = await service
    .from('phone_numbers')
    .select('location_slug, is_active')
    .eq('website', websiteDomain)
    .eq('is_active', true)

  if (!numbers || numbers.length === 0) {
    // No active numbers — clear mode
    await service
      .from('company_websites')
      .update({ leads_mode: null })
      .eq('domain', websiteDomain)
    return
  }

  const allLocationNumbers = numbers.filter(n => n.location_slug === 'all')
  const specificLocationNumbers = numbers.filter(n => n.location_slug !== 'all')

  let mode: string

  if (allLocationNumbers.length > 0 && specificLocationNumbers.length > 0) {
    // Has both "all" and specific location numbers
    mode = 'hybrid'
  } else if (specificLocationNumbers.length > 0 && allLocationNumbers.length === 0) {
    // Only specific location numbers
    mode = 'location'
  } else if (allLocationNumbers.length === 1) {
    // Single "all" number
    mode = 'single'
  } else {
    // Multiple "all" numbers
    mode = 'rotation'
  }

  await service
    .from('company_websites')
    .update({ leads_mode: mode })
    .eq('domain', websiteDomain)
}
