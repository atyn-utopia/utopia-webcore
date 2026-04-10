/**
 * Validate a Malaysian phone number for the rotation pool.
 *
 * Rules:
 *  - Required
 *  - Digits only (no +, spaces, dashes, parentheses)
 *  - Must start with country code 60
 *  - Length between 10 and 13 digits (covers mobile and landlines)
 *
 * Returns an error message if invalid, or null if valid.
 */
export function validatePhoneNumber(value: string): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return 'Phone number is required'
  if (/\s/.test(trimmed)) return 'Phone number cannot contain spaces'
  if (/[-+()]/.test(trimmed)) return 'Remove +, dashes, and parentheses'
  if (!/^\d+$/.test(trimmed)) return 'Only digits are allowed'
  if (!trimmed.startsWith('60')) return 'Must start with country code 60 (not +60 or 0)'
  if (trimmed.length < 10) return 'Too short — expected 10–13 digits'
  if (trimmed.length > 13) return 'Too long — expected 10–13 digits'
  return null
}

/**
 * Check if a phone number already exists in a list of numbers (for duplicate detection).
 * Pass `excludeId` to ignore a specific row when editing it.
 */
export function isDuplicatePhone(
  value: string,
  existing: { id: string; phone_number: string }[],
  excludeId?: string,
): boolean {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return false
  return existing.some(n => n.id !== excludeId && n.phone_number === trimmed)
}
