"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Save } from "lucide-react";

interface AnswerDetailActionsProps {
  qaId: string;
  initialEditedAnswer: string;
  status: "pending" | "approved" | "rejected";
}

export function AnswerDetailActions({
  qaId,
  initialEditedAnswer,
  status,
}: AnswerDetailActionsProps) {
  const router = useRouter();
  const [editedAnswer, setEditedAnswer] = useState(initialEditedAnswer);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function saveEdit() {
    startTransition(async () => {
      setSaved(false);
      const res = await fetch(`/api/talent-twin/qa/${qaId}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: editedAnswer }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  async function approve() {
    startTransition(async () => {
      await fetch(`/api/talent-twin/qa/${qaId}/approve`, { method: "POST" });
      router.refresh();
    });
  }

  async function reject() {
    startTransition(async () => {
      await fetch(`/api/talent-twin/qa/${qaId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edit: editedAnswer !== initialEditedAnswer ? editedAnswer : undefined }),
      });
      router.refresh();
    });
  }

  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Edit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-answer">Edited answer (optional)</Label>
          <Textarea
            id="edit-answer"
            rows={8}
            value={editedAnswer}
            onChange={(e) => setEditedAnswer(e.target.value)}
            disabled={isApproved || isRejected}
            className="text-sm"
          />
        </div>

        {isApproved && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Approved — answer is visible to the recruiter.
          </p>
        )}
        {isRejected && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <XCircle className="h-4 w-4" />
            Rejected — recruiter will see your edited version (if provided) or "Question declined."
          </p>
        )}

        {!isApproved && !isRejected && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={saveEdit}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved" : "Save Draft"}
            </Button>
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
              variant="destructive"
              className="gap-1.5"
              onClick={reject}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
