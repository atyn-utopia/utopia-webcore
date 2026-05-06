import crypto from 'crypto'

/**
 * Constant-time string comparison for shared secrets.
 *
 * Plain `===` short-circuits on the first mismatched byte, leaking timing
 * information that could let an attacker iteratively brute-force a secret one
 * byte at a time. crypto.timingSafeEqual scans the full buffer regardless.
 *
 * Returns false if either input is missing or the lengths differ. Length is
 * itself a one-bit information leak, but for fixed-length secrets (CRON_SECRET,
 * webhook secrets) that's negligible — and node's timingSafeEqual throws if
 * lengths mismatch, so we have to length-check up front anyway.
 */
export function timingSafeEqualString(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}
