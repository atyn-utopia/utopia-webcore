import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// GET /api/analytics/blog?website=X&period=7d|30d|90d
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const period = searchParams.get('period') ?? '7d'

  if (!website) return NextResponse.json({ error: 'website is required' }, { status: 400 })

  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString()

  const service = createServiceClient()

  // Get all pageview events for this website with blog paths
  const { data: events } = await service
    .from('page_events')
    .select('path, session_id, created_at')
    .eq('website', website)
    .eq('event_type', 'pageview')
    .gte('created_at', prevSince)

  const rows = events ?? []
  const currentRows = rows.filter(e => e.created_at >= since)
  const prevRows = rows.filter(e => e.created_at < since)

  // Get blog posts for this website
  const { data: posts } = await service
    .from('blog_posts')
    .select('id, slug, status, updated_at, blog_translations(language, title)')
    .eq('website', website)
    .order('updated_at', { ascending: false })

  // Match posts to pageviews by slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postStats = (posts ?? []).map((post: any) => {
    const blogPath = `/blog/${post.slug}`
    const altPaths = [`/blog/${post.slug}`, `/${post.slug}`]

    const currentViews = currentRows.filter(e => altPaths.some(p => e.path === p || e.path.startsWith(p + '/'))).length
    const prevViews = prevRows.filter(e => altPaths.some(p => e.path === p || e.path.startsWith(p + '/'))).length

    const en = post.blog_translations?.find((t: { language: string }) => t.language === 'en') ?? post.blog_translations?.[0]

    let trend: 'up' | 'down' | 'flat' = 'flat'
    let changePct = 0
    if (prevViews > 0 && currentViews > prevViews) {
      trend = 'up'
      changePct = Math.round(((currentViews - prevViews) / prevViews) * 100)
    } else if (prevViews > 0 && currentViews < prevViews) {
      trend = 'down'
      changePct = Math.round(((prevViews - currentViews) / prevViews) * 100)
    } else if (prevViews === 0 && currentViews > 0) {
      trend = 'up'
      changePct = 100
    }

    return {
      id: post.id,
      slug: post.slug,
      title: en?.title ?? '(Untitled)',
      status: post.status,
      updated_at: post.updated_at,
      views: currentViews,
      prev_views: prevViews,
      trend,
      change_pct: changePct,
    }
  })

  // Summary stats
  const totalViews = postStats.reduce((s, p) => s + p.views, 0)
  const prevTotalViews = postStats.reduce((s, p) => s + p.prev_views, 0)
  const publishedCount = postStats.filter(p => p.status === 'published').length
  const draftCount = postStats.filter(p => p.status === 'draft').length
  const growingCount = postStats.filter(p => p.trend === 'up').length
  const decliningCount = postStats.filter(p => p.trend === 'down').length

  return NextResponse.json({
    summary: {
      total_posts: postStats.length,
      published: publishedCount,
      drafts: draftCount,
      total_views: totalViews,
      prev_total_views: prevTotalViews,
      growing: growingCount,
      declining: decliningCount,
      trend: totalViews > prevTotalViews ? 'up' : totalViews < prevTotalViews ? 'down' : 'flat',
    },
    posts: postStats.sort((a, b) => b.views - a.views),
  })
}
