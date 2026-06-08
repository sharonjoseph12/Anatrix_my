// Supabase Edge Function: github-sync
// Fetches commits (and repos) for a connected GitHub account and upserts them
// into the github_activity table. Idempotent: unique (user_id, commit_hash).
//
// Trigger:
//   - Manually: POST /functions/v1/github-sync { user_id, full_sync?: boolean }
//   - Scheduled: pg_cron job every 2 hours (see supabase/migrations/012_cron_jobs.sql)
//   - Cascade: github-callback fires it once on first connect
//
// Local dev:  npx supabase functions serve github-sync --no-verify-jwt
// Deploy:     npx supabase functions deploy github-sync
//
// Required env:
//   SUPABASE_URL                       (auto)
//   SUPABASE_SERVICE_ROLE_KEY          (auto)
//   GITHUB_TOKEN_FALLBACK              (optional PAT used when user OAuth lacks scope)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SyncRequest {
  user_id: string;
  full_sync?: boolean;
  account_id?: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
  };
  repository?: { full_name?: string; name?: string };
  files?: Array<{ filename: string }>;
  stats?: { additions: number; deletions: number; total: number };
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  fork: boolean;
  archived: boolean;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchAllCommits(
  accessToken: string,
  username: string,
  sinceIso: string,
): Promise<GitHubCommit[]> {
  const commits: GitHubCommit[] = [];
  const perPage = 100;
  let page = 1;

  // GitHub events API gives us recent pushes across repos in one shot
  while (page <= 5) {
    const res = await fetch(
      `https://api.github.com/users/${username}/events/public?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "antarix-edge",
        },
      },
    );
    if (!res.ok) break;

    const events = (await res.json()) as Array<{
      type: string;
      created_at: string;
      payload?: { commits?: Array<{ sha: string; message: string; url: string }>; ref?: string };
      repo?: { id: number; name: string; full_name: string };
    }>;

    if (!Array.isArray(events) || events.length === 0) break;

    let pushedAnyOld = false;
    for (const ev of events) {
      if (ev.type !== "PushEvent") continue;
      if (new Date(ev.created_at) < new Date(sinceIso)) {
        pushedAnyOld = true;
        continue;
      }
      const repoFullName = ev.repo?.full_name ?? "";
      for (const c of ev.payload?.commits ?? []) {
        commits.push({
          sha: c.sha,
          commit: { message: c.message, author: { name: "", email: "", date: ev.created_at } },
          repository: { full_name: repoFullName, name: ev.repo?.name ?? "" },
        });
      }
    }

    if (pushedAnyOld) break;
    page += 1;
  }

  return commits;
}

async function fetchRepos(accessToken: string, username: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (page <= 5) {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed&type=owner`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "antarix-edge",
        },
      },
    );
    if (!res.ok) break;
    const batch = (await res.json()) as GitHubRepo[];
    if (batch.length === 0) break;
    repos.push(...batch);
    page += 1;
  }
  return repos.filter((r) => !r.fork && !r.archived);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    const { user_id, full_sync = false, account_id } = body;
    if (!user_id) {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Find the github account(s) to sync
    let accountsQuery = supabaseAdmin
      .from("github_accounts")
      .select("id,user_id,username,access_token_encrypted,status,last_synced_at")
      .eq("user_id", user_id)
      .eq("status", "active");

    if (account_id) accountsQuery = accountsQuery.eq("id", account_id);

    const { data: accounts, error: accErr } = await accountsQuery;
    if (accErr) return jsonResponse({ error: accErr.message }, 500);
    if (!accounts || accounts.length === 0) {
      return jsonResponse({ synced: 0, message: "No active GitHub accounts" });
    }

    let totalInserted = 0;
    const errors: Array<{ account: string; message: string }> = [];

    for (const acc of accounts) {
      try {
        const sinceIso = full_sync || !acc.last_synced_at
          ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
          : acc.last_synced_at;

        const commits = await fetchAllCommits(
          acc.access_token_encrypted,
          acc.username,
          sinceIso,
        );

        if (commits.length === 0) {
          await supabaseAdmin
            .from("github_accounts")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", acc.id);
          continue;
        }

        // 2. Optionally enrich with file counts/stats via repos API
        const repos = await fetchRepos(acc.access_token_encrypted, acc.username);
        const repoLang = new Map(repos.map((r) => [r.full_name, r.language]));

        const rows = commits.map((c) => {
          const fullName = c.repository?.full_name ?? "";
          return {
            user_id: acc.user_id,
            github_account_id: acc.id,
            commit_hash: c.sha,
            repo_name: c.repository?.name ?? "",
            repo_full_name: fullName,
            primary_language: repoLang.get(fullName) ?? null,
            files_changed: c.files?.length ?? null,
            additions: c.stats?.additions ?? null,
            deletions: c.stats?.deletions ?? null,
            message: c.commit.message.slice(0, 500),
            committed_at: c.commit.author?.date ?? new Date().toISOString(),
          };
        });

        // Upsert in chunks of 200 to stay under request size limits
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error: upErr } = await supabaseAdmin
            .from("github_activity")
            .upsert(chunk, { onConflict: "user_id,commit_hash", ignoreDuplicates: true });
          if (upErr) throw new Error(upErr.message);
          totalInserted += chunk.length;
        }

        await supabaseAdmin
          .from("github_accounts")
          .update({ last_synced_at: new Date().toISOString(), last_error: null, last_error_at: null })
          .eq("id", acc.id);
      } catch (perAccErr) {
        const message = perAccErr instanceof Error ? perAccErr.message : String(perAccErr);
        const now = new Date().toISOString();

        // Token expiry / 401: mark account as expired AND record the error
        if (/401|403|bad credentials|token expired/i.test(message)) {
          await supabaseAdmin
            .from("github_accounts")
            .update({ status: "expired", last_error: message, last_error_at: now })
            .eq("id", acc.id);
        } else {
          await supabaseAdmin
            .from("github_accounts")
            .update({ last_error: message, last_error_at: now })
            .eq("id", acc.id);
        }
        errors.push({ account: acc.username, message });
      }
    }

    return jsonResponse({
      synced: totalInserted,
      accounts: accounts.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
