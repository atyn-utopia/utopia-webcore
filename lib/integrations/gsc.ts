const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
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
    scope: GSC_SCOPE,
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
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
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
