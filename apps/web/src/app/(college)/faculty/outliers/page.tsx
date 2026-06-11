// apps/web/src/app/(college)/faculty/outliers/page.tsx
// Server component. Anti-inflation monitor: lists faculty members at the
// admin's institution, computes their grading distribution over the last
// 90 days, and flags rows whose mean deviates by more than 2 stdev from
// the peer mean (research D5).

import { redirect } from "next/navigation";
import { AlertTriangle, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  grades_issued: number;
  mean_grade: number | null;
  stdev_grade: number | null;
};

type PeerStats = { peer_mean: number; peer_stdev: number };

async function loadOutliers(institutionId: string): Promise<{ rows: Row[]; peer: PeerStats | null }> {
  const supabase = await createSupabaseServerClient();

  // Fetch all faculty verifications at this institution.
  const { data: verifications } = await supabase
    .from("faculty_verifications")
    .select("user_id")
    .eq("institution_id", institutionId)
    .eq("verified", true)
    .is("revoked_at", null);
  const userIds = ((verifications ?? []) as Array<{ user_id: string }>).map((v) => v.user_id);
  if (userIds.length === 0) return { rows: [], peer: null };

  const { data: users } = await supabase
    .from("users")
    .select("id,email,display_name")
    .in("id", userIds);
  const userMap = new Map<string, { email: string | null; display_name: string | null }>();
  for (const u of (users ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>) {
    userMap.set(u.id, { email: u.email, display_name: u.display_name });
  }

  // Aggregate grades per faculty, last 90 days. We use the rpc-less
  // approach: pull the rows we care about and aggregate in JS. The volume
  // per faculty is small (the contract caps at 100/hour, so ~72K rows
  // max/faculty/quarter — fine to read in a single pass for a single
  // institution). For larger institutions the same query can be pushed
  // to a Supabase Edge Function with SQL aggregation.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: grades } = await supabase
    .from("faculty_grades")
    .select("faculty_id,grade,graded_at")
    .in("faculty_id", userIds)
    .gte("graded_at", since);

  const buckets = new Map<string, number[]>();
  for (const g of (grades ?? []) as Array<{ faculty_id: string; grade: number; graded_at: string }>) {
    const list = buckets.get(g.faculty_id) ?? [];
    list.push(g.grade);
    buckets.set(g.faculty_id, list);
  }

  const rows: Row[] = userIds.map((uid) => {
    const grades = buckets.get(uid) ?? [];
    const u = userMap.get(uid);
    if (grades.length === 0) {
      return {
        user_id: uid,
        email: u?.email ?? null,
        display_name: u?.display_name ?? null,
        grades_issued: 0,
        mean_grade: null,
        stdev_grade: null,
      };
    }
    const mean = grades.reduce((s, n) => s + n, 0) / grades.length;
    const variance =
      grades.reduce((s, n) => s + (n - mean) * (n - mean), 0) / grades.length;
    const stdev = Math.sqrt(variance);
    return {
      user_id: uid,
      email: u?.email ?? null,
      display_name: u?.display_name ?? null,
      grades_issued: grades.length,
      mean_grade: Math.round(mean * 10) / 10,
      stdev_grade: Math.round(stdev * 10) / 10,
    };
  });

  // Peer mean/stdev over faculty with >= 5 grades (avoid noise).
  const withGrades = rows.filter((r) => r.mean_grade !== null && r.grades_issued >= 5);
  if (withGrades.length < 2) return { rows, peer: null };
  const peerMean = withGrades.reduce((s, r) => s + (r.mean_grade ?? 0), 0) / withGrades.length;
  const peerVariance =
    withGrades.reduce((s, r) => s + ((r.mean_grade ?? 0) - peerMean) ** 2, 0) / withGrades.length;
  const peerStdev = Math.sqrt(peerVariance);
  return { rows, peer: { peer_mean: peerMean, peer_stdev: peerStdev } };
}

export default async function CollegeFacultyOutliersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/faculty/outliers");

  // Caller must be an admin / placement_officer at some institution.
  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["admin", "placement_officer"])
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const institutionId = (membership as { institution_id: string }).institution_id;

  const { rows, peer } = await loadOutliers(institutionId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-7 w-7" />
          Faculty grading outliers
        </h1>
        <p className="text-muted-foreground">
          Distribution of grades issued by each verified faculty member in
          the last 90 days. Rows whose mean deviates by more than 2 stdev
          from peer mean are flagged for human review (no auto-penalty).
        </p>
      </div>

      {peer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peer baseline</CardTitle>
            <CardDescription>
              Aggregated across faculty with ≥ 5 grades in window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Peer mean</p>
              <p className="text-2xl font-bold tabular-nums">{peer.peer_mean.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Peer stdev</p>
              <p className="text-2xl font-bold tabular-nums">{peer.peer_stdev.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Faculty
          </CardTitle>
          <CardDescription>
            {rows.length} verified faculty member{rows.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No verified faculty at your institution yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Faculty</th>
                    <th className="py-2 pr-3">Grades</th>
                    <th className="py-2 pr-3">Mean</th>
                    <th className="py-2 pr-3">Stdev</th>
                    <th className="py-2 pr-3">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const flagged =
                      peer !== null &&
                      r.mean_grade !== null &&
                      r.grades_issued >= 5 &&
                      Math.abs((r.mean_grade ?? 0) - peer.peer_mean) > 2 * peer.peer_stdev;
                    return (
                      <tr key={r.user_id} className="border-t">
                        <td className="py-2 pr-3 font-medium">
                          {r.display_name ?? r.email ?? r.user_id.slice(0, 8)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{r.grades_issued}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {r.mean_grade ?? "—"}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {r.stdev_grade ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {flagged ? (
                            <Badge variant="destructive">outlier</Badge>
                          ) : (
                            <Badge variant="outline">ok</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
