"use client";

// T-ATS-006 / T-ATS-007 — Client-side workspace for the recruiter ATS
// page. Owns:
//   • "Add connection" dialog (POST /api/ats/connect)
//   • "Add saved search" dialog (POST /api/ats/saved-search)
//   • Connection list with status badges + revoke button
//   • Per-connection saved-search list with active toggle
//   • Recent sync log table
//
// After every mutation we re-fetch the relevant slice via the
// browser Supabase client (RLS keeps the result scoped to the
// current user) and patch local state. We deliberately don't use
// router.refresh() because the page is server-rendered with a
// non-cached dynamic segment and the fresh data is small.

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export interface AtsConnection {
  id: string;
  provider: "greenhouse" | "lever";
  status: "active" | "paused" | "revoked";
  pool_id: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export interface AtsSavedSearch {
  id: string;
  connection_id: string;
  name: string;
  query_json: {
    skills?: string[];
    min_score?: number;
    verified_only?: boolean;
    graduation_year?: number;
    institutions?: string[];
  };
  min_score: number;
  active: boolean;
  last_evaluated_at: string | null;
  created_at: string;
}

export interface AtsLogEntry {
  id: number | string;
  connection_id: string;
  saved_search_id: string | null;
  student_id: string;
  status: "success" | "retry" | "failed_permanent";
  attempt: number;
  error: string | null;
  pushed_at: string;
  // Supabase PostgREST joins return arrays even for to-one relations.
  // We model the array shape here and unwrap on render.
  users: { full_name: string | null; email: string | null }[] | null;
}

export interface AtsWorkspaceData {
  connections: AtsConnection[];
  savedSearches: AtsSavedSearch[];
  log: AtsLogEntry[];
}

export function AtsWorkspace({ initial }: { initial: AtsWorkspaceData }) {
  const [data, setData] = useState<AtsWorkspaceData>(initial);
  const [refreshing, startRefresh] = useTransition();

  async function refresh() {
    startRefresh(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: conns }, { data: searches }, { data: log }, { data: ownConns }] =
        await Promise.all([
          supabase
            .from("ats_connections")
            .select("id,provider,status,pool_id,last_sync_at,created_at")
            .eq("recruiter_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("ats_saved_searches")
            .select("id,connection_id,name,query_json,min_score,active,last_evaluated_at,created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("ats_sync_log")
            .select(
              "id,connection_id,saved_search_id,student_id,status,attempt,error,pushed_at,users!ats_sync_log_student_id_fkey(full_name,email)",
            )
            .order("pushed_at", { ascending: false })
            .limit(20),
          supabase.from("ats_connections").select("id").eq("recruiter_id", user.id),
        ]);
      const ownIds = new Set((ownConns ?? []).map((c: { id: string }) => c.id));
      setData({
        connections: (conns ?? []) as AtsConnection[],
        savedSearches: ((searches ?? []) as AtsSavedSearch[]).filter((s) =>
          ownIds.has(s.connection_id),
        ),
        log: ((log ?? []) as AtsLogEntry[]).filter((l) => ownIds.has(l.connection_id)),
      });
    });
  }

  const searchesByConn = useMemo(() => {
    const m = new Map<string, AtsSavedSearch[]>();
    for (const s of data.savedSearches) {
      const list = m.get(s.connection_id) ?? [];
      list.push(s);
      m.set(s.connection_id, list);
    }
    return m;
  }, [data.savedSearches]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.connections.length} connection{data.connections.length === 1 ? "" : "s"} •{" "}
          {data.savedSearches.length} saved search{data.savedSearches.length === 1 ? "" : "es"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="ml-1">Refresh</span>
          </Button>
          <AddConnectionDialog onCreated={refresh} />
        </div>
      </div>

      {data.connections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No ATS connections yet. Click <b>Add connection</b> to push matched candidates to your
            Greenhouse or Lever instance.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.connections.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              searches={searchesByConn.get(c.id) ?? []}
              onChange={refresh}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent sync activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync attempts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.log.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.pushed_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.users?.[0]?.full_name ?? row.users?.[0]?.email ?? row.student_id}
                    </TableCell>
                    <TableCell>
                      <SyncStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{row.attempt}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {row.error ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionCard({
  connection,
  searches,
  onChange,
}: {
  connection: AtsConnection;
  searches: AtsSavedSearch[];
  onChange: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function revoke() {
    if (!confirm(`Revoke ${connection.provider} connection?`)) return;
    setRevoking(true);
    const res = await fetch(`/api/ats/connect/${connection.id}`, { method: "DELETE" });
    setRevoking(false);
    if (!res.ok) {
      alert(`Revoke failed (${res.status})`);
      return;
    }
    onChange();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm capitalize">{connection.provider}</CardTitle>
          <ConnectionStatusBadge status={connection.status} />
          {connection.pool_id && (
            <Badge variant="outline" className="text-[10px]">
              pool {connection.pool_id}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Show"} searches
          </Button>
          {connection.status !== "revoked" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={revoke}
              disabled={revoking}
              className="text-destructive"
            >
              {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              <span className="ml-1">Revoke</span>
            </Button>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {searches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved searches on this connection.</p>
          ) : (
            searches.map((s) => (
              <SavedSearchRow key={s.id} search={s} onChange={onChange} />
            ))
          )}
          {connection.status !== "revoked" && (
            <AddSavedSearchDialog connectionId={connection.id} onCreated={onChange} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SavedSearchRow({
  search,
  onChange,
}: {
  search: AtsSavedSearch;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const skills = search.query_json?.skills ?? [];

  async function toggleActive(next: boolean) {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.from("ats_saved_searches").update({ active: next }).eq("id", search.id);
    setBusy(false);
    onChange();
  }

  return (
    <div className="flex items-center justify-between rounded border px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{search.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          min score {search.min_score}
          {skills.length > 0 && ` • skills: ${skills.join(", ")}`}
          {search.query_json?.verified_only && " • verified only"}
          {search.query_json?.graduation_year && ` • grad ${search.query_json.graduation_year}`}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {search.last_evaluated_at
            ? `last evaluated ${new Date(search.last_evaluated_at).toLocaleString()}`
            : "never evaluated"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">active</span>
        <Switch checked={search.active} onCheckedChange={toggleActive} disabled={busy} />
      </div>
    </div>
  );
}

function AddConnectionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"greenhouse" | "lever">("greenhouse");
  const [apiKey, setApiKey] = useState("");
  const [poolId, setPoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setWarning(null);
    const res = await fetch("/api/ats/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        api_key: apiKey,
        pool_id: poolId.trim() || undefined,
      }),
    });
    setBusy(false);
    if (res.status === 201) {
      const body = (await res.json().catch(() => ({}))) as {
        connection_id?: string;
        status?: string;
        warning?: string;
      };
      if (body.warning) setWarning(body.warning);
      setOpen(false);
      setApiKey("");
      setPoolId("");
      onCreated();
      return;
    }
    if (res.status === 429) {
      setError("Rate limit hit — try again in an hour.");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? `Failed (${res.status})`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3 w-3" /> <span className="ml-1">Add connection</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ATS connection</DialogTitle>
          <DialogDescription>
            We&apos;ll test the credentials once and store them encrypted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as "greenhouse" | "lever")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="greenhouse">Greenhouse</SelectItem>
                <SelectItem value="lever">Lever</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>API key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
            />
          </div>
          {provider === "greenhouse" && (
            <div>
              <Label>Prospect pool ID (optional)</Label>
              <Input
                value={poolId}
                onChange={(e) => setPoolId(e.target.value)}
                placeholder="e.g. 4123"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                If set, candidates are added to this pool after creation.
              </p>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !apiKey}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
        {warning && (
          <p className="text-xs text-amber-600">Connection saved, but {warning}.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddSavedSearchDialog({
  connectionId,
  onCreated,
}: {
  connectionId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [minScore, setMinScore] = useState(75);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [gradYear, setGradYear] = useState("");
  const [institutions, setInstitutions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSkills("");
    setMinScore(75);
    setVerifiedOnly(false);
    setGradYear("");
    setInstitutions("");
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const query_json = {
      skills: skills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      min_score: minScore,
      verified_only: verifiedOnly,
      ...(gradYear && { graduation_year: Number(gradYear) }),
      ...(institutions.trim() && {
        institutions: institutions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    };
    const res = await fetch("/api/ats/saved-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connection_id: connectionId,
        name,
        query_json,
        min_score: minScore,
      }),
    });
    setBusy(false);
    if (res.status === 201) {
      setOpen(false);
      reset();
      onCreated();
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? `Failed (${res.status})`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-3 w-3" /> <span className="ml-1">Add saved search</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New saved search</DialogTitle>
          <DialogDescription>
            Defines the candidate set pushed to this ATS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Senior React, 2026 batch"
            />
          </div>
          <div>
            <Label>Skills (comma-separated, case-insensitive)</Label>
            <Input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="react, typescript"
            />
          </div>
          <div>
            <Label>Min score: {minScore}</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Graduation year</Label>
              <Input
                type="number"
                value={gradYear}
                onChange={(e) => setGradYear(e.target.value)}
                placeholder="2026"
              />
            </div>
            <div>
              <Label>Institution IDs (comma)</Label>
              <Input
                value={institutions}
                onChange={(e) => setInstitutions(e.target.value)}
                placeholder="optional UUIDs"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded border px-3 py-2">
            <span className="text-sm">Verified candidates only</span>
            <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionStatusBadge({ status }: { status: AtsConnection["status"] }) {
  if (status === "active") return <Badge className="bg-green-600">active</Badge>;
  if (status === "paused") return <Badge variant="secondary">paused</Badge>;
  return <Badge variant="destructive">revoked</Badge>;
}

function SyncStatusBadge({ status }: { status: AtsLogEntry["status"] }) {
  if (status === "success") return <Badge className="bg-green-600">success</Badge>;
  if (status === "retry") return <Badge variant="secondary">retry</Badge>;
  return <Badge variant="destructive">failed</Badge>;
}
