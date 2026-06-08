// supabase/functions/dsa-sync/index.ts
// T017 — DSA sync edge function. Pulls LeetCode via GraphQL and HackerRank
// via REST; upserts into public.user_dsa_profiles. Idempotent.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEETCODE_API = Deno.env.get("LEETCODE_API_URL") ?? "https://leetcode.com/graphql";
const HACKERRANK_API = Deno.env.get("HACKERRANK_API_URL") ?? "https://www.hackerrank.com/rest/hackers";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const LEETCODE_QUERY = `{
  matchedUser(username: "%USERNAME%") {
    submitStats: submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
    contestRating
    userCalendar { streak totalActiveDays }
  }
}`;

const USERNAME_RE = /^[A-Za-z0-9_-]{2,30}$/;

type Body = {
  user_id?: string;
  platform?: "leetcode" | "hackerrank";
  full_sync?: boolean;
  sweep?: boolean;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.sweep) return await sweep();

  if (!body.user_id || !body.platform) {
    return json({ error: "user_id and platform are required" }, 400);
  }

  const { data: profile, error: pErr } = await supabase
    .from("user_dsa_profiles")
    .select("id,user_id,platform,username")
    .eq("user_id", body.user_id)
    .eq("platform", body.platform)
    .maybeSingle();
  if (pErr) return json({ error: pErr.message }, 500);
  if (!profile) return json({ error: "No connection found for that platform" }, 404);

  const username = (profile as { username: string }).username;
  if (!USERNAME_RE.test(username)) {
    await markStatus(body.user_id, body.platform, "not_found");
    return json({ error: "Invalid username format" }, 400);
  }

  try {
    if (body.platform === "leetcode") {
      await syncLeetcode(body.user_id, username);
    } else {
      await syncHackerrank(body.user_id, username);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("dsa-sync failed", e);
    await markStatus(body.user_id, body.platform, "error");
    return json({ error: (e as Error).message }, 500);
  }
});

async function sweep(): Promise<Response> {
  // Cron entry — refresh every active row that's older than 6 hours.
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("user_dsa_profiles")
    .select("user_id,platform,username")
    .eq("sync_status", "active")
    .lt("last_synced_at", cutoff)
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let synced = 0;
  let errors = 0;
  for (const row of (rows ?? []) as Array<{ user_id: string; platform: "leetcode" | "hackerrank"; username: string }>) {
    try {
      if (row.platform === "leetcode") {
        await syncLeetcode(row.user_id, row.username);
      } else {
        await syncHackerrank(row.user_id, row.username);
      }
      synced += 1;
    } catch (e) {
      errors += 1;
      await markStatus(row.user_id, row.platform, "error");
      console.error("sweep failed for", row.user_id, row.platform, e);
    }
  }
  return json({ ok: true, synced, errors });
}

async function syncLeetcode(userId: string, username: string) {
  const query = LEETCODE_QUERY.replace("%USERNAME%", username);
  const res = await fetch(LEETCODE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query }),
  });
  if (res.status === 404 || res.status === 403) {
    await markStatus(userId, "leetcode", res.status === 404 ? "not_found" : "private");
    return;
  }
  if (res.status === 429) {
    await markStatus(userId, "leetcode", "rate_limited");
    return;
  }
  if (!res.ok) throw new Error(`LeetCode ${res.status}`);
  const body = (await res.json()) as {
    data?: {
      matchedUser?: {
        submitStats?: { acSubmissionNum?: Array<{ difficulty: string; count: number }> };
        contestRating?: number | null;
        userCalendar?: { streak?: number; totalActiveDays?: number } | null;
      } | null;
    };
  };
  const mu = body.data?.matchedUser;
  if (!mu) {
    await markStatus(userId, "leetcode", "not_found");
    return;
  }
  const counts = mu.submitStats?.acSubmissionNum ?? [];
  const easy = counts.find((c) => c.difficulty === "Easy")?.count ?? 0;
  const medium = counts.find((c) => c.difficulty === "Medium")?.count ?? 0;
  const hard = counts.find((c) => c.difficulty === "Hard")?.count ?? 0;
  const total = easy + medium + hard;
  const streak = mu.userCalendar?.streak ?? 0;
  await supabase
    .from("user_dsa_profiles")
    .update({
      total_solved: total,
      easy_solved: easy,
      medium_solved: medium,
      hard_solved: hard,
      contest_rating: mu.contestRating ?? null,
      streak_days: streak,
      sync_status: "active",
      last_synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "leetcode");
}

async function syncHackerrank(userId: string, username: string) {
  const res = await fetch(`${HACKERRANK_API}/${username}/scores`);
  if (res.status === 404) {
    await markStatus(userId, "hackerrank", "not_found");
    return;
  }
  if (res.status === 403) {
    await markStatus(userId, "hackerrank", "private");
    return;
  }
  if (res.status === 429) {
    await markStatus(userId, "hackerrank", "rate_limited");
    return;
  }
  if (!res.ok) throw new Error(`HackerRank ${res.status}`);
  const body = (await res.json()) as {
    badges?: Array<{ badge_name?: string; stars?: number; id?: string }>;
    certificates?: Array<{ id?: string; name?: string }>;
  };
  const badges = (body.badges ?? []).map((b) => ({
    name: b.badge_name ?? "Badge",
    stars: b.stars ?? 0,
    id: b.id ?? null,
  }));
  // HackerRank doesn't expose easy/medium/hard, so bucket by stars as a proxy.
  const easy = badges.filter((b) => b.stars >= 1 && b.stars < 3).length;
  const medium = badges.filter((b) => b.stars >= 3 && b.stars < 5).length;
  const hard = badges.filter((b) => b.stars >= 5).length;
  const total = easy + medium + hard;
  const certCount = body.certificates?.length ?? 0;
  await supabase
    .from("user_dsa_profiles")
    .update({
      total_solved: total,
      easy_solved: easy,
      medium_solved: medium,
      hard_solved: hard,
      badges: [...badges, ...(certCount > 0 ? [{ name: `${certCount} verified certificate${certCount === 1 ? "" : "s"}`, stars: 0, id: null }] : [])],
      sync_status: "active",
      last_synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "hackerrank");
}

async function markStatus(userId: string, platform: "leetcode" | "hackerrank", status: string) {
  await supabase
    .from("user_dsa_profiles")
    .update({ sync_status: status, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("platform", platform);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
