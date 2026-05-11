/**
 * Google Analytics 4 — Admin API helpers used by the marketing auto-connect
 * flow. Each customer site gets a dedicated Property + Web Data Stream under
 * the user's existing GA4 account, with the SOP's settings (Scroll +
 * Outbound Click only, 14-month retention).
 *
 * All calls take a bearer access_token. Refresh is handled by the shared
 * helper in lib/integrations/google.ts.
 */

const ADMIN_V1 = 'https://analyticsadmin.googleapis.com/v1beta'
const ADMIN_V1ALPHA = 'https://analyticsadmin.googleapis.com/v1alpha'

async function gaFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
}

async function gaOk<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(body)) {
      throw new Ga4QuotaError(`${label}: ${body}`)
    }
    throw new Error(`${label} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<T>
}

export interface Ga4AccountSummary {
  name: string
  account: string
  displayName: string
  propertySummaries?: { property: string; displayName: string }[]
}

export interface Ga4ListAccountsResponse {
  accountSummaries?: Ga4AccountSummary[]
}

/**
 * List the user's GA4 accounts and their properties in one call. Returns []
 * when the user has no GA accounts yet (they need to create one in the GA UI;
 * GA4 doesn't let third-party apps create the top-level account).
 */
export async function listGa4AccountSummaries(accessToken: string): Promise<Ga4AccountSummary[]> {
  const res = await gaFetch(`${ADMIN_V1}/accountSummaries?pageSize=200`, accessToken)
  const data = await gaOk<Ga4ListAccountsResponse>(res, 'GA4 listAccountSummaries')
  return data.accountSummaries ?? []
}

export class Ga4QuotaError extends Error {
  readonly code = 'quota' as const
  constructor(detail: string) {
    super(`GA4 Admin write quota exhausted: ${detail}`)
    this.name = 'Ga4QuotaError'
  }
}

export interface Ga4Property {
  name: string                    // 'properties/{propertyId}'
  displayName: string
  timeZone: string
  currencyCode: string
}

/**
 * Find a property by displayName across all of the user's accounts. Used by
 * auto-connect to skip re-creating a property on retry (each create costs
 * GA Admin write tokens — see Ga4QuotaError below).
 */
export async function findGa4PropertyByDisplayName({
  accessToken,
  displayName,
}: {
  accessToken: string
  displayName: string
}): Promise<{ propertyPath: string; accountPath: string } | null> {
  const summaries = await listGa4AccountSummaries(accessToken)
  for (const summary of summaries) {
    const match = (summary.propertySummaries ?? []).find(p => p.displayName === displayName)
    if (match) return { propertyPath: match.property, accountPath: summary.account }
  }
  return null
}

export interface Ga4DataStream {
  name: string
  type: string
  displayName: string
  webStreamData?: { measurementId: string; defaultUri: string }
}

/**
 * List the data streams on an existing property. Used by auto-connect's
 * idempotent path — if a property exists for this domain but the previous
 * stream-create failed mid-flight, we want to reuse what's there instead of
 * making more.
 */
export async function listGa4DataStreams({
  accessToken,
  propertyPath,
}: {
  accessToken: string
  propertyPath: string
}): Promise<Ga4DataStream[]> {
  const res = await gaFetch(`${ADMIN_V1}/${propertyPath}/dataStreams?pageSize=200`, accessToken)
  const data = await gaOk<{ dataStreams?: Ga4DataStream[] }>(res, 'GA4 listDataStreams')
  return data.dataStreams ?? []
}

/**
 * Create a GA4 Property under the chosen account. timeZone + currencyCode
 * default to Malaysian sensible values (matches our customer base); caller
 * can override.
 */
export async function createGa4Property({
  accessToken,
  accountPath,
  displayName,
  timeZone = 'Asia/Kuala_Lumpur',
  currencyCode = 'MYR',
}: {
  accessToken: string
  accountPath: string             // 'accounts/{accountId}'
  displayName: string
  timeZone?: string
  currencyCode?: string
}): Promise<Ga4Property> {
  const res = await gaFetch(`${ADMIN_V1}/properties`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      parent: accountPath,
      displayName,
      timeZone,
      currencyCode,
      industryCategory: 'OTHER',
    }),
  })
  return gaOk<Ga4Property>(res, 'GA4 createProperty')
}

export interface Ga4WebStream {
  name: string                    // 'properties/{p}/dataStreams/{s}'
  type: string
  displayName: string
  webStreamData: {
    measurementId: string         // 'G-XXXXXX'
    firebaseAppId?: string
    defaultUri: string
  }
}

/**
 * Create a Web Data Stream on the new property. measurementId (G-XXX) is
 * what the customer site loads via gtag.js / GTM.
 */
export async function createGa4WebStream({
  accessToken,
  propertyPath,
  displayName,
  defaultUri,
}: {
  accessToken: string
  propertyPath: string            // 'properties/{propertyId}'
  displayName: string
  defaultUri: string              // e.g. 'https://example.com'
}): Promise<Ga4WebStream> {
  const res = await gaFetch(`${ADMIN_V1}/${propertyPath}/dataStreams`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      type: 'WEB_DATA_STREAM',
      displayName,
      webStreamData: { defaultUri },
    }),
  })
  return gaOk<Ga4WebStream>(res, 'GA4 createWebStream')
}

/**
 * Enhanced Measurement settings — per the SOP, only Scroll + Outbound Click.
 * Everything else (site search, video, file downloads, form interactions,
 * page changes) is explicitly turned off. The streamEnabled master toggle
 * must be true for any of the above to actually fire.
 *
 * Lives on v1alpha — at time of writing the GA Admin API still publishes
 * enhancedMeasurementSettings under the alpha surface.
 */
export async function updateGa4EnhancedMeasurement({
  accessToken,
  streamPath,
}: {
  accessToken: string
  streamPath: string              // 'properties/{p}/dataStreams/{s}'
}): Promise<void> {
  const updateMask = [
    'streamEnabled',
    'scrollsEnabled',
    'outboundClicksEnabled',
    'siteSearchEnabled',
    'videoEngagementEnabled',
    'fileDownloadsEnabled',
    'formInteractionsEnabled',
    'pageChangesEnabled',
  ].join(',')
  const url = `${ADMIN_V1ALPHA}/${streamPath}/enhancedMeasurementSettings?updateMask=${encodeURIComponent(updateMask)}`
  const res = await gaFetch(url, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({
      streamEnabled: true,
      scrollsEnabled: true,
      outboundClicksEnabled: true,
      siteSearchEnabled: false,
      videoEngagementEnabled: false,
      fileDownloadsEnabled: false,
      formInteractionsEnabled: false,
      pageChangesEnabled: false,
    }),
  })
  if (!res.ok) {
    throw new Error(`GA4 updateEnhancedMeasurement failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Set event data retention to 14 months (the SOP value) and enable
 * resetUserDataOnNewActivity so the 14-month clock restarts on every visit.
 */
export async function updateGa4DataRetention({
  accessToken,
  propertyPath,
}: {
  accessToken: string
  propertyPath: string
}): Promise<void> {
  const url = `${ADMIN_V1}/${propertyPath}/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity`
  const res = await gaFetch(url, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({
      eventDataRetention: 'FOURTEEN_MONTHS',
      resetUserDataOnNewActivity: true,
    }),
  })
  if (!res.ok) {
    throw new Error(`GA4 updateDataRetention failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Mark an event as a Key Event (formerly "Conversion"). Used after first
 * events have flowed in — you can't mark an event Key until GA has seen
 * the eventName at least once. We surface this as a separate button.
 */
export async function createGa4KeyEvent({
  accessToken,
  propertyPath,
  eventName,
}: {
  accessToken: string
  propertyPath: string
  eventName: string
}): Promise<{ name: string; eventName: string }> {
  const res = await gaFetch(`${ADMIN_V1}/${propertyPath}/keyEvents`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      eventName,
      countingMethod: 'ONCE_PER_EVENT',
    }),
  })
  if (res.status === 409) {
    // Already a key event — treat as success.
    return { name: '', eventName }
  }
  return gaOk(res, 'GA4 createKeyEvent')
}
