// Recruiter-facing AI Talent Twin page for a single candidate:
// ask questions + view issued badges.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, BrainCircuit } from "lucide-react";
import { AskForm } from "./ask-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateTalentTwinPage({ params }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id: studentId } = await params;

  const { data: student } = await supabase
    .from("users")
    .select("display_name, talent_twin_opt_in")
    .eq("id", studentId)
    .single();

  if (!student || !student.talent_twin_opt_in) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">AI Talent Twin</h1>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BrainCircuit className="h-8 w-8 mx-auto mb-2" />
            <p>This candidate has not opted in to the AI Talent Twin.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: badgeChunks } = await supabase
    .from("talent_twin_chunks")
    .select("metadata")
    .eq("user_id", studentId);

  const badges = (badgeChunks ?? []).filter((c) => {
    const meta = c.metadata as Record<string, unknown>;
    return meta?.badge_nonce && meta?.badge_jwt;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Talent Twin</h1>
        <p className="text-muted-foreground mt-1">
          Ask questions about {student.display_name ?? "this candidate"}&apos;s work.
        </p>
      </div>

      <AskForm studentId={studentId} studentName={student.display_name ?? "this candidate"} />

      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Authorship Badges
            </CardTitle>
            <CardDescription>
              Cryptographically signed proof of authorship for selected commits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {badges.map((b, i) => {
              const meta = b.metadata as Record<string, unknown>;
              const jwt = meta?.badge_jwt as string | undefined;
              return (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{meta?.label as string ?? "Authorship Badge"}</p>
                      <p className="text-sm text-muted-foreground">
                        {(meta?.commits as string[])?.length ?? 0} commits ·{" "}
                        {(meta?.total_lines as number)?.toLocaleString() ?? 0} lines
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">Verified</Badge>
                      {jwt && (
                        <a
                          href={`/badges/verify?jwt=${encodeURIComponent(jwt)}`}
                          className="text-xs text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Verify
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
