import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText } from "lucide-react";
import { PendingAnswerCard } from "./pending-answer-card";

export default async function PendingAnswersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: previews } = await supabase
    .from("answer_preview")
    .select("id, recruiter_question, llm_answer, citation_links, status, created_at, auto_approve_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const pendingCount = previews?.filter((p) => p.status === "pending").length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Answers</h1>
        <p className="text-muted-foreground mt-1">
          Review recruiter questions before they become visible. Answers auto-approve after 24h
          if no action is taken.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquareText className="h-5 w-5" />
            Recruiter Questions
            {pendingCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                · {pendingCount} pending
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!previews || previews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recruiter questions yet. When a recruiter asks about your work, it will appear here.
            </p>
          ) : (
            previews.map((p) => (
              <PendingAnswerCard
                key={p.id}
                id={p.id}
                recruiterQuestion={p.recruiter_question}
                llmAnswer={p.llm_answer}
                status={p.status as "pending" | "approved" | "rejected"}
                createdAt={p.created_at}
                autoApproveAt={p.auto_approve_at}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
