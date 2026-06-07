// supabase/functions/ats-sync-evaluator/index.ts
//
// T-ATS-002 — Cron dispatcher for the ATS sync pipeline. Scheduled every
// 5 minutes by `038_cron_004.sql` (`ats-sync-evaluator-5m`).
//
// For each (ats_connections.active, ats_saved_searches.active,
// last_evaluated_at < now() - 5min OR null) pair, this function POSTs
// to `ats-sync-greenhouse` or `ats-sync-lever` and bumps the saved
// search's `last_evaluated_at`. The provider-specific function then
// runs the saved search, pushes up to 50 matched students, and writes
// the audit rows.
//
// This split keeps each function single-purpose:
//   - evaluator    → orchestration (which jobs to run, how often)
//   - per-provider → the actual API push
//
// Body: any (cron-triggered; no required fields). `{ sweep: true }` is
// accepted for parity with other sweep functions.
//
// Return: JSON { ok, dispatched }

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STALENESS_MIN = Number(Deno.env.get("ATS_SYNC_CRON_MINUTES") ?? "5");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

interface ConnRow {
  id: string;
  provider: "greenhouse" | "lever";
}

interface SavedSearchRow {
  id: string;
  connection_id: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // Body is informational only; cron triggers send empty / `{sweep:true}`.
  await req.json().catch(() => ({}));

  const { data: conns, error: cErr } = await supabase
    .from("ats_connections")
    .select("id,provider")
    .eq("status", "active");
  if (cErr) return json({ error: cErr.message }, 500);
  if (!conns || conns.length === 0) return json({ ok: true, dispatched: 0 });

  const connMap = new Map<string, "greenhouse" | "lever">();
  for (const c of conns as ConnRow[]) connMap.set(c.id, c.provider);

  const connIds = (conns as ConnRow[]).map((c) => c.id);
  const cutoffIso = new Date(Date.now() - STALENESS_MIN * 60 * 1000).toISOString();

  // Two queries OR'd in code: `null OR < cutoff`.
  const { data: nullRows } = await supabase
    .from("ats_saved_searches")
    .select("id,connection_id")
    .eq("active", true)
    .in("connection_id", connIds)
    .is("last_evaluated_at", null);

  const { data: staleRows } = await supabase
    .from("ats_saved_searches")
    .select("id,connection_id")
    .eq("active", true)
    .in("connection_id", connIds)
    .lt("last_evaluated_at", cutoffIso);

  const seen = new Set<string>();
  const due: SavedSearchRow[] = [];
  for (const row of [
    ...((nullRows ?? []) as SavedSearchRow[]),
    ...((staleRows ?? []) as SavedSearchRow[]),
  ]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    due.push(row);
  }

  if (due.length === 0) return json({ ok: true, dispatched: 0 });

  // Dispatch sequentially to keep upstream provider rate-limits sane.
  // Within the 5-minute cron window we have plenty of time for hundreds
  // of HTTP calls; we'd rather avoid bursting parallel pushes to the
  // same recruiter's Greenhouse / Lever account.
  let dispatched = 0;
  let dispatchErrors = 0;
  const now = new Date().toISOString();

  for (const search of due) {
    const provider = connMap.get(search.connection_id);
    if (!provider) continue;
    const fn = provider === "greenhouse" ? "ats-sync-greenhouse" : "ats-sync-lever";

    try {
      // Fire-and-await so we never overlap two cron ticks on the same
      // saved search. The per-provider function itself is bounded to a
      // 50-candidate batch so this loop completes well within the 5-min
      // window even for ~100 active saved searches.
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          connection_id: search.connection_id,
          saved_search_id: search.id,
        }),
      });
      if (!res.ok) {
        dispatchErrors += 1;
        const txt = await res.text().catch(() => "");
        console.warn("ats-sync-evaluator dispatch returned non-2xx", {
          saved_search_id: search.id,
          fn,
          status: res.status,
          body: txt.slice(0, 200),
        });
      }
      dispatched += 1;
    } catch (e) {
      dispatchErrors += 1;
      console.error("ats-sync-evaluator dispatch failed", {
        saved_search_id: search.id,
        fn,
        err: (e as Error).message,
      });
    }

    // Always bump last_evaluated_at, even on dispatch error — the
    // provider function persists per-attempt rows in ats_sync_log, and
    // the connection-level pause path handles repeated failures. Keeping
    // last_evaluated_at fresh prevents this evaluator from busy-looping
    // on a broken saved search.
    await supabase
      .from("ats_saved_searches")
      .update({ last_evaluated_at: now })
      .eq("id", search.id);
  }

  return json({ ok: true, dispatched, dispatch_errors: dispatchErrors });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
