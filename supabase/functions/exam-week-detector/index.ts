// supabase/functions/exam-week-detector/index.ts
// T036 — Weekly scan that detects dense "exam" calendar windows for each connected student.
// During these windows, real-time peak and streak-risk nudges are suppressed.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const KEYWORDS = /\b(exam|midterm|end[- ]?sem|final|test|quiz|viva)\b/i;
const DEFAULT_THRESHOLD = 0.6;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const threshold = Number(Deno.env.get("NUDGE_EXAM_WEEK_KEYWORD_DENSITY_THRESHOLD") ?? DEFAULT_THRESHOLD);

  // Look at events for each user with a connected calendar, sliding 28-day window
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("calendar_accounts")
    .select("user_id")
    .eq("status", "active");
  if (accErr) return json({ error: accErr.message }, 500);
  if (!accounts?.length) return json({ detected: 0, users_scanned: 0 });

  const today = new Date();
  const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000);
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const userIds = Array.from(new Set(accounts.map((a) => a.user_id)));
  const { data: events, error: evErr } = await supabaseAdmin
    .from("calendar_events")
    .select("user_id,title,start_at,derived_event_type")
    .in("user_id", userIds)
    .gte("start_at", startIso)
    .lte("start_at", endIso);
  if (evErr) return json({ error: evErr.message }, 500);

  // Group events by user and look for "exam density"
  const byUser = new Map<string, Array<{ title: string | null; derived_event_type: string | null }>>();
  for (const ev of events ?? []) {
    const list = byUser.get(ev.user_id) ?? [];
    list.push({ title: ev.title, derived_event_type: ev.derived_event_type });
    byUser.set(ev.user_id, list);
  }

  const windows: Array<{ user_id: string; start: string; end: string; confidence: number }> = [];
  for (const [userId, evs] of byUser.entries()) {
    const examEvents = evs.filter((e) => e.derived_event_type === "exam" || (e.title && KEYWORDS.test(e.title)));
    if (examEvents.length === 0) continue;
    const ratio = examEvents.length / Math.max(1, evs.length);
    if (ratio < threshold) continue;
    // Confidence = min(1, examEvents * 0.2) so 5+ exam events → 1.0
    const confidence = Math.min(1, examEvents.length * 0.2);
    // Window: from earliest exam day to 7 days after latest
    const examDates = examEvents
      .map((e) => (events ?? []).find((x) => x.user_id === userId && x.title === e.title)?.start_at)
      .filter(Boolean) as string[];
    if (examDates.length === 0) continue;
    const sorted = examDates.sort();
    const start = sorted[0].slice(0, 10);
    const end = new Date(new Date(sorted[sorted.length - 1]).getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    windows.push({ user_id: userId, start, end, confidence });
  }

  // Upsert into exam_windows (UNIQUE (user_id, start_date, end_date))
  let upserts = 0;
  for (const w of windows) {
    const { error: upErr } = await supabaseAdmin.from("exam_windows").upsert({
      user_id: w.user_id,
      start_date: w.start,
      end_date: w.end,
      detection_basis: "keyword_density",
      confidence: w.confidence,
    }, { onConflict: "user_id,start_date,end_date" });
    if (!upErr) upserts++;
  }

  return json({ detected: windows.length, users_scanned: userIds.length, upserts });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
