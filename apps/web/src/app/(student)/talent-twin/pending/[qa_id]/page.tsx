import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnswerDetailActions } from "./answer-detail-actions";

export default async function PendingAnswerDetailPage({
  params,
}: {
  params: Promise<{ qa_id: string }>;
}) {
  const { qa_id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: preview } = await supabase
    .from("answer_preview")
    .select("*")
    .eq("id", qa_id)
    .eq("student_id", user.id)
    .single();

  if (!preview) notFound();

  const statusBadge = {
    pending: <Badge variant="secondary">Pending</Badge>,
    approved: <Badge className="bg-emerald-500">Approved</Badge>,
    rejected: <Badge variant="destructive">Rejected</Badge>,
  }[preview.status as "pending" | "approved" | "rejected"];

  const citations = (preview.citation_links ?? []) as Array<{
    number: number;
    source_url: string;
    title: string;
    chunk_type: string;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/talent-twin/pending"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to pending answers
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Review Answer</h1>
          {statusBadge}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recruiter Question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {preview.recruiter_question}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested Answer</CardTitle>
          <CardDescription>
            Asked on {new Date(preview.created_at).toLocaleDateString()} ·
            Auto-approves {new Date(preview.auto_approve_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/50 p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {preview.llm_answer}
          </div>

          {citations.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Citations:</p>
              {citations.map((c, i) => (
                <p key={i}>
                  [{c.number}]{" "}
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {c.title}
                  </a>
                  {" · "}
                  <span className="italic">{c.chunk_type}</span>
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AnswerDetailActions
        qaId={qa_id}
        initialEditedAnswer={preview.edited_answer ?? preview.llm_answer}
        status={preview.status as "pending" | "approved" | "rejected"}
      />
    </div>
  );
}
