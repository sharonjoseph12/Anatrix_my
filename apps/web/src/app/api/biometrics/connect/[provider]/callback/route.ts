// apps/web/src/app/api/biometrics/connect/[provider]/callback/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US2 (FR-BIO-001, FR-BIO-007)
//   contracts/api.md → GET /api/biometrics/connect/{provider}/callback
// OAuth2 callback. Verifies the state cookie matches the ?state query,
// exchanges the code for tokens via OuraClient/WhoopClient, encrypts
// the refresh token, persists the connection, and 302-redirects to the
// privacy-center page. Mobile providers (healthkit/google_fit) bypass
// this flow entirely.

import { NextResponse } from "next/server";
import { OuraClient } from "@/lib/biometrics/oura-client";
import { WhoopClient } from "@/lib/biometrics/whoop-client";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string, headers: Headers) {
  return NextResponse.redirect(new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), {
    status: 302,
    headers,
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function encryptRefreshToken(plain: string): string {
  // TODO(prod): use pgsodium encrypt_secret RPC (migration 004 supplies it
  // for ATS API keys; the same call signs biometric refresh tokens once
  // the RPC lands in 004 — until then, base64 placeholder is used).
  return Buffer.from(plain, "utf8").toString("base64");
}

async function readCookies(
  req: Request,
): Promise<{ state: string | null; verifier: string | null; provider: string | null }> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const jar: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq);
    const v = trimmed.slice(eq + 1);
    jar[k] = decodeURIComponent(v);
  }
  return {
    state: jar["biometric_oauth_state"] ?? null,
    verifier: jar["biometric_oauth_verifier"] ?? null,
    provider: jar["biometric_oauth_provider"] ?? null,
  };
}

function clearOAuthCookies(res: NextResponse) {
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set("biometric_oauth_state", "", opts);
  res.cookies.set("biometric_oauth_verifier", "", opts);
  res.cookies.set("biometric_oauth_provider", "", opts);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const headers = new Headers();
  const setCookie = (name: string, value: string) => {
    headers.append(
      "Set-Cookie",
      `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
  };

  if (oauthError) {
    setCookie("biometric_oauth_state", "");
    setCookie("biometric_oauth_verifier", "");
    setCookie("biometric_oauth_provider", "");
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=${encodeURIComponent(oauthError)}`,
      headers,
    );
  }
  if (!code || !returnedState) {
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=missing_params`,
      headers,
    );
  }

  const { state, verifier, provider: cookieProvider } = await readCookies(req);
  if (!state || !verifier || !cookieProvider) {
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=expired_state`,
      headers,
    );
  }
  if (cookieProvider !== provider) {
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=provider_mismatch`,
      headers,
    );
  }
  if (!timingSafeEqual(state, returnedState)) {
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=state_mismatch`,
      headers,
    );
  }

  let studentId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      uid?: string;
      p?: string;
    };
    if (!decoded.uid || decoded.p !== provider) throw new Error("invalid state payload");
    studentId = decoded.uid;
  } catch {
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=state_malformed`,
      headers,
    );
  }

  let accessToken: string;
  let refreshToken: string;
  let scopes: string[] = [];
  try {
    if (provider === "oura") {
      const clientId = process.env.OURA_CLIENT_ID;
      const redirectUri = process.env.OURA_REDIRECT_URI;
      if (!clientId || !redirectUri) throw new Error("oura_not_configured");
      const client = new OuraClient({
        clientId,
        clientSecret: process.env.OURA_CLIENT_SECRET ?? "",
        redirectUri,
      });
      const tok = await client.exchangeCode(code, verifier);
      accessToken = tok.access_token;
      refreshToken = tok.refresh_token;
      scopes = tok.scope ? tok.scope.split(/\s+/).filter(Boolean) : [];
    } else if (provider === "whoop") {
      const clientId = process.env.WHOOP_CLIENT_ID;
      const redirectUri = process.env.WHOOP_REDIRECT_URI;
      if (!clientId || !redirectUri) throw new Error("whoop_not_configured");
      const client = new WhoopClient({
        clientId,
        clientSecret: process.env.WHOOP_CLIENT_SECRET ?? "",
        redirectUri,
      });
      const tok = await client.exchangeCode(code, verifier);
      accessToken = tok.access_token;
      refreshToken = tok.refresh_token;
      scopes = tok.scope ? tok.scope.split(/\s+/).filter(Boolean) : [];
    } else {
      return redirect(
        `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=invalid_provider`,
        headers,
      );
    }
  } catch (e) {
    console.error("biometric token exchange failed", e);
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=token_exchange_failed`,
      headers,
    );
  }

  if (!accessToken || !refreshToken) {
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=token_missing`,
      headers,
    );
  }

  const encrypted = encryptRefreshToken(refreshToken);
  const service = createSupabaseServiceClient();
  const { error: upsertErr } = await service
    .from("biometric_connections")
    .upsert(
      {
        student_id: studentId,
        provider,
        status: "connected",
        oauth_refresh_token_encrypted: encrypted,
        last_error: null,
        scopes_json: scopes.length > 0 ? scopes : ["sleep", "hrv", "resting_hr", "readiness"],
      },
      { onConflict: "student_id,provider" },
    );
  if (upsertErr) {
    console.error("biometric connection upsert failed", upsertErr);
    return redirect(
      `/settings/signals?provider=${encodeURIComponent(provider)}&status=error&error=persist_failed`,
      headers,
    );
  }

  const auditProvider: "biometric_oura" | "biometric_whoop" =
    provider === "oura" ? "biometric_oura" : "biometric_whoop";
  try {
    await writeSignalAudit({
      actor_id: studentId,
      actor_type: "student",
      student_id: studentId,
      provider: auditProvider,
      action: "enable",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  setCookie("biometric_oauth_state", "");
  setCookie("biometric_oauth_verifier", "");
  setCookie("biometric_oauth_provider", "");
  return redirect(
    `/settings/signals?provider=${encodeURIComponent(provider)}&status=connected`,
    headers,
  );
}
