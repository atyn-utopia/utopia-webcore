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
      maxItems: 4,
      items: { type: 'string', minLength: 4, maxLength: 90 },
    },
  },
})

interface ProfileRow {
  brand_name: string
  location: string
  keywords: string[]
}

// POST /api/seo/suggest-heading
// Body: { website, level, current_heading, language? }
// Returns 3-4 alternative phrasings for an h2/h3 heading. Output goes into
// the designer's code, not into a runtime override — heading structure is too
// fragile to rewrite at runtime. The UI offers these as copy-pasteable
// suggestions next to the existing heading text.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Malformed body' }, { status: 400 })
  const { website, level, current_heading, language } = body as Record<string, unknown>

  if (typeof website !== 'string' || !website) return NextResponse.json({ error: 'website is required' }, { status: 400 })
  if (typeof current_heading !== 'string' || !current_heading.trim()) return NextResponse.json({ error: 'current_heading is required' }, { status: 400 })
  const lvl = level === 3 ? 3 : 2
  const lang = typeof language === 'string' && (language === 'en' || language === 'ms') ? language : 'en'

  const scope = await getUserScope(user.id)
  if (!ALLOWED_ROLES.has(scope.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
    return NextResponse.json({ error: 'Forbidden for this website' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('seo_site_profile')
    .select('brand_name, location, keywords')
    .eq('website', website)
    .maybeSingle()
  const p = (profile ?? { brand_name: '', location: '', keywords: [] }) as ProfileRow

  const langLabel = lang === 'ms' ? 'Bahasa Malaysia' : 'English'
  const prompt = [
    `You are an SEO/UX writer suggesting alternative phrasings for an <h${lvl}> heading on a small business website.`,
    `Domain: ${website}`,
    p.brand_name ? `Brand: ${p.brand_name}` : '',
    p.location ? `Location: ${p.location}` : '',
    p.keywords.length ? `Target keywords: ${p.keywords.join(', ')}` : '',
    `Current heading: "${current_heading.trim()}"`,
    `Output language: ${langLabel}.`,
    ``,
    `Write 4 distinct alternative phrasings. Each must:`,
    `- Be a section heading (4-12 words is ideal — h${lvl} should be punchy, not a paragraph).`,
    `- Make the section's purpose obvious to a first-time visitor.`,
    `- Naturally include a target keyword when one fits — but don't force keyword stuffing.`,
    `- Sound like a real human wrote it. No marketing jargon, no ALL CAPS, no emoji.`,
    `Return only the headings in the structured output.`,
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
    return NextResponse.json({ error: `Heading generation failed: ${(e as Error).message}` }, { status: 502 })
  }
}
