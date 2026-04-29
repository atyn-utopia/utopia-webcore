import { LOCATION_LABEL } from '@/lib/myStates'

/**
 * Build the user-facing WhatsApp message for a phone row.
 *
 * Format: `Hi {domain}[ {locationLabel}], {savedText}`
 *
 * The DB stores the operator's raw text only; this prefix is applied at
 * read time (resolve / list public APIs) so the format matches the admin
 * preview without requiring a migration of existing rows.
 *
 * Idempotent: if the saved text already starts with `Hi {domain}` (case-
 * insensitive), it's returned unchanged. Protects rows where someone
 * manually typed the prefix in before this format was applied server-side.
 */
export function formatWhatsAppText(opts: {
  website: string
  locationSlug: string | null | undefined
  whatsappText: string | null | undefined
}): string {
  const text = (opts.whatsappText ?? '').trim()
  if (!text) return text

  const websiteLower = opts.website.toLowerCase()
  if (text.toLowerCase().startsWith(`hi ${websiteLower}`)) return text

  const slug = opts.locationSlug ?? ''
  const locLabel = slug && slug !== 'all' ? (LOCATION_LABEL[slug] ?? slug) : ''
  const loc = locLabel ? ` ${locLabel}` : ''
  return `Hi ${opts.website}${loc}, ${text}`
}
