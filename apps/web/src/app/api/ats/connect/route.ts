import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { atsConnectSchema, parseOrError } from "@/lib/validation/schemas";

// POST /api/ats/connect — create a recruiter ATS connection.
//
// Spec: specs/004-eleven-of-ten/contracts/api.md → Internal: ATS.
//
// Auth: any authenticated user. The ats_connections RLS policy already
// restricts SELECTs to the owning recruiter; the table's writes are
// service-role-only (see migration 035), so we use the supabase server
// client (which is authenticated as the user but inserts with the
// service-role automatically when RLS denies — actually no, we INSERT
// via the user client and rely on the bypass of RLS only on the read
// policy. Writes have no INSERT policy, so we use the service client.)

// IMPORTANT (encryption choice):
// v1 stores the API key as **base64**. This is a placeholder, not real
// encryption — base64 is reversible and confers no confidentiality
// beyond "not plaintext at a glance". The decision was made for v1
// because:
//   1. The schema (migration 035) already calls the column
//      `api_key_encrypted` with the comment that envelope encryption
//      happens in the app/KMS layer (not enforced by Postgres).
//   2. The matching ats-sync-{greenhouse,lever} edge functions
//      auto-detect base64 vs plaintext and decode accordingly.
//   3. KMS envelope encryption requires provisioning a key + IAM and
//      was de-scoped from v1 (see TODO below).
//
// TODO(prod): replace base64 with AES-256-GCM where the data key is
// wrapped by KMS (AWS KMS / GCP KMS / Supabase Vault). Mirror the
// change in supabase/functions/ats-sync-{greenhouse,lever}/index.ts.

function encryptApiKey(plain: string): string {
  // TODO(prod): swap for KMS envelope encryption — see comment above.
  return Buffer.from(plain, "utf8").toString("base64");
}

async function pingProvider(
  provider: "greenhouse" | "lever",
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = `Basic ${Buffer.from(`${apiKey}:`, "utf8").toString("base64")}`;
  const url =
    provider === "greenhouse"
      ? `${process.env.GREENHOUSE_API_BASE ?? "https://harvest.greenhouse.io/v1"}/users?per_page=1`
      : `${process.env.LEVER_API_BASE ?? "https://api.lever.co/v1"}/users?limit=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status >= 200 && res.status < 300) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `unauthorized_${res.status}` };
    }
    return { ok: false, error: `ping_${res.status}` };
  } catch (e) {
    return { ok: false, error: `network_${(e as Error).name}` };
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 5 connection creations per hour per recruiter.
  const rl = rateLimit({ key: `ats-connect:${user.id}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(atsConnectSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { provider, api_key, pool_id } = parsed.data;

  // Defense-in-depth: also confirm the caller belongs to a company. RLS on
  // ats_connections doesn't filter inserts (writes are service-role-only),
  // so this is the only place that ties a connection to a real recruiter.
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .in("role", ["recruiter", "admin", "hiring_manager"])
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json(
      { error: "Only recruiters / company admins can connect an ATS" },
      { status: 403 },
    );
  }

  // Test ping — never blocks the create, only decides initial status.
  const ping = await pingProvider(provider, api_key);
  const status: "active" | "paused" = ping.ok ? "active" : "paused";

  const encrypted = encryptApiKey(api_key);

  const { data, error } = await supabase
    .from("ats_connections")
    .insert({
      recruiter_id: user.id,
      provider,
      api_key_encrypted: encrypted,
      pool_id: pool_id ?? null,
      status,
    })
    .select("id,status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = data as { id: string; status: "active" | "paused" };

  // NEVER echo the api_key back to the client. The created row only
  // exposes id + status.
  if (!ping.ok) {
    return NextResponse.json(
      {
        connection_id: row.id,
        status: row.status,
        warning: "connection unverified",
      },
      { status: 201 },
    );
  }
  return NextResponse.json(
    { connection_id: row.id, status: row.status },
    { status: 201 },
  );
}
