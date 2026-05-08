# Utopia Webcore — Product API Integration Guide

> **For website builder developers** who need to insert product data during site generation and fetch it for display.

## Base URL

```
https://webcore.utopiaai.my
```

## Authentication

Write operations (POST, PATCH, DELETE) require an API key in the header:

```
X-API-Key: uwc_your_key_here
```

Read operations (GET) are **public** — no auth needed.

> Ask your admin to generate an API key at `/api-keys` in the dashboard.
> The key is scoped to a specific website domain or `*` for all websites.

---

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. WEBSITE BUILDER (during site generation)                │
│     → Insert products into Webcore via API                  │
│     → Products appear in admin dashboard for editing        │
│                                                             │
│  2. DEPLOYED WEBSITE (at runtime)                           │
│     → Fetch products from Webcore public API                │
│     → Display on the main page                              │
│                                                             │
│  3. ADMIN (ongoing)                                         │
│     → Edit products, pricing, photos from dashboard         │
│     → Changes reflect immediately on next fetch             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Insert Products (Website Builder)

### Create a main product

```js
const res = await fetch('https://webcore.utopiaai.my/api/public/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'uwc_your_key_here'
  },
  body: JSON.stringify({
    website: 'client-site.vercel.app',   // must match the domain exactly
    name: 'Aircond Service',
    slug: 'aircond-service',             // URL-friendly, unique per website
    description: 'Complete aircond servicing for all brands',
    sale_price: 150.00,                  // optional, set null if not applicable
    rental_price: null,                  // optional
    photos: [                            // optional array
      { url: 'https://example.com/photo1.jpg', alt_text: 'Aircond unit' },
      { url: 'https://example.com/photo2.jpg', alt_text: 'Technician at work' }
    ]
  })
})

const mainProduct = await res.json()
// mainProduct.id → use this as parent_id for sub-products
```

### Create sub-products under a main product

```js
await fetch('https://webcore.utopiaai.my/api/public/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'uwc_your_key_here'
  },
  body: JSON.stringify({
    website: 'client-site.vercel.app',
    parent_id: mainProduct.id,           // ← links to the main product
    name: 'Wall Mounted Unit',
    slug: 'wall-mounted-unit',
    sale_price: 120.00,
    rental_price: 80.00,
    photos: [
      { url: 'https://example.com/wall-unit.jpg' }
    ]
  })
})
```

### Full example: Insert 1 main product + 3 sub-products

```js
const API_KEY = 'uwc_your_key_here'
const BASE = 'https://webcore.utopiaai.my/api/public/products'
const WEBSITE = 'service-aircond-kl.vercel.app'

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY
}

// 1. Create main product
const main = await fetch(BASE, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    website: WEBSITE,
    name: 'Aircond Services',
    slug: 'aircond-services',
    description: 'Professional aircond installation, repair and maintenance',
    sale_price: null,
    photos: [{ url: 'https://cdn.example.com/aircond-hero.jpg' }]
  })
}).then(r => r.json())

// 2. Create sub-products
const subProducts = [
  { name: 'Wall Mounted Unit', slug: 'wall-mounted', sale_price: 120.00, rental_price: 80.00 },
  { name: 'Ceiling Cassette', slug: 'ceiling-cassette', sale_price: 250.00, rental_price: 150.00 },
  { name: 'Portable Unit', slug: 'portable-unit', sale_price: 90.00, rental_price: 50.00 },
]

for (const sub of subProducts) {
  await fetch(BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      website: WEBSITE,
      parent_id: main.id,
      ...sub
    })
  })
}

console.log('Done! Products inserted for', WEBSITE)
```

---

## Step 2: Fetch Products (Deployed Website)

### Get all products with sub-products (nested)

```js
// Next.js example — server component or getStaticProps
const products = await fetch(
  'https://webcore.utopiaai.my/api/public/products?website=client-site.vercel.app',
  { next: { revalidate: 60 } }  // cache for 60 seconds
).then(r => r.json())
```

**Response format:**

```json
[
  {
    "id": "uuid",
    "name": "Aircond Services",
    "slug": "aircond-services",
    "description": "Professional aircond...",
    "sale_price": null,
    "rental_price": null,
    "sort_order": 0,
    "photos": [
      { "url": "https://...", "alt_text": "..." }
    ],
    "sub_products": [
      {
        "id": "uuid",
        "name": "Wall Mounted Unit",
        "slug": "wall-mounted",
        "description": null,
        "sale_price": 120.00,
        "rental_price": 80.00,
        "photos": [...]
      },
      {
        "id": "uuid",
        "name": "Ceiling Cassette",
        "slug": "ceiling-cassette",
        "sale_price": 250.00,
        "rental_price": 150.00,
        "photos": [...]
      }
    ]
  }
]
```

### Display example (React/Next.js)

```jsx
export default async function ProductSection() {
  const products = await fetch(
    'https://webcore.utopiaai.my/api/public/products?website=my-site.vercel.app',
    { next: { revalidate: 60 } }
  ).then(r => r.json())

  return (
    <section>
      {products.map(product => (
        <div key={product.id}>
          {product.photos[0] && (
            <img src={product.photos[0].url} alt={product.name} />
          )}
          <h2>{product.name}</h2>
          <p>{product.description}</p>

          {/* Sub-products */}
          {product.sub_products?.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {product.sub_products.map(sub => (
                <div key={sub.id}>
                  {sub.photos[0] && <img src={sub.photos[0].url} alt={sub.name} />}
                  <h3>{sub.name}</h3>
                  {sub.sale_price && <p>RM {sub.sale_price.toFixed(2)}</p>}
                  {sub.rental_price && <p>Rental: RM {sub.rental_price.toFixed(2)}/month</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
```

---

## Other API Options

| Endpoint | Description |
|---|---|
| `GET ?website=X` | All products, nested with sub_products |
| `GET ?website=X&type=main` | Only main products, no sub_products |
| `GET ?website=X&type=all` | Flat list (main + sub together) |
| `GET ?website=X&slug=Y` | Single product by slug |
| `POST` (with API key) | Create a product |
| `PATCH` (with API key) | Update: `{ id, name?, sale_price?, ... }` |
| `DELETE` (with API key) | Delete: `{ id }` |

---

## Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `website` | string | Yes | Must match the exact domain |
| `name` | string | Yes | Product display name |
| `slug` | string | Yes | URL-friendly, unique per website |
| `description` | string | No | Product description text |
| `sale_price` | number | No | Sale/purchase price in RM |
| `rental_price` | number | No | Monthly rental price in RM |
| `parent_id` | uuid | No | Set to a main product's ID to make this a sub-product |
| `photos` | array | No | `[{ url: "https://...", alt_text: "..." }]` |
| `sort_order` | number | No | Lower = appears first (default 0) |

---

## Rules

- **Slug must be unique per website** — you'll get a 409 error if duplicated
- **Sub-products can only go 1 level deep** — a sub-product cannot have its own sub-products
- **Only active products are returned** by the public GET endpoints
- **Photos are ordered** by sort_order (the order you insert them)
- **The API key is scoped** to a specific website or `*` for all

---

## Error Handling

```js
const res = await fetch(BASE, { method: 'POST', headers, body: JSON.stringify(data) })

if (!res.ok) {
  const error = await res.json()
  console.error(error)
  // { error: "Slug \"aircond-services\" already exists for this website" }
  // { error: "website, name, and slug are required" }
  // { error: "Invalid or unauthorized API key" }
  // { error: "Sub-products cannot have their own sub-products" }
}
```

Common status codes:
- `201` — Created successfully
- `400` — Missing required fields
- `401` — Invalid or missing API key
- `409` — Duplicate slug
- `500` — Server error

---

## Need Help?

Contact your admin at the Utopia Webcore dashboard or submit a ticket at `/help`.
