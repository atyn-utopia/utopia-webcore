# Utopia Webcore

Admin dashboard and data platform that powers the websites we build for clients. One place to manage companies, sites, phone numbers, blog posts, products, analytics, and API access — so designers and external partners can self-serve without touching the code.

Production: **https://utopia-webcore.vercel.app**

## What lives here

- **Websites** — company → website → single-site drill-down with live screenshot preview, on-site analytics, and a Google Search Console panel.
- **Phone Numbers** — inline-editable Manage page with four lead-distribution modes (Single / Rotation / Location / Hybrid), percentage distribution enforced at 100%, and a WhatsApp preview per row.
- **Blog Analytics** — TipTap editor, per-post views/clicks/impressions with trend arrows.
- **Products** — parent-child hierarchy, photos, audit log, public read API for the front-end sites to consume.
- **API Keys** — 5-hour grace window on creation, auto-expire if unused, copy-ready Claude setup doc, history dropdown for expired/revoked keys.
- **Analytics** — self-hosted `t.js` tracking script + dashboard with daily insights, trend indicators, and site-vs-site comparison (up to 3).
- **Audit Trail** — every mutation logged with diff; widened to products and websites.
- **Coxy** — in-app AI chat assistant (mascot + chatbox) with route-aware positioning and strict guardrails.

## Stack

- **Next.js 16** (App Router, Turbopack) on **React 19**
- **Supabase** — Postgres + auth + service-role writes via `lib/supabase/`
- **TipTap** for rich text
- **Vercel AI SDK** (`@ai-sdk/openai`) powering Coxy
- **Tailwind CSS v4** for styling

> Note on Next.js: this is a recent major; some APIs differ from older tutorials. See `AGENTS.md`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Required env vars (in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=                   # for Coxy
GOOGLE_CLIENT_ID=                 # for Search Console OAuth
GOOGLE_CLIENT_SECRET=
```

## Project layout

```
app/
  (admin)/                Authenticated admin pages — websites, blog, products,
                          phone-numbers, api-keys, analytics, audit, users, help
  api/                    Route handlers — admin mutations + public read APIs
                          (public/products, analytics, integrations/gsc/*)
  auth/                   Sign-in flow
components/               Shared UI (PageHeader, AdminShell, Breadcrumb, Coxy, charts)
contexts/                 Toast, Confirm, Language, User, Website
lib/                      Supabase clients, validators, integration helpers
public/t.js               Tracking script served to client sites
supabase-*.sql            Schema + migrations (run in Supabase SQL editor)
```

## Deployment

Vercel auto-deploys `main`. If the Git webhook is stale, trigger a manual deploy:

```bash
vercel --prod --yes
```

The Supabase migrations in `supabase-migration-*.sql` are applied manually via the Supabase SQL editor in order; `supabase-schema.sql` is the consolidated baseline.

## Integrations

- **Tracking script** — sites embed `<script defer src="https://utopia-webcore.vercel.app/t.js" data-website="example.com"></script>` in `<head>`.
- **Public Product API** — read-only, authenticated via website-scoped API key. See `docs/` for the integration guide.
- **Google Search Console** — OAuth on each website's L3 page; backfills clicks/impressions/queries into the analytics panel.
- **Claude Code handoff** — API key creation surfaces a single paste-ready markdown doc so any Claude can wire up a designer's website end-to-end.

## Roles

`admin`, `designer`, `external_designer`, `writer` — each role scopes what API routes return and what pages are reachable (see `lib/getUserScope.ts`).
