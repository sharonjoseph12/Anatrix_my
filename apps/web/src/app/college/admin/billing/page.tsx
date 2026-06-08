// apps/web/src/app/college/admin/billing/page.tsx
//
// Outcome-based billing dashboard for college admins (US9 / FR-OBP-*).
// Lists all outcome_contracts for the admin's institution, the events
// billed under each, the running totals, and a per-event dispute CTA
// (still within the 30-day window). The actual dispute POST is fired
// from a client component so the page stays statically renderable
// (admin-only data) and a server action isn't needed.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Receipt } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisputeButton } from "./_dispute-button";

const DISPUTE_WINDOW_DAYS = Number.parseInt(
  process.env.OUTCOME_BILLING_DISPUTE_WINDOW_DAYS ?? "30",
  10,
);

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/college/admin/billing");

  // Resolve the admin's institution via institution_members.
  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["admin", "placement_officer"])
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return (
      <div className="space-y-2 p-6">
        <h1 className="text-2xl font-semibold">Outcome billing</h1>
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to a college admin or placement officer role.
        </p>
      </div>
    );
  }
  const instId = (membership as { institution_id: string }).institution_id;

  // Look up the institution name separately to avoid the embedded-relationship
  // parse error in the Supabase generated types for this codebase.
  const { data: instRow } = await supabase
    .from("institutions")
    .select("name,type")
    .eq("id", instId)
    .maybeSingle();
  const inst = (instRow as { name: string; type: string } | null) ?? null;

  const { data: contracts } = await supabase
    .from("outcome_contracts")
    .select("id,rate_per_placement,currency,started_at,ends_at,status")
    .eq("institution_id", instId)
    .order("started_at", { ascending: false });

  const contractList = (contracts ?? []) as Array<{
    id: string;
    rate_per_placement: number;
    currency: string;
    started_at: string;
    ends_at: string | null;
    status: string;
  }>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outcome billing</h1>
          <p className="text-sm text-muted-foreground">
            Pay only for verified placements. {inst?.name ?? "Your institution"} is on the
            {" "}
            <span className="font-medium">outcome</span> pricing plan.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {inst?.name ?? "Institution"}
        </div>
      </div>

      {contractList.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              No contracts yet
            </CardTitle>
            <CardDescription>
              Contact onboarding@antarix.app to set up an outcome-based contract.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        contractList.map(async (contract) => {
          const { data: events } = await supabase
            .from("outcome_billing_events")
            .select("id,student_id,offer_id,amount,currency,confirmed_at,disputed,dispute_reason,reversed_at")
            .eq("contract_id", contract.id)
            .order("confirmed_at", { ascending: false });
          const evs = (events ?? []) as Array<{
            id: string;
            student_id: string;
            offer_id: string;
            amount: number;
            currency: string;
            confirmed_at: string;
            disputed: boolean;
            dispute_reason: string | null;
            reversed_at: string | null;
          }>;
          const totalBilled = evs.reduce((s, e) => s + e.amount, 0);
          const totalReversed = evs.filter((e) => e.reversed_at).reduce((s, e) => s + e.amount, 0);
          const netBilled = totalBilled - totalReversed;

          return (
            <Card key={contract.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Contract #{contract.id.slice(0, 8)}
                  </CardTitle>
                  <Badge variant={contract.status === "active" ? "default" : "outline"}>
                    {contract.status}
                  </Badge>
                </div>
                <CardDescription>
                  Rate: {formatAmount(contract.rate_per_placement, contract.currency)} per placement ·{" "}
                  {new Date(contract.started_at).toLocaleDateString()}
                  {contract.ends_at ? ` – ${new Date(contract.ends_at).toLocaleDateString()}` : " — ongoing"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat label="Events" value={evs.length} />
                  <Stat label="Billed" value={formatAmount(totalBilled, contract.currency)} />
                  <Stat label="Net" value={formatAmount(netBilled, contract.currency)} hint="after reversals" />
                </div>

                {evs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No placements billed under this contract yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4">Confirmed</th>
                          <th className="py-2 pr-4">Student</th>
                          <th className="py-2 pr-4">Amount</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {evs.map((e) => {
                          const withinWindow =
                            (Date.now() - new Date(e.confirmed_at).getTime()) / 86_400_000 <=
                            DISPUTE_WINDOW_DAYS;
                          return (
                            <tr key={e.id}>
                              <td className="py-2 pr-4">
                                {new Date(e.confirmed_at).toLocaleDateString()}
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs">
                                {e.student_id.slice(0, 8)}…
                              </td>
                              <td className="py-2 pr-4">{formatAmount(e.amount, e.currency)}</td>
                              <td className="py-2 pr-4">
                                {e.disputed ? (
                                  <Badge variant="destructive">
                                    Disputed{e.reversed_at ? " · reversed" : ""}
                                  </Badge>
                                ) : withinWindow ? (
                                  <Badge variant="outline">Within dispute window</Badge>
                                ) : (
                                  <Badge variant="secondary">Final</Badge>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-right">
                                {!e.disputed && withinWindow ? (
                                  <DisputeButton eventId={e.id} />
                                ) : e.disputed ? (
                                  <span className="text-xs text-muted-foreground">
                                    {e.dispute_reason?.slice(0, 60) ?? "—"}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/api/outcome-billing/events?contract_id=${contract.id}`}>
                      Download CSV
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function formatAmount(amountInSmallestUnit: number, currency: string): string {
  // Best-effort display. The DB stores the smallest currency unit
  // (paise for INR, cents for USD). We don't have full currency metadata
  // here, so we show "<amount> <currency>". The college UI can format
  // further with Intl.NumberFormat when we have a real rate.
  return `${amountInSmallestUnit} ${currency}`;
}
