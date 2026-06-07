// apps/web/src/app/api/outcome-billing/events/route.ts
//
// POST /api/outcome-billing/events
//   Body: { contract_id, student_id, offer_id }
//   Auth: service-role only.
//   Effect: snapshots the contract's rate_per_placement + currency at
//           billing time and INSERTs a row into outcome_billing_events.
//   Response: 201 { event_id, amount, currency }
//
// Service-role auth model (v1 — intentionally simple, documented):
//   The caller MUST present a bearer token equal to
//   process.env.SUPABASE_SERVICE_ROLE_KEY in the Authorization header.
//   This is the same secret that Edge Functions use to talk back to the
//   database, so by sharing it the placement-confirmation pipeline
//   (002) can call this route from an internal worker without minting a
//   user session. The endpoint is not reachable from the public API
//   surface and is not exposed under /v1/*.
//
// Future work: rotate the secret per-environment, document a dedicated
// OUTCOME_BILLING_SERVICE_TOKEN env, and switch to an mTLS-secured
// channel. This is captured in research.md D8's "future work" section
// and the deployment runbook (docs/004-rollout-runbook.md).

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { outcomeBillingEventSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  // ---- Service-role check ------------------------------------------------
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers.get("authorization") ?? "";
  const presented = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }
  if (!presented || presented !== serviceKey) {
    return NextResponse.json({ error: "Service role authentication required" }, { status: 401 });
  }

  // ---- Body validation ---------------------------------------------------
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(outcomeBillingEventSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { contract_id, student_id, offer_id } = parsed.data;

  const supabase = createSupabaseServiceClient();

  // ---- Snapshot the contract --------------------------------------------
  const { data: contract, error: cErr } = await supabase
    .from("outcome_contracts")
    .select("id,institution_id,rate_per_placement,currency,status")
    .eq("id", contract_id)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  const c = contract as {
    id: string;
    institution_id: string;
    rate_per_placement: number;
    currency: string;
    status: string;
  };
  if (c.status !== "active") {
    return NextResponse.json(
      { error: `Contract is not active (status=${c.status})` },
      { status: 409 },
    );
  }

  // ---- Insert the billing event -----------------------------------------
  // The unique (contract_id, offer_id) index protects against double-bill.
  const { data: event, error: iErr } = await supabase
    .from("outcome_billing_events")
    .insert({
      contract_id: c.id,
      student_id,
      offer_id,
      amount: c.rate_per_placement,
      currency: c.currency,
    })
    .select("id,amount,currency")
    .single();

  if (iErr) {
    // 23505 = unique_violation — surface as 409 conflict
    if (iErr.code === "23505") {
      return NextResponse.json(
        { error: "Offer already billed under this contract" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  const ev = event as { id: string; amount: number; currency: string };
  return NextResponse.json(
    { event_id: ev.id, amount: ev.amount, currency: ev.currency },
    { status: 201 },
  );
}
