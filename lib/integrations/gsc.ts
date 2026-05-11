// Bumped from 'webmasters.readonly' to full 'webmasters' so we can call
// sites.add during auto-connect. Added 'siteverification' so we can grab
// a verification token + run verify on the user's behalf. Old refresh
// tokens that only had readonly will need to re-consent — handled by the
// existing prompt='consent' in the auth URL builder.
const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/siteverification',
].join(' ')
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var ${name}`)
  return v
}

export function gscRedirectUri(origin: string): string {
  return `${origin}/api/integrations/gsc/callback`
}

export function buildGscAuthUrl({ origin, state }: { origin: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: gscRedirectUri(origin),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GSC_SCOPES,
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens({ code, origin }: { code: string; origin: string }): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: gscRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export class GscTokenRevokedError extends Error {
  readonly code = 'token_revoked' as const
  constructor(detail: string) {
    super(`Google refresh token expired or revoked: ${detail}`)
    this.name = 'GscTokenRevokedError'
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 400 && body.includes('invalid_grant')) {
      throw new GscTokenRevokedError(body)
    }
    throw new Error(`Token refresh failed: ${res.status} ${body}`)
  }
  return res.json()
}

export interface GscSiteEntry { siteUrl: string; permissionLevel: string }

export async function listGscSites(accessToken: string): Promise<GscSiteEntry[]> {
  const res = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`GSC sites list failed: ${res.status}`)
  const data = await res.json()
  return data.siteEntry ?? []
}

// ─── Site Verification + Search Console (auto-connect) ──────────────────

/**
 * Ask Google for a verification token for a domain. Used by the
 * auto-connect flow: we drop this TXT value into DNS (via Vercel when
 * possible, manually otherwise) so Google can confirm ownership without
 * the designer touching their site code.
 */
export async function getDomainVerificationToken({ accessToken, domain }: { accessToken: string; domain: string }): Promise<{ token: string }> {
  const res = await fetch('https://www.googleapis.com/siteVerification/v1/token', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verificationMethod: 'DNS_TXT',
      site: { type: 'INET_DOMAIN', identifier: domain },
    }),
  })
  if (!res.ok) throw new Error(`Site verification token failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<{ token: string }>
}

/**
 * Trigger verification. Google checks the DNS TXT record itself; we just
 * ask it to confirm. Resolves successfully when the record is found, throws
 * (with the API's error message) when it isn't.
 */
export async function verifyDomain({ accessToken, domain }: { accessToken: string; domain: string }) {
  const url = 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT'
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ site: { type: 'INET_DOMAIN', identifier: domain } }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Verify failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<{ id: string; site: { type: string; identifier: string }; owners: string[] }>
}

/**
 * Add the domain property (sc-domain:example.com) to the user's Search
 * Console properties list. 200 / 204 = added, 409 = already present (we
 * treat that as success).
 */
export async function addDomainPropertyToSearchConsole({ accessToken, domain }: { accessToken: string; domain: string }) {
  const siteUrl = `sc-domain:${domain}`
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 409) {
    throw new Error(`sites.add failed: ${res.status} ${await res.text()}`)
  }
  return { siteUrl }
}

export interface GscSearchAnalyticsRow { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }

export async function querySearchAnalytics({ accessToken, propertyId, startDate, endDate, dimensions }: {
  accessToken: string
  propertyId: string
  startDate: string
  endDate: string
  dimensions?: ('query' | 'page' | 'date' | 'device' | 'country')[]
}): Promise<GscSearchAnalyticsRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyId)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions: dimensions ?? [] }),
  })
  if (!res.ok) throw new Error(`GSC query failed: ${res.status}`)
  const data = await res.json()
  return data.rows ?? []
}
