import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(), "Content-Type": "application/json" } });
}

export async function validateAuth(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Error("Missing Authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: ue } = await supabase.auth.getUser();
  if (ue || !user) throw new Error("Not authenticated");
  return { supabase, user };
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  return null;
}

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

export function serveWithAuth(
  handler: (req: Request, supabase: ReturnType<typeof createClient>, user: any) => Promise<Response> | Response
) {
  serve(async (req: Request) => {
    const optionsRes = handleOptions(req);
    if (optionsRes) return optionsRes;

    let supabase;
    let user;
    try {
      const auth = await validateAuth(req);
      supabase = auth.supabase;
      user = auth.user;
    } catch (err: any) {
      return json({ error: err.message }, 401);
    }

    return handler(req, supabase, user);
  });
}

export async function getOptedInStudents(
  supabase: any,
  institution_id: string,
  batch_year: number
): Promise<{ user_id: string }[]> {
  const { data: members } = await supabase.from("institution_members")
    .select("user_id")
    .eq("institution_id", institution_id)
    .eq("role", "student")
    .eq("batch_year", batch_year || 0)
    .eq("opted_in", true);
  return members ?? [];
}
