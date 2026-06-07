import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const companyId = (membership as { company_id: string }).company_id;

  const { data: matches } = await supabase
    .from("job_matches")
    .select("id,status,match_score,reached_out_at,interview_scheduled_at,interview_completed_at,hired_at,created_at")
    .eq("company_id", companyId);

  const list = (matches ?? []) as Array<{
    id: string;
    status: string;
    match_score: number;
    reached_out_at: string | null;
    interview_scheduled_at: string | null;
    interview_completed_at: string | null;
    hired_at: string | null;
    created_at: string;
  }>;

  const total = list.length;
  const matched = list.filter((m) => m.status !== "rejected").length;
  const reached = list.filter((m) => !!m.reached_out_at).length;
  const interviewed = list.filter((m) => !!m.interview_completed_at).length;
  const hired = list.filter((m) => !!m.hired_at).length;
  const rejected = list.filter((m) => m.status === "rejected").length;
  const avgMatch =
    total > 0 ? Math.round(list.reduce((sum, m) => sum + (m.match_score ?? 0), 0) / total) : 0;
  const retentionRate = hired > 0 ? Math.round((hired / Math.max(1, interviewed)) * 100) : 0;

  // Funnel counts
  const funnel = {
    matched,
    reached,
    interviewed,
    hired,
    rejected,
  };

  return NextResponse.json({
    total,
    funnel,
    avg_match_score: avgMatch,
    retention_rate: retentionRate,
    pipeline_value: total * 1000, // placeholder monetization metric
  });
}
