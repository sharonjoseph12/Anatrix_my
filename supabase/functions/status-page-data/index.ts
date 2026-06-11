// supabase/functions/status-page-data/index.ts
// T-PUB-STATUS — public status-page data aggregator.
//
// Endpoint:   GET /functions/v1/status-page-data
// Auth:       None (public, anonymous + CDN-edge rate limit).
// Rate limit: 60 burst / 1 rps sustained (the `_default` config in
//             _shared/rate-limit.ts).
// Caching:    60s in-memory in this isolate + 30s CDN via Cache-Control.
// Output:     200 always. JSON envelope with the worst-of-all-subsystems
//             status, per-subsystem details, incidents, scheduled
//             maintenances. A 5xx from this function is itself an outage
//             of the status page; the handler degrades to an `unknown`
//             envelope rather than 5xx.
//
// All 7 subsystem checks run in parallel via Promise.allSettled; a single
// subsystem's failure (timeout, 5xx, network error) does NOT block the
// others. Each fetch has a 5s AbortController-driven timeout.
//
// Local dev:  npx supabase functions serve status-page-data --no-verify-jwt
// Deploy:     npx supabase functions deploy status-page-data --no-verify-jwt
//
// Copy-paste template for the observability + rate-limit composition — see
// supabase/functions/health-check/index.ts header and
// supabase/functions/_shared/rate-limit.ts §"withRateLimit".

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";
import { withRateLimit } from "../_shared/rate-limit.ts";

const CACHE_TTL_MS = 60_000;
const PER_CHECK_TIMEOUT_MS = 5_000;
const VERSION = "1.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// All-zero UUID is a sentinel; the credential-vc-resolve endpoint should
// return 404 for it (the DID is well-formed but no row matches). A 404 is
// 4xx, which we classify as `operational` — the function is up.
const SAMPLE_DID = "did:web:antarix.app:c/00000000-0000-0000-0000-000000000000";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type SubsystemState = "operational" | "degraded" | "down" | "unknown";

interface SubsystemResult {
  status: SubsystemState;
  latency_ms: number;
  checked_at: string;
  http_status?: number;
  error?: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
  summary: string | null;
  affected_subsystems: string[];
}

interface ScheduledMaintenance {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  description: string | null;
  affected_subsystems: string[];
}

interface StatusEnvelope {
  status: SubsystemState;
  subsystems: Record<string, SubsystemResult>;
  incidents: Incident[];
  scheduled_maintenances: ScheduledMaintenance[];
  generated_at: string;
  version: string;
}

interface SubsystemSpec {
  name: string;
  method: "GET" | "POST";
  url: string;
  body?: string;
}

// One entry per subsystem. Add a new subsystem by appending one line here
// (and one friendly-name entry in apps/web/public/status.html, if desired).
// See docs/status-page.md §"Adding a new subsystem".
const SUBSYSTEMS: SubsystemSpec[] = [
  {
    name: "core-platform",
    method: "GET",
    url: `${SUPABASE_URL}/functions/v1/health-check`,
  },
  {
    name: "credential-vc-resolve",
    method: "GET",
    url: `${SUPABASE_URL}/functions/v1/credential-vc-resolve/${
      encodeURIComponent(SAMPLE_DID)
    }`,
  },
  // ai-coach has no dedicated Edge Function (it's a web inbox fronted by
  // nudge-dispatch / whatsapp-send / push-send). We probe a stable,
  // lightweight Edge Function (credential-vc-issue, 401-on-no-auth) as a
  // proxy for "the Edge Function runtime is healthy" — which is the only
  // signal a status page needs for this subsystem.
  {
    name: "ai-coach",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/credential-vc-issue`,
  },
  {
    name: "whatsapp-send",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/whatsapp-send`,
  },
  {
    name: "nudge-dispatch",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/nudge-dispatch`,
  },
  {
    name: "github-sync",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/github-sync`,
  },
  {
    name: "calendar-sync",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/calendar-sync`,
  },
];

interface CacheEntry {
  at: number;
  body: string;
}
let cache: CacheEntry | null = null;

// 2xx, 3xx, 4xx all indicate the function is up. 4xx is the expected
// response for authed endpoints probed without a token. Only 5xx means
// "the function is up but erroring" → degraded.
function classifyHttp(httpStatus: number): SubsystemState {
  if (httpStatus >= 500 && httpStatus <= 599) return "degraded";
  return "operational";
}

async function checkOne(spec: SubsystemSpec): Promise<SubsystemResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(spec.url, {
      method: spec.method,
      ...(spec.body !== undefined ? { body: spec.body } : {}),
      signal: ctrl.signal,
      headers: {
        "user-agent": "antarix-status-page/1.0",
        ...(spec.method === "POST" ? { "content-type": "application/json" } : {}),
      },
      redirect: "manual",
    });
    return {
      status: classifyHttp(res.status),
      latency_ms: Date.now() - start,
      checked_at: new Date().toISOString(),
      http_status: res.status,
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      checked_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function worstOf(subs: Record<string, SubsystemResult>): SubsystemState {
  const states = Object.values(subs).map((s) => s.status);
  if (states.length === 0) return "unknown";
  if (states.some((s) => s === "down")) return "down";
  if (states.some((s) => s === "degraded")) return "degraded";
  if (states.every((s) => s === "operational")) return "operational";
  return "unknown";
}

async function fetchIncidentsAndMaintenance(): Promise<{
  incidents: Incident[];
  scheduled_maintenances: ScheduledMaintenance[];
}> {
  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const [incRes, smRes] = await Promise.all([
    supabase
      .from("status_incidents")
      .select(
        "id,title,status,started_at,resolved_at,summary,affected_subsystems",
      )
      .order("started_at", { ascending: false }),
    supabase
      .from("status_scheduled_maintenances")
      .select("id,title,starts_at,ends_at,description,affected_subsystems")
      .order("starts_at", { ascending: true }),
  ]);

  if (incRes.error) {
    throw new Error(`status_incidents: ${incRes.error.message}`);
  }
  if (smRes.error) {
    throw new Error(`status_scheduled_maintenances: ${smRes.error.message}`);
  }

  return {
    incidents: (incRes.data ?? []) as Incident[],
    scheduled_maintenances: (smRes.data ?? []) as ScheduledMaintenance[],
  };
}

async function buildStatusPageData(): Promise<StatusEnvelope> {
  const results = await Promise.allSettled(SUBSYSTEMS.map(checkOne));
  const subsystems: Record<string, SubsystemResult> = {};
  for (let i = 0; i < SUBSYSTEMS.length; i++) {
    const name = SUBSYSTEMS[i].name;
    const r = results[i];
    if (r.status === "fulfilled") {
      subsystems[name] = r.value;
    } else {
      // Promise.allSettled itself only rejects on synchronous throw inside
      // the executor; checkOne catches everything. Defensive anyway.
      subsystems[name] = {
        status: "down",
        latency_ms: 0,
        checked_at: new Date().toISOString(),
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    }
  }

  let incidents: Incident[] = [];
  let scheduled_maintenances: ScheduledMaintenance[] = [];
  try {
    const r = await fetchIncidentsAndMaintenance();
    incidents = r.incidents;
    scheduled_maintenances = r.scheduled_maintenances;
  } catch (err) {
    // A DB read failure should NOT 5xx the status page — that would mean
    // the page is down exactly when people most want to see it. Surface
    // the error in logs; emit an empty list.
    console.warn(
      "status-page-data: incident fetch failed",
      err instanceof Error ? err.message : String(err),
    );
  }

  return {
    status: worstOf(subsystems),
    subsystems,
    incidents,
    scheduled_maintenances,
    generated_at: new Date().toISOString(),
    version: VERSION,
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

serve(
  withRateLimit(
    "status-page-data",
    "_default",
    withObservability("status-page-data", async (req, ctx) => {
      if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
      }
      if (req.method !== "GET") {
        return jsonResponse(
          { error: "method_not_allowed", message: "Use GET." },
          { status: 405 },
        );
      }

      const now = Date.now();
      if (cache && now - cache.at < CACHE_TTL_MS) {
        ctx.log.info("status-page-data cache hit", {
          age_ms: now - cache.at,
        });
        return new Response(cache.body, {
          headers: {
            ...CORS,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=30",
          },
        });
      }

      try {
        const data = await buildStatusPageData();
        const body = JSON.stringify(data);
        cache = { at: now, body };
        ctx.log.info("status-page-data built", {
          overall: data.status,
          subsystems: Object.keys(data.subsystems).length,
          incidents: data.incidents.length,
          scheduled: data.scheduled_maintenances.length,
        });
        return new Response(body, {
          headers: {
            ...CORS,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=30",
          },
        });
      } catch (err) {
        // Should be unreachable (buildStatusPageData catches its own
        // errors). Defensive: a 200 with `unknown` overall is better than
        // a 5xx, which would itself show as a status-page outage.
        ctx.log.error("status-page-data build failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        const body = JSON.stringify({
          status: "unknown",
          subsystems: {},
          incidents: [],
          scheduled_maintenances: [],
          generated_at: new Date().toISOString(),
          version: VERSION,
          error: "build_failed",
        });
        return new Response(body, {
          status: 200,
          headers: {
            ...CORS,
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      }
    }),
  ),
);
