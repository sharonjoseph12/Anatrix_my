"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
] as const;

type Language = (typeof LANGUAGES)[number]["value"];

export function SubmissionForm({ hackathonId }: { hackathonId: string }) {
  const router = useRouter();
  const [codeUrl, setCodeUrl] = useState("");
  const [language, setLanguage] = useState<Language>("python");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_url: codeUrl.trim(), language }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        submission_id?: string;
        status?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setOk("Submitted. Grading asynchronously — refresh in a few seconds.");
      setCodeUrl("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submit your solution</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="text-xs text-muted-foreground">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Code archive URL (signed Supabase Storage URL to a .zip / .tar.gz / single-file source)
            </label>
            <Input
              value={codeUrl}
              onChange={(e) => setCodeUrl(e.target.value)}
              type="url"
              placeholder="https://<project>.supabase.co/storage/v1/object/sign/..."
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {ok && <p className="text-sm text-emerald-600">{ok}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Submit
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
