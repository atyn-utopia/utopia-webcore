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
