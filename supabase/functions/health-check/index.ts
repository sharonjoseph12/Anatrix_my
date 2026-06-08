// supabase/functions/health-check/index.ts
// Reference implementation of withObservability for the other 27 Edge
// Functions. GET /functions/v1/health-check returns a small JSON document
// with a 30s in-memory cache so polling does not flood stdout.
//
// Local dev:  npx supabase functions serve health-check --no-verify-jwt
// Deploy:     npx supabase functions deploy health-check
//
// Copy-paste template for adopting observability in another function:
//
//   import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
//   import { withObservability } from "../_shared/observability.ts";
//
//   serve(withObservability("my-fn", async (req, ctx) => {
//     ctx.log.info("doing the thing");
//     return new Response(JSON.stringify({ ok: true }), {
//       headers: { "Content-Type": "application/json" },
//     });
//   }));

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withObservability } from "../_shared/observability.ts";

const VERSION = "1.0.0";
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  at: number;
  body: string;
}
let cache: CacheEntry | null = null;

serve(
  withObservability("health-check", async (_req, ctx) => {
    const now = Date.now();
    if (cache && now - cache.at < CACHE_TTL_MS) {
      ctx.log.info("health-check cache hit");
      return new Response(cache.body, {
        headers: { "Content-Type": "application/json" },
      });
    }
    const checks = {
      supabase_url_set: !!Deno.env.get("SUPABASE_URL"),
      service_role_key_set: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    };
    const body = JSON.stringify({ ok: true, version: VERSION, checks });
    cache = { at: now, body };
    ctx.log.info("health-check ok", { checks });
    return new Response(body, {
      headers: { "Content-Type": "application/json" },
    });
  }),
);
