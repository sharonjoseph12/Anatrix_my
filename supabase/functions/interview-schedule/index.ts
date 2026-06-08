// supabase/functions/interview-schedule/index.ts
// T089 — Given a job_matches.id and a search window, generate proposed
// interview_slots by intersecting the candidate's free time, the interviewer's
// calendar, and the candidate's peak window. Peak-window-matched slots are
// returned first. A target of >=3 slots is documented; partial-result flag is
// returned when fewer are found.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TARGET_SLOTS = 3;
const WINDOW_DAYS = 7;
const SLOT_LENGTH_MIN = 45;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Missing Authorization" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: ue } = await supabase.auth.getUser();
  if (ue || !user) return json({ error: "Not authenticated" }, 401);

  const { job_match_id, interviewer_user_ids = [], start = new Date().toISOString() } = await req.json() as {
    job_match_id?: string; interviewer_user_ids?: string[]; start?: string;
  };
  if (!job_match_id) return json({ error: "job_match_id required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: match } = await supabase.from("job_matches").select("student_user_id")
    .eq("id", job_match_id).maybeSingle();
  if (!match) return json({ error: "job_match not found" }, 404);
  const studentId = match.student_user_id;

  const { data: cp } = await supabase.from("candidate_profiles")
    .select("peak_window_start_local_hour,peak_window_end_local_hour").eq("user_id", studentId).maybeSingle();
  const peakStart = cp?.peak_window_start_local_hour ?? 9;
  const peakEnd = cp?.peak_window_end_local_hour ?? 12;

  // Pull busy events for student + interviewers
  const end = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString();
  const participantIds = [studentId, ...interviewer_user_ids];
  const { data: busy } = await supabase.from("calendar_events")
    .select("user_id,start_at,end_at").in("user_id", participantIds)
    .gte("start_at", start).lte("start_at", end);

  const busyByUser = new Map<string, Array<{ s: number; e: number }>>();
  for (const b of busy ?? []) {
    const arr = busyByUser.get(b.user_id) ?? [];
    arr.push({ s: new Date(b.start_at).getTime(), e: new Date(b.end_at ?? b.start_at).getTime() });
    busyByUser.set(b.user_id, arr);
  }

  // Generate candidate slots in 30-min granularity, 9–18 local
  const candidates: Array<{ start: string; end: string; peak_match: boolean }> = [];
  for (let day = 0; day < WINDOW_DAYS; day++) {
    for (let h = 9; h < 18; h++) {
      for (const m of [0, 30]) {
        const slotStart = new Date(start);
        slotStart.setUTCDate(slotStart.getUTCDate() + day);
        slotStart.setUTCHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + SLOT_LENGTH_MIN * 60 * 1000);
        const localHour = slotStart.getUTCHours();
        const peakMatch = localHour >= peakStart && localHour < peakEnd;

        let conflict = false;
        for (const [uid, intervals] of busyByUser) {
          for (const i of intervals) {
            if (slotStart.getTime() < i.e && slotEnd.getTime() > i.s) { conflict = true; break; }
          }
          if (conflict) break;
        }
        if (!conflict) candidates.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), peak_match: peakMatch });
      }
    }
  }

  // Peak-match first, then chronological
  candidates.sort((a, b) => Number(b.peak_match) - Number(a.peak_match) || a.start.localeCompare(b.start));
  const chosen = candidates.slice(0, TARGET_SLOTS);
  const partial = chosen.length < TARGET_SLOTS;

  for (const s of chosen) {
    await admin.from("interview_slots").insert({
      job_match_id,
      candidate_user_id: studentId,
      starts_at: s.start,
      ends_at: s.end,
      status: "proposed",
      candidate_peak_window_match: s.peak_match,
    });
  }

  return json({ slots: chosen, partial, target: TARGET_SLOTS });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
