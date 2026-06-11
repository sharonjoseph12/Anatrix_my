"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

export function AskForm({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    citations: Array<{ source_type: string; title: string; url: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ask() {
    if (!question.trim()) return;
    startTransition(async () => {
      setError(null);
      setAnswer(null);
      try {
        const tokenRes = await fetch("/api/auth/token").then((r) => r.json());
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/talent-twin-ask`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenRes.token}`,
            },
            body: JSON.stringify({
              user_ids: [studentId],
              question: question.trim(),
            }),
          },
        );
        const data = await res.json();
        if (res.ok) setAnswer(data);
        else setError(data.error?.message ?? "Failed to get answer");
      } catch {
        setError("Network error");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask about {studentName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. What distributed-systems work has this candidate done?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
          />
          <Button onClick={ask} disabled={!question.trim() || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Ask
          </Button>
        </CardContent>
      </Card>

      {answer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
            {answer.citations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Sources:</p>
                <ul className="list-disc list-inside space-y-1">
                  {answer.citations.map((c, i) => (
                    <li key={i} className="text-xs">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        {c.title}
                      </a>
                      <span className="text-muted-foreground"> ({c.source_type})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
