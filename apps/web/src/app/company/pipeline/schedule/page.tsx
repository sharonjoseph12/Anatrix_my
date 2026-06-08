import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleForm } from "./schedule-form";

interface PageProps {
  searchParams: Promise<{ candidate?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { candidate: candidateId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/company/pipeline`);

  let candidate = null as null | {
    candidate_id: string;
    display_name: string | null;
    email: string | null;
    primary_specialization: string | null;
    overall_skill_proof_score: number | null;
    peak_window: { startHour?: number; endHour?: number } | null;
  };

  if (candidateId) {
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id,user_id,primary_specialization,overall_skill_proof_score,peak_window")
      .eq("id", candidateId)
      .maybeSingle();
    if (cp) {
      const { data: u } = await supabase
        .from("users")
        .select("email,display_name")
        .eq("id", (cp as { user_id: string }).user_id)
        .maybeSingle();
      candidate = {
        candidate_id: cp.id,
        display_name: u?.display_name ?? null,
        email: u?.email ?? null,
        primary_specialization: cp.primary_specialization,
        overall_skill_proof_score: cp.overall_skill_proof_score,
        peak_window: (cp.peak_window as { startHour?: number; endHour?: number } | null) ?? null,
      };
    }
  }

  // Find the recruiter's company for default job_match creation
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const companyId = (membership as { company_id: string } | null)?.company_id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/company/search">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to search
          </Link>
        </Button>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">Schedule interview</h1>

      {!candidate ? (
        <Card>
          <CardHeader>
            <CardTitle>Pick a candidate first</CardTitle>
            <CardDescription>
              Run a search and click Schedule on a candidate to begin.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Candidate</CardTitle>
              <CardDescription>
                {candidate.display_name ?? candidate.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Specialization</span>
                <span>{candidate.primary_specialization ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skill proof</span>
                <span>{candidate.overall_skill_proof_score ?? 0}</span>
              </div>
              {candidate.peak_window?.startHour != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peak window</span>
                  <span>
                    {formatHour(candidate.peak_window.startHour)}–
                    {formatHour((candidate.peak_window.startHour + 4) % 24)}
                  </span>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Best time to reach: outside their peak focus block to avoid
                disrupting deep work.
              </p>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <ScheduleForm
              candidateId={candidate.candidate_id}
              candidateName={candidate.display_name ?? candidate.email ?? "candidate"}
              companyId={companyId}
              recruiterId={user.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatHour(h: number): string {
  const v = h % 24;
  const ampm = v < 12 ? "am" : "pm";
  const display = v % 12 === 0 ? 12 : v % 12;
  return `${display}${ampm}`;
}
