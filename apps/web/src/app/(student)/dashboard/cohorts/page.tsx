import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CohortCard } from "@/components/dashboard/cohort-card";
import { JoinCohortButton } from "@/components/dashboard/join-cohort-button";
import { CreateCohortButton } from "@/components/dashboard/create-cohort-button";

export default async function CohortsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/cohorts");

  // 1. Cohorts the user is a member of
  const { data: myMemberships } = await supabase
    .from("cohort_members")
    .select("cohort_id");
  const myCohortIds = new Set((myMemberships ?? []).map((m) => m.cohort_id));

  const { data: allPublic } = await supabase
    .from("cohorts")
    .select("id,name,description,cohort_type,member_count,is_public,created_at")
    .order("member_count", { ascending: false })
    .limit(60);

  const myCohorts = (allPublic ?? []).filter((c) => myCohortIds.has(c.id));
  const discover = (allPublic ?? []).filter(
    (c) => !myCohortIds.has(c.id) && c.is_public,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7" />
            Cohorts
          </h1>
          <p className="text-muted-foreground">
            Join a cohort to compare your metrics with peers.
          </p>
        </div>
        <CreateCohortButton />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your cohorts
        </h2>
        {myCohorts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">You haven&apos;t joined any cohorts yet</CardTitle>
              <CardDescription>
                Pick one below to start comparing your metrics.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myCohorts.map((c) => (
              <CohortCard
                key={c.id}
                id={c.id}
                name={c.name}
                description={c.description}
                memberCount={c.member_count ?? 0}
                cohortType={c.cohort_type as "institutional" | "interest" | "custom"}
                isPublic={c.is_public}
                action={<JoinCohortButton cohortId={c.id} isMember />}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Discover
        </h2>
        {discover.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No public cohorts yet. Be the first to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {discover.slice(0, 12).map((c) => (
              <CohortCard
                key={c.id}
                id={c.id}
                name={c.name}
                description={c.description}
                memberCount={c.member_count ?? 0}
                cohortType={c.cohort_type as "institutional" | "interest" | "custom"}
                isPublic={c.is_public}
                action={<JoinCohortButton cohortId={c.id} isMember={false} />}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
