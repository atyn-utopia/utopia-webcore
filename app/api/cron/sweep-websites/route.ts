import { NextResponse } from 'next/server'
import { sweepOrphanedWebsites } from '@/lib/sweepOrphanedWebsites'

export const maxDuration = 60

/**
 * Scheduled sweep — triggered by Vercel Cron (see vercel.json).
 *
 * Auth: Vercel's scheduler automatically includes `Authorization: Bearer $CRON_SECRET`.
 * Anything without a matching secret is rejected 401 so random internet traffic
 * can't trigger cleanups.
 *
 * Runs daily at 19:00 UTC (03:00 MYT). Calls the shared sweep helper, which
 * writes audit log entries for every website it removes (actor = 'System (cron)').
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sweepOrphanedWebsites(null)
  return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() })
}
