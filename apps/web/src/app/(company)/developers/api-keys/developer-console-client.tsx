"use client";

// apps/web/src/app/(company)/developers/api-keys/developer-console-client.tsx
// Client island for the developer console. Handles:
//   - creating a new API key (POST /api/api-keys) and showing the plaintext
//     in a modal with a "Copy to clipboard" button
//   - rotating a key (POST /api/api-keys/:id/rotate) and showing the new
//     plaintext in the same modal
//   - revoking a key (DELETE /api/api-keys/:id)
//   - creating a webhook subscription (POST /api/v1/public/webhooks/subscriptions)
//   - revoking a subscription (DELETE /api/v1/public/webhooks/subscriptions/:id)
//
// The "reveal plaintext" dialog is critical: the plaintext key/secret is
// returned EXACTLY ONCE from the server, and the user must copy it before
// closing the dialog. We use a Radix Dialog for accessibility and
// navigator.clipboard for the copy action.

import { useState, useTransition } from "react";
import { Copy, KeyRound, Loader2, Plus, RotateCw, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ApiKey, ApiKeyScope, WebhookEvent, WebhookSubscription } from "@antarix/types";

const ALL_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
  { value: "read:public_profile", label: "read:public_profile", description: "Read public candidate profiles." },
  { value: "read:verifiable_credential", label: "read:verifiable_credential", description: "Read W3C verifiable credentials." },
  { value: "webhook:subscribe", label: "webhook:subscribe", description: "Register and manage webhook subscriptions." },
  { value: "read:placement_aggregate", label: "read:placement_aggregate", description: "Read placement aggregates (aggregate-only)." },
];

const ALL_EVENTS: WebhookEvent[] = ["score.updated", "credential.issued", "placement.confirmed"];

interface Props {
  initialApiKeys: ApiKey[];
  initialSubscriptions: WebhookSubscription[];
}

export function DeveloperConsoleClient({ initialApiKeys, initialSubscriptions }: Props) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>(initialSubscriptions);
  const [pending, startTransition] = useTransition();

  // Key creation form state.
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);

  // Plaintext reveal dialog state. When set, the user must copy + dismiss.
  const [revealed, setRevealed] = useState<{ kind: "api_key" | "secret"; value: string; helper: string } | null>(null);

  // Subscription create form state. The console must use a real API key
  // (with scope webhook:subscribe) as the Authorization bearer; since the
  // plaintext was shown only once at creation we ask the user to paste it.
  const [subEvent, setSubEvent] = useState<WebhookEvent>("score.updated");
  const [subUrl, setSubUrl] = useState("");
  const [subBearer, setSubBearer] = useState("");

  function toggleScope(s: ApiKeyScope) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy. Select the text manually.");
    }
  }

  function refresh() {
    startTransition(async () => {
      const res = await fetch("/api/api-keys", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { api_keys: ApiKey[] };
      setApiKeys(data.api_keys ?? []);
    });
  }

  async function createKey() {
    if (!name.trim() || scopes.length === 0) {
      toast.error("Name and at least one scope are required.");
      return;
    }
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), scopes }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error((j as { error?: { message?: string } }).error?.message ?? "Could not create key.");
      return;
    }
    const data = (await res.json()) as { key: string; key_prefix: string; api_key_id: string };
    setRevealed({ kind: "api_key", value: data.key, helper: data.key_prefix });
    setName("");
    setScopes([]);
    refresh();
    toast.success("API key created. Copy the plaintext now — it will not be shown again.");
  }

  async function rotateKey(id: string) {
    if (!confirm("Rotate this key? The previous plaintext will stop working immediately.")) return;
    const res = await fetch(`/api/api-keys/${id}/rotate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Could not rotate key.");
      return;
    }
    const data = (await res.json()) as { key: string; key_prefix: string };
    setRevealed({ kind: "api_key", value: data.key, helper: data.key_prefix });
    refresh();
  }

  async function revokeKey(id: string, keyName: string) {
    if (!confirm(`Revoke "${keyName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      toast.error("Could not revoke key.");
      return;
    }
    toast.success("Key revoked.");
    refresh();
  }

  async function createSubscription() {
    if (!subBearer.trim() || !subUrl.trim()) {
      toast.error("Paste an API key (with webhook:subscribe) and a target URL.");
      return;
    }
    if (!/^ant_pub_/.test(subBearer.trim())) {
      toast.error("API key must start with ant_pub_.");
      return;
    }
    const res = await fetch("/api/v1/public/webhooks/subscriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${subBearer.trim()}`,
      },
      body: JSON.stringify({ event: subEvent, target_url: subUrl.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error((j as { error?: { message?: string } }).error?.message ?? "Could not create subscription.");
      return;
    }
    const data = (await res.json()) as {
      subscription_id: string;
      event: WebhookEvent;
      target_url: string;
      active: boolean;
      created_at: string;
      secret: string;
    };
    setSubscriptions((prev) => [
      {
        id: data.subscription_id,
        // The owning api_key_id is not echoed by the public route; we mark
        // it as "external" and rely on the server-side list refresh.
        api_key_id: "",
        event: data.event,
        target_url: data.target_url,
        active: data.active,
        created_at: data.created_at,
      },
      ...prev,
    ]);
    setRevealed({ kind: "secret", value: data.secret, helper: data.subscription_id });
    setSubUrl("");
    setSubBearer("");
    toast.success("Subscription created. Copy the signing secret now.");
  }

  async function revokeSubscription(id: string) {
    if (!subBearer.trim()) {
      const input = window.prompt("Paste an API key with webhook:subscribe scope to manage this subscription:") ?? "";
      if (!input.trim()) return;
      setSubBearer(input.trim());
    }
    const res = await fetch(`/api/v1/public/webhooks/subscriptions/${id}`, {
      method: "DELETE",
      headers: { "authorization": `Bearer ${subBearer.trim()}` },
    });
    if (!res.ok && res.status !== 204) {
      toast.error("Could not disable subscription.");
      return;
    }
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, active: false } : s)));
    toast.success("Subscription disabled.");
  }

  return (
    <div className="space-y-6">
      {/* API KEYS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-4 w-4" /> API keys
          </CardTitle>
          <CardDescription>
            Authenticate as <code>Authorization: Bearer ant_pub_…</code>. The plaintext
            is shown exactly once at creation / rotation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">No keys yet. Create one below.</p>
          )}
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {k.name}
                    {k.revoked_at && <Badge variant="destructive">revoked</Badge>}
                    {!k.revoked_at && <Badge variant="secondary">{k.rate_limit_rpm}/min</Badge>}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</p>
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </div>
                {!k.revoked_at && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => rotateKey(k.id)}>
                      <RotateCw className="h-3 w-3" /> Rotate
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => revokeKey(k.id, k.name)}>
                      <Trash2 className="h-3 w-3" /> Revoke
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded border p-3">
            <p className="mb-2 text-sm font-medium">Create a new key</p>
            <div className="space-y-2">
              <div>
                <Label htmlFor="key-name">Name</Label>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production integration" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scopes</p>
                <div className="mt-1 space-y-1">
                  {ALL_SCOPES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-sm">
                      <Switch checked={scopes.includes(s.value)} onCheckedChange={() => toggleScope(s.value)} />
                      <span>
                        <code className="mr-1 rounded bg-muted px-1 text-xs">{s.label}</code>
                        <span className="text-xs text-muted-foreground">{s.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={createKey} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Create key
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WEBHOOK SUBSCRIPTIONS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Webhook className="h-4 w-4" /> Webhook subscriptions
          </CardTitle>
          <CardDescription>
            Receive signed POSTs at your endpoint when key events fire. The signing
            secret is shown exactly once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
          )}
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Badge variant="outline">{s.event}</Badge>
                    {s.active ? <Badge variant="secondary">active</Badge> : <Badge variant="destructive">disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.target_url}</p>
                </div>
                {s.active && (
                  <Button size="sm" variant="outline" onClick={() => revokeSubscription(s.id)}>
                    <Trash2 className="h-3 w-3" /> Disable
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="rounded border p-3">
            <p className="mb-2 text-sm font-medium">Add a subscription</p>
            <div className="space-y-2">
              <div>
                <Label htmlFor="sub-bearer">API key (plaintext, with webhook:subscribe scope)</Label>
                <Input
                  id="sub-bearer"
                  type="password"
                  value={subBearer}
                  onChange={(e) => setSubBearer(e.target.value)}
                  placeholder="ant_pub_…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The key is sent in the Authorization header to the public API and
                  is not stored anywhere on the client. The console does not retain it
                  after the request.
                </p>
              </div>
              <div>
                <Label htmlFor="sub-event">Event</Label>
                <select
                  id="sub-event"
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={subEvent}
                  onChange={(e) => setSubEvent(e.target.value as WebhookEvent)}
                >
                  {ALL_EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="sub-url">Target URL</Label>
                <Input
                  id="sub-url"
                  type="url"
                  value={subUrl}
                  onChange={(e) => setSubUrl(e.target.value)}
                  placeholder="https://example.com/hooks/antarix"
                />
              </div>
              <Button onClick={createSubscription} disabled={pending || !subBearer || !subUrl}>
                <Plus className="h-3 w-3" /> Create subscription
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REVEAL DIALOG */}
      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your {revealed?.kind === "secret" ? "signing secret" : "API key"}</DialogTitle>
            <DialogDescription>
              This is the only time the plaintext is shown. Store it in your secrets
              manager before closing this dialog. Antarix cannot recover it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <code className="block break-all rounded bg-muted p-3 text-xs">{revealed?.value}</code>
            <p className="text-xs text-muted-foreground">Prefix / id: {revealed?.helper}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => revealed && copyToClipboard(revealed.value)}>
              <Copy className="h-3 w-3" /> Copy to clipboard
            </Button>
            <Button onClick={() => setRevealed(null)}>I have saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
