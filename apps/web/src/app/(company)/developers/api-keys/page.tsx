// apps/web/src/app/(company)/developers/api-keys/page.tsx
// 11/10 — Developer console: programmatic API keys + webhook subscriptions.
//
// Server component: lists the calling user's API keys (via the safe view
// exposed by /api/api-keys GET) and their webhook subscriptions, then
// hands interaction over to <DeveloperConsoleClient/>.
//
// URL: /developers/api-keys  (the (company) route group is organisational
// only; the developer console is not company-scoped — any authed user can
// use it.)

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeveloperConsoleClient } from "./developer-console-client";
import type { ApiKey, WebhookSubscription, WebhookEvent } from "@antarix/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DeveloperConsolePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/developers/api-keys");
  }

  // 1. List the user's API keys via the safe view.
  const { data: keysRaw } = await supabase
    .from("api_keys_safe")
    .select("id, subject_id, name, key_prefix, scopes, rate_limit_rpm, last_used_at, revoked_at, created_at")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false });

  const apiKeys: ApiKey[] = ((keysRaw ?? []) as Array<{
    id: string;
    subject_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    rate_limit_rpm: number;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>).map((k) => ({
    id: k.id,
    subject_id: k.subject_id,
    name: k.name,
    key_prefix: k.key_prefix,
    scopes: k.scopes.filter((s): s is ApiKey["scopes"][number] =>
      ["read:public_profile", "read:verifiable_credential", "webhook:subscribe", "read:placement_aggregate"].includes(s),
    ),
    rate_limit_rpm: k.rate_limit_rpm,
    last_used_at: k.last_used_at,
    revoked_at: k.revoked_at,
    created_at: k.created_at,
  }));

  // 2. List the user's webhook subscriptions (via the owning api_key rows).
  const apiKeyIds = apiKeys.map((k) => k.id);
  let subscriptions: WebhookSubscription[] = [];
  if (apiKeyIds.length > 0) {
    const { data: subsRaw } = await supabase
      .from("webhook_subscriptions")
      .select("id, api_key_id, event, target_url, active, created_at")
      .in("api_key_id", apiKeyIds)
      .order("created_at", { ascending: false });
    subscriptions = ((subsRaw ?? []) as Array<{
      id: string;
      api_key_id: string;
      event: string;
      target_url: string;
      active: boolean;
      created_at: string;
    }>).map((s) => ({
      id: s.id,
      api_key_id: s.api_key_id,
      event: s.event as WebhookEvent,
      target_url: s.target_url,
      active: s.active,
      created_at: s.created_at,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer console</h1>
        <p className="text-muted-foreground">
          Programmatic access to the public Antarix API. Mint keys, register webhook
          subscriptions, and copy your plaintext key now — it will not be shown again.
        </p>
      </div>
      <DeveloperConsoleClient
        initialApiKeys={apiKeys}
        initialSubscriptions={subscriptions}
      />
    </div>
  );
}
