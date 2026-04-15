import { createServiceClient } from '@/lib/supabase/service'

export type AuditEntityType = 'phone_number' | 'blog_post' | 'product'
export type AuditAction = 'create' | 'update' | 'delete'

export interface AuditActor {
  id: string
  name: string
  role: string
}

export interface FieldChange {
  before: unknown
  after: unknown
}

export type ChangesMap = Record<string, FieldChange>

/**
 * Compute a diff between two snapshots. Only includes fields that changed.
 * Skips fields that are in neither snapshot or are deeply equal.
 */
export function diffObjects(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fields: string[],
): ChangesMap {
  const out: ChangesMap = {}
  for (const key of fields) {
    const b = before?.[key]
    const a = after?.[key]
    // Normalize null/undefined as equal
    if (b == null && a == null) continue
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out[key] = { before: b ?? null, after: a ?? null }
    }
  }
  return out
}

/** Resolve the actor (user id, name, role) from the auth session. */
export async function resolveActor(userId: string): Promise<AuditActor> {
  const service = createServiceClient()
  const { data } = await service
    .from('user_profiles')
    .select('name, role')
    .eq('id', userId)
    .maybeSingle()
  return {
    id: userId,
    name: data?.name ?? 'Unknown',
    role: data?.role ?? 'unknown',
  }
}

interface LogOptions {
  actor: AuditActor
  entityType: AuditEntityType
  entityId?: string | null
  action: AuditAction
  website?: string | null
  /** Short human label for the entity (e.g. phone number value, post title) */
  label?: string | null
  changes?: ChangesMap
  metadata?: Record<string, unknown>
}

/**
 * Write an entry to the audit_logs table. Swallows errors — audit logging
 * should never block the main request.
 */
export async function writeAuditLog(opts: LogOptions) {
  try {
    const service = createServiceClient()
    await service.from('audit_logs').insert({
      user_id: opts.actor.id,
      user_name: opts.actor.name,
      user_role: opts.actor.role,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      action: opts.action,
      website: opts.website ?? null,
      label: opts.label ?? null,
      changes: opts.changes && Object.keys(opts.changes).length > 0 ? opts.changes : null,
      metadata: opts.metadata ?? null,
    })
  } catch (err) {
    console.error('[audit] failed to write log:', err)
  }
}

export const PHONE_FIELDS = [
  'phone_number',
  'whatsapp_text',
  'location_slug',
  'percentage',
  'label',
  'type',
  'is_active',
]

export const BLOG_FIELDS = [
  'website',
  'slug',
  'status',
  'cover_image_url',
]

export const PRODUCT_FIELDS = [
  'name',
  'slug',
  'description',
  'sale_price',
  'rental_price',
  'sort_order',
  'is_active',
  'parent_id',
]
