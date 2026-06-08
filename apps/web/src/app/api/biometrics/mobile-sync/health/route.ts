// apps/web/src/app/api/biometrics/mobile-sync/health/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US2 (FR-BIO-001)
//   contracts/api.md → GET /api/biometrics/mobile-sync/health
// The Expo mobile app (005) polls this on launch. Returns 503 when
// the feature is disabled, 200 with server_time + min_app_version
// otherwise. No auth — the call is unauthenticated and rate-limited
// upstream by the mobile app.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFlagEnabled(): boolean {
  return process.env.FF_006_BIOMETRICS_MOBILE === "on";
}

export async function GET() {
  if (!isFlagEnabled()) {
    return NextResponse.json(
      { ok: false, code: "feature_disabled" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      server_time: new Date().toISOString(),
      min_app_version: "1.0.0",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
