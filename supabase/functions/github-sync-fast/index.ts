// supabase/functions/github-sync-fast/index.ts
// T027 — Day-1 sync variant. Ingest up to 90 days of public commits, compute the first-pass
// language breakdown + peak hours + streak, and write a candidate_profiles row so the
// dashboard renders real data within 60 seconds of GitHub OAuth completion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Body = { user_id: string; mode?: "day_one" | "manual" };

const GITHUB_API = "https://api.github.com";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = (await req.json()) as Body;
  if (!body?.user_id) return new Response("user_id required", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: gh } = await supabase
    .from("github_accounts")
    .select("id,username,access_token,scope,last_synced_at")
    .eq("user_id", body.user_id)
    .maybeSingle();
  if (!gh) return new Response("No GitHub connection", { status: 404 });

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "antarix-day-one",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (gh.access_token) headers["Authorization"] = `Bearer ${gh.access_token}`;

  // Resolve user (in case access_token is empty for public-only)
  const userLookup = await fetch(`${GITHUB_API}/users/${gh.username}`, { headers });
  if (!userLookup.ok) {
    await supabase.from("github_accounts")
      .update({ last_error: `users lookup ${userLookup.status}`, last_error_at: new Date().toISOString() })
      .eq("id", gh.id);
    return new Response("GitHub user lookup failed", { status: 502 });
  }
  const ghUser = await userLookup.json() as { id: number; login: string };

  // Fetch up to 90 days of public events (commits)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const eventsResp = await fetch(
    `${GITHUB_API}/users/${ghUser.login}/events/public?per_page=100&page=1`,
    { headers },
  );
  if (!eventsResp.ok) {
    await supabase.from("github_accounts")
      .update({ last_error: `events ${eventsResp.status}`, last_error_at: new Date().toISOString() })
      .eq("id", gh.id);
    return new Response("GitHub events fetch failed", { status: 502 });
  }
  const events = (await eventsResp.json()) as Array<{ type: string; created_at: string; payload?: { commits?: Array<{ sha: string; message: string }> } }>;

  const pushEvents = events.filter((e) => e.type === "PushEvent" && e.created_at >= since);
  const rows: Array<{
    user_id: string; commit_hash: string; repository_name: string;
    primary_language: string | null; message: string; committed_at: string;
  }> = [];
  for (const ev of pushEvents) {
    const repoName = (ev as unknown as { repo: { name: string } }).repo?.name;
    for (const c of ev.payload?.commits ?? []) {
      rows.push({
        user_id: body.user_id,
        commit_hash: c.sha,
        repository_name: repoName ?? "unknown",
        primary_language: null, // language attribution resolved on read from repos endpoint
        message: c.message,
        committed_at: ev.created_at,
      });
    }
  }
  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("github_activity")
      .upsert(rows, { onConflict: "user_id,commit_hash", ignoreDuplicates: true });
    if (insErr) {
      await supabase.from("github_accounts")
        .update({ last_error: insErr.message, last_error_at: new Date().toISOString() })
        .eq("id", gh.id);
      return new Response(`Insert failed: ${insErr.message}`, { status: 500 });
    }
  }

  // First-pass language breakdown from repos
  const reposResp = await fetch(`${GITHUB_API}/users/${ghUser.login}/repos?per_page=100&sort=updated`, { headers });
  const langTotals: Record<string, number> = {};
  if (reposResp.ok) {
    const repos = (await reposResp.json()) as Array<{ name: string; language: string | null; size: number }>;
    for (const r of repos) {
      if (r.language) langTotals[r.language] = (langTotals[r.language] ?? 0) + Math.max(1, r.size);
    }
  }
  const totalLang = Object.values(langTotals).reduce((a, b) => a + b, 0);
  const topLanguages = Object.entries(langTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => ({ name, pct: totalLang > 0 ? Math.round((n / totalLang) * 100) : 0 }));

  // Peak commit hours (local 0-23)
  const hourCounts = new Array(24).fill(0) as number[];
  for (const r of rows) {
    const h = new Date(r.committed_at).getUTCHours();
    hourCounts[h] = (hourCounts[h] ?? 0) + 1;
  }
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((h) => h.hour)
    .sort((a, b) => a - b);

  // Streak (consecutive days with at least one commit)
  const dayKeys = new Set(rows.map((r) => r.committed_at.slice(0, 10)));
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (dayKeys.has(d)) streak++;
    else break;
  }

  // Compute a first-pass skill proof score (rough): commit count + recency + breadth
  const firstPassScore = Math.min(100, Math.round(
    (rows.length > 0 ? 30 : 0) +
    Math.min(30, streak * 3) +
    Math.min(20, topLanguages.length * 7) +
    Math.min(20, Object.keys(dayKeys).length * 1),
  ));

  // Write candidate_profiles (upsert)
  await supabase.from("candidate_profiles").upsert({
    user_id: body.user_id,
    overall_skill_proof_score: firstPassScore,
    primary_specialization: topLanguages[0]?.name ?? null,
    specialization_scores: Object.fromEntries(topLanguages.map((l) => [l.name, l.pct])),
    total_commits: rows.length,
    last_score_change_at: new Date().toISOString(),
    peak_window_start_local_hour: peakHours[0] ?? null,
    peak_window_end_local_hour: peakHours.length > 0 ? (peakHours[peakHours.length - 1] + 1) % 24 : null,
    last_updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  await supabase.from("github_accounts")
    .update({ last_synced_at: new Date().toISOString(), last_error: null, last_error_at: null, status: "active" })
    .eq("id", gh.id);

  return new Response(
    JSON.stringify({ ok: true, commits: rows.length, streak, topLanguages, peakHours, firstPassScore }),
    { headers: { "Content-Type": "application/json" } },
  );
});
