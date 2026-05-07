/**
 * Match a URL path against a glob pattern with a single `*` wildcard.
 *
 *   pattern: /aircond-service-*
 *   path:    /aircond-service-shah-alam
 *   → returns 'shah-alam'
 *
 * Returns null if the pattern doesn't match. The pattern is anchored at
 * both ends so `/aircond-service-*` does NOT match `/foo/aircond-service-kl`.
 *
 * The wildcard is non-greedy across `/` segments — it captures exactly the
 * portion between the pattern's literal prefix and suffix. This means
 * patterns like `/products/*` capture full sub-paths (e.g. `kl/aircond`).
 */
export function matchPattern(pattern: string, path: string): string | null {
  if (!pattern.includes('*')) {
    return pattern === path ? '' : null
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)')
  const re = new RegExp(`^${escaped}$`)
  const m = path.match(re)
  return m ? (m[1] ?? '') : null
}

/**
 * Group a list of paths into pattern suggestions. Detects:
 *
 *   - sibling slugs under a shared parent: /products/a, /products/b → /products/*
 *   - hyphenated suffix variants: /aircond-service-kl, /aircond-service-pj
 *     → /aircond-service-*
 *
 * Returns groups with >= MIN_MEMBERS members, sorted by match count desc.
 * Excludes patterns that are already covered by an existing exact override
 * or by an existing pattern (the caller passes those in to filter against).
 */
const MIN_MEMBERS = 3

export function suggestPatterns(
  paths: string[],
  existingExactPaths: Set<string> = new Set(),
  existingPatterns: string[] = [],
): { pattern: string; matches: string[] }[] {
  const groups = new Map<string, Set<string>>()

  for (const p of paths) {
    if (p === '/' || existingExactPaths.has(p)) continue

    const lastSlash = p.lastIndexOf('/')
    if (lastSlash > 0 && lastSlash < p.length - 1) {
      const prefix = p.slice(0, lastSlash + 1) + '*'
      if (!groups.has(prefix)) groups.set(prefix, new Set())
      groups.get(prefix)!.add(p)
    }

    const lastHyphen = p.lastIndexOf('-')
    if (lastHyphen > lastSlash && lastHyphen < p.length - 1) {
      const prefix = p.slice(0, lastHyphen + 1) + '*'
      if (!groups.has(prefix)) groups.set(prefix, new Set())
      groups.get(prefix)!.add(p)
    }
  }

  const out: { pattern: string; matches: string[] }[] = []
  for (const [pattern, matches] of groups) {
    if (matches.size < MIN_MEMBERS) continue
    if (existingPatterns.includes(pattern)) continue
    out.push({ pattern, matches: [...matches].sort() })
  }
  return out.sort((a, b) => b.matches.length - a.matches.length)
}

/**
 * Substitute the {match} placeholder in a template with the captured value,
 * formatted as Title Case (kebab-case → Title Case). Idempotent if the
 * template has no placeholder.
 *
 *   template: "{match} Aircond Service | Brand"
 *   capture:  "shah-alam"
 *   → "Shah Alam Aircond Service | Brand"
 */
export function substituteMatch(template: string | null, capture: string): string | null {
  if (!template) return template
  if (!template.includes('{match}')) return template
  const titleCased = capture
    .split(/[-_]+/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
  return template.replace(/\{match\}/g, titleCased)
}
