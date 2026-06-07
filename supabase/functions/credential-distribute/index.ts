// supabase/functions/credential-distribute/index.ts
// T068 helper — generate the per-channel distribution artifact (PDF/QR/LinkedIn share URL)
// and record a credential_distributions row.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CHANNELS = new Set(["link", "pdf", "qr", "linkedin_badge"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Missing Authorization" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: ue } = await supabase.auth.getUser();
  if (ue || !user) return json({ error: "Not authenticated" }, 401);

  const { channel, slug } = await req.json() as { channel?: string; slug?: string };
  if (!channel || !CHANNELS.has(channel)) return json({ error: "invalid channel" }, 400);
  if (!slug) return json({ error: "slug required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: cred } = await supabase.from("verifiable_credentials")
    .select("id,public_slug,snapshot_overall_score,snapshot_cohort_percentile,snapshot_taken_at")
    .eq("public_slug", slug).eq("user_id", user.id).maybeSingle();
  if (!cred) return json({ error: "credential not found" }, 404);

  const baseUrl = Deno.env.get("APP_PUBLIC_URL") ?? "https://antarix.app";
  const verifyUrl = `${baseUrl}/verify/${cred.public_slug}`;

  let url = verifyUrl;
  let artifactKey: string | null = null;
  if (channel === "linkedin_badge") {
    url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
  } else if (channel === "pdf" || channel === "qr") {
    // For the scaffold we just return the verify URL; production would render
    // a PDF or upload a QR PNG to storage and return the signed URL.
    artifactKey = `credential-artifacts/${cred.id}/${channel}.${channel === "pdf" ? "pdf" : "png"}`;
  }

  await admin.from("credential_distributions").upsert({
    credential_id: cred.id,
    channel: channel as "link" | "pdf" | "qr" | "linkedin_badge",
    artifact_url: artifactKey ?? url,
  }, { onConflict: "credential_id,channel" });

  return json({ url, artifact_storage_key: artifactKey, slug: cred.public_slug });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
