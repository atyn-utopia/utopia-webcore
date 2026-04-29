import { createServiceClient } from '@/lib/supabase/service'

export type RevalidateEntity = 'product' | 'phone_number' | 'blog_post'

const TAGS_BY_ENTITY: Record<RevalidateEntity, string[]> = {
  product: ['webcore-products'],
  phone_number: ['webcore-phones'],
  blog_post: ['webcore-blog'],
}

/**
 * Fire-and-forget webhook to a designer site so it can flush its ISR cache.
 *
 * Looks up the website's `revalidate_url` + `revalidate_secret` in
 * `website_settings`. If either is missing, this is a no-op — the site
 * just hasn't enabled live revalidation yet.
 *
 * Never throws. A failing designer site must NOT break webcore mutations.
 */
export async function notifyWebsite(website: string, entity: RevalidateEntity): Promise<void> {
  if (!website) return
  try {
    const service = createServiceClient()
    const { data } = await service
      .from('website_settings')
      .select('revalidate_url, revalidate_secret')
      .eq('website', website)
      .maybeSingle()

    const url = data?.revalidate_url as string | null | undefined
    const secret = data?.revalidate_secret as string | null | undefined
    if (!url || !secret) return

    const body = JSON.stringify({ entity, tags: TAGS_BY_ENTITY[entity], website })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webcore-Secret': secret,
      },
      body,
      signal: controller.signal,
    })
      .catch(err => console.warn(`[notifyWebsite] ${website} ${entity}: ${(err as Error).message}`))
      .finally(() => clearTimeout(timeout))
  } catch (err) {
    console.warn(`[notifyWebsite] lookup failed for ${website}: ${(err as Error).message}`)
  }
}
