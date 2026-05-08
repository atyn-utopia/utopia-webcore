/**
 * Minimal Vercel REST client used by the domain-rename flow. Only covers the
 * three calls we need: find project by domain, attach domain, trigger
 * redeploy of the latest production deployment.
 *
 * Reads `VERCEL_API_TOKEN` (required) and `VERCEL_TEAM_ID` (only when the
 * project lives in a team rather than a personal account). When the token
 * isn't set, callers should treat Vercel as opt-out and fall back to the
 * webcore-only rename path.
 */

const BASE = 'https://api.vercel.com'

export class VercelError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'VercelError'
  }
}

function token() {
  return process.env.VERCEL_API_TOKEN ?? null
}

function teamId() {
  return process.env.VERCEL_TEAM_ID ?? null
}

export function isVercelEnabled() {
  return !!token()
}

function buildUrl(path: string) {
  const team = teamId()
  if (!team) return `${BASE}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${BASE}${path}${sep}teamId=${team}`
}

async function vercelFetch(path: string, init: RequestInit = {}) {
  const t = token()
  if (!t) throw new VercelError('VERCEL_API_TOKEN not configured', 500)
  const res = await fetch(buildUrl(path), {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  return res
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } }
    return data?.error?.message ?? `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

/**
 * Locate the Vercel project that currently serves `domain`. Returns null if
 * the token doesn't have visibility into a project that owns this domain
 * (custom domain on another team, or domain isn't on Vercel at all).
 */
export async function findProjectIdByDomain(domain: string): Promise<string | null> {
  // Fast path — *.vercel.app subdomains always map 1:1 to a project name.
  if (domain.endsWith('.vercel.app')) {
    const name = domain.slice(0, -'.vercel.app'.length)
    const res = await vercelFetch(`/v9/projects/${encodeURIComponent(name)}`)
    if (res.ok) {
      const data = (await res.json()) as { id?: string }
      if (data.id) return data.id
    }
  }

  // Slow path — paginate projects and inspect each project's domain list.
  let until: string | undefined
  for (let safety = 0; safety < 50; safety++) {
    const qs = until ? `?limit=100&until=${until}` : '?limit=100'
    const res = await vercelFetch(`/v9/projects${qs}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      projects?: { id: string; alias?: { domain: string }[]; targets?: { production?: { alias?: string[] } } }[]
      pagination?: { next?: string | null }
    }
    for (const p of data.projects ?? []) {
      if (p.alias?.some(a => a.domain === domain)) return p.id
      const aliases = p.targets?.production?.alias ?? []
      if (aliases.includes(domain)) return p.id
    }
    if (!data.pagination?.next) break
    until = data.pagination.next
  }
  return null
}

export async function addDomainToProject(projectId: string, domain: string) {
  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  })
  if (res.ok) return (await res.json()) as { name: string; verified: boolean }
  const msg = await readError(res)
  if (/already (exists|in use|added)/i.test(msg)) {
    // Someone attached it earlier (or we're retrying after a partial run).
    // Treat as success so we don't block the rename.
    return { name: domain, verified: false }
  }
  throw new VercelError(msg, res.status)
}

/**
 * Trigger a redeploy of the latest production deployment so the new domain
 * gets served by a fresh build (some builds bake the canonical hostname into
 * the bundle — easier to redeploy than to audit every site).
 */
export async function redeployLatestProduction(projectId: string) {
  // Find the most recent production deployment.
  const listRes = await vercelFetch(`/v6/deployments?projectId=${projectId}&target=production&limit=1&state=READY`)
  if (!listRes.ok) throw new VercelError(`List deployments failed: ${await readError(listRes)}`, listRes.status)
  const listData = (await listRes.json()) as { deployments?: { uid: string; name: string }[] }
  const dep = listData.deployments?.[0]
  if (!dep) throw new VercelError('No READY production deployment to redeploy', 404)

  const res = await vercelFetch('/v13/deployments', {
    method: 'POST',
    body: JSON.stringify({
      name: dep.name,
      deploymentId: dep.uid,
      target: 'production',
    }),
  })
  if (!res.ok) throw new VercelError(`Redeploy failed: ${await readError(res)}`, res.status)
  return (await res.json()) as { id: string; url: string }
}
