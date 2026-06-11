// spec: specs/010-ai-talent-twin/spec.md US1 scenario 9-10

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BATCH_SIZE = 100;

async function handler(_req: Request): Promise<Response> {
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let totalApproved = 0;
  let batch = 0;

  while (true) {
    const { data: rows, error } = await client
      .from("answer_preview")
      .select("id")
      .eq("status", "pending")
      .lte("auto_approve_at", new Date().toISOString())
      .limit(BATCH_SIZE);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!rows || rows.length === 0) break;

    const ids = rows.map((r) => r.id);

    const { error: updateError } = await client
      .from("answer_preview")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) {
      console.error(JSON.stringify({
        event: "talent_twin_auto_approve",
        count: ids.length,
        batch,
        error: updateError.message,
      }));
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    totalApproved += ids.length;
    console.log(JSON.stringify({
      event: "talent_twin_auto_approve",
      count: ids.length,
      batch,
    }));
    batch++;
  }

  return new Response(
    JSON.stringify({ approved: totalApproved, batches: batch }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export default withObservability(handler);
