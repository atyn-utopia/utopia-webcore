/**
 * Google OAuth flow for the "marketing" bundle: GA4 + GTM.
 *
 * Kept separate from gsc.ts so users connecting GSC don't need to consent to
 * GA/GTM scopes (and vice-versa). Same Google Cloud OAuth client, different
 * redirect_uri + different requested scopes.
 *
 * Scopes:
 *   analytics.edit                 — create properties, streams, key events
 *   tagmanager.edit.containers     — create containers + tags
 *   tagmanager.publish             — publish container versions
 *   tagmanager.edit.containerversions — required for create_version
 */
const MARKETING_SCOPES = [
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
].join(' ')

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var ${name}`)
  return v
}

export function marketingRedirectUri(origin: string): string {
  return `${origin}/api/integrations/marketing/callback`
}

export function buildMarketingAuthUrl({ origin, state }: { origin: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: marketingRedirectUri(origin),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: MARKETING_SCOPES,
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

export async function exchangeMarketingCodeForTokens({ code, origin }: { code: string; origin: string }): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: marketingRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Marketing token exchange failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export class MarketingTokenRevokedError extends Error {
  readonly code = 'token_revoked' as const
  constructor(detail: string) {
    super(`Google marketing refresh token expired or revoked: ${detail}`)
    this.name = 'MarketingTokenRevokedError'
  }
}

export async function refreshMarketingAccessToken(refreshToken: string): Promise<GoogleTokens> {
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
      throw new MarketingTokenRevokedError(body)
    }
    throw new Error(`Marketing token refresh failed: ${res.status} ${body}`)
  }
  return res.json()
}
