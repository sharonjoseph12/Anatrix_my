"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface PendingAnswerCardProps {
  id: string;
  recruiterQuestion: string;
  llmAnswer: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  autoApproveAt: string;
}

export function PendingAnswerCard({
  id,
  recruiterQuestion,
  llmAnswer,
  status,
  createdAt,
  autoApproveAt,
}: PendingAnswerCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function approve() {
    startTransition(async () => {
      await fetch(`/api/talent-twin/qa/${id}/approve`, { method: "POST" });
      router.refresh();
    });
  }

  async function reject() {
    startTransition(async () => {
      await fetch(`/api/talent-twin/qa/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.refresh();
    });
  }

  const statusBadge = {
    pending: <Badge variant="secondary">Pending</Badge>,
    approved: <Badge className="bg-emerald-500">Approved</Badge>,
    rejected: <Badge variant="destructive">Rejected</Badge>,
  }[status];

  const truncatedQuestion =
    recruiterQuestion.length > 200
      ? recruiterQuestion.slice(0, 200) + "…"
      : recruiterQuestion;
  const truncatedAnswer =
    llmAnswer.length > 300
      ? llmAnswer.slice(0, 300) + "…"
      : llmAnswer;

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleDateString()} · Auto-approves{" "}
              {new Date(autoApproveAt).toLocaleDateString()}
            </p>
            <p className="font-medium text-sm leading-relaxed">{truncatedQuestion}</p>
          </div>
          {statusBadge}
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="text-xs font-medium text-muted-foreground mb-1">Suggested answer</p>
          <p className="whitespace-pre-wrap">{truncatedAnswer}</p>
        </div>

        {status === "pending" && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={approve}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={reject}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Reject
            </Button>
            <Link href={`/talent-twin/pending/${id}`}>
              <Button size="sm" variant="ghost">Edit & Review</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
