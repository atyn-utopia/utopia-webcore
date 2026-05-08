import PageHeader from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'

interface Step {
  number: number
  title: string
  body: string
}

interface Section {
  title: string
  intro: string
  steps?: Step[]
  bullets?: string[]
}

const SECTIONS: Section[] = [
  {
    title: 'What is Webcore?',
    intro:
      'Webcore is the central control room for every website your team manages. Phone numbers, blog posts, products, SEO settings, and integrations all live here. Designers build the websites; admins run them through Webcore without redeploying code.',
    bullets: [
      'One dashboard for every site you manage. Switch between them from the top bar.',
      'Edit content, images, and metadata in Webcore and the live site updates within seconds.',
      'No code changes needed for day-to-day work. Designers only get involved for new pages or layout changes.',
    ],
  },
  {
    title: 'Getting Started',
    intro: 'Three things to set up the first time you use Webcore.',
    steps: [
      { number: 1, title: 'Pick a site', body: 'Open the home dashboard and click a company folder. Pick the website you want to manage.' },
      { number: 2, title: 'Set the brand profile', body: 'Open the SEO tab. Click the pencil at the top right to fill in business name, location, and target keywords. The AI suggestion features use this.' },
      { number: 3, title: 'Connect Google Search Console', body: 'Open the Integrations tab. Click Connect Google Search Console, sign in with the Google account that owns the property, and pick the right property from the list.' },
    ],
  },
  {
    title: 'Phone Numbers',
    intro:
      'Phone numbers power the WhatsApp and call buttons on designer sites. Each site has a rotation pool with location targeting and percentage weighting.',
    steps: [
      { number: 1, title: 'Open the Phone Numbers tab', body: 'You will see a card per website with the active percentage, total numbers, and a Manage button.' },
      { number: 2, title: 'Add or edit numbers', body: 'Click Manage. Add phone numbers, set location (state-level or "all"), set percentage, and toggle active/off.' },
      { number: 3, title: 'Hit 100% across active rows', body: 'Active percentages must total 100% per site, otherwise leads do not distribute correctly. Webcore shows a warning if you go under or over.' },
    ],
  },
  {
    title: 'Blog',
    intro:
      'Blog posts are SEO content that appears on designer sites under /blog/[slug]. Each post supports multiple languages.',
    steps: [
      { number: 1, title: 'New post', body: 'Open the Blog tab and click New Post. Pick the website, write the body in the rich-text editor, add a cover image.' },
      { number: 2, title: 'Translations', body: 'Use the language tabs in the editor to add Malay or Mandarin translations. Each language has its own title, slug, content, and meta tags.' },
      { number: 3, title: 'Publish', body: 'Click Publish when you are ready. Drafts only show in the admin until published. The designer site picks up the change within ~30 seconds.' },
    ],
  },
  {
    title: 'Products',
    intro:
      'Catalog items that show up on designer sites. Useful for service listings, product cards, or pricing tables.',
    bullets: [
      'Click Add Product to create a new entry: name, slug, description, sale price, rental price, photos.',
      'Sub-products give you a one-level hierarchy (e.g. main service with sub-services).',
      'Drag photos to reorder; the first photo is the hero.',
    ],
  },
  {
    title: 'SEO',
    intro:
      'The SEO tab is a checklist that walks through everything search engines look for: titles, descriptions, headings, images, social previews, indexing.',
    bullets: [
      'Step 1 covers the homepage. Each task expands to an inline editor.',
      'Step 2 covers every other page. Set a title and description per URL, or save a pattern (e.g. /aircond-service-* with {match} placeholder).',
      'Use the AI suggestion buttons to generate brand-aligned title and heading copy.',
      'Alt text for images can be set without designer involvement; the tracker applies them at runtime.',
    ],
  },
  {
    title: 'When to Involve a Designer',
    intro: 'Most operational changes are self-serve in Webcore. Designers come in when:',
    bullets: [
      'A new page layout or visual treatment is needed.',
      'A site needs to be re-skinned or rebranded.',
      'New content types beyond products / blog need to render on the site.',
      'The Webcore tracker or webcore.ts helpers need updating in the designer code.',
    ],
  },
  {
    title: 'Troubleshooting',
    intro: 'Quick fixes for the most common issues.',
    bullets: [
      'Changes not appearing on the live site: check Integrations → Live Revalidation. If the webhook returns anything other than 200, fix the secret or URL.',
      'Google Search Console asks to reconnect: usually the OAuth app is in Testing mode (7-day token expiry). Ask an admin to publish the OAuth consent screen in Google Cloud Console.',
      'AI suggestions feel off-brand: open the SEO tab, click the pencil on the brand profile, fill in business name + location + keywords. Suggestions read these on every request.',
      'Stuck somewhere not covered here: open the Coxy chat (bottom right) and ask in plain language.',
    ],
  },
]

export default function TutorialPage() {
  return (
    <div>
      <PageHeader
        title="Tutorial"
        description="How Webcore works, what to do first, and where to look when something feels off."
      />
      <div className="space-y-5 max-w-4xl">
        {SECTIONS.map((section, i) => (
          <Card key={i}>
            <h2 className="text-base font-semibold text-slate-900 mb-1">{section.title}</h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">{section.intro}</p>

            {section.steps && (
              <ol className="space-y-3">
                {section.steps.map(s => (
                  <li key={s.number} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white bg-[var(--primary)]">
                      {s.number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {section.bullets && (
              <ul className="space-y-2">
                {section.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-slate-300 mt-2" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}

        <Card variant="inset" className="text-center">
          <p className="text-sm font-semibold text-slate-900 mb-1">Still stuck?</p>
          <p className="text-xs text-slate-500">Open Coxy from the bottom-right corner of any page, or file a ticket from the Tickets tab.</p>
        </Card>
      </div>
    </div>
  )
}
