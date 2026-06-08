// Server component — fetch the recruiter's ATS workspace (connections,
// saved searches, recent sync log) and hand it to a client component for
// interactivity (add connection / add saved search / revoke).
//
// Auth: any signed-in user can load this page, but the queries are
// filtered to recruiter_id = auth.uid() so cross-user leakage is
// impossible. The RLS policy on ats_connections enforces the same
// restriction at the DB layer (see migration 035).

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AtsWorkspace, type AtsWorkspaceData } from "./ats-workspace";

export const dynamic = "force-dynamic";

export default async function AtsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // First fetch the user's own connection ids (RLS would do this, but
  // we need them as IN-clause inputs for the saved-search and log
  // queries below).
  const { data: ownConns } = await supabase
    .from("ats_connections")
    .select("id")
    .eq("recruiter_id", user.id);
  const ownConnIds = (ownConns ?? []).map((r: { id: string }) => r.id);
  const inFilter = ownConnIds.length > 0
    ? ownConnIds
    : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: conns }, { data: searches }, { data: log }] = await Promise.all([
    supabase
      .from("ats_connections")
      .select("id,provider,status,pool_id,last_sync_at,created_at")
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ats_saved_searches")
      .select("id,connection_id,name,query_json,min_score,active,last_evaluated_at,created_at")
      .in("connection_id", inFilter)
      .order("created_at", { ascending: false }),
    supabase
      .from("ats_sync_log")
      .select(
        "id,connection_id,saved_search_id,student_id,status,attempt,error,pushed_at,users!ats_sync_log_student_id_fkey(full_name,email)",
      )
      .in("connection_id", inFilter)
      .order("pushed_at", { ascending: false })
      .limit(20),
  ]);

  const data: AtsWorkspaceData = {
    connections: (conns ?? []) as unknown as AtsWorkspaceData["connections"],
    savedSearches: (searches ?? []) as unknown as AtsWorkspaceData["savedSearches"],
    log: (log ?? []) as unknown as AtsWorkspaceData["log"],
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ATS sync</h1>
        <p className="text-sm text-muted-foreground">
          Push matched candidates to your Greenhouse or Lever automatically.
        </p>
      </div>
      <AtsWorkspace initial={data} />
    </div>
  );
}
