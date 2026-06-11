// apps/web/src/app/api/biometrics/disconnect/[provider]/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US2 (FR-BIO-003)
//   contracts/api.md → POST /api/biometrics/disconnect/{provider}
// Sets the caller's biometric_connections.status='disconnected' for
// the named provider. Writes a signal_audit row with action=disable.

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "@/lib/audit/log";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function err(code: string, message: string, status: number) {
  return json({ error: { code, message } }, { status });
}

type BiometricProvider = "healthkit" | "google_fit" | "oura" | "whoop";
type AuditProvider =
  | "biometric_healthkit"
  | "biometric_google_fit"
  | "biometric_oura"
  | "biometric_whoop";

const PROVIDER_TO_AUDIT: Record<BiometricProvider, AuditProvider> = {
  healthkit: "biometric_healthkit",
  google_fit: "biometric_google_fit",
  oura: "biometric_oura",
  whoop: "biometric_whoop",
};

function isProvider(p: string): p is BiometricProvider {
  return p === "healthkit" || p === "google_fit" || p === "oura" || p === "whoop";
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return err("invalid_input", "provider must be healthkit, google_fit, oura, or whoop", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to disconnect a biometric provider", 401);

  const rl = rateLimit({ key: `biometric-disconnect:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("biometric_connections")
    .update({ status: "disconnected" })
    .eq("student_id", user.id)
    .eq("provider", provider)
    .select("id")
    .maybeSingle();
  if (error) return err("internal_error", error.message, 500);
  if (!data) {
    return err("not_found", "no active connection for this provider", 404);
  }

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider: PROVIDER_TO_AUDIT[provider],
      action: "disable",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({ ok: true });
}
