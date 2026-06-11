import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";
import { withRateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized", message: "Invalid or expired JWT" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { opt_in } = await req.json();
  if (typeof opt_in !== "boolean") {
    return new Response(JSON.stringify({ error: "invalid_request", message: "opt_in must be a boolean" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (opt_in) {
    const { error } = await client.from("users").update({ talent_twin_opt_in: true }).eq("id", user.id);
    if (error) {
      return new Response(JSON.stringify({ error: "internal_error", message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const { count } = await client.from("talent_twin_chunks").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    return new Response(JSON.stringify({ opt_in: true, chunks_count: count ?? 0, message: "AI Talent Twin is now enabled. Your work is visible to recruiters on Pro+ plans." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    const { error: deleteError } = await client.rpc("delete_student_chunks", { p_user_id: user.id });
    if (deleteError) {
      console.error(`delete chunks for ${user.id}: ${deleteError.message}`);
    }

    const { error } = await client.from("users").update({ talent_twin_opt_in: false }).eq("id", user.id);
    if (error) {
      return new Response(JSON.stringify({ error: "internal_error", message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ opt_in: false, chunks_deleted: 0, message: "AI Talent Twin is now disabled. Your chunks have been deleted. Re-enabling will take 24 hours to rebuild." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withObservability(withRateLimit(handler, "talent-twin-opt-in"));
