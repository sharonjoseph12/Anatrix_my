import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CompaniesClient from "./companies-client";

export default async function CollegeCompaniesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/college/companies");

  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const institutionId = (membership as { institution_id: string }).institution_id;

  // Companies + open positions (light join)
  const { data: companies } = await supabase
    .from("companies")
    .select("id,name,industry,location,subscription_tier,open_positions:intake_positions(count)")
    .order("name")
    .limit(50);

  // For each company, count matched students at this institution
  const companyList = (companies ?? []) as Array<{
    id: string;
    name: string;
    industry: string | null;
    location: string | null;
    subscription_tier: string | null;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-7 w-7" />
          Companies
        </h1>
        <p className="text-muted-foreground">
          Run an auto-match to see which of your students fit each company&apos;s roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open positions</CardTitle>
          <CardDescription>
            Click <em>Auto-match</em> to run matching for that company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companyList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies on Antarix yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Industry</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {companyList.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2 pr-3 font-medium">{c.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{c.industry ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{c.location ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{c.subscription_tier ?? "—"}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <CompaniesClient.MatchButton
                          companyId={c.id}
                          companyName={c.name}
                          institutionId={institutionId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
