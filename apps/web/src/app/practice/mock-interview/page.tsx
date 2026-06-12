"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, StopCircle, MessageSquare } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Role = "interviewer" | "student";

type Turn = {
  id?: string;
  role: Role;
  content: string;
  pending?: boolean;
};

const TOPICS = [
  "System design — URL shortener",
  "System design — Twitter feed",
  "DSA — Graphs & BFS/DFS",
  "DSA — Dynamic programming",
  "Behavioural — conflict resolution",
  "Behavioural — project failure post-mortem",
];

const SSE_HEADERS_OK = (s: string) => s.startsWith("data:");

export default function MockInterviewPage() {
  const [topic, setTopic] = useState<string | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rubric, setRubric] = useState<{ clarity: number; depth: number; correctness: number; summary: string } | null>(null);
  const [scoreContrib, setScoreContrib] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const send = useMockInterviewStream(
    interviewId,
    input,
    setInput,
    setTurns,
    streaming,
    setStreaming,
    setError,
    abortRef
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function start(t: string) {
    setBusy(true);
    setError(null);
    setRubric(null);
    setScoreContrib(null);
    setTurns([]);
    setTopic(t);
    try {
      const res = await fetch("/api/mock-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        interview_id?: string;
        first_question?: string;
        error?: string;
      };
      if (!res.ok || !data.interview_id) {
        setError(data.error ?? "Failed to start interview");
        return;
      }
      setInterviewId(data.interview_id);
      setTurns([{ role: "interviewer", content: data.first_question ?? "" }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }


  function stop() {
    abortRef.current?.abort();
  }

  async function complete() {
    if (!interviewId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mock-interview/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interview_id: interviewId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        rubric?: { clarity: number; depth: number; correctness: number; summary: string };
        score_contribution?: number;
        error?: string;
      };
      if (!res.ok || !data.rubric) {
        setError(data.error ?? "Failed to complete");
        return;
      }
      setRubric(data.rubric);
      setScoreContrib(data.score_contribution ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Picker state.
  if (!interviewId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Mock interview
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a topic. An LLM interviewer will ask open-ended questions, then score you on clarity,
          depth, and correctness at the end.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {TOPICS.map((t) => (
            <Button
              key={t}
              variant="outline"
              className="justify-start text-left"
              onClick={() => start(t)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
              <span className="ml-1">{t}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Mock interview
          </h1>
          <p className="text-xs text-muted-foreground">Topic: {topic}</p>
        </div>
        <div className="flex gap-2">
          {streaming ? (
            <Button variant="outline" size="sm" onClick={stop}>
              <StopCircle className="h-3 w-3" /> Stop
            </Button>
          ) : (
            <Button onClick={complete} size="sm" disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Complete & score"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
            {turns.map((t, i) => (
              <div
                key={i}
                className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    t.role === "student"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
                    {t.role === "student" ? "You" : "Interviewer"}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {t.content}
                    {t.pending && <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-current align-middle" />}
                  </p>
                </div>
              </div>
            ))}
            {turns.length === 0 && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </CardContent>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your response…"
          disabled={streaming}
          maxLength={4000}
        />
        <Button type="submit" disabled={streaming || !input.trim()}>
          {streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rubric && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Rubric</span>
              {scoreContrib != null && <Badge>+{scoreContrib}% to score (cap 5%/wk)</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Clarity" value={rubric.clarity} />
              <Stat label="Depth" value={rubric.depth} />
              <Stat label="Correctness" value={rubric.correctness} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{rubric.summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}/10</p>
    </div>
  );
}

function useMockInterviewStream(
  interviewId: string | null,
  input: string,
  setInput: React.Dispatch<React.SetStateAction<string>>,
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
  streaming: boolean,
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  abortRef: React.MutableRefObject<AbortController | null>
) {
  return async function send() {
    if (!interviewId || !input.trim() || streaming) return;
    const message = input.trim();
    setInput("");
    setTurns((prev) => [...prev, { role: "student", content: message }, { role: "interviewer", content: "", pending: true }]);
    setStreaming(true);
    setError(null);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const res = await fetch("/api/mock-interview/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({ interview_id: interviewId, message }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        setError(text || "Stream failed");
        setTurns((prev) => prev.slice(0, -1));
        return;
      }
      await processStream(res.body.getReader(), setTurns, setError);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };
}

async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!SSE_HEADERS_OK(line)) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload) as { delta?: string; error?: string; done?: boolean };
        if (obj.error) {
          setError(typeof obj.error === "string" ? obj.error : "Stream error");
          continue;
        }
        if (obj.delta) {
          assembled += obj.delta;
          setTurns((prev) => {
            const next = prev.slice();
            const last = next[next.length - 1];
            if (last && last.role === "interviewer") {
              next[next.length - 1] = { ...last, content: assembled, pending: true };
            }
            return next;
          });
        }
        if (obj.done) {
          setTurns((prev) => {
            const next = prev.slice();
            const last = next[next.length - 1];
            if (last && last.role === "interviewer") {
              next[next.length - 1] = { ...last, pending: false };
            }
            return next;
          });
        }
      } catch { /* ignore */ }
    }
  }
}
