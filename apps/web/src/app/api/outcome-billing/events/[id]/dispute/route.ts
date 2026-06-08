// apps/web/src/app/api/outcome-billing/events/[id]/dispute/route.ts
//
// POST /api/outcome-billing/events/[id]/dispute
//   Body: { reason: string (10..500 chars) }
//   Auth: institution admin / placement officer at the event's contract
//         institution (institution_members.role in {admin, placement_officer}).
//   Effect: marks the event as disputed; if confirmed_at is within the
//           30-day window (per FR-OBP-003), also sets reversed_at to now.
//   Response: 200 { disputed: true, reversed_at: string | null }
//
// Reversal semantics: the row is kept for audit; the dispute just records
// that the institution intends to reverse the charge. The next billing
// finalizer cron (per migration 038_cron_004.sql) is responsible for
// excluding disputed events from the next invoice cycle. The
// reversed_at timestamp is the actual reversal marker; setting it
// requires the event to be within the dispute window.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { outcomeBillingDisputeSchema, parseOrError } from "@/lib/validation/schemas";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const DISPUTE_WINDOW_DAYS = Number.parseInt(
  process.env.OUTCOME_BILLING_DISPUTE_WINDOW_DAYS ?? "30",
  10,
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `outcome-billing-dispute:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(outcomeBillingDisputeSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { reason } = parsed.data;

  // ---- Look up the event + contract + institution -----------------------
  const { data: event, error: eErr } = await supabase
    .from("outcome_billing_events")
    .select("id,contract_id,disputed,dispute_reason,reversed_at,confirmed_at")
    .eq("id", id)
    .maybeSingle();
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const ev = event as {
    id: string;
    contract_id: string;
    disputed: boolean;
    dispute_reason: string | null;
    reversed_at: string | null;
    confirmed_at: string;
  };

  if (ev.disputed) {
    return NextResponse.json(
      { error: "Event already disputed", reversed_at: ev.reversed_at },
      { status: 409 },
    );
  }

  const { data: contract, error: cErr } = await supabase
    .from("outcome_contracts")
    .select("institution_id")
    .eq("id", ev.contract_id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  const institutionId = (contract as { institution_id: string }).institution_id;

  // ---- Auth: caller must be admin/placement_officer at institution -----
  const { data: membership, error: mErr } = await supabase
    .from("institution_members")
    .select("role")
    .eq("institution_id", institutionId)
    .eq("user_id", user.id)
    .in("role", ["admin", "placement_officer"])
    .maybeSingle();
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (!membership) {
    return NextResponse.json(
      { error: "Forbidden: requires admin or placement officer at the contract's institution" },
      { status: 403 },
    );
  }

  // ---- Compute whether reversal is within the 30-day window ------------
  const confirmedAt = new Date(ev.confirmed_at).getTime();
  const ageDays = (Date.now() - confirmedAt) / 86_400_000;
  const withinWindow = ageDays <= DISPUTE_WINDOW_DAYS;
  const reversedAt = withinWindow ? new Date().toISOString() : null;

  // ---- Apply the dispute -----------------------------------------------
  const { data: updated, error: uErr } = await supabase
    .from("outcome_billing_events")
    .update({
      disputed: true,
      dispute_reason: reason,
      reversed_at: reversedAt,
    })
    .eq("id", id)
    .select("id,disputed,dispute_reason,reversed_at")
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  const out = updated as { id: string; disputed: boolean; dispute_reason: string; reversed_at: string | null };
  return NextResponse.json({
    disputed: out.disputed,
    dispute_reason: out.dispute_reason,
    reversed_at: out.reversed_at,
  });
}
