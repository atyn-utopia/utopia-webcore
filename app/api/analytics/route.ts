import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getUserScope } from '@/lib/getUserScope'

// GET /api/analytics?period=7d|30d|90d&website=&event_type=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await getUserScope(user.id)
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? '7d'
  const website = searchParams.get('website')
  const eventType = searchParams.get('event_type')

  // Calculate date range
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const service = createServiceClient()

  // Build base query for raw stats
  let query = service
    .from('page_events')
    .select('website, event_type, path, label, device, browser, referrer, session_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  // Apply scoping
  if (website) {
    if (scope.isScoped && !(scope.domains ?? []).includes(website)) {
      return NextResponse.json({ events: [], summary: {} })
    }
    query = query.eq('website', website)
  } else if (scope.isScoped) {
    const allowed = scope.domains ?? []
    if (allowed.length === 0) return NextResponse.json({ events: [], summary: {} })
    query = query.in('website', allowed)
  }

  if (eventType) query = query.eq('event_type', eventType)

  const { data: events, error } = await query.limit(10000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = events ?? []

  // Compute aggregates
  const totalPageviews = rows.filter(e => e.event_type === 'pageview').length
  const totalClicks = rows.filter(e => e.event_type === 'click').length
  const totalImpressions = rows.filter(e => e.event_type === 'impression').length
  const uniqueSessions = new Set(rows.map(e => e.session_id).filter(Boolean)).size

  // Per-website breakdown
  const byWebsite: Record<string, { pageviews: number; clicks: number; impressions: number; sessions: Set<string> }> = {}
  for (const e of rows) {
    if (!byWebsite[e.website]) byWebsite[e.website] = { pageviews: 0, clicks: 0, impressions: 0, sessions: new Set() }
    const w = byWebsite[e.website]
    if (e.event_type === 'pageview') w.pageviews++
    else if (e.event_type === 'click') w.clicks++
    else if (e.event_type === 'impression') w.impressions++
    if (e.session_id) w.sessions.add(e.session_id)
  }

  const websiteStats = Object.entries(byWebsite)
    .map(([domain, s]) => ({
      website: domain,
      pageviews: s.pageviews,
      clicks: s.clicks,
      impressions: s.impressions,
      sessions: s.sessions.size,
    }))
    .sort((a, b) => b.pageviews - a.pageviews)

  // Per-day breakdown (for chart)
  const byDay: Record<string, { pageviews: number; clicks: number; impressions: number }> = {}
  for (const e of rows) {
    const day = e.created_at.slice(0, 10)
    if (!byDay[day]) byDay[day] = { pageviews: 0, clicks: 0, impressions: 0 }
    if (e.event_type === 'pageview') byDay[day].pageviews++
    else if (e.event_type === 'click') byDay[day].clicks++
    else if (e.event_type === 'impression') byDay[day].impressions++
  }

  const dailyStats = Object.entries(byDay)
    .map(([date, s]) => ({ date, ...s }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Top pages
  const pageCounts: Record<string, number> = {}
  for (const e of rows.filter(r => r.event_type === 'pageview')) {
    const key = e.path || '/'
    pageCounts[key] = (pageCounts[key] || 0) + 1
  }
  const topPages = Object.entries(pageCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top referrers
  const refCounts: Record<string, number> = {}
  for (const e of rows.filter(r => r.referrer)) {
    try {
      const host = new URL(e.referrer!).hostname
      refCounts[host] = (refCounts[host] || 0) + 1
    } catch {
      refCounts[e.referrer!] = (refCounts[e.referrer!] || 0) + 1
    }
  }
  const topReferrers = Object.entries(refCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Device + browser breakdown
  const deviceCounts: Record<string, number> = {}
  const browserCounts: Record<string, number> = {}
  for (const e of rows) {
    if (e.device) deviceCounts[e.device] = (deviceCounts[e.device] || 0) + 1
    if (e.browser) browserCounts[e.browser] = (browserCounts[e.browser] || 0) + 1
  }

  // Top click labels (WhatsApp clicks, etc.)
  const clickLabels: Record<string, number> = {}
  for (const e of rows.filter(r => r.event_type === 'click' && r.label)) {
    clickLabels[e.label!] = (clickLabels[e.label!] || 0) + 1
  }
  const topClicks = Object.entries(clickLabels)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    period: { days, since },
    summary: {
      pageviews: totalPageviews,
      clicks: totalClicks,
      impressions: totalImpressions,
      sessions: uniqueSessions,
    },
    websiteStats,
    dailyStats,
    topPages,
    topReferrers,
    topClicks,
    devices: deviceCounts,
    browsers: browserCounts,
  })
}
