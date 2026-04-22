# Utopia Webcore — Website Tracking Guide

> **For website builder developers** who need to embed analytics tracking into generated websites.

## Quick Start

Add this **one line** to your website's `<head>` tag:

```html
<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="your-domain.vercel.app"></script>
```

Replace `your-domain.vercel.app` with the **exact domain** of the website.

That's it — pageviews are tracked automatically.

---

## What Gets Tracked Automatically

Once the script is added, these are tracked **without any extra code**:

| Event | When | Details |
|---|---|---|
| Page view | Every page load | Path, referrer, device, browser |
| SPA navigation | pushState / popstate | Path changes in single-page apps |

---

## Manual Event Tracking

Use `window.uwc()` to track custom events:

### Track WhatsApp Button Clicks

```js
// When user clicks a WhatsApp button
document.querySelector('.whatsapp-btn').addEventListener('click', function() {
  window.uwc('click', { label: 'whatsapp-60123456789' })
})
```

### Track Call Button Clicks

```js
document.querySelector('.call-btn').addEventListener('click', function() {
  window.uwc('click', { label: 'call-60123456789' })
})
```

### Track Product Impressions

```js
// When a product card is visible on screen
window.uwc('impression', { label: 'product-electric-wheelchair' })
```

### Track Blog Article Clicks

```js
// When someone clicks on a blog article link
window.uwc('click', { label: 'blog-wheelchair-shah-alam' })
```

### Track Any Custom Action

```js
// Generic format
window.uwc('click', { label: 'your-custom-label' })
window.uwc('impression', { label: 'your-custom-label' })
```

---

## API Reference

```js
window.uwc(eventType, options)
```

| Parameter | Type | Required | Values |
|---|---|---|---|
| `eventType` | string | Yes | `'click'` or `'impression'` |
| `options.label` | string | No | Any descriptive label for the event |

---

## Next.js Integration

### App Router (recommended)

Add the script to your root layout's `<head>`:

```tsx
// app/layout.tsx or app/[locale]/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <script
          defer
          src="https://utopia-webcore.vercel.app/t.js"
          data-website="your-domain.vercel.app"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Track WhatsApp in a Component

```tsx
'use client'

export function WhatsAppButton({ phoneNumber }: { phoneNumber: string }) {
  function handleClick() {
    // Track the click
    if (typeof window !== 'undefined' && window.uwc) {
      window.uwc('click', { label: `whatsapp-${phoneNumber}` })
    }
    // Open WhatsApp
    window.open(`https://wa.me/${phoneNumber}`, '_blank')
  }

  return (
    <button onClick={handleClick}>
      Chat on WhatsApp
    </button>
  )
}
```

### Track Product Card Impressions

```tsx
'use client'

import { useEffect, useRef } from 'react'

export function ProductCard({ slug, name }: { slug: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && typeof window !== 'undefined' && window.uwc) {
        window.uwc('impression', { label: `product-${slug}` })
        observer.disconnect() // Only track once
      }
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [slug])

  return (
    <div ref={ref}>
      <h3>{name}</h3>
    </div>
  )
}
```

### TypeScript Support

Add this to your `global.d.ts` or any `.d.ts` file:

```ts
declare global {
  interface Window {
    uwc: (eventType: string, options?: { label?: string }) => void
  }
}
export {}
```

---

## How the Data Appears in the Dashboard

| What you track | Where it shows in Webcore |
|---|---|
| Page views | Analytics → Pageviews stat card + chart |
| `uwc('click', ...)` | Analytics → Clicks stat card + Top Clicks list |
| `uwc('impression', ...)` | Analytics → Impressions stat card |
| Blog page views | Blog Analytics → Views column per post |
| `label: 'whatsapp-...'` | Analytics → Top Clicks → grouped by label |

---

## Best Practices

1. **Use consistent labels** — `whatsapp-{number}`, `call-{number}`, `product-{slug}`, `blog-{slug}`
2. **Track impressions once** — Use IntersectionObserver and disconnect after first trigger
3. **Don't track sensitive data** — Never include user emails, names, or IPs in labels
4. **The domain must match exactly** — `data-website="your-domain.vercel.app"` must match what's registered in Webcore
5. **The script is non-blocking** — Uses `defer` and `sendBeacon`, so it won't slow down your site

---

## Privacy

- **No cookies** — Session ID uses `sessionStorage` (cleared when tab closes)
- **IP hashed** — Raw IP is never stored, only a SHA-256 hash
- **Lightweight** — The script is ~2KB, loaded with `defer`
- **Non-blocking** — Uses `navigator.sendBeacon()` so it never blocks page load

---

## Troubleshooting

**Events not appearing in dashboard?**

1. Check browser console for errors loading `t.js`
2. Verify `data-website` matches the exact domain in Webcore
3. Open Network tab → filter by `track` → check the POST request returns 204
4. Wait a few seconds and refresh the Analytics page

**Script returns 307 redirect?**

The Webcore proxy may be blocking `/t.js`. Ensure `proxy.ts` has `/t.js` in its public exclusion list. This is already done in the latest version.

---

## Fetching Data From Webcore

Besides tracking, your website can **pull data** from Webcore so that admins can manage things in one place and your site reflects updates automatically.

### Phone Numbers (list all)

```js
// From any website, anytime
fetch('https://utopia-webcore.vercel.app/api/public/phone-numbers?website=your-domain.vercel.app')
  .then(r => r.json())
  .then(phones => {
    // [{ phone_number, whatsapp_text, type, label, location_slug }, ...]
  })
```

Optional filter by location:
```
?website=your-domain.vercel.app&location=shah-alam
```

### Phone Numbers (resolve one — respects rotation)

If your site uses rotation/hybrid mode, let the server pick the right number for you:

```js
fetch('https://utopia-webcore.vercel.app/api/public/phone-numbers/resolve?website=your-domain.vercel.app&location=shah-alam')
  .then(r => r.json())
  .then(({ phone_number, whatsapp_text }) => {
    // One chosen number, weighted by percentage
  })
```

Without `location`, it picks from numbers scoped to `all` locations.

### Blog Posts

```js
// List published posts (light payload)
fetch('https://utopia-webcore.vercel.app/api/public/blog?website=your-domain.vercel.app&language=en')
  .then(r => r.json())
  .then(posts => {
    // [{ id, slug, title, excerpt, cover_image_url, published_at, languages }, ...]
  })

// Single post with full content
fetch('https://utopia-webcore.vercel.app/api/public/blog?website=your-domain.vercel.app&slug=wheelchair-guide&language=en')
  .then(r => r.json())
  .then(post => {
    // { slug, title, content, excerpt, meta_title, meta_description, cover_image_url }
  })
```

Omit `language` on single-post fetch to get **all translations** nested under `translations: { en: {...}, ms: {...} }`.

### Products

```js
fetch('https://utopia-webcore.vercel.app/api/public/products?website=your-domain.vercel.app')
  .then(r => r.json())
  .then(products => {
    // Main products with nested sub_products and photos
  })
```

Single product by slug:
```
?website=your-domain.vercel.app&slug=electric-wheelchair
```

Flat list (no nesting):
```
?website=your-domain.vercel.app&type=all
```

### Pushing Data (requires API key)

Designers can push products, phone numbers, and blog posts back into Webcore. **One API key gates all three** — request it from your Webcore admin (scoped to one website, read/write).

```js
// Products
fetch('https://utopia-webcore.vercel.app/api/public/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'uwc_...' },
  body: JSON.stringify({
    website: 'your-domain.vercel.app',
    name: 'Electric Wheelchair',
    slug: 'electric-wheelchair',
    sale_price: 2500,
    photos: [{ url: 'https://...', alt_text: 'Side view' }],
  }),
})

// Phone numbers (the admin 'default' number is read-only from the API)
fetch('https://utopia-webcore.vercel.app/api/public/phone-numbers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'uwc_...' },
  body: JSON.stringify({
    website: 'your-domain.vercel.app',
    phone_number: '60123456789',
    whatsapp_text: 'Hi, I want to know more about…',
    location_slug: 'shah-alam',
    percentage: 50,
    label: 'Shah Alam Sales',
  }),
})

// Blog posts — translations are upserted by language on PATCH
fetch('https://utopia-webcore.vercel.app/api/public/blog', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'uwc_...' },
  body: JSON.stringify({
    website: 'your-domain.vercel.app',
    slug: 'wheelchair-buying-guide',
    status: 'published',
    cover_image_url: 'https://…',
    translations: [
      { language: 'en', title: 'Buying guide', content: '…', excerpt: '…' },
      { language: 'ms', title: 'Panduan membeli', content: '…', excerpt: '…' },
    ],
  }),
})
```

**`PATCH` and `DELETE`** use the same endpoints, with `{ id, ...fields }` in the body. For blog `PATCH`, include only the languages you want to update in `translations`; other languages stay untouched.

---

## Need Help?

Contact your admin at the Utopia Webcore dashboard or submit a ticket at `/help`.
