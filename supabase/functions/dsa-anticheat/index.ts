// supabase/functions/dsa-anticheat/index.ts
// MIRRORS apps/web/src/lib/anticheat/dsa-signals.ts — keep in sync.
//
// Feature 004 — Anti-cheat edge function for DSA profile snapshots.
// Runs the 2 DSA detectors (impossible_velocity, rating_delta_anomaly)
// per student, per platform, aggregates via the same max-confidence
// rule, persists signals + audit rows, and updates
// user_dsa_profiles.{anticheat_score,quarantined_at} (the table and
// columns DO exist after migration 034).
//
// Two modes:
//   - Single:  POST { user_id: "<uuid>" }
//   - Sweep:   POST { sweep: true }    (or {} from the cron)
//
// History source for velocity + rating-delta detection:
//   `user_dsa_profiles` only stores the current snapshot (no native
//   history). We therefore read the most recent *prior* signal for the
//   same (user, platform) from `anticheat_signals.evidence_payload`,
//   where the previous run wrote the totals as evidence. The very
//   first run has no prior data, so neither detector fires — the
//   function is a steady-state detector.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";

// ----- env -------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const QUARANTINE_THRESHOLD = Number(
  Deno.env.get("ANTICHEAT_QUARANTINE_THRESHOLD") ?? "0.6",
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----- types ----------------------------------------------------------------

type DsaSignalKind = "impossible_velocity" | "rating_delta_anomaly";

interface DsaSignalDetectionResult {
  signal: DsaSignalKind;
  confidence: number;
  evidence: Record<string, unknown>;
}

interface DsaProfileSnapshot {
  platform: "leetcode" | "hackerrank";
  recorded_at: string;
  total_solved: number;
  contest_rating: number | null;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
}

interface DsaAggregateResult {
  score: number;
  primary_signal: DsaSignalDetectionResult | null;
  all_signals: DsaSignalDetectionResult[];
  is_quarantined: boolean;
}

// ----- mirrored detectors (keep in sync) -----------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const VELOCITY_NORMAL_MAX = 30;
const VELOCITY_HIGH_CONFIDENCE = 50;
const RATING_DELTA_HIGH = 600;
const RATING_DELTA_SUSPECT = 400;

function detectImpossibleVelocity(
  history: DsaProfileSnapshot[],
): DsaSignalDetectionResult | null {
  if (history.length < 2) return null;
  const sorted = [...history]
    .filter((s) => Number.isFinite(new Date(s.recorded_at).getTime()))
    .sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  if (sorted.length < 2) return null;

  let best: {
    from: DsaProfileSnapshot;
    to: DsaProfileSnapshot;
    ratePerDay: number;
    delta: number;
    days: number;
    confidence: number;
  } | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]!;
    const to = sorted[i]!;
    const days = (new Date(to.recorded_at).getTime() - new Date(from.recorded_at).getTime()) / MS_PER_DAY;
    if (days <= 0) continue;
    const delta = to.total_solved - from.total_solved;
    if (delta <= 0) continue;
    const ratePerDay = delta / days;
    if (ratePerDay <= VELOCITY_NORMAL_MAX) continue;
    const confidence = ratePerDay > VELOCITY_HIGH_CONFIDENCE ? 0.9 : 0.45;
    if (!best || ratePerDay > best.ratePerDay) {
      best = { from, to, ratePerDay, delta, days, confidence };
    }
  }
  if (!best) return null;
  return {
    signal: "impossible_velocity",
    confidence: best.confidence,
    evidence: {
      from_solved: best.from.total_solved,
      to_solved: best.to.total_solved,
      delta: best.delta,
      days_elapsed: roundTo(best.days, 3),
      rate_per_day: roundTo(best.ratePerDay, 3),
      from_recorded_at: best.from.recorded_at,
      to_recorded_at: best.to.recorded_at,
      platform: best.to.platform,
    },
  };
}

function detectRatingDeltaAnomaly(
  history: DsaProfileSnapshot[],
): DsaSignalDetectionResult | null {
  if (history.length < 2) return null;
  const sorted = [...history]
    .filter(
      (s) =>
        s.contest_rating !== null &&
        Number.isFinite(new Date(s.recorded_at).getTime()),
    )
    .sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  if (sorted.length < 2) return null;
  let best: {
    from: DsaProfileSnapshot;
    to: DsaProfileSnapshot;
    delta: number;
    confidence: number;
  } | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]!;
    const to = sorted[i]!;
    const fromRating = from.contest_rating as number;
    const toRating = to.contest_rating as number;
    const delta = toRating - fromRating;
    if (delta <= RATING_DELTA_SUSPECT) continue;
    const confidence = delta > RATING_DELTA_HIGH ? 0.95 : 0.4;
    if (!best || delta > best.delta) {
      best = { from, to, delta, confidence };
    }
  }
  if (!best) return null;
  return {
    signal: "rating_delta_anomaly",
    confidence: best.confidence,
    evidence: {
      from_rating: best.from.contest_rating,
      to_rating: best.to.contest_rating,
      delta: best.delta,
      from_recorded_at: best.from.recorded_at,
      to_recorded_at: best.to.recorded_at,
      platform: best.to.platform,
    },
  };
}

function aggregateDsa(
  signals: ReadonlyArray<DsaSignalDetectionResult | null>,
  threshold: number,
): DsaAggregateResult {
  const allSignals: DsaSignalDetectionResult[] = [];
  for (const s of signals) if (s !== null) allSignals.push(s);
  if (allSignals.length === 0) {
    return { score: 0, primary_signal: null, all_signals: [], is_quarantined: false };
  }
  let primary: DsaSignalDetectionResult = allSignals[0]!;
  let maxConfidence = primary.confidence;
  for (let i = 1; i < allSignals.length; i++) {
    const s = allSignals[i]!;
    if (s.confidence > maxConfidence) {
      maxConfidence = s.confidence;
      primary = s;
    }
  }
  const score = clamp01(maxConfidence);
  return { score, primary_signal: primary, all_signals: allSignals, is_quarantined: score >= threshold };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
function roundTo(n: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

// ----- per-student scan -----------------------------------------------------

interface ScanResult {
  user_id: string;
  scanned: number;
  quarantined: number;
  errors: number;
}

async function loadPriorSnapshot(
  userId: string,
  platform: string,
): Promise<DsaProfileSnapshot | null> {
  const { data, error } = await supabase
    .from("anticheat_signals")
    .select("evidence_payload, detected_at")
    .eq("entity_type", "dsa_record")
    .eq("student_id", userId)
    .is("superseded_by", null)
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const payload = (data as { evidence_payload: Record<string, unknown> | null }).evidence_payload;
  if (!payload) return null;
  if (payload.platform !== platform) return null;
  const total = Number(payload.total_solved ?? NaN);
  if (!Number.isFinite(total)) return null;
  return {
    platform: platform as "leetcode" | "hackerrank",
    recorded_at: String(payload.snapshot_at ?? (data as { detected_at: string }).detected_at),
    total_solved: total,
    contest_rating: payload.contest_rating === null || payload.contest_rating === undefined
      ? null
      : Number(payload.contest_rating),
    easy_solved: Number(payload.easy_solved ?? 0),
    medium_solved: Number(payload.medium_solved ?? 0),
    hard_solved: Number(payload.hard_solved ?? 0),
  };
}

async function scanStudent(
  userId: string,
  ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } },
): Promise<ScanResult> {
  const { data: profiles, error: pErr } = await supabase
    .from("user_dsa_profiles")
    .select("id, platform, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, last_synced_at")
    .eq("user_id", userId);
  if (pErr) {
    ctx.log.error("user_dsa_profiles read failed", { user_id: userId, error: pErr.message });
    return { user_id: userId, scanned: 0, quarantined: 0, errors: 1 };
  }

  let scanned = 0;
  let quarantined = 0;
  let errors = 0;

  for (const row of (profiles ?? []) as Array<{
    id: string;
    platform: "leetcode" | "hackerrank";
    total_solved: number | null;
    easy_solved: number | null;
    medium_solved: number | null;
    hard_solved: number | null;
    contest_rating: number | null;
    last_synced_at: string;
  }>) {
    scanned += 1;
    const entityId = row.id;
    const platform = row.platform;
    const current: DsaProfileSnapshot = {
      platform,
      recorded_at: row.last_synced_at,
      total_solved: row.total_solved ?? 0,
      contest_rating: row.contest_rating ?? null,
      easy_solved: row.easy_solved ?? 0,
      medium_solved: row.medium_solved ?? 0,
      hard_solved: row.hard_solved ?? 0,
    };

    const prior = await loadPriorSnapshot(userId, platform);
    const history: DsaProfileSnapshot[] = prior ? [prior, current] : [current];

    const aggregate = aggregateDsa(
      [
        detectImpossibleVelocity(history),
        detectRatingDeltaAnomaly(history),
      ],
      QUARANTINE_THRESHOLD,
    );

    if (aggregate.all_signals.length === 0) continue;

    try {
      // Persist a snapshot of the current totals as part of the evidence
      // so the NEXT run can compute the delta. This is the steady-state
      // snapshot history (the README's "documented choice").
      const snapshotPayload = {
        platform: current.platform,
        snapshot_at: current.recorded_at,
        total_solved: current.total_solved,
        easy_solved: current.easy_solved,
        medium_solved: current.medium_solved,
        hard_solved: current.hard_solved,
        contest_rating: current.contest_rating,
        aggregate_score: aggregate.score,
        quarantined: aggregate.is_quarantined,
      };

      const { data: priorRows } = await supabase
        .from("anticheat_signals")
        .select("id, signal")
        .eq("entity_type", "dsa_record")
        .eq("entity_id", entityId)
        .is("superseded_by", null);

      const insertedIds: string[] = [];
      for (const sig of aggregate.all_signals) {
        const { data: ins, error: insErr } = await supabase
          .from("anticheat_signals")
          .insert({
            entity_type: "dsa_record",
            entity_id: entityId,
            student_id: userId,
            signal: sig.signal,
            confidence: sig.confidence,
            evidence_payload: { ...sig.evidence, ...snapshotPayload },
          })
          .select("id")
          .single();
        if (insErr) {
          ctx.log.error("dsa signal insert failed", { signal: sig.signal, error: insErr.message });
          errors += 1;
          continue;
        }
        if (ins) insertedIds.push((ins as { id: string }).id);
      }

      if (priorRows && priorRows.length > 0) {
        const priorByKind = new Map(
          (priorRows as Array<{ id: string; signal: string }>).map((p) => [p.signal, p.id]),
        );
        for (let i = 0; i < aggregate.all_signals.length; i++) {
          const kind = aggregate.all_signals[i]!.signal;
          const priorId = priorByKind.get(kind);
          const newId = insertedIds[i];
          if (priorId && newId && priorId !== newId) {
            await supabase
              .from("anticheat_signals")
              .update({ superseded_by: newId })
              .eq("id", priorId);
          }
        }
      }

      if (aggregate.is_quarantined) {
        quarantined += 1;
        const { error: qErr } = await supabase
          .from("user_dsa_profiles")
          .update({
            anticheat_score: aggregate.score,
            quarantined_at: new Date().toISOString(),
          })
          .eq("id", entityId);
        if (qErr) {
          ctx.log.error("dsa quarantine update failed", { entity_id: entityId, error: qErr.message });
          errors += 1;
        }

        if (aggregate.primary_signal && insertedIds.length > 0) {
          const primaryIndex = aggregate.all_signals.findIndex(
            (s) => s.signal === aggregate.primary_signal!.signal,
          );
          const primaryId = insertedIds[primaryIndex] ?? insertedIds[0]!;
          const { error: audErr } = await supabase.from("anticheat_audit").insert({
            actor_id: null,
            actor_type: "system",
            action: "quarantine",
            subject_signal_id: primaryId,
            payload: {
              entity_type: "dsa_record",
              entity_id: entityId,
              platform,
              student_id: userId,
              score: aggregate.score,
              primary_signal: aggregate.primary_signal.signal,
              confidence: aggregate.primary_signal.confidence,
            },
          });
          if (audErr) {
            ctx.log.error("dsa audit insert failed", { error: audErr.message });
            errors += 1;
          }
        }
      }
    } catch (e) {
      ctx.log.error("dsa profile scan failed", {
        entity_id: entityId,
        error: (e as Error).message,
      });
      errors += 1;
    }
  }

  return { user_id: userId, scanned, quarantined, errors };
}

// ----- sweep ----------------------------------------------------------------

async function sweep(ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } }): Promise<{ ok: true; scanned: number; quarantined: number; errors: number; students: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("user_dsa_profiles")
    .select("user_id")
    .eq("sync_status", "active")
    .gte("last_synced_at", cutoff)
    .order("last_synced_at", { ascending: false })
    .limit(2000);
  if (error) {
    ctx.log.error("sweep read failed", { error: error.message });
    return { ok: true, scanned: 0, quarantined: 0, errors: 1, students: 0 };
  }
  const uniqueUserIds = Array.from(
    new Set(((rows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
  );

  let scanned = 0;
  let quarantined = 0;
  let errors = 0;
  for (const userId of uniqueUserIds) {
    try {
      const r = await scanStudent(userId, ctx);
      scanned += r.scanned;
      quarantined += r.quarantined;
      errors += r.errors;
    } catch (e) {
      ctx.log.error("sweep student failed", { user_id: userId, error: (e as Error).message });
      errors += 1;
    }
  }
  return { ok: true, scanned, quarantined, errors, students: uniqueUserIds.length };
}

// ----- handler --------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const handler = async (
  req: Request,
  ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } },
): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Server misconfiguration" }, 500);

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    sweep?: boolean;
  };

  if (body.sweep || (!body.user_id && !body.sweep)) {
    const r = await sweep(ctx);
    return json(r);
  }
  if (!body.user_id) return json({ error: "user_id is required" }, 400);

  const r = await scanStudent(body.user_id, ctx);
  return json({ ok: true, user_id: r.user_id, scanned: r.scanned, quarantined: r.quarantined, errors: r.errors });
};

Deno.serve(withObservability("dsa-anticheat", handler));
