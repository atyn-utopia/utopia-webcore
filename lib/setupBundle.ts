import JSZip from 'jszip'

interface BundleInput {
  domain: string
  apiKey: string
  permissions: string[]
}

/**
 * The paste-ready prompt designers give to their Claude agent after unzipping
 * the setup bundle. Kept in sync with the file list in downloadSetupBundle.
 */
export function kickoffPrompt(domain: string): string {
  return `I've added webcore-setup-${domain} files to this project (AGENTS.md at the root, plus lib/webcore.ts, components/WebcoreTracker.tsx, .env.local.example, and TRACKING-GUIDE.md).

Please:

1. Read AGENTS.md — it has the full integration spec.
2. Rename .env.local.example to .env.local. The WEBCORE_API_KEY is already filled in; make sure .env.local is in .gitignore.
3. Add <WebcoreTracker /> to the root layout's <head>.
4. Audit the codebase for hardcoded phone numbers, WhatsApp/call buttons, products, or blog content. Replace them with calls from lib/webcore.ts (resolvePhone, fetchProducts, fetchBlog, pushProduct, etc.).
5. Wire up window.uwc() tracking on every CTA — WhatsApp, call, product cards (impression via IntersectionObserver, fire once), blog article links. Use the label conventions in AGENTS.md: whatsapp-{phone}, call-{phone}, product-{slug}, blog-{slug}.
6. When done, confirm pageviews and clicks appear in the webcore admin Analytics tab for domain "${domain}".

If anything is ambiguous, re-read AGENTS.md and TRACKING-GUIDE.md before asking me.`
}

/**
 * Build and trigger a download of a "webcore-setup-{domain}.zip" containing
 * everything a designer needs to hand off to their Claude Code agent for
 * integration work:
 *
 *   AGENTS.md                  — project instructions Claude reads automatically
 *   README.md                  — human-readable quick-start
 *   .env.local.example         — with API key + domain pre-filled
 *   lib/webcore.ts             — typed helper for the public APIs
 *   components/WebcoreTracker.tsx — drop-in <head> tracking script
 *   TRACKING-GUIDE.md          — full reference docs
 */
export async function downloadSetupBundle({ domain, apiKey, permissions }: BundleInput) {
  const zip = new JSZip()
  const permList = permissions.length > 0 ? permissions.join(' + ') : 'read + write'

  zip.file('AGENTS.md', agentsMd({ domain, permList }))
  zip.file('README.md', readmeMd({ domain }))
  zip.file('.env.local.example', envExample({ domain, apiKey }))
  zip.file('lib/webcore.ts', webcoreTs({ domain }))
  zip.file('components/WebcoreTracker.tsx', trackerTsx({ domain }))
  zip.file('TRACKING-GUIDE.md', trackingGuideMd())

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
export function fullSetupMarkdown({ domain, apiKey, permissions }: BundleInput): string {
  const permList = permissions.length > 0 ? permissions.join(' + ') : 'read + write'
  const sep = '═'.repeat(72)
  const block = (path: string, content: string) =>
    `${sep}\nFILE: ${path}\n${sep}\n\n${content}\n\n`

  return `# Utopia Webcore setup for ${domain}

Please create the following files in my project exactly as written. Use the content between the "FILE:" delimiters verbatim. Do NOT ask me to confirm — just create them all, then do the integration work described at the bottom.

${block('AGENTS.md', agentsMd({ domain, permList }))}${block('.env.local', envExample({ domain, apiKey }))}${block('lib/webcore.ts', webcoreTs({ domain }))}${block('components/WebcoreTracker.tsx', trackerTsx({ domain }))}${block('TRACKING-GUIDE.md', trackingGuideMd())}${sep}
END OF FILES
${sep}

After creating the files above, do the integration:

1. Make sure \`.env.local\` is listed in \`.gitignore\` (add the line if not).
2. Add \`<WebcoreTracker />\` to the root layout's \`<head>\`.
3. Audit the codebase for hardcoded phone numbers, WhatsApp/call buttons, products, or blog content. Replace them with calls from \`lib/webcore.ts\` (\`resolvePhone\`, \`fetchProducts\`, \`fetchBlog\`, \`pushProduct\`, etc.).
4. Wire up \`window.uwc()\` tracking on every CTA — WhatsApp, call, product cards (impression via IntersectionObserver, fire once), blog article links. Use the label conventions in AGENTS.md: \`whatsapp-{phone}\`, \`call-{phone}\`, \`product-{slug}\`, \`blog-{slug}\`.
5. When done, tell me to verify that pageviews and clicks appear in the webcore admin Analytics tab for domain "${domain}".

If anything is ambiguous, re-read AGENTS.md and TRACKING-GUIDE.md before asking me.
`
}

/* ─── File templates ────────────────────────────────────────── */

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
   - \`pushProduct(...)\` — write new/updated products back to webcore (requires write permission)

3. **Track user interactions** via \`window.uwc(type, { label })\`:
   - WhatsApp button click: \`window.uwc('click', { label: \\\`whatsapp-\${phone}\\\` })\`
   - Call button click: \`window.uwc('click', { label: \\\`call-\${phone}\\\` })\`
   - Product card impression (IntersectionObserver, fire once): \`window.uwc('impression', { label: \\\`product-\${slug}\\\` })\`
   - Blog article click: \`window.uwc('click', { label: \\\`blog-\${slug}\\\` })\`

## Full documentation

See \`TRACKING-GUIDE.md\` in this folder for complete API reference, event conventions, and examples.

## Label naming conventions (important for analytics dashboards)

Stick to this format so events group correctly in webcore:

| Event | Label format |
|---|---|
| WhatsApp click | \`whatsapp-{number}\` |
| Call click | \`call-{number}\` |
| Product impression | \`product-{slug}\` |
| Blog click | \`blog-{slug}\` |

## Code style

- TypeScript strict mode everywhere
- Server-side data fetching (Server Components or route handlers) preferred for SEO
- Track clicks/impressions from client components only
- Never expose \`WEBCORE_API_KEY\` to the client bundle — it's server-only

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

- \`AGENTS.md\` — instructions for Claude Code / Claude agents (auto-loaded)
- \`.env.local.example\` — environment variables template (rename to \`.env.local\`)
- \`lib/webcore.ts\` — typed helper for fetching and pushing data
- \`components/WebcoreTracker.tsx\` — drop-in component for the tracking script
- \`TRACKING-GUIDE.md\` — full API reference

## Quick start

1. **Copy the env file**:
   \`\`\`bash
   cp .env.local.example .env.local
   \`\`\`

2. **Move the code files** into your project (they're already organized by folder).

3. **Ask your Claude agent**:
   > "Read AGENTS.md and integrate Utopia Webcore into this project. Start by adding the tracker to the root layout, then replace any hardcoded phones/products/blog with API calls."

Claude will read \`AGENTS.md\` automatically and handle the rest.

## Test your integration

Once running, open webcore admin → **Analytics** → filter by this domain. You should see pageviews appear within a few seconds of visiting your site.
`
}

function envExample({ domain, apiKey }: { domain: string; apiKey: string }): string {
  return `# Utopia Webcore

# API key — keep secret, never commit .env.local to git.
WEBCORE_API_KEY=${apiKey}

# This site's registered domain in webcore. Must match exactly.
NEXT_PUBLIC_WEBCORE_DOMAIN=${domain}

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

/** Fetch all active phone numbers. Optionally filter by location slug. */
export async function fetchPhones(location?: string): Promise<PhoneNumber[]> {
  const url = new URL(\`\${BASE}/api/public/phone-numbers\`)
  url.searchParams.set('website', SITE)
  if (location) url.searchParams.set('location', location)
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return []
  return res.json()
}

/** Resolve a single phone number (respects rotation / location / hybrid modes). */
export async function resolvePhone(location?: string): Promise<PhoneNumber | null> {
  const url = new URL(\`\${BASE}/api/public/phone-numbers/resolve\`)
  url.searchParams.set('website', SITE)
  if (location) url.searchParams.set('location', location)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

/** Fetch all active products (nested main + sub products). */
export async function fetchProducts(): Promise<Product[]> {
  const url = new URL(\`\${BASE}/api/public/products\`)
  url.searchParams.set('website', SITE)
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []
  return res.json()
}

/** Fetch a single product by slug (includes sub_products). */
export async function fetchProduct(slug: string): Promise<Product | null> {
  const url = new URL(\`\${BASE}/api/public/products\`)
  url.searchParams.set('website', SITE)
  url.searchParams.set('slug', slug)
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return null
  return res.json()
}

/** Fetch published blog posts (light payload, no full content). */
export async function fetchBlog(language?: string): Promise<BlogPostSummary[]> {
  const url = new URL(\`\${BASE}/api/public/blog\`)
  url.searchParams.set('website', SITE)
  if (language) url.searchParams.set('language', language)
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []
  return res.json()
}

/** Fetch a single blog post with full content. Omit language to get all translations. */
export async function fetchBlogPost(slug: string, language?: string): Promise<BlogPost | null> {
  const url = new URL(\`\${BASE}/api/public/blog\`)
  url.searchParams.set('website', SITE)
  url.searchParams.set('slug', slug)
  if (language) url.searchParams.set('language', language)
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return null
  return res.json()
}

/* ─── Writes (server-only, need WEBCORE_API_KEY) ────────────── */

interface PushProductInput {
  name: string
  slug: string
  description?: string
  sale_price?: number
  rental_price?: number
  parent_id?: string
  photos?: { url: string; alt_text?: string }[]
}

/** SERVER-ONLY. Pushes a new product. Uses WEBCORE_API_KEY from env. */
export async function pushProduct(input: PushProductInput): Promise<{ id: string } | { error: string }> {
  const apiKey = process.env.WEBCORE_API_KEY
  if (!apiKey) return { error: 'WEBCORE_API_KEY not set' }

  const res = await fetch(\`\${BASE}/api/public/products\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ website: SITE, ...input }),
  })
  if (!res.ok) return { error: (await res.json()).error ?? 'Unknown error' }
  return res.json()
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

### Create / Update / Delete a product

\`\`\`
POST   /api/public/products    { website, name, slug, sale_price, photos: [...] }
PATCH  /api/public/products    { id, ...fields }
DELETE /api/public/products    { id }
\`\`\`

## Label Conventions

Stick to these so analytics group correctly:

- \`whatsapp-{phone}\`
- \`call-{phone}\`
- \`product-{slug}\`
- \`blog-{slug}\`

## Privacy & Performance

- Script is ~2KB, loaded with \`defer\`
- Uses \`sessionStorage\` (no cookies)
- IP is hashed before storage
- Events sent via \`navigator.sendBeacon\` (non-blocking)
`
}
