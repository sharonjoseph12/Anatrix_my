// supabase/functions/recruiter-credit/index.ts
// Returns { used, remaining, reset_at } for the calling recruiter's company.
// Also handles the monthly reset: any time this is called, if the reset date
// is in the past, refill the credit balance to the per-company cap.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEFAULT_MONTHLY_CAP = 200;

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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const cap = Number(Deno.env.get("RECRUITER_MONTHLY_SEARCH_CAP") ?? DEFAULT_MONTHLY_CAP);

  // Load + reset if needed
  const { data: company } = await admin.from("companies")
    .select("id,monthly_search_credit_balance,monthly_search_credit_reset_at,plan")
    .eq("owner_user_id", user.id).maybeSingle();
  if (!company) return json({ error: "no_company_profile" }, 403);

  const now = new Date();
  const resetAt = company.monthly_search_credit_reset_at ? new Date(company.monthly_search_credit_reset_at) : null;
  let balance = company.monthly_search_credit_balance ?? 0;
  if (!resetAt || now > resetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    await admin.from("companies").update({
      monthly_search_credit_balance: cap,
      monthly_search_credit_reset_at: nextReset,
    }).eq("owner_user_id", user.id);
    balance = cap;
    return json({ used: 0, remaining: cap, reset_at: nextReset, plan: company.plan ?? "free" });
  }
  return json({
    used: cap - balance,
    remaining: balance,
    reset_at: resetAt.toISOString(),
    plan: company.plan ?? "free",
  });
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
