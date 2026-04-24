import { createServiceClient } from '@/lib/supabase/service'
import { resolveActor, writeAuditLog } from '@/lib/auditLog'

const GRACE_MS = 5 * 60 * 60 * 1000 // 5 hours

interface SweepResult {
  checked: number
  deleted: string[]
}

/**
 * Scan for orphaned websites (all api_keys expired-unused, no phones/products/blog/integrations)
 * and delete the company_websites link. Writes an audit log entry per deletion.
 *
 * actorUserId:
 *   - pass a real user id → writes audit log with that actor, name suffixed '(auto-sweep)'
 *   - pass null → treats it as a system/cron invocation (user_id left null in audit_logs)
 */
export async function sweepOrphanedWebsites(actorUserId: string | null): Promise<SweepResult> {
  const service = createServiceClient()
  const cutoffIso = new Date(Date.now() - GRACE_MS).toISOString()

  const { data: candidateRows } = await service
    .from('api_keys')
    .select('website')
    .lt('created_at', cutoffIso)
    .neq('website', '*')

  const candidates = [...new Set((candidateRows ?? []).map(r => r.website as string))]
  const deleted: string[] = []
  if (candidates.length === 0) return { checked: 0, deleted }

  const actor = actorUserId ? await resolveActor(actorUserId) : null

  for (const domain of candidates) {
    try {
      // Every api_key for this domain must be expired_unused
      const { data: keys } = await service
        .from('api_keys')
        .select('is_active, last_used')
        .eq('website', domain)
      if (!keys || keys.length === 0) continue
      const allExpiredUnused = keys.every(k => !k.is_active && k.last_used === null)
      if (!allExpiredUnused) continue

      // No other signals of actual use
      const [phoneRes, productRes, blogRes, integrationRes] = await Promise.all([
        service.from('phone_numbers').select('*', { count: 'exact', head: true }).eq('website', domain),
        service.from('products').select('*', { count: 'exact', head: true }).eq('website', domain),
        service.from('blog_posts').select('*', { count: 'exact', head: true }).eq('website', domain),
        service.from('website_integrations').select('*', { count: 'exact', head: true }).eq('website', domain),
      ])
      if ((phoneRes.count ?? 0) > 0) continue
      if ((productRes.count ?? 0) > 0) continue
      if ((blogRes.count ?? 0) > 0) continue
      if ((integrationRes.count ?? 0) > 0) continue

      const { data: cw } = await service
        .from('company_websites')
        .select('id, company_id')
        .eq('domain', domain)
        .maybeSingle()
      if (!cw) continue

      const { data: company } = await service.from('companies').select('name').eq('id', cw.company_id).maybeSingle()

      const { error: delErr } = await service.from('company_websites').delete().eq('domain', domain)
      if (delErr) continue

      deleted.push(domain)

      const metadata = {
        reason: 'auto-removed — no API usage within 5h grace window',
        company_id: cw.company_id,
        company_name: company?.name ?? null,
        stale_api_keys: keys.length,
      }

      if (actor) {
        // Admin-triggered sweep — attribute to the admin with a '(auto-sweep)' suffix
        await writeAuditLog({
          actor: { ...actor, name: `${actor.name} (auto-sweep)` },
          entityType: 'website',
          entityId: cw.id,
          action: 'delete',
          website: domain,
          label: domain,
          metadata,
        })
      } else {
        // Cron invocation — no user, insert directly with null user_id
        try {
          await service.from('audit_logs').insert({
            user_id: null,
            user_name: 'System (cron)',
            user_role: 'system',
            entity_type: 'website',
            entity_id: cw.id,
            action: 'delete',
            website: domain,
            label: domain,
            metadata,
          })
        } catch (err) {
          // Audit should never block cleanup
          console.error('[cron-sweep] audit insert failed:', err)
        }
      }
    } catch {
      continue
    }
  }

  return { checked: candidates.length, deleted }
}
