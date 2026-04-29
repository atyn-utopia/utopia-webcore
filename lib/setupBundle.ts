import JSZip from 'jszip'

interface BundleInput {
  domain: string
  apiKey: string
  permissions: string[]
  revalidateSecret?: string | null
}

/**
 * The paste-ready prompt designers give to their Claude agent after unzipping
 * the setup bundle. Kept in sync with the file list in downloadSetupBundle.
 */
export function kickoffPrompt(domain: string): string {
  return `I've added webcore-setup-${domain} files to this project (webcore-AGENTS.md at the root, plus lib/webcore.ts, components/WebcoreTracker.tsx, app/api/revalidate/route.ts, .env.local.example, webcore-TRACKING-GUIDE.md, and an AGENTS.md stub that points to webcore-AGENTS.md).

Please:

1. Read webcore-AGENTS.md — it has the full integration spec.
2. Handle AGENTS.md at the project root so Claude auto-loads webcore rules on future turns:
   - If AGENTS.md does NOT exist: keep the stub I added verbatim.
   - If AGENTS.md ALREADY exists (from a previous setup or template): leave the existing content intact and just append a "## Webcore integration" section that says "See webcore-AGENTS.md for the full spec."
3. Rename .env.local.example to .env.local. WEBCORE_API_KEY and WEBCORE_REVALIDATE_SECRET are already filled in; make sure .env.local is in .gitignore.
4. Add <WebcoreTracker /> to the root layout's <head>.
5. Audit the codebase for hardcoded phone numbers, WhatsApp/call buttons, products, or blog content. Replace them with calls from lib/webcore.ts (resolvePhone, fetchProducts, fetchBlog, pushProduct, etc.). These helpers are tagged for ISR — when webcore content changes, the /api/revalidate handler will flush the right tag and the next request rebuilds.
6. Wire up window.uwc() tracking on every CTA — WhatsApp, call, product cards (impression via IntersectionObserver, fire once), blog article links. Use the label conventions in webcore-AGENTS.md: whatsapp-{phone}, call-{phone}, product-{slug}, blog-{slug}.
7. After deploying, paste the deployed origin + /api/revalidate into webcore admin → website detail → Live revalidation. Verify by editing a product in webcore and refreshing the live site within ~2 seconds.
8. When done, confirm pageviews and clicks appear in the webcore admin Analytics tab for domain "${domain}".

If anything is ambiguous, re-read webcore-AGENTS.md and webcore-TRACKING-GUIDE.md before asking me.`
}

/**
 * Build and trigger a download of a "webcore-setup-{domain}.zip" containing
 * everything a designer needs to hand off to their Claude Code agent for
 * integration work:
 *
 *   AGENTS.md                         — auto-loaded stub pointing Claude at webcore-AGENTS.md
 *   webcore-AGENTS.md                 — full project instructions
 *   webcore-README.md                 — human-readable quick-start
 *   .env.local.example                — with API key + domain pre-filled
 *   lib/webcore.ts                    — typed helper for the public APIs
 *   components/WebcoreTracker.tsx     — drop-in <head> tracking script
 *   webcore-TRACKING-GUIDE.md         — full reference docs
 */
export async function downloadSetupBundle({ domain, apiKey, permissions, revalidateSecret }: BundleInput) {
  const zip = new JSZip()
  const permList = permissions.length > 0 ? permissions.join(' + ') : 'read + write'

  zip.file('AGENTS.md', agentsStub())
  zip.file('webcore-AGENTS.md', agentsMd({ domain, permList }))
  zip.file('webcore-README.md', readmeMd({ domain }))
  zip.file('.env.local.example', envExample({ domain, apiKey, revalidateSecret }))
  zip.file('lib/webcore.ts', webcoreTs({ domain }))
  zip.file('components/WebcoreTracker.tsx', trackerTsx({ domain }))
  zip.file('app/api/revalidate/route.ts', revalidateRouteTs())
  zip.file('webcore-TRACKING-GUIDE.md', trackingGuideMd())

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `webcore-setup-${domain}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Single-document version of the setup — paste-ready for any Claude surface.
 * Uses plain "=== FILE: path ===" delimiters (not fenced code blocks) so that
 * file contents with embedded code blocks don't break the outer wrapper.
 */
export function fullSetupMarkdown({ domain, apiKey, permissions, revalidateSecret }: BundleInput): string {
  const permList = permissions.length > 0 ? permissions.join(' + ') : 'read + write'
  const sep = '═'.repeat(72)
  const block = (path: string, content: string) =>
    `${sep}\nFILE: ${path}\n${sep}\n\n${content}\n\n`

  return `# Utopia Webcore setup for ${domain}

Please create the following files in my project exactly as written. Use the content between the "FILE:" delimiters verbatim. Do NOT ask me to confirm — just create them all, then do the integration work described at the bottom.

${block('webcore-AGENTS.md', agentsMd({ domain, permList }))}${block('.env.local', envExample({ domain, apiKey, revalidateSecret }))}${block('lib/webcore.ts', webcoreTs({ domain }))}${block('components/WebcoreTracker.tsx', trackerTsx({ domain }))}${block('app/api/revalidate/route.ts', revalidateRouteTs())}${block('webcore-TRACKING-GUIDE.md', trackingGuideMd())}${block('AGENTS.md (stub — merge if file already exists)', agentsStub())}${sep}
END OF FILES
${sep}

After creating the files above, do the integration:

1. Handle AGENTS.md so Claude auto-loads webcore rules on future turns:
   - If AGENTS.md does NOT exist: write the stub content from above verbatim.
   - If AGENTS.md ALREADY exists: do NOT overwrite it. Append a "## Webcore integration" section that says "See webcore-AGENTS.md for the full spec." below whatever's already there.
2. Make sure \`.env.local\` is listed in \`.gitignore\` (add the line if not).
3. Add \`<WebcoreTracker />\` to the root layout's \`<head>\`.
4. Audit the codebase for hardcoded phone numbers, WhatsApp/call buttons, products, or blog content. Replace them with calls from \`lib/webcore.ts\` (\`resolvePhone\`, \`fetchProducts\`, \`fetchBlog\`, \`pushProduct\`, etc.).
5. Wire up \`window.uwc()\` tracking on every CTA — WhatsApp, call, product cards (impression via IntersectionObserver, fire once), blog article links. Use the label conventions in webcore-AGENTS.md: \`whatsapp-{phone}\`, \`call-{phone}\`, \`product-{slug}\`, \`blog-{slug}\`.
6. When done, tell me to verify that pageviews and clicks appear in the webcore admin Analytics tab for domain "${domain}".

If anything is ambiguous, re-read webcore-AGENTS.md and webcore-TRACKING-GUIDE.md before asking me.
`
}

/* ─── File templates ────────────────────────────────────────── */

function agentsStub(): string {
  return `# Project instructions

## Webcore integration

This project integrates with **Utopia Webcore**. For the full integration spec, read [webcore-AGENTS.md](./webcore-AGENTS.md).

Key rules at a glance:

- Do NOT hardcode phone numbers, products, or blog content — fetch them via \`lib/webcore.ts\`.
- Every page loads \`<WebcoreTracker />\` in its root layout.
- Click/impression tracking uses \`window.uwc(...)\` with label conventions \`whatsapp-{phone}\`, \`call-{phone}\`, \`product-{slug}\`, \`blog-{slug}\`.
- \`WEBCORE_API_KEY\` is server-only — never imported into client components.

See \`webcore-AGENTS.md\` for roles, APIs, conventions, and Google Search Console verification steps.
`
}


function agentsMd({ domain, permList }: { domain: string; permList: string }): string {
  return `# Utopia Webcore Integration

You're helping build a website that integrates with **Utopia Webcore** — a centralized admin platform that manages phone numbers, products, and blog content across multiple sites.

## This project

- **Domain**: \`${domain}\`
- **Webcore base URL**: \`https://utopia-webcore.vercel.app\`
- **API key**: see \`.env.local\` (key variable: \`WEBCORE_API_KEY\`, permissions: ${permList})

## Non-negotiable requirements

1. **Every page MUST embed the tracking snippet** in \`<head>\`. Use \`components/WebcoreTracker.tsx\` or paste the script tag directly:
   \`\`\`html
   <script defer src="https://utopia-webcore.vercel.app/t.js" data-website="${domain}"></script>
   \`\`\`

2. **Do not hardcode phone numbers, products, or blog content.** Always fetch from the public APIs via \`lib/webcore.ts\`:
   - \`fetchPhones()\` / \`resolvePhone(location)\` — WhatsApp and call numbers
   - \`fetchProducts()\` / \`fetchProduct(slug)\` — product catalog
   - \`fetchBlog()\` / \`fetchBlogPost(slug)\` — blog posts

   These helpers use Next.js ISR with **cache tags**, not time-based revalidation. They cache forever until webcore tells this site to flush. Tags are: \`webcore-products\`, \`webcore-phones\`, \`webcore-blog\`. If you add new fetches that aren't going through \`lib/webcore.ts\`, add the matching tag yourself: \`fetch(url, { next: { tags: ['webcore-products'] } })\`.

**Writes — one API key covers all three:**
   - Products: \`pushProduct() / updateProduct(id, ...) / deleteProduct(id)\`
   - Phone numbers: \`pushPhone() / updatePhone(id, ...) / deletePhone(id)\` (the admin 'default' phone is read-only from the API — leave it alone)
   - Blog posts: \`pushBlogPost({ slug, translations, ... }) / updateBlogPost(id, ...) / deleteBlogPost(id)\` (translations are upserted per language — send just the languages you're changing)

   All writes are server-only (require \`WEBCORE_API_KEY\`). Never expose or use the key from the browser.

3. **Track user interactions** via \`window.uwc(type, { label })\`:
   - WhatsApp button click: \`window.uwc('click', { label: \\\`whatsapp-\${phone}\\\` })\`
   - Call button click: \`window.uwc('click', { label: \\\`call-\${phone}\\\` })\`
   - Product card impression (IntersectionObserver, fire once): \`window.uwc('impression', { label: \\\`product-\${slug}\\\` })\`
   - Blog article click: \`window.uwc('click', { label: \\\`blog-\${slug}\\\` })\`

## Full documentation

See \`webcore-TRACKING-GUIDE.md\` in this folder for complete API reference, event conventions, and examples.

## Label naming conventions (important for analytics dashboards)

Stick to this format so events group correctly in webcore:

| Event | Label format |
|---|---|
| WhatsApp click | \`whatsapp-{number}\` |
| Call click | \`call-{number}\` |
| Product impression | \`product-{slug}\` |
| Blog click | \`blog-{slug}\` |

## Phone CTA patterns — resolution + rotation

For WhatsApp / Call buttons, ALWAYS call \`resolvePhone()\` at click time — never at render time or build time. Caching the result would freeze one phone for everyone and break the rotation.

The resolver tries these in order (server-side):

1. Active phones at the passed \`location\` slug → weighted-random pick using the \`percentage\` field
2. Active phones at \`location_slug = 'all'\` → weighted-random pick
3. The admin \`type='default'\` row as last resort (returned with \`source: 'default_fallback'\`)

You can tell how the number was chosen from the returned \`source\` field. If you want step 3 disabled (e.g. hide the button instead of showing the default), pass \`{ noFallback: true }\`.

### Canonical WhatsApp button (click-time resolve, always works)

\`\`\`tsx
'use client'
import { resolvePhone } from '@/lib/webcore'

export function WhatsAppButton({ location }: { location?: string }) {
  async function onClick() {
    const p = await resolvePhone(location)
    if (!p) return // default fallback is on by default — null is rare (no default row configured)
    window.uwc?.('click', { label: \\\`whatsapp-\\\${p.phone_number}\\\` })
    window.open(
      \\\`https://wa.me/\\\${p.phone_number}?text=\\\${encodeURIComponent(p.whatsapp_text)}\\\`,
      '_blank',
    )
  }
  return <button onClick={onClick}>WhatsApp us</button>
}
\`\`\`

### Call button (pageview rotation — OK for tel: links)

\`tel:\` links need the number in the \`href\`, so the number is fixed for the render. Rotation still happens per page visit because \`resolvePhone()\` is called server-side on each request.

\`\`\`tsx
// app/contact/page.tsx — Server Component
import { resolvePhone } from '@/lib/webcore'

export default async function ContactPage({ params }: { params: { location?: string } }) {
  const p = await resolvePhone(params.location) // cache: 'no-store' is set in the helper
  return p ? <a href={\\\`tel:\\\${p.phone_number}\\\`}>Call {p.phone_number}</a> : null
}
\`\`\`

### Anti-patterns — do NOT do these

- ❌ \`const phone = (await fetchPhones())[0]\` — freezes first phone, kills rotation
- ❌ Baking a WhatsApp URL into static HTML at build time — same reason
- ❌ Caching \`resolvePhone()\` in a module-level variable — same reason
- ❌ Matching on \`label === 'default'\` client-side — use \`type === 'default'\` instead; labels are editable

## Live revalidation — how content stays fresh

This site has \`app/api/revalidate/route.ts\` shipped with the setup bundle. **Don't delete or modify it.** It's how webcore tells this site to flush its ISR cache when a product / phone / blog post changes in the admin.

The flow:

1. Admin edits a product in webcore → webcore POSTs to \`https://${domain}/api/revalidate\` with header \`X-Webcore-Secret: <shared>\` and body \`{ entity, tags: ['webcore-products'], website }\`.
2. The handler verifies the secret against \`WEBCORE_REVALIDATE_SECRET\` from \`.env\`, then calls \`revalidateTag('webcore-products')\`.
3. The next visitor request rebuilds the affected pages on-demand. End-to-end latency is ~1–2 seconds.

**Required setup checklist**:

- \`WEBCORE_REVALIDATE_SECRET\` MUST be set in production env (Vercel project settings, not just \`.env.local\`).
- Every webcore fetch MUST include the right \`next.tags\` (already done in \`lib/webcore.ts\`).
- After deploying, the webcore admin must paste this site's deployed URL + \`/api/revalidate\` into webcore admin → website detail → Live revalidation.
- Test by editing a product in webcore and refreshing this site within ~2s.

**Don't reintroduce time-based revalidation.** Specifically: don't put \`export const revalidate = 60\` on a page that consumes \`lib/webcore.ts\`, and don't change the \`tags:\` calls into \`revalidate:\` numbers. Time-based revalidation defeats the point — visitors will see stale content for up to N seconds even though webcore already told us to flush.

## Code style

- TypeScript strict mode everywhere
- Server-side data fetching (Server Components or route handlers) preferred for SEO
- Track clicks/impressions from client components only
- Never expose \`WEBCORE_API_KEY\` or \`WEBCORE_REVALIDATE_SECRET\` to the client bundle — both are server-only

## Google Search Console verification (optional)

If this site needs to appear in the webcore admin's Search Console card:

1. The user adds a URL-prefix property at https://search.google.com/search-console
2. Google shows a meta tag like \`<meta name="google-site-verification" content="aBcDeF123..." />\`
3. User copies ONLY the content value (\`aBcDeF123...\`) and puts it in \`.env.local\` as \`NEXT_PUBLIC_GSC_VERIFICATION=aBcDeF123...\`
4. Deploy — \`<WebcoreTracker />\` renders the meta tag automatically
5. User clicks Verify in Search Console

Alternative: if they control DNS for the domain, they can use the **Domain property** method (one TXT record covers the whole domain forever). No code change needed.

## Starting checklist

1. Add \`<WebcoreTracker />\` to the root layout
2. Replace any hardcoded phone numbers with \`resolvePhone()\` calls
3. Replace any hardcoded products with \`fetchProducts()\` calls
4. Wire up \`window.uwc()\` calls on all CTA buttons
5. Verify in webcore admin that pageviews + clicks appear in the Analytics tab
6. If the user wants GSC data, follow the verification steps above
`
}

function readmeMd({ domain }: { domain: string }): string {
  return `# Webcore Setup for ${domain}

This folder contains everything needed to integrate this website with Utopia Webcore.

## Files

- \`AGENTS.md\` — a small stub that points Claude Code at \`webcore-AGENTS.md\` (auto-loaded on every turn). If your project already has an AGENTS.md, merge — don't overwrite.
- \`webcore-AGENTS.md\` — full integration spec for Claude Code / Claude agents
- \`.env.local.example\` — environment variables template (rename to \`.env.local\`)
- \`lib/webcore.ts\` — typed helper for fetching and pushing data (uses cache tags so webcore can revalidate on demand)
- \`components/WebcoreTracker.tsx\` — drop-in component for the tracking script
- \`app/api/revalidate/route.ts\` — webhook endpoint webcore calls when content changes; flushes the matching ISR cache tag
- \`webcore-TRACKING-GUIDE.md\` — full API reference

## Quick start

1. **Copy the env file**:
   \`\`\`bash
   cp .env.local.example .env.local
   \`\`\`

2. **Move the code files** into your project (they're already organized by folder).

3. **Ask your Claude agent**:
   > "Read webcore-AGENTS.md and integrate Utopia Webcore into this project. Start by adding the tracker to the root layout, then replace any hardcoded phones/products/blog with API calls."

## Test your integration

Once running, open webcore admin → **Analytics** → filter by this domain. You should see pageviews appear within a few seconds of visiting your site.
`
}

function envExample({ domain, apiKey, revalidateSecret }: { domain: string; apiKey: string; revalidateSecret?: string | null }): string {
  const secretLine = revalidateSecret
    ? `WEBCORE_REVALIDATE_SECRET=${revalidateSecret}`
    : `# WEBCORE_REVALIDATE_SECRET=  # ask the webcore admin to enable Live revalidation for this site, then paste the secret here`
  return `# Utopia Webcore

# API key — keep secret, never commit .env.local to git.
WEBCORE_API_KEY=${apiKey}

# This site's registered domain in webcore. Must match exactly.
NEXT_PUBLIC_WEBCORE_DOMAIN=${domain}

# Shared secret used by webcore to authenticate revalidation pings.
# When products / phones / blog change in webcore, webcore POSTs to
# /api/revalidate on this site with the X-Webcore-Secret header.
${secretLine}

# Google Search Console verification code (optional).
# Get it from https://search.google.com/search-console after adding a
# URL-prefix property. Paste ONLY the "content" value from the meta tag,
# not the whole <meta> element. <WebcoreTracker /> will render it for you.
# NEXT_PUBLIC_GSC_VERIFICATION=

# Base URL (shouldn't need to change)
WEBCORE_BASE_URL=https://utopia-webcore.vercel.app
`
}

function webcoreTs({ domain }: { domain: string }): string {
  return `/**
 * Utopia Webcore — typed client for ${domain}
 *
 * Server-side functions use WEBCORE_API_KEY (never exposed to the browser).
 * Client-safe read functions only need the domain.
 */

const BASE = process.env.WEBCORE_BASE_URL ?? 'https://utopia-webcore.vercel.app'
const SITE = process.env.NEXT_PUBLIC_WEBCORE_DOMAIN ?? '${domain}'

/* ─── Types ─────────────────────────────────────────────────── */

export interface PhoneNumber {
  phone_number: string
  whatsapp_text: string
  type: 'default' | 'custom' | 'location' | string
  label: string | null
  location_slug: string
  /** Populated by resolvePhone — tells you how the number was chosen. */
  source?: 'location' | 'all' | 'default_fallback'
}

export interface ProductPhoto {
  url: string
  alt_text: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  sale_price: number | null
  rental_price: number | null
  sort_order: number
  photos: ProductPhoto[]
  sub_products?: Product[]
}

export interface BlogPostSummary {
  id: string
  slug: string
  title: string
  excerpt: string
  cover_image_url: string | null
  published_at: string
  updated_at: string
  language: string | null
  languages: string[]
}

export interface BlogPost {
  id: string
  website: string
  slug: string
  cover_image_url: string | null
  published_at: string
  updated_at: string
  language?: string
  title?: string
  content?: string
  excerpt?: string
  meta_title?: string
  meta_description?: string
  languages?: string[]
  translations?: Record<string, {
    title: string
    content: string
    excerpt: string
    meta_title: string
    meta_description: string
  }>
}

/* ─── Reads (no auth required) ──────────────────────────────── */
//
// All cached reads use Next.js ISR with TAGS, not time-based revalidation.
// Webcore POSTs to /api/revalidate when content changes; that handler calls
// revalidateTag(...) and the next request rebuilds. Cached forever in between.
//
// Tag conventions (must match what /api/revalidate handles):
//   webcore-phones    — phone numbers
//   webcore-products  — products
//   webcore-blog      — blog posts

/** Fetch all active phone numbers. Optionally filter by location slug. */
export async function fetchPhones(location?: string): Promise<PhoneNumber[]> {
  const url = new URL(\`\${BASE}/api/public/phone-numbers\`)
  url.searchParams.set('website', SITE)
  if (location) url.searchParams.set('location', location)
  const res = await fetch(url, { next: { tags: ['webcore-phones'] } })
  if (!res.ok) return []
  return res.json()
}

/**
 * Resolve a single phone number for a CTA button.
 *
 * Resolution order (server-side):
 *   1. Active phones with location_slug = <location> (weighted random)
 *   2. Active phones with location_slug = 'all' (weighted random)
 *   3. Last resort: the admin 'default' row (returned with source='default_fallback')
 *
 * Always call this at click time with { cache: 'no-store' } so rotation
 * distributes across users. Never bake the result into server-rendered HTML
 * or cache it — that freezes one phone for everyone.
 *
 * Pass \`{ noFallback: true }\` if you want null back instead of the default row
 * (e.g. you want to hide the button entirely when nothing matches).
 */
export async function resolvePhone(
  location?: string,
  options?: { noFallback?: boolean },
): Promise<PhoneNumber | null> {
  const url = new URL(\`\${BASE}/api/public/phone-numbers/resolve\`)
  url.searchParams.set('website', SITE)
  if (location) url.searchParams.set('location', location)
  if (options?.noFallback) url.searchParams.set('fallback_default', '0')
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

/** Fetch all active products (nested main + sub products). */
export async function fetchProducts(): Promise<Product[]> {
  const url = new URL(\`\${BASE}/api/public/products\`)
  url.searchParams.set('website', SITE)
  const res = await fetch(url, { next: { tags: ['webcore-products'] } })
  if (!res.ok) return []
  return res.json()
}

/** Fetch a single product by slug (includes sub_products). */
export async function fetchProduct(slug: string): Promise<Product | null> {
  const url = new URL(\`\${BASE}/api/public/products\`)
  url.searchParams.set('website', SITE)
  url.searchParams.set('slug', slug)
  const res = await fetch(url, { next: { tags: ['webcore-products'] } })
  if (!res.ok) return null
  return res.json()
}

/** Fetch published blog posts (light payload, no full content). */
export async function fetchBlog(language?: string): Promise<BlogPostSummary[]> {
  const url = new URL(\`\${BASE}/api/public/blog\`)
  url.searchParams.set('website', SITE)
  if (language) url.searchParams.set('language', language)
  const res = await fetch(url, { next: { tags: ['webcore-blog'] } })
  if (!res.ok) return []
  return res.json()
}

/** Fetch a single blog post with full content. Omit language to get all translations. */
export async function fetchBlogPost(slug: string, language?: string): Promise<BlogPost | null> {
  const url = new URL(\`\${BASE}/api/public/blog\`)
  url.searchParams.set('website', SITE)
  url.searchParams.set('slug', slug)
  if (language) url.searchParams.set('language', language)
  const res = await fetch(url, { next: { tags: ['webcore-blog'] } })
  if (!res.ok) return null
  return res.json()
}

/* ─── Writes (server-only, need WEBCORE_API_KEY) ────────────── */
/* One API key gates every write endpoint below. The key is scoped per
 * website in webcore, so it can only affect this site's data. */

async function writeJson<T = unknown>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>): Promise<T | { error: string }> {
  const apiKey = process.env.WEBCORE_API_KEY
  if (!apiKey) return { error: 'WEBCORE_API_KEY not set' }

  const res = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ website: SITE, ...body }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error ?? \`\${method} \${path} failed with \${res.status}\` }
  }
  return res.json() as Promise<T>
}

// ── Products ──

interface PushProductInput {
  name: string
  slug: string
  description?: string
  sale_price?: number
  rental_price?: number
  parent_id?: string
  photos?: { url: string; alt_text?: string }[]
}

/** SERVER-ONLY. Create a product. */
export async function pushProduct(input: PushProductInput) {
  return writeJson<{ id: string }>('/api/public/products', 'POST', input)
}

/** SERVER-ONLY. Update a product by id. */
export async function updateProduct(id: string, fields: Partial<PushProductInput> & { is_active?: boolean }) {
  return writeJson('/api/public/products', 'PATCH', { id, ...fields })
}

/** SERVER-ONLY. Delete a product by id. */
export async function deleteProduct(id: string) {
  return writeJson<{ success: boolean }>('/api/public/products', 'DELETE', { id })
}

// ── Phone Numbers ──

interface PushPhoneInput {
  phone_number: string
  whatsapp_text: string
  location_slug?: string
  percentage?: number
  label?: string
}

/** SERVER-ONLY. Create a phone number. Admin manages the 'default' phone. */
export async function pushPhone(input: PushPhoneInput) {
  return writeJson<PhoneNumber & { id: string }>('/api/public/phone-numbers', 'POST', input)
}

/** SERVER-ONLY. Update a phone by id. Can't edit the admin 'default' phone. */
export async function updatePhone(id: string, fields: Partial<PushPhoneInput> & { is_active?: boolean }) {
  return writeJson('/api/public/phone-numbers', 'PATCH', { id, ...fields })
}

/** SERVER-ONLY. Delete a phone by id. Can't delete the admin 'default' phone. */
export async function deletePhone(id: string) {
  return writeJson<{ success: boolean }>('/api/public/phone-numbers', 'DELETE', { id })
}

// ── Blog Posts ──

interface BlogTranslationInput {
  language: string
  title: string
  content?: string
  excerpt?: string
  meta_title?: string
  meta_description?: string
}

interface PushBlogInput {
  slug: string
  status?: 'draft' | 'published'
  cover_image_url?: string
  translations: BlogTranslationInput[]
}

/** SERVER-ONLY. Create a blog post with one or more translations. */
export async function pushBlogPost(input: PushBlogInput) {
  return writeJson<BlogPost>('/api/public/blog', 'POST', input as unknown as Record<string, unknown>)
}

/**
 * SERVER-ONLY. Update a blog post.
 * Any translations in the body are upserted by language — passing just one
 * language leaves the others untouched.
 */
export async function updateBlogPost(
  id: string,
  fields: Partial<{ slug: string; status: 'draft' | 'published'; cover_image_url: string; translations: BlogTranslationInput[] }>,
) {
  return writeJson('/api/public/blog', 'PATCH', { id, ...fields })
}

/** SERVER-ONLY. Delete a blog post (and its translations). */
export async function deleteBlogPost(id: string) {
  return writeJson<{ success: boolean }>('/api/public/blog', 'DELETE', { id })
}

/* ─── Client-side tracking helpers ──────────────────────────── */

declare global {
  interface Window {
    uwc?: (eventType: 'click' | 'impression', options?: { label?: string }) => void
  }
}

export function trackWhatsApp(phoneNumber: string) {
  if (typeof window !== 'undefined' && window.uwc) {
    window.uwc('click', { label: \`whatsapp-\${phoneNumber}\` })
  }
}

export function trackCall(phoneNumber: string) {
  if (typeof window !== 'undefined' && window.uwc) {
    window.uwc('click', { label: \`call-\${phoneNumber}\` })
  }
}

export function trackProductImpression(slug: string) {
  if (typeof window !== 'undefined' && window.uwc) {
    window.uwc('impression', { label: \`product-\${slug}\` })
  }
}

export function trackBlogClick(slug: string) {
  if (typeof window !== 'undefined' && window.uwc) {
    window.uwc('click', { label: \`blog-\${slug}\` })
  }
}
`
}

function revalidateRouteTs(): string {
  return `import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * Webcore revalidation webhook.
 *
 * When products / phone numbers / blog posts change in the webcore admin,
 * webcore POSTs here. We verify the shared secret, then call
 * revalidateTag(...) to flush this site's ISR cache for that content type.
 *
 * The matching tags must be set on every webcore fetch in lib/webcore.ts:
 *   webcore-products, webcore-phones, webcore-blog
 *
 * Body:    { entity: 'product' | 'phone_number' | 'blog_post', tags: string[], website: string }
 * Header:  X-Webcore-Secret: <shared secret>
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-webcore-secret')
  const expected = process.env.WEBCORE_REVALIDATE_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'WEBCORE_REVALIDATE_SECRET not set on this site' }, { status: 500 })
  }
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tags } = (await request.json().catch(() => ({}))) as { tags?: string[] }
  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: 'tags array required' }, { status: 400 })
  }

  for (const tag of tags) revalidateTag(tag)
  return NextResponse.json({ revalidated: tags })
}
`
}

function trackerTsx({ domain }: { domain: string }): string {
  return `/**
 * Drop-in webcore tracker. Place inside the root layout's <head>:
 *
 *   import WebcoreTracker from '@/components/WebcoreTracker'
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html>
 *         <head><WebcoreTracker /></head>
 *         <body>{children}</body>
 *       </html>
 *     )
 *   }
 *
 * Also renders the Google Search Console verification meta tag if
 * NEXT_PUBLIC_GSC_VERIFICATION is set in .env.local. That lets you verify
 * ownership of this site in Search Console by pasting ONE env var — no
 * need to touch layout code.
 */
export default function WebcoreTracker() {
  const domain = process.env.NEXT_PUBLIC_WEBCORE_DOMAIN ?? '${domain}'
  const gscVerification = process.env.NEXT_PUBLIC_GSC_VERIFICATION

  return (
    <>
      {gscVerification && <meta name="google-site-verification" content={gscVerification} />}
      <script
        defer
        src="https://utopia-webcore.vercel.app/t.js"
        data-website={domain}
      />
    </>
  )
}
`
}

function trackingGuideMd(): string {
  return `# Utopia Webcore — Integration Reference

## Tracking Script

Add to every page's \`<head>\`:

\`\`\`html
<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="YOUR-DOMAIN"></script>
\`\`\`

Pageviews and SPA navigation are tracked automatically.

## Manual Event Tracking

\`\`\`js
window.uwc('click', { label: 'whatsapp-60123456789' })
window.uwc('click', { label: 'call-60123456789' })
window.uwc('impression', { label: 'product-electric-wheelchair' })
window.uwc('click', { label: 'blog-wheelchair-guide' })
\`\`\`

## Public Read APIs (no auth)

### Phone Numbers

\`\`\`
GET /api/public/phone-numbers?website=YOUR-DOMAIN
GET /api/public/phone-numbers?website=YOUR-DOMAIN&location=shah-alam
GET /api/public/phone-numbers/resolve?website=YOUR-DOMAIN&location=shah-alam
\`\`\`

The \`/resolve\` endpoint returns ONE phone number, weighted by rotation percentage, falling back from specific location to \`all\`.

### Products

\`\`\`
GET /api/public/products?website=YOUR-DOMAIN                      # nested
GET /api/public/products?website=YOUR-DOMAIN&slug=wheelchair      # single
GET /api/public/products?website=YOUR-DOMAIN&type=all             # flat list
\`\`\`

### Blog

\`\`\`
GET /api/public/blog?website=YOUR-DOMAIN                          # list
GET /api/public/blog?website=YOUR-DOMAIN&language=en              # list, preferred lang
GET /api/public/blog?website=YOUR-DOMAIN&slug=my-post             # single, all translations
GET /api/public/blog?website=YOUR-DOMAIN&slug=my-post&language=ms # single, flat
\`\`\`

## Write APIs (require API key via \`X-API-Key\` header)

One API key (scoped to the website) gates all three endpoints.

### Products

\`\`\`
POST   /api/public/products         { website, name, slug, sale_price?, rental_price?, photos?: [...] }
PATCH  /api/public/products         { id, ...fields }
DELETE /api/public/products         { id }
\`\`\`

### Phone numbers

\`\`\`
POST   /api/public/phone-numbers    { website, phone_number, whatsapp_text, location_slug?, percentage?, label? }
PATCH  /api/public/phone-numbers    { id, ...fields }    # admin 'default' phone is read-only here
DELETE /api/public/phone-numbers    { id }               # same — can't delete the 'default'
\`\`\`

### Blog posts

\`\`\`
POST   /api/public/blog             { website, slug, status?='draft', cover_image_url?, translations: [{language,title,content,...}] }
PATCH  /api/public/blog             { id, ...postFields, translations?: [...] }   # translations upsert by language
DELETE /api/public/blog             { id }
\`\`\`

## Label Conventions

Stick to these so analytics group correctly:

- \`whatsapp-{phone}\`
- \`call-{phone}\`
- \`product-{slug}\`
- \`blog-{slug}\`

## Live revalidation webhook

Webcore POSTs to your site whenever a product / phone / blog post changes:

\`\`\`
POST https://YOUR-DOMAIN/api/revalidate
Header: X-Webcore-Secret: <value of WEBCORE_REVALIDATE_SECRET>
Body:   { "entity": "product" | "phone_number" | "blog_post",
          "tags": ["webcore-products"],
          "website": "YOUR-DOMAIN" }
\`\`\`

The handler that ships in \`app/api/revalidate/route.ts\` verifies the header and calls \`revalidateTag(...)\`. As long as your fetches in \`lib/webcore.ts\` include the matching \`next.tags\`, the next request rebuilds with fresh data.

To enable: webcore admin pastes your deployed URL + \`/api/revalidate\` into the website's "Live revalidation" panel.

## Privacy & Performance

- Script is ~2KB, loaded with \`defer\`
- Uses \`sessionStorage\` (no cookies)
- IP is hashed before storage
- Events sent via \`navigator.sendBeacon\` (non-blocking)
`
}
