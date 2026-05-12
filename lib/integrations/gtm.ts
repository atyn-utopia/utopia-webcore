/**
 * Google Tag Manager API helpers used by the marketing auto-connect flow.
 * Creates a Container per customer domain, drops a Google Tag inside the
 * default workspace pointing at the just-created GA4 measurement ID, then
 * publishes the initial version.
 *
 * GTM container IDs (GTM-XXXXXX) are surfaced to the user; the tracker
 * (public/t.js) pulls the active one from the public config endpoint and
 * loads gtm.js at runtime on the customer site.
 */

const API = 'https://www.googleapis.com/tagmanager/v2'

// GTM's special built-in "All Pages" trigger that fires on every pageview.
// This ID is constant across all containers — documented in the GTM API
// reference under "Built-in trigger IDs".
const ALL_PAGES_TRIGGER_ID = '2147479553'

async function gtmFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
}

async function gtmOk<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

export interface GtmAccount {
  path: string                    // 'accounts/{accountId}'
  accountId: string
  name: string
}

export async function listGtmAccounts(accessToken: string): Promise<GtmAccount[]> {
  const res = await gtmFetch(`${API}/accounts`, accessToken)
  const data = await gtmOk<{ account?: GtmAccount[] }>(res, 'GTM listAccounts')
  return data.account ?? []
}

export interface GtmContainer {
  path: string                    // 'accounts/{a}/containers/{c}'
  accountId: string
  containerId: string
  name: string
  publicId: string                // 'GTM-XXXXXX'
  usageContext: string[]
  domainName?: string[]
}

/**
 * List containers in an account so we can detect "already created for this
 * domain" before creating a duplicate. Match heuristic: domain in name or
 * in domainName[].
 */
export async function listGtmContainers(accessToken: string, accountPath: string): Promise<GtmContainer[]> {
  const res = await gtmFetch(`${API}/${accountPath}/containers`, accessToken)
  const data = await gtmOk<{ container?: GtmContainer[] }>(res, 'GTM listContainers')
  return data.container ?? []
}

export async function createGtmContainer({
  accessToken,
  accountPath,
  domain,
}: {
  accessToken: string
  accountPath: string
  domain: string
}): Promise<GtmContainer> {
  const res = await gtmFetch(`${API}/${accountPath}/containers`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: domain,
      usageContext: ['web'],
      domainName: [domain],
    }),
  })
  return gtmOk(res, 'GTM createContainer')
}

export interface GtmWorkspace {
  path: string                    // 'accounts/{a}/containers/{c}/workspaces/{w}'
  workspaceId: string
  name: string
}

/**
 * Each container auto-creates a "Default Workspace". We use that workspace
 * for all initial setup — no need to spin up a custom one.
 */
export async function getDefaultGtmWorkspace({
  accessToken,
  containerPath,
}: {
  accessToken: string
  containerPath: string
}): Promise<GtmWorkspace> {
  const res = await gtmFetch(`${API}/${containerPath}/workspaces`, accessToken)
  const data = await gtmOk<{ workspace?: GtmWorkspace[] }>(res, 'GTM listWorkspaces')
  const def = (data.workspace ?? []).find(w => w.name === 'Default Workspace') ?? (data.workspace ?? [])[0]
  if (!def) throw new Error('GTM: no workspace found on new container')
  return def
}

export interface GtmTag {
  tagId: string
  name: string
  type: string
  firingTriggerId?: string[]
}

export interface GtmTrigger {
  path?: string
  triggerId: string
  name: string
  type: string
  filter?: Array<{
    type: string
    parameter?: Array<{ type: string; key: string; value: string }>
  }>
}

export interface GtmVariable {
  variableId: string
  name: string
  type: string
}

/**
 * List user-defined variables in a workspace. Used to skip creating a
 * `Constant_Measurement ID` (or similar) variable that's already there.
 */
export async function listGtmVariables({
  accessToken,
  workspacePath,
}: {
  accessToken: string
  workspacePath: string
}): Promise<GtmVariable[]> {
  const res = await gtmFetch(`${API}/${workspacePath}/variables`, accessToken)
  const data = await gtmOk<{ variable?: GtmVariable[] }>(res, 'GTM listVariables')
  return data.variable ?? []
}

/**
 * Create a Constant variable (type `c`). The team's GTM convention puts the
 * GA4 measurement ID into a single `Constant_Measurement ID` variable so
 * every tag references one source of truth — change the property and only
 * the variable's value updates, not every tag config.
 */
export async function createConstantVariable({
  accessToken,
  workspacePath,
  name,
  value,
}: {
  accessToken: string
  workspacePath: string
  name: string
  value: string
}): Promise<{ variableId: string; name: string }> {
  const res = await gtmFetch(`${API}/${workspacePath}/variables`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      type: 'c',
      parameter: [{ type: 'template', key: 'value', value }],
    }),
  })
  return gtmOk(res, 'GTM createConstantVariable')
}

/**
 * List tags / triggers in a workspace. Used by the auto-connect flow to
 * skip resources that already exist by name — same Connect button can
 * safely re-run on a backfill (e.g. after we ship a new default tag set).
 */
export async function listGtmTags({
  accessToken,
  workspacePath,
}: {
  accessToken: string
  workspacePath: string
}): Promise<GtmTag[]> {
  const res = await gtmFetch(`${API}/${workspacePath}/tags`, accessToken)
  const data = await gtmOk<{ tag?: GtmTag[] }>(res, 'GTM listTags')
  return data.tag ?? []
}

export async function listGtmTriggers({
  accessToken,
  workspacePath,
}: {
  accessToken: string
  workspacePath: string
}): Promise<GtmTrigger[]> {
  const res = await gtmFetch(`${API}/${workspacePath}/triggers`, accessToken)
  const data = await gtmOk<{ trigger?: GtmTrigger[] }>(res, 'GTM listTriggers')
  return data.trigger ?? []
}

/**
 * Add the Google Tag (gtag.js / GA4) inside the workspace, firing on every
 * pageview. consentSettings.consentStatus = 'notNeeded' matches the SOP's
 * "Consent Overview → No additional consent required" instruction at tag
 * level (the container-level "Additional Consent Checks (Beta)" toggle is
 * not currently exposed via API and stays opt-in via the GTM UI).
 */
export async function createGoogleTagInWorkspace({
  accessToken,
  workspacePath,
  measurementId,
}: {
  accessToken: string
  workspacePath: string
  measurementId: string           // 'G-XXXXXX'
}): Promise<{ tagId: string; name: string }> {
  const res = await gtmFetch(`${API}/${workspacePath}/tags`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Google Tag',
      type: 'googtag',
      parameter: [
        { type: 'template', key: 'tagId', value: measurementId },
      ],
      firingTriggerId: [ALL_PAGES_TRIGGER_ID],
      consentSettings: { consentStatus: 'notNeeded' },
    }),
  })
  return gtmOk(res, 'GTM createGoogleTag')
}

/**
 * Conversion Linker tag — preserves Google Ads gclid / gbraid / wbraid
 * across navigation so Ads conversion attribution survives downstream
 * redirects. Standard "every site that runs Ads" boilerplate.
 */
export async function createConversionLinkerTag({
  accessToken,
  workspacePath,
}: {
  accessToken: string
  workspacePath: string
}): Promise<{ tagId: string; name: string }> {
  const res = await gtmFetch(`${API}/${workspacePath}/tags`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Conversion Linker',
      type: 'cl',
      firingTriggerId: [ALL_PAGES_TRIGGER_ID],
      consentSettings: { consentStatus: 'notNeeded' },
    }),
  })
  return gtmOk(res, 'GTM createConversionLinker')
}

/**
 * Custom Event trigger — fires when the customer site pushes
 * `dataLayer.push({ event: <eventName> })`. The webcore tracker bridges
 * window.uwc(eventName) calls into that dataLayer push, so any first-party
 * event the designer fires also feeds GTM with no extra wiring.
 */
export async function createCustomEventTrigger({
  accessToken,
  workspacePath,
  eventName,
}: {
  accessToken: string
  workspacePath: string
  eventName: string
}): Promise<{ triggerId: string; name: string }> {
  const res = await gtmFetch(`${API}/${workspacePath}/triggers`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: eventName,
      type: 'customEvent',
      customEventFilter: [
        {
          type: 'equals',
          parameter: [
            { type: 'template', key: 'arg0', value: '{{_event}}' },
            { type: 'template', key: 'arg1', value: eventName },
          ],
        },
      ],
    }),
  })
  return gtmOk(res, 'GTM createCustomEventTrigger')
}

/**
 * Link Click trigger (GTM type "Click - Just Links") — fires when a link
 * whose href matches the supplied regex is clicked. Used for the
 * whatsapp_click event. Each customer site can route WhatsApp clicks
 * differently:
 *   - some have a per-site internal redirect page (e.g. /redirect-whatsapp-1)
 *   - some link to the centralized webcore endpoint (/api/public/whatsapp-redirect)
 *   - unmigrated sites still link directly to wa.me/<number>
 * Using a single regex covers all three without per-site configuration.
 *
 * Requires the {{Click URL}} built-in variable to be enabled — handled
 * by enableGtmClickBuiltins which is already called from auto-connect.
 */
export async function createLinkClickTrigger({
  accessToken,
  workspacePath,
  name,
  urlPattern,
}: {
  accessToken: string
  workspacePath: string
  name: string
  urlPattern: string              // regex, e.g. '(redirect-whatsapp|whatsapp-redirect|wa\\.me/)'
}): Promise<{ triggerId: string; name: string }> {
  const res = await gtmFetch(`${API}/${workspacePath}/triggers`, accessToken, {
    method: 'POST',
    body: JSON.stringify(linkClickBody({ name, urlPattern })),
  })
  return gtmOk(res, 'GTM createLinkClickTrigger')
}

/**
 * Replace a Link Click trigger in-place so a re-run of the auto-connect
 * flow can migrate existing triggers (e.g. when we change the URL pattern
 * we filter on). Same triggerId, new filter — so the tag's
 * firingTriggerId reference stays valid.
 */
export async function updateLinkClickTrigger({
  accessToken,
  triggerPath,
  name,
  urlPattern,
}: {
  accessToken: string
  triggerPath: string
  name: string
  urlPattern: string
}): Promise<{ triggerId: string }> {
  const res = await gtmFetch(`${API}/${triggerPath}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(linkClickBody({ name, urlPattern })),
  })
  return gtmOk(res, 'GTM updateLinkClickTrigger')
}

function linkClickBody({ name, urlPattern }: { name: string; urlPattern: string }) {
  return {
    name,
    type: 'linkClick',
    waitForTags: { type: 'boolean', value: 'false' },
    checkValidation: { type: 'boolean', value: 'false' },
    filter: [
      {
        type: 'matchRegex',
        parameter: [
          { type: 'template', key: 'arg0', value: '{{Click URL}}' },
          { type: 'template', key: 'arg1', value: urlPattern },
          // Case-insensitive — WhatsApp URLs are lowercase in practice
          // but cheap insurance against a stray uppercase in a designer
          // template.
          { type: 'boolean', key: 'ignore_case', value: 'true' },
        ],
      },
    ],
  }
}

/**
 * GA4 Event tag — sends a named event to the same GA4 property the Google
 * Tag is wired to. measurementIdOverride lets us point at the stream
 * directly instead of referencing the Google Tag by name (more robust if
 * someone later renames it in the GTM UI).
 */
export async function createGa4EventTag({
  accessToken,
  workspacePath,
  eventName,
  measurementId,
  triggerId,
}: {
  accessToken: string
  workspacePath: string
  eventName: string
  measurementId: string           // 'G-XXXXXX'
  triggerId: string
}): Promise<{ tagId: string; name: string }> {
  const res = await gtmFetch(`${API}/${workspacePath}/tags`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: eventName,
      type: 'gaawe',
      parameter: [
        { type: 'template', key: 'eventName', value: eventName },
        { type: 'template', key: 'measurementIdOverride', value: measurementId },
      ],
      firingTriggerId: [triggerId],
      consentSettings: { consentStatus: 'notNeeded' },
    }),
  })
  return gtmOk(res, 'GTM createGa4EventTag')
}

/**
 * Enable the click-related built-in variables. The SOP highlights
 * "Variables Section (Click)" — these are required if the user later wants
 * to add custom click triggers (e.g. whatsapp_click). GA4 Enhanced
 * Measurement covers outbound clicks itself, but having these enabled
 * removes a manual step the next time they extend GTM.
 */
export async function enableGtmClickBuiltins({
  accessToken,
  workspacePath,
}: {
  accessToken: string
  workspacePath: string
}): Promise<void> {
  const types = [
    'clickElement', 'clickClasses', 'clickId', 'clickTarget', 'clickUrl', 'clickText',
    'pageUrl', 'pageHostname', 'pagePath', 'referrer',
    // `event` exposes the current dataLayer `event` value to triggers + tags.
    // Required if anyone later adds a Custom Event trigger or wants to fork
    // tag logic by event name.
    'event',
  ]
  const params = types.map(t => `type=${t}`).join('&')
  const res = await gtmFetch(`${API}/${workspacePath}/built_in_variables?${params}`, accessToken, {
    method: 'POST',
  })
  // 409 = some/all already enabled — that's fine.
  if (!res.ok && res.status !== 409) {
    throw new Error(`GTM enableBuiltinVariables failed: ${res.status} ${await res.text()}`)
  }
}

export interface GtmVersion {
  path: string
  containerVersionId: string
}

/**
 * Snapshot the workspace into a version, then immediately publish it.
 * Until published, the container serves an empty configuration so no tags
 * fire on the live site.
 */
export async function publishGtmWorkspace({
  accessToken,
  workspacePath,
  containerPath,
}: {
  accessToken: string
  workspacePath: string
  containerPath: string
}): Promise<{ versionId: string }> {
  const createRes = await gtmFetch(`${API}/${workspacePath}:create_version`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Initial setup',
      notes: 'Auto-published by Webcore on first connect.',
    }),
  })
  const created = await gtmOk<{ containerVersion?: GtmVersion }>(createRes, 'GTM createVersion')
  const versionId = created.containerVersion?.containerVersionId
  if (!versionId) throw new Error('GTM: createVersion returned no containerVersionId')

  const pubRes = await gtmFetch(`${API}/${containerPath}/versions/${versionId}:publish`, accessToken, {
    method: 'POST',
  })
  if (!pubRes.ok) {
    throw new Error(`GTM publishVersion failed: ${pubRes.status} ${await pubRes.text()}`)
  }
  return { versionId }
}
