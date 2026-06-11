import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, CheckCircle2, Clock, XCircle } from "lucide-react";
import { OptInToggle } from "./opt-in-toggle";
import type { Database } from "@antarix/types/database";

type ChunkRow = {
  chunk_type: string;
  metadata: Database["public"]["Tables"]["talent_twin_chunks"]["Row"]["metadata"];
  created_at: string;
};

export default async function TalentTwinPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("talent_twin_opt_in")
    .eq("id", user.id)
    .single();

  const optIn = userData?.talent_twin_opt_in ?? false;
  let chunks: ChunkRow[] = [];

  if (optIn) {
    const { data } = await supabase
      .from("talent_twin_chunks")
      .select("chunk_type, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    chunks = (data ?? []) as ChunkRow[];
  }

  const byType: Record<string, number> = {};
  for (const c of chunks) {
    byType[c.chunk_type] = (byType[c.chunk_type] ?? 0) + 1;
  }
  const totalChunks = chunks.length;

  const repoSet = new Set<string>();
  for (const c of chunks) {
    const repo = (c.metadata as Record<string, unknown>)?.repo as string | undefined;
    if (repo) repoSet.add(repo);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Talent Twin</h1>
          <p className="text-muted-foreground mt-1">
            Let recruiters ask questions about your work. You stay in control.
          </p>
        </div>
        <OptInToggle initialOptIn={optIn} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {optIn ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{optIn ? "Active" : "Disabled"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {optIn ? "Recruiters can ask about your work" : "Opt in to enable recruiter Q&A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data Chunks</CardTitle>
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChunks.toLocaleString()}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(byType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Repositories</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repoSet.size}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all connected sources
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About AI Talent Twin</CardTitle>
          <CardDescription>
            When enabled, your GitHub commits, IDE sessions, and collaboration data are
            chunked and embedded into a searchable knowledge base. Recruiters on Pro+ plans
            can ask natural-language questions about your work. Every answer includes
            citations back to the original source.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• You can revoke access at any time — all chunks are deleted within 60 seconds.</p>
          <p>• You can also issue authorship badges for specific commits to showcase on your profile.</p>
          <p>• Q&A interactions are logged with hashed questions for auditability.</p>
        </CardContent>
      </Card>
    </div>
  );
}
