// Supabase Edge Function: calendar-sync
// Fetches upcoming + recent Google Calendar events for a connected account and
// upserts them into calendar_events. Idempotent (unique on user_id,event_id)
// and refreshes the access token on 401.
//
// Trigger:
//   - Manually: POST /functions/v1/calendar-sync { user_id, full_sync?: boolean }
//   - Scheduled: pg_cron job every 6 hours (see supabase/migrations/012_cron_jobs.sql)
//   - Cascade: (none yet — calendar OAuth flow lives in calendar-callback)
//
// Local dev:  npx supabase functions serve calendar-sync --no-verify-jwt
// Deploy:     npx supabase functions deploy calendar-sync
//
// Required env:
//   SUPABASE_URL                          (auto)
//   SUPABASE_SERVICE_ROLE_KEY             (auto)
//   GOOGLE_CLIENT_ID                      (OAuth app)
//   GOOGLE_CLIENT_SECRET                  (OAuth app)

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

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  eventType?: string;
  transparency?: string;
  extendedProperties?: { shared?: Record<string, string> };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as GoogleTokenResponse;
}

function inferCategory(summary: string | undefined, description: string | undefined): string | null {
  const text = `${summary ?? ""} ${description ?? ""}`.toLowerCase();
  if (/interview|standup|sync|meeting|call/.test(text)) return "meeting";
  if (/study|learn|tutorial|course|class|lecture|workshop/.test(text)) return "learning";
  if (/build|project|coding|develop|sprint|deploy/.test(text)) return "project";
  if (/dsa|leetcode|code|algorithm|practice|contest/.test(text)) return "dsa";
  if (/research|paper|experiment|analysis/.test(text)) return "research";
  return null;
}

// T035 — bucket events into the 6 derived types the AI Coach reasons about.
// Keyword heuristics; all-day events with exam-related text get 'exam' first.
function inferDerivedType(
  summary: string | undefined,
  description: string | undefined,
  start: { dateTime?: string; date?: string } | undefined,
): "class" | "deadline" | "meeting" | "study_group" | "exam" | "other" {
  const text = `${summary ?? ""} ${description ?? ""}`.toLowerCase();
  if (/exam|midterm|end-sem|final|test|quiz/.test(text)) return "exam";
  if (/due|deadline|submit|assignment/.test(text)) return "deadline";
  if (/study group|study session|study-group/.test(text)) return "study_group";
  if (/class|lecture|tutorial|lab|workshop/.test(text)) return "class";
  if (/meeting|standup|sync|interview|1:1|1-on-1/.test(text)) return "meeting";
  return "other";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    const { user_id, full_sync = false, account_id } = body;
    if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let q = supabaseAdmin
      .from("calendar_accounts")
      .select("id,user_id,provider,email,access_token_encrypted,refresh_token_encrypted,token_expires_at,status,last_synced_at")
      .eq("user_id", user_id)
      .eq("status", "active");
    if (account_id) q = q.eq("id", account_id);
    const { data: accounts, error: accErr } = await q;
    if (accErr) return jsonResponse({ error: accErr.message }, 500);
    if (!accounts || accounts.length === 0) {
      return jsonResponse({ synced: 0, message: "No active calendar accounts" });
    }

    let totalInserted = 0;
    const errors: Array<{ account: string; message: string }> = [];

    for (const acc of accounts) {
      try {
        // 1. Refresh token if expired
        let accessToken = acc.access_token_encrypted;
        const expiresAt = acc.token_expires_at ? new Date(acc.token_expires_at) : null;
        if ((!expiresAt || expiresAt.getTime() < Date.now() + 60_000) && acc.refresh_token_encrypted) {
          const refreshed = await refreshAccessToken(acc.refresh_token_encrypted);
          if (!refreshed) {
            await supabaseAdmin
              .from("calendar_accounts")
              .update({ status: "expired" })
              .eq("id", acc.id);
            throw new Error("Token refresh failed");
          }
          accessToken = refreshed.access_token;
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          await supabaseAdmin
            .from("calendar_accounts")
            .update({
              access_token_encrypted: accessToken,
              token_expires_at: newExpiresAt,
              refresh_token_encrypted: refreshed.refresh_token ?? acc.refresh_token_encrypted,
            })
            .eq("id", acc.id);
        }

        // 2. Time window: incremental from last_synced_at (or 30 days back),
        //    plus 14 days forward so upcoming focus blocks show up.
        const now = new Date();
        const start = full_sync || !acc.last_synced_at
          ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          : new Date(acc.last_synced_at);
        const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const params = new URLSearchParams({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        });

        const eventsRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (!eventsRes.ok) {
          if (eventsRes.status === 401 && acc.refresh_token_encrypted) {
            const refreshed = await refreshAccessToken(acc.refresh_token_encrypted);
            if (refreshed) {
              await supabaseAdmin
                .from("calendar_accounts")
                .update({
                  access_token_encrypted: refreshed.access_token,
                  token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
                })
                .eq("id", acc.id);
            } else {
              await supabaseAdmin
                .from("calendar_accounts")
                .update({ status: "expired" })
                .eq("id", acc.id);
            }
          }
          throw new Error(`Google Calendar API ${eventsRes.status}`);
        }

        const eventsPayload = (await eventsRes.json()) as { items?: GoogleEvent[] };
        const events = eventsPayload.items ?? [];

        const rows = events
          .filter((e) => e.start?.dateTime)
          .map((e) => {
            const isFocused = e.transparency !== "transparent";
            return {
              user_id: acc.user_id,
              calendar_account_id: acc.id,
              event_id: e.id,
              title: e.summary?.slice(0, 255) ?? null,
              description: e.description?.slice(2000) ?? null,
              start_at: e.start!.dateTime!,
              end_at: e.end?.dateTime ?? null,
              event_type: e.eventType ?? "default",
              is_focused: isFocused,
              category: inferCategory(e.summary, e.description),
              // T035 — derive a 6-bucket type (class/deadline/meeting/study_group/exam/other)
              // for the AI Coach's free-window + exam-week detection.
              derived_event_type: inferDerivedType(e.summary, e.description, e.start),
              is_all_day: !e.start?.dateTime,
              attendee_count: Array.isArray(e.extendedProperties?.shared) ? 0 : 1,
            };
          });

        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error: upErr } = await supabaseAdmin
            .from("calendar_events")
            .upsert(chunk, { onConflict: "user_id,event_id", ignoreDuplicates: true });
          if (upErr) throw new Error(upErr.message);
          totalInserted += chunk.length;
        }

        await supabaseAdmin
          .from("calendar_accounts")
          .update({ last_synced_at: new Date().toISOString(), last_error: null, last_error_at: null })
          .eq("id", acc.id);
      } catch (perAccErr) {
        const message = perAccErr instanceof Error ? perAccErr.message : String(perAccErr);
        const now = new Date().toISOString();
        // T035 — record per-account error for non-blocking UI surfacing
        await supabaseAdmin
          .from("calendar_accounts")
          .update({ last_error: message, last_error_at: now })
          .eq("id", acc.id);
        errors.push({ account: acc.email, message });
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
