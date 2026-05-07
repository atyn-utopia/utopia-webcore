import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject, jsonSchema } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserScope } from '@/lib/getUserScope'

const ALLOWED_ROLES = new Set(['admin', 'designer', 'external_designer'])

interface SuggestionsObject { suggestions: string[] }

const responseSchema = jsonSchema<SuggestionsObject>({
  type: 'object',
  required: ['suggestions'],
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string', minLength: 10, maxLength: 80 },
    },
  },
})

interface ProfileRow {
  brand_name: string
  location: string
  keywords: string[]
}

// POST /api/seo/suggest-title
// Body: { website, path, current_title?, page_summary? }
// Returns 3–5 SEO-friendly title suggestions tailored to the site's brand
// profile + keywords, aiming for the 50–60 character sweet spot.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Malformed body' }, { status: 400 })

  const { website, path, language, current_title, page_summary } = body as Record<string, unknown>
  if (typeof website !== 'string' || !website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  const lang = typeof language === 'string' && (language === 'en' || language === 'ms' || language === 'zh') ? language : 'en'

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  // Pull the brand profile to ground suggestions in the site's vocabulary.
  // Empty profile is fine — we still get reasonable suggestions from the path.
  const service = createServiceClient()
  const { data: profile } = await service
    .from('seo_site_profile')
    .select('brand_name, location, keywords')
    .eq('website', website)
    .maybeSingle()
  const p = (profile ?? { brand_name: '', location: '', keywords: [] }) as ProfileRow

  const safePath = typeof path === 'string' && path.startsWith('/') ? path : '/'
  const safeCurrent = typeof current_title === 'string' ? current_title.slice(0, 200) : ''
  const safeSummary = typeof page_summary === 'string' ? page_summary.slice(0, 600) : ''

  const langLabel = lang === 'ms' ? 'Bahasa Malaysia' : lang === 'zh' ? 'Mandarin Chinese (Simplified)' : 'English'
  const prompt = [
    `You are an SEO writer suggesting page-title alternatives for a small business website.`,
    `Domain: ${website}`,
    `Page path: ${safePath}`,
    `Write the suggestions in ${langLabel}.`,
    p.brand_name ? `Brand name: ${p.brand_name}` : '',
    p.location ? `Location / market: ${p.location}` : '',
    p.keywords.length ? `Target keywords: ${p.keywords.join(', ')}` : '',
    safeCurrent ? `Current title: "${safeCurrent}"` : '',
    safeSummary ? `Page summary: ${safeSummary}` : '',
    ``,
    `Write 4 distinct title suggestions in ${langLabel}. Each must:`,
    `- Be 50–60 characters (Google's display sweet spot).`,
    `- Include at least one of the target keywords if any are listed.`,
    `- Mention the brand name and/or location when relevant.`,
    `- Read like a natural search-result title — no marketing fluff, no emoji, no quotes around the whole title.`,
    `- Use a separator like " | " or " — " between phrases when combining.`,
    `Return only the titles in the structured output.`,
  ].filter(Boolean).join('\n')

  try {
    const { object } = await generateObject({
      model: openai('gpt-5.4-mini'),
      schema: responseSchema,
      prompt,
      temperature: 0.7,
    })
    return NextResponse.json({ suggestions: object.suggestions })
  } catch (e) {
    return NextResponse.json({ error: `Title generation failed: ${(e as Error).message}` }, { status: 502 })
  }
}
