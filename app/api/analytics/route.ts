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

  // Today vs yesterday
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const todayRows = rows.filter(e => e.created_at.slice(0, 10) === todayStr)
  const yesterdayRows = rows.filter(e => e.created_at.slice(0, 10) === yesterdayStr)
  const todayStats = {
    pageviews: todayRows.filter(e => e.event_type === 'pageview').length,
    clicks: todayRows.filter(e => e.event_type === 'click').length,
    impressions: todayRows.filter(e => e.event_type === 'impression').length,
    sessions: new Set(todayRows.map(e => e.session_id).filter(Boolean)).size,
  }
  const yesterdayStats = {
    pageviews: yesterdayRows.filter(e => e.event_type === 'pageview').length,
    clicks: yesterdayRows.filter(e => e.event_type === 'click').length,
    impressions: yesterdayRows.filter(e => e.event_type === 'impression').length,
    sessions: new Set(yesterdayRows.map(e => e.session_id).filter(Boolean)).size,
  }

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

  // ─── Generate insights ─────────────────────────────────────
  const insights: { icon: string; text: string; type: 'positive' | 'negative' | 'neutral' | 'warning' }[] = []

  // 1. Traffic spike/drop per website (today vs yesterday)
  for (const ws of websiteStats.slice(0, 10)) {
    const todayPv = todayRows.filter(e => e.website === ws.website && e.event_type === 'pageview').length
    const yestPv = yesterdayRows.filter(e => e.website === ws.website && e.event_type === 'pageview').length
    if (yestPv > 5 && todayPv > yestPv * 1.3) {
      const pct = Math.round(((todayPv - yestPv) / yestPv) * 100)
      insights.push({ icon: '🔥', text: `${ws.website} has ${pct}% more pageviews today vs yesterday`, type: 'positive' })
    } else if (yestPv > 5 && todayPv < yestPv * 0.5) {
      const pct = Math.round(((yestPv - todayPv) / yestPv) * 100)
      insights.push({ icon: '📉', text: `${ws.website} traffic is down ${pct}% today vs yesterday`, type: 'negative' })
    }
  }

  // 2. Zero traffic websites (no events in last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
  const recentWebsites = new Set(rows.filter(e => e.created_at > threeDaysAgo).map(e => e.website))
  for (const ws of websiteStats) {
    if (!recentWebsites.has(ws.website) && ws.pageviews > 0) {
      insights.push({ icon: '⚠️', text: `${ws.website} has had no visitors in the last 3 days`, type: 'warning' })
    }
  }

  // 3. Mobile percentage
  const totalDevices = Object.values(deviceCounts).reduce((s, v) => s + v, 0)
  const mobilePct = totalDevices > 0 ? Math.round(((deviceCounts['mobile'] ?? 0) / totalDevices) * 100) : 0
  if (mobilePct > 70) {
    insights.push({ icon: '📱', text: `${mobilePct}% of your visitors are on mobile devices`, type: 'neutral' })
  }

  // 4. Click-through rate
  if (totalPageviews > 20 && totalClicks > 0) {
    const ctr = ((totalClicks / totalPageviews) * 100).toFixed(1)
    if (todayStats.clicks > yesterdayStats.clicks && yesterdayStats.clicks > 0) {
      const pct = Math.round(((todayStats.clicks - yesterdayStats.clicks) / yesterdayStats.clicks) * 100)
      insights.push({ icon: '🎯', text: `Clicks are up ${pct}% today. Overall click rate is ${ctr}%`, type: 'positive' })
    } else {
      insights.push({ icon: '🎯', text: `Your overall click-through rate is ${ctr}%`, type: 'neutral' })
    }
  }

  // 5. Best day of the week
  if (dailyStats.length >= 7) {
    const dayTotals: Record<string, { total: number; count: number }> = {}
    for (const d of dailyStats) {
      const dayName = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
      if (!dayTotals[dayName]) dayTotals[dayName] = { total: 0, count: 0 }
      dayTotals[dayName].total += d.pageviews
      dayTotals[dayName].count++
    }
    const avgByDay = Object.entries(dayTotals).map(([day, v]) => ({ day, avg: v.total / v.count }))
    const overallAvg = avgByDay.reduce((s, d) => s + d.avg, 0) / avgByDay.length
    const best = avgByDay.sort((a, b) => b.avg - a.avg)[0]
    if (best && best.avg > overallAvg * 1.15) {
      const pct = Math.round(((best.avg - overallAvg) / overallAvg) * 100)
      insights.push({ icon: '📊', text: `${best.day} is your best performing day with ${pct}% more traffic than average`, type: 'neutral' })
    }
  }

  // 6. Top referrer
  if (topReferrers.length > 0) {
    const topRef = topReferrers[0]
    const refPct = totalPageviews > 0 ? Math.round((topRef.count / totalPageviews) * 100) : 0
    if (refPct > 20) {
      insights.push({ icon: '🔗', text: `${topRef.source} is your top referrer, driving ${refPct}% of traffic`, type: 'neutral' })
    }
  }

  // 7. Fastest growing website (compare first half vs second half of period)
  if (dailyStats.length >= 6 && websiteStats.length > 1) {
    const mid = Math.floor(dailyStats.length / 2)
    const firstHalfDates = new Set(dailyStats.slice(0, mid).map(d => d.date))
    const secondHalfDates = new Set(dailyStats.slice(mid).map(d => d.date))
    let bestGrowth = { website: '', pct: 0 }
    for (const ws of websiteStats.slice(0, 5)) {
      const first = rows.filter(e => e.website === ws.website && e.event_type === 'pageview' && firstHalfDates.has(e.created_at.slice(0, 10))).length
      const second = rows.filter(e => e.website === ws.website && e.event_type === 'pageview' && secondHalfDates.has(e.created_at.slice(0, 10))).length
      if (first > 3 && second > first * 1.2) {
        const pct = Math.round(((second - first) / first) * 100)
        if (pct > bestGrowth.pct) bestGrowth = { website: ws.website, pct }
      }
    }
    if (bestGrowth.pct > 20) {
      insights.push({ icon: '⭐', text: `${bestGrowth.website} is your fastest growing site — up ${bestGrowth.pct}% in recent days`, type: 'positive' })
    }
  }

  return NextResponse.json({
    period: { days, since },
    summary: {
      pageviews: totalPageviews,
      clicks: totalClicks,
      impressions: totalImpressions,
      sessions: uniqueSessions,
    },
    today: todayStats,
    yesterday: yesterdayStats,
    insights: insights.slice(0, 6),
    websiteStats,
    dailyStats,
    topPages,
    topReferrers,
    topClicks,
    devices: deviceCounts,
    browsers: browserCounts,
  })
}
