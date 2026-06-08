import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Upload, ArrowUpRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function CollegeStudentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/college/students");

  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const institutionId = (membership as { institution_id: string }).institution_id;

  const { data: members } = await supabase
    .from("institution_members")
    .select("user_id,role,batch_year,department,roll_number,specialization,joined_at")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .order("joined_at", { ascending: false })
    .limit(200);

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("candidate_profiles")
        .select("user_id,overall_skill_proof_score,total_hours_logged,total_projects_completed,placement_ready,primary_specialization")
        .in("user_id", userIds)
    : { data: [] };

  const { data: users } = userIds.length
    ? await supabase
        .from("users")
        .select("id,email,display_name")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map<string, NonNullable<typeof profiles>[number]>();
  for (const p of profiles ?? []) profileMap.set(p.user_id, p);
  const userMap = new Map<string, NonNullable<typeof users>[number]>();
  for (const u of users ?? []) userMap.set(u.id, u);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7" />
            Students
          </h1>
          <p className="text-muted-foreground">
            {(members ?? []).length} student member{(members ?? []).length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/college/students/import">
            <Upload className="mr-1 h-4 w-4" />
            Import CSV
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All students</CardTitle>
          <CardDescription>Click a student to view their verified profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {members && members.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Batch</th>
                    <th className="py-2 pr-3">Hours</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const u = userMap.get(m.user_id);
                    const p = profileMap.get(m.user_id);
                    return (
                      <tr key={m.user_id} className="border-t">
                        <td className="py-2 pr-3 font-medium">
                          {u?.display_name ?? u?.email ?? m.user_id.slice(0, 8)}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {m.department ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {m.batch_year ?? "—"}
                        </td>
                        <td className="py-2 pr-3">{p?.total_hours_logged ?? 0}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={p?.placement_ready ? "default" : "outline"}>
                            {p?.overall_skill_proof_score ?? 0}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {p?.placement_ready
                            ? "Ready"
                            : (p?.overall_skill_proof_score ?? 0) >= 55
                              ? "Developing"
                              : "Early"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/college/students/${m.user_id}`}>
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No students yet. Use Import to add your cohort.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
