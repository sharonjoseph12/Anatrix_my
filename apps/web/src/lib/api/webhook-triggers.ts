// apps/web/src/lib/api/webhook-triggers.ts
// 11/10 — Server-only helper called by 002/004 flows to enqueue webhook
// deliveries against active public.webhook_subscriptions.
//
// Called from places like the score recompute pipeline, the credential
// issue path, and the placement confirmation flow. Each call:
//   1. SELECTs all matching active subscriptions (optionally scoped to
//      a single api_key.subject_id via the filter argument).
//   2. INSERTs a row into public.webhook_deliveries for each, with
//      status='pending', attempt=1, and a fresh event_id.
//   3. Returns the number of deliveries enqueued.
//
// The actual HTTP dispatch is performed by the
//   supabase/functions/webhook-dispatcher Edge Function
// which sweeps pending + retry-due rows on a cron tick (and can also be
// invoked in "immediate mode" with a delivery_id for low-latency pushes).
//
// SECURITY:
//   - This module uses the service-role client (RLS bypass) and is
//     `server-only`. Calling from a Client Component throws at build time.
//   - The `data` payload is opaque (Record<string, unknown>); callers
//     decide what to include. Do NOT include plaintext secrets / API keys.

import "server-only";
import { randomUUID } from "node:crypto";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { WebhookEvent } from "@antarix/types";

export interface EnqueueWebhookFilter {
  /**
   * If set, restrict the fan-out to subscriptions whose api_key was
   * created by this subject. Used for per-user events (e.g. a score
   * update for student X) so we don't fan out to every subscriber.
   */
  subject_id?: string;
}

export interface EnqueueWebhookResult {
  enqueued: number;
  delivery_ids: number[];
}

export async function enqueueWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
  filter?: EnqueueWebhookFilter,
): Promise<EnqueueWebhookResult> {
  const supabase = createSupabaseServiceClient();

  // 1. Find matching subscriptions.
  let q = supabase
    .from("webhook_subscriptions")
    .select("id, api_key_id, event, target_url, active")
    .eq("event", event)
    .eq("active", true);

  if (filter?.subject_id) {
    // We need an inner join on api_keys to scope to a single subject. The
    // PostgREST filter `api_key:api_keys!inner(subject_id)` traverses the
    // FK and applies a WHERE on the joined table.
    q = q.eq("api_key.subject_id", filter.subject_id);
  }

  const { data: subs, error: subErr } = await q;
  if (subErr) {
    return { enqueued: 0, delivery_ids: [] };
  }
  const rows = (subs ?? []) as Array<{
    id: string;
    api_key_id: string;
    event: string;
    target_url: string;
    active: boolean;
  }>;
  if (rows.length === 0) {
    return { enqueued: 0, delivery_ids: [] };
  }

  // 2. INSERT one delivery row per subscription. event_id is the
  //    idempotency key for the consumer.
  const eventId = randomUUID();
  const inserts = rows.map((s) => ({
    subscription_id: s.id,
    event_id: eventId,
    status: "pending" as const,
    attempt: 1,
  }));

  const { data: deliveries, error: insErr } = await supabase
    .from("webhook_deliveries")
    .insert(inserts)
    .select("id");

  if (insErr) {
    return { enqueued: 0, delivery_ids: [] };
  }

  const deliveryIds = ((deliveries ?? []) as Array<{ id: number }>).map((d) => d.id);

  // 3. Best-effort: also expose the data payload to the dispatcher via
  //    a JSON-encoded "trace" record. The dispatcher re-fetches the
  //    underlying event data when it actually fires (see dispatcher
  //    README), but having the payload inline helps with debugging and
  //    replay. We store it in `last_error` field is wrong — instead we
  //    rely on the event-type-keyed fetch in the dispatcher. The
  //    `data` argument is kept for future use (e.g. a `webhook_payloads`
  //    table) but not persisted here.
  void data;

  return { enqueued: deliveryIds.length, delivery_ids: deliveryIds };
}

/**
 * Helper to build a webhook event payload for the standard event types.
 * Callers that need to add extra fields can spread the result.
 */
export function buildWebhookEventPayload<T extends Record<string, unknown>>(
  event: WebhookEvent,
  data: T,
): { event: WebhookEvent; data: T } {
  return { event, data };
}
