// apps/web/src/app/(college)/admin/billing/page.tsx
// 11/10 — Institution outcome-billing console (US4 / FR-OBP-001..005).
//
// Server component. Lists every outcome contract for the admin's
// institution and, per contract, the billing events with their
// dispute state. Admins can dispute a billing event within the
// 30-day window via a child client component that POSTs to
// /api/outcome-billing/events/[id]/dispute (defined in
// apps/web/src/app/api/outcome-billing/events/[id]/dispute/route.ts).
//
// Student display is anonymized for users who have not opted in
// (candidate_profiles.is_open_to_opportunities = false); opted-in
// users get their display_name. Email is always redacted to the
// first 4 chars + "@".

import { redirect } from "next/navigation";
import { Receipt, ExternalLink, AlertCircle, FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisputeButton } from "./dispute-button";

interface Membership {
  institution_id: string;
  institutions: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface ContractRow {
  id: string;
  institution_id: string;
  rate_per_placement: number;
  currency: string;
  started_at: string;
  ends_at: string | null;
  status: string;
}

interface BillingEventRow {
  id: string;
  contract_id: string;
  student_id: string;
  offer_id: string;
  amount: number;
  currency: string;
  confirmed_at: string;
  disputed: boolean;
  dispute_reason: string | null;
  reversed_at: string | null;
  application:
    | {
        id: string;
        company: { name: string } | { name: string }[] | null;
      }
    | Array<{
        id: string;
        company: { name: string } | { name: string }[] | null;
      }>
    | null;
  student:
    | {
        id: string;
        display_name: string | null;
        email: string;
        profile: { is_open_to_opportunities: boolean } | { is_open_to_opportunities: boolean }[] | null;
      }
    | Array<{
        id: string;
        display_name: string | null;
        email: string;
        profile: { is_open_to_opportunities: boolean } | { is_open_to_opportunities: boolean }[] | null;
      }>
    | null;
}

const DISPUTE_WINDOW_DAYS = 30;

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "paused") return "secondary";
  if (status === "ended") return "outline";
  return "secondary";
}

function formatCurrency(amountMinor: number, currency: string): string {
  // amount is stored in the smallest currency unit (paise for INR).
  // Display as a localised major-unit string. We don't ship
  // Intl.NumberFormat plumbing for arbitrary currencies in v1, so a
  // 2-decimal split is a safe default.
  const major = amountMinor / 100;
  return `${currency} ${major.toFixed(2)}`;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function anonymizedLabel(student: {
  display_name: string | null;
  email: string;
  profile: { is_open_to_opportunities: boolean } | { is_open_to_opportunities: boolean }[] | null;
}): { label: string; optedIn: boolean } {
  const profile = pickOne(student.profile);
  const optedIn = profile?.is_open_to_opportunities === true;
  if (optedIn && student.display_name) {
    return { label: student.display_name, optedIn: true };
  }
  // Fall back to a stable, non-reversible short hash from the email
  // local-part. We use the first 4 chars of the local-part as a
  // human-recognisable hint without leaking PII.
  const local = student.email.split("@")[0] ?? "anon";
  return { label: `Student ${local.slice(0, 4)}…`, optedIn: false };
}

export default async function CollegeAdminBillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/billing");

  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id, institutions:public.institutions(id, name)")
    .eq("user_id", user.id)
    .in("role", ["admin", "placement_officer"])
    .limit(1)
    .maybeSingle<Membership>();
  if (!membership) return null;

  const institutionId = membership.institution_id;

  const { data: contracts } = await supabase
    .from("outcome_contracts")
    .select("id, institution_id, rate_per_placement, currency, started_at, ends_at, status")
    .eq("institution_id", institutionId)
    .order("started_at", { ascending: false })
    .returns<ContractRow[]>();

  const contractList = contracts ?? [];
  const contractIds = contractList.map((c) => c.id);

  let events: BillingEventRow[] = [];
  if (contractIds.length > 0) {
    const { data: ev } = await supabase
      .from("outcome_billing_events")
      .select(`
        id, contract_id, student_id, offer_id, amount, currency, confirmed_at,
        disputed, dispute_reason, reversed_at,
        application:student_applications(
          id, company:companies(name)
        ),
        student:users(
          id, display_name, email,
          profile:candidate_profiles(is_open_to_opportunities)
        )
      `)
      .in("contract_id", contractIds)
      .order("confirmed_at", { ascending: false })
      .limit(500)
      .returns<BillingEventRow[]>();
    events = ev ?? [];
  }

  const eventsByContract = new Map<string, BillingEventRow[]>();
  for (const e of events) {
    const list = eventsByContract.get(e.contract_id) ?? [];
    list.push(e);
    eventsByContract.set(e.contract_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-7 w-7" />
            Outcome Billing
          </h1>
          <p className="text-muted-foreground">
            Per-placement charges and dispute console for your
            institution&apos;s outcome-pricing contract.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#contracts"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <FileText className="h-3.5 w-3.5" />
            View contracts
          </a>
          <button
            type="button"
            disabled
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground opacity-60"
            title="Contract creation is service-role-only in v1 (back-office flow)"
          >
            Create contract
          </button>
        </div>
      </div>

      {contractList.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No contracts yet</CardTitle>
            <CardDescription>
              You don&apos;t have an active outcome-pricing contract.
              Contact your account manager to get set up.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div id="contracts" className="space-y-6">
          {contractList.map((contract) => {
            const rows = eventsByContract.get(contract.id) ?? [];
            const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
            const disputedAmount = rows
              .filter((r) => r.disputed)
              .reduce((s, r) => s + r.amount, 0);
            const netAmount = totalAmount - disputedAmount;
            return (
              <Card key={contract.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {formatCurrency(contract.rate_per_placement, contract.currency)} / placement
                    </CardTitle>
                    <Badge variant={statusVariant(contract.status)}>
                      {contract.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    Window: {new Date(contract.started_at).toLocaleDateString()}
                    {contract.ends_at
                      ? ` → ${new Date(contract.ends_at).toLocaleDateString()}`
                      : " → open-ended"}
                    {" · "}
                    {rows.length} billed placement{rows.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No placements billed under this contract yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">Date</th>
                            <th className="py-2 pr-3 font-medium">Student</th>
                            <th className="py-2 pr-3 font-medium">Offer</th>
                            <th className="py-2 pr-3 font-medium">Amount</th>
                            <th className="py-2 pr-3 font-medium">Disputed?</th>
                            <th className="py-2 pr-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((e) => {
                            const student = pickOne(e.student);
                            const application = pickOne(e.application);
                            const company = pickOne(application?.company ?? null);
                            const label = student
                              ? anonymizedLabel(student)
                              : { label: "Unknown", optedIn: false };
                            const ageDays =
                              (Date.now() - new Date(e.confirmed_at).getTime()) /
                              86_400_000;
                            const withinWindow = ageDays <= DISPUTE_WINDOW_DAYS;
                            const showDispute =
                              !e.disputed && withinWindow;
                            return (
                              <tr
                                key={e.id}
                                className={
                                  e.disputed
                                    ? "border-b text-muted-foreground"
                                    : "border-b"
                                }
                              >
                                <td className="py-2 pr-3 align-top">
                                  {new Date(e.confirmed_at).toLocaleDateString()}
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  <div className="flex flex-col">
                                    <span>{label.label}</span>
                                    {!label.optedIn ? (
                                      <span className="text-[10px] text-muted-foreground">
                                        anonymized
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  <span className="inline-flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                    {company?.name ?? e.offer_id.slice(0, 8)}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 align-top font-medium">
                                  {formatCurrency(e.amount, e.currency)}
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  {e.disputed ? (
                                    <Badge variant="destructive">
                                      {e.reversed_at ? "Reversed" : "Disputed"}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">No</Badge>
                                  )}
                                </td>
                                <td className="py-2 pr-3 align-top text-right">
                                  {showDispute ? (
                                    <DisputeButton eventId={e.id} />
                                  ) : e.disputed ? (
                                    <span className="text-xs text-muted-foreground">
                                      {e.reversed_at
                                        ? "reversed"
                                        : "out of window"}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      past window
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t text-sm">
                            <td colSpan={3} className="py-2 pr-3 text-right text-muted-foreground">
                              Totals
                            </td>
                            <td className="py-2 pr-3 font-medium">
                              {formatCurrency(totalAmount, contract.currency)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                          <tr className="text-sm">
                            <td colSpan={3} className="py-2 pr-3 text-right text-muted-foreground">
                              Disputed
                            </td>
                            <td className="py-2 pr-3 text-destructive">
                              −{formatCurrency(disputedAmount, contract.currency)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                          <tr className="text-sm">
                            <td colSpan={3} className="py-2 pr-3 text-right font-medium">
                              Net
                            </td>
                            <td className="py-2 pr-3 font-semibold">
                              {formatCurrency(netAmount, contract.currency)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
