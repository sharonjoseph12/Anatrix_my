// supabase/functions/signal-audit-pseudonymise/index.ts
//
// spec: specs/006-deep-signal-capture/spec.md FR-AUD-002
// data-model: specs/006-deep-signal-capture/data-model.md line 294
//
// Nightly cron that pseudonymises actor_id in signal_audit rows older
// than 90 days:
//   1. SELECT rows WHERE created_at < now() - INTERVAL '90 days' AND
//      actor_id IS NOT NULL AND LENGTH(actor_id::text) < 64 (rows not
//      yet hashed).
//   2. For each batch (max 500), compute
//      pseudonym = sha256Hex(original_actor_id + SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT).
//   3. UPDATE signal_audit SET actor_id = pseudonym WHERE id IN (...)
//      in batch (max 100 per UPDATE).
//   4. Return count of rows pseudonymised.
//
// Reversibility (for admins with audit:read + audit:unmask dual scope):
//   sha256(suspected_id + salt) matches the stored pseudonym. Manual
//   process in admin dashboard; not handled here.
//
// Salt rotation: the env var SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT holds the
// current salt. A deployment runbook step updates it yearly. Previous
// 2 salts are stored server-side for reverse-compatibility but are not
// used in this function.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SALT = Deno.env.get("SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT") ?? "";

const SELECT_BATCH_SIZE = 500;
const UPDATE_BATCH_SIZE = 100;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface PseudonymiseResult {
  ok: boolean;
  rows_pseudonymised: number;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }
  if (!SALT) {
    return json({ error: "SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT is not set" }, 500);
  }

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    let totalPseudonymised = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: rows, error } = await supabase
        .from("signal_audit")
        .select("id, actor_id")
        .lt("created_at", ninetyDaysAgo)
        .isNotNull("actor_id")
        .order("id", { ascending: true })
        .limit(SELECT_BATCH_SIZE);

      if (error) throw new Error(`select: ${error.message}`);
      if (!rows || rows.length === 0) break;

      const toUpdate: Array<{ id: number; pseudonym: string }> = [];

      for (const r of rows) {
        const actorIdStr = String(r.actor_id);
        if (actorIdStr.length >= 64) continue;

        const pseudonym = await sha256Hex(actorIdStr + SALT);
        toUpdate.push({ id: r.id, pseudonym });
      }

      if (toUpdate.length === 0) {
        hasMore = rows.length === SELECT_BATCH_SIZE;
        continue;
      }

      for (const b of toUpdate) {
        const { error: updErr } = await supabase
          .from("signal_audit")
          .update({ actor_id: b.pseudonym })
          .eq("id", b.id);
        if (updErr) throw new Error(`update id=${b.id}: ${updErr.message}`);
      }

      totalPseudonymised += toUpdate.length;
      hasMore = rows.length === SELECT_BATCH_SIZE;
    }

    const result: PseudonymiseResult = {
      ok: true,
      rows_pseudonymised: totalPseudonymised,
    };

    console.log("signal-audit-pseudonymise complete", result);
    return json(result);
  } catch (e) {
    console.error("signal-audit-pseudonymise failed", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
