// Supabase Edge Function: generate-insights
// Weekly job that runs the peak-window / workflow-pattern / skill-detection
// algorithms against the last 7 days of session + GitHub activity and writes
// the results into the `insights` table. Only fires for users with ≥ 7 days
// of activity.
//
// Trigger:
//   - Manually: POST /functions/v1/generate-insights { user_id?: string }
//   - Scheduled: pg_cron weekly Monday 04:00 UTC
//
// Local dev:  npx supabase functions serve generate-insights --no-verify-jwt
// Deploy:     npx supabase functions deploy generate-insights

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GenerateRequest {
  user_id?: string;
  week_starting?: string; // ISO date for the week being analyzed
}

interface SessionRow {
  started_at: string;
  duration_minutes: number;
  focus_score: number | null;
  focus_level: "high" | "medium" | "low";
  category: string;
  project_name: string | null;
}

interface CommitRow {
  primary_language: string | null;
  committed_at: string;
  repo_full_name: string | null;
}

interface InsightSeed {
  type: "peak_window" | "workflow_pattern" | "skill_detection" | "productivity_trend";
  title: string;
  description: string;
  metric_value: number | null;
  metric_unit: string | null;
  metric_metadata: Record<string, unknown>;
  confidence: number | null;
  data_points: number;
  recommended_action: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday as start
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

const FOCUS_FALLBACK = { high: 0.9, medium: 0.6, low: 0.3 } as const;

function effectiveFocus(s: SessionRow): number {
  return s.focus_score ?? FOCUS_FALLBACK[s.focus_level];
}

function generateForUser(
  sessions: SessionRow[],
  commits: CommitRow[],
): InsightSeed[] {
  const insights: InsightSeed[] = [];

  if (sessions.length === 0) return insights;

  // ---------- Peak window ----------
  const buckets = new Array(24).fill(0).map(() => ({ focus: 0, minutes: 0 }));
  for (const s of sessions) {
    const h = new Date(s.started_at).getUTCHours();
    const weight = Math.max(1, s.duration_minutes);
    const bucket = buckets[h]!;
    bucket.focus += effectiveFocus(s) * weight;
    bucket.minutes += weight;
  }
  let bestHour = 0;
  let bestMean = -1;
  const WINDOW = 4;
  for (let start = 0; start < 24; start += 1) {
    let focus = 0;
    let minutes = 0;
    for (let i = 0; i < WINDOW; i += 1) {
      const b = buckets[(start + i) % 24]!;
      focus += b.focus;
      minutes += b.minutes;
    }
    const mean = minutes > 0 ? focus / minutes : 0;
    if (mean > bestMean) {
      bestMean = mean;
      bestHour = start;
    }
  }
  const totalFocus = buckets.reduce((sum, b) => sum + b.focus, 0);
  const totalMinutes = buckets.reduce((sum, b) => sum + b.minutes, 0);
  const overallMean = totalMinutes > 0 ? totalFocus / totalMinutes : 0.5;
  const multiplier = overallMean > 0 ? bestMean / overallMean : 1;
  const confidence = Math.min(1, sessions.length / 21);

  if (sessions.length >= 7 && bestMean > 0) {
    insights.push({
      type: "peak_window",
      title: `Peak focus window: ${formatHour(bestHour)}–${formatHour(bestHour + WINDOW)}`,
      description: `You are ${(multiplier).toFixed(2)}× more focused during this window than your weekly average.`,
      metric_value: Math.round(multiplier * 100) / 100,
      metric_unit: "multiplier",
      metric_metadata: { startHour: bestHour, endHour: bestHour + WINDOW, windowMean: bestMean, overallMean },
      confidence: Math.round(confidence * 100) / 100,
      data_points: sessions.length,
      recommended_action: `Block your calendar for deep work between ${formatHour(bestHour)} and ${formatHour(bestHour + WINDOW)}.`,
    });
  }

  // ---------- Workflow pattern ----------
  const dayMap = new Map<string, { focusSum: number; weight: number; cats: string[] }>();
  for (const s of sessions) {
    const key = isoDay(new Date(s.started_at));
    const w = Math.max(1, s.duration_minutes);
    const entry = dayMap.get(key) ?? { focusSum: 0, weight: 0, cats: [] };
    entry.focusSum += effectiveFocus(s) * w;
    entry.weight += w;
    if (entry.cats[entry.cats.length - 1] !== s.category) entry.cats.push(s.category);
    dayMap.set(key, entry);
  }
  const days = Array.from(dayMap.entries());
  if (days.length >= 5) {
    const sorted = days.map(([, v]) => v.weight > 0 ? v.focusSum / v.weight : 0).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const successful = days.filter(([, v]) => (v.weight > 0 ? v.focusSum / v.weight : 0) >= median);
    const patternCounts = new Map<string, number>();
    for (const [, v] of successful) {
      const key = v.cats.join("→");
      patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1);
    }
    let bestPattern: string | null = null;
    let bestCount = 0;
    for (const [pat, count] of patternCounts) {
      if (count > bestCount) { bestCount = count; bestPattern = pat; }
    }
    if (bestPattern && successful.length > 0) {
      const successRate = bestCount / successful.length;
      insights.push({
        type: "workflow_pattern",
        title: `Best day pattern: ${bestPattern}`,
        description: `On ${Math.round(successRate * 100)}% of your most productive days, you followed this category order.`,
        metric_value: Math.round(successRate * 100) / 100,
        metric_unit: "rate",
        metric_metadata: { pattern: bestPattern, daysAnalyzed: days.length },
        confidence: Math.min(1, days.length / 14),
        data_points: days.length,
        recommended_action: `Try to repeat the order: ${bestPattern} on your next study day.`,
      });
    }
  }

  // ---------- Skill detection ----------
  if (commits.length > 0) {
    const counts = new Map<string, number>();
    for (const c of commits) {
      const lang = c.primary_language ?? "Other";
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const sortedLangs = Array.from(counts.entries())
      .map(([lang, n]) => ({ lang, n, pct: n / total }))
      .sort((a, b) => b.n - a.n);
    const top = sortedLangs[0];
    if (top && top.pct >= 0.2) {
      insights.push({
        type: "skill_detection",
        title: `${top.lang} is your dominant language this week`,
        description: `${top.n} of ${total} commits (${Math.round(top.pct * 100)}%) used ${top.lang}. Consider doubling down.`,
        metric_value: top.n,
        metric_unit: "commits",
        metric_metadata: { language: top.lang, percent: top.pct, breakdown: sortedLangs.slice(0, 5) },
        confidence: Math.min(1, total / 10),
        data_points: total,
        recommended_action: `Add a project in ${top.lang} to your portfolio this week.`,
      });
    }
  }

  // ---------- Productivity trend ----------
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const totalHours = totalMinutes / 60;
  const avgFocus = totalMinutes > 0
    ? sessions.reduce((sum, s) => sum + effectiveFocus(s) * Math.max(1, s.duration_minutes), 0) / totalMinutes
    : 0;
  insights.push({
    type: "productivity_trend",
    title: `This week: ${Math.round(totalHours)}h tracked, ${Math.round(avgFocus * 100)}% avg focus`,
    description: `${sessions.length} sessions across ${
      new Set(sessions.map((s) => isoDay(new Date(s.started_at)))).size
    } active days.`,
    metric_value: Math.round(avgFocus * 100) / 100,
    metric_unit: "focus",
    metric_metadata: { totalMinutes, totalSessions: sessions.length },
    confidence: 1,
    data_points: sessions.length,
    recommended_action: totalHours < 10
      ? "Try to hit 10 hours of focused work next week."
      : "Maintain cadence — aim for incremental improvement.",
  });

  return insights;
}

function formatHour(hour: number): string {
  const h = hour % 24;
  const ampm = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${ampm}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as GenerateRequest;
    const { user_id, week_starting } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Resolve user set
    let userIds: string[] = [];
    if (user_id) {
      userIds = [user_id];
    } else {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id,created_at")
        .lte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(2000);
      if (error) return jsonResponse({ error: error.message }, 500);
      userIds = (data ?? []).map((u) => u.id);

      // Cheap pre-filter: only users with sessions in the last 7 days
      const { data: active, error: aErr } = await supabaseAdmin
        .from("sessions")
        .select("user_id")
        .gte("started_at", cutoff)
        .limit(5000);
      if (aErr) return jsonResponse({ error: aErr.message }, 500);
      const activeSet = new Set((active ?? []).map((r) => r.user_id));
      userIds = userIds.filter((id) => activeSet.has(id));
    }

    const weekStart = week_starting
      ? new Date(week_starting)
      : startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const validFrom = weekStart.toISOString();
    const validUntil = weekEnd.toISOString();

    let totalInsights = 0;
    const errors: Array<{ user_id: string; message: string }> = [];

    for (const uid of userIds) {
      try {
        const { data: sessions, error: sErr } = await supabaseAdmin
          .from("sessions")
          .select("started_at,duration_minutes,focus_score,focus_level,category,project_name")
          .eq("user_id", uid)
          .gte("started_at", validFrom)
          .lt("started_at", validUntil);
        if (sErr) throw new Error(sErr.message);

        const { data: commits, error: cErr } = await supabaseAdmin
          .from("github_activity")
          .select("primary_language,committed_at,repo_full_name")
          .eq("user_id", uid)
          .gte("committed_at", validFrom)
          .lt("committed_at", validUntil);
        if (cErr) throw new Error(cErr.message);

        const insights = generateForUser(
          (sessions as SessionRow[] | null) ?? [],
          (commits as CommitRow[] | null) ?? [],
        );

        if (insights.length === 0) continue;

        // Replace existing insights for this user + week (idempotent)
        await supabaseAdmin
          .from("insights")
          .delete()
          .eq("user_id", uid)
          .eq("generated_for_week", weekStart.toISOString().slice(0, 10));

        const rows = insights.map((i) => ({
          user_id: uid,
          type: i.type,
          title: i.title,
          description: i.description,
          metric_value: i.metric_value,
          metric_unit: i.metric_unit,
          metric_metadata: i.metric_metadata,
          confidence: i.confidence,
          data_points: i.data_points,
          recommended_action: i.recommended_action,
          generated_for_week: weekStart.toISOString().slice(0, 10),
          valid_from: validFrom,
          valid_until: validUntil,
        }));
        const { error: insErr } = await supabaseAdmin
          .from("insights")
          .insert(rows);
        if (insErr) throw new Error(insErr.message);
        totalInsights += rows.length;
      } catch (perUserErr) {
        errors.push({
          user_id: uid,
          message: perUserErr instanceof Error ? perUserErr.message : String(perUserErr),
        });
      }
    }

    return jsonResponse({
      users_processed: userIds.length,
      insights_written: totalInsights,
      week_starting: weekStart.toISOString().slice(0, 10),
      errors: errors.length ? errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
