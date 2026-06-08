// supabase/functions/_shared/observability.test.ts
// v1 tests for the observability wrapper. Run with `deno test` from the
// repo root, or `deno test supabase/functions/_shared/observability.test.ts`
// directly. No external test deps — uses std@0.224.0/assert only.

import {
  assert,
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ObsContext,
  withObservability,
} from "./observability.ts";

// Capture everything the wrapper writes to stdout for a single handler call.
async function captureStdout(
  fn: () => unknown | Promise<unknown>,
): Promise<Array<Record<string, unknown>>> {
  const original = console.log;
  const lines: string[] = [];
  // deno-lint-ignore no-explicit-any
  console.log = (...args: any[]) => {
    lines.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
  };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines.map((l) => JSON.parse(l) as Record<string, unknown>);
}

const W3C_TRACE_ID = "0af7651916cd43dd8448eb211c80319c"; // 32 hex
const W3C_PARENT   = "b7ad6b7169203331";                  // 16 hex
const TRACEPARENT  = `00-${W3C_TRACE_ID}-${W3C_PARENT}-01`;

function fakeJwt(sub: string): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub })}.sig`;
}

Deno.test("withObservability: emits an access log line with all required fields", async () => {
  const recs = await captureStdout(async () => {
    const handler = withObservability("test-fn", () =>
      new Response("ok", { headers: { "Content-Type": "text/plain" } }));
    const res = await handler(new Request("https://example.com/test"));
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "ok");
  });
  const access = recs.find((r) => r.msg === "request" && r.function_name === "test-fn");
  assertExists(access, "expected an access log line with msg=request");
  assertEquals(access!.level, "info");
  assertEquals(access!.method, "GET");
  assertEquals(access!.path, "/test");
  assertEquals(access!.status, 200);
  assertEquals(typeof access!.request_id, "string");
  assertEquals(typeof access!.timestamp, "string");
  assertEquals(typeof access!.duration_ms, "number");
  assertEquals(typeof access!.trace_id, "string");
  assertEquals((access!.trace_id as string).length, 32);
});

Deno.test("withObservability: catches handler errors, logs, and returns 500", async () => {
  const recs = await captureStdout(async () => {
    const handler = withObservability("boom-fn", () => {
      throw new Error("kaboom");
    });
    const res = await handler(new Request("https://example.com/boom", { method: "POST" }));
    assertEquals(res.status, 500);
    const body = await res.json() as { error: string };
    assertEquals(body.error, "kaboom");
  });
  const access = recs.find((r) => r.msg === "request");
  assertExists(access);
  assertEquals(access!.status, 500);
  assertEquals(access!.level, "error");

  const handlerLog = recs.find((r) => r.msg === "handler threw");
  assertExists(handlerLog, "expected a 'handler threw' log line");
  assertEquals(handlerLog!.error, "kaboom");

  const span = recs.find((r) => r.type === "span" && r.name === "boom-fn.handler");
  assertExists(span, "expected the root span to be emitted");
  assertEquals(span!.status, "ERROR");
  const ev = (span!.events as Array<Record<string, unknown>>).find((e) => e.name === "exception");
  assertExists(ev, "expected an exception event on the root span");
  assertEquals(
    (ev!.attributes as Record<string, unknown>)["exception.message"],
    "kaboom",
  );
});

Deno.test("withObservability: propagates traceparent if present, generates if absent", async () => {
  // 1. Incoming traceparent is preserved and a new span_id is generated.
  const recsWith = await captureStdout(async () => {
    const handler = withObservability("tp-fn", () => new Response("ok"));
    const res = await handler(
      new Request("https://example.com/x", { headers: { traceparent: TRACEPARENT } }),
    );
    const echoed = res.headers.get("traceparent");
    assertExists(echoed, "expected traceparent in response");
    const parts = echoed!.split("-");
    assertEquals(parts.length, 4);
    assertEquals(parts[0], "00");
    assertEquals(parts[1], W3C_TRACE_ID, "trace_id must be preserved across the hop");
    assertEquals(parts[2].length, 16, "a new 16-hex span_id should be generated");
    assertEquals(parts[3], "01");
    // x-request-id is also echoed for downstream correlation
    const xrid = res.headers.get("x-request-id");
    assertExists(xrid);
  });
  const accessWith = recsWith.find((r) => r.msg === "request")!;
  assertEquals(accessWith.trace_id, W3C_TRACE_ID);

  // 2. No incoming traceparent -> a fresh 32-hex trace_id is generated.
  const recsWithout = await captureStdout(async () => {
    const handler = withObservability("tp-fn", () => new Response("ok"));
    await handler(new Request("https://example.com/x"));
  });
  const accessWithout = recsWithout.find((r) => r.msg === "request")!;
  const tid = accessWithout.trace_id as string;
  assertEquals(tid.length, 32);
  assert(!/^0+$/.test(tid), "generated trace_id should be non-zero");
});

Deno.test("withObservability: ctx.log.info emits structured JSON with required fields", async () => {
  const recs = await captureStdout(async () => {
    const handler = withObservability("log-fn", async (_req, ctx: ObsContext) => {
      ctx.log.info("user signed in", { cohort: "2026-cs", n: 3 });
      return new Response("ok");
    });
    await handler(new Request("https://example.com/log"));
  });
  const logLine = recs.find((r) => r.level === "info" && r.msg === "user signed in");
  assertExists(logLine, "expected a structured log line for ctx.log.info");
  assertEquals(logLine!.function_name, "log-fn");
  assertEquals(typeof logLine!.request_id, "string");
  assertEquals(typeof logLine!.timestamp, "string");
  assertEquals(typeof logLine!.trace_id, "string");
  assertEquals(logLine!.cohort, "2026-cs");
  assertEquals(logLine!.n, 3);
  // The line must be single-line JSON (no embedded newlines).
  assert(!JSON.stringify(logLine).includes("\n"));
});

Deno.test("withObservability: extracts user_id from Authorization: Bearer <jwt>", async () => {
  const jwt = fakeJwt("user-123");
  const recs = await captureStdout(async () => {
    const handler = withObservability("auth-fn", () => new Response("ok"));
    const res = await handler(
      new Request("https://example.com/x", {
        headers: { authorization: `Bearer ${jwt}` },
      }),
    );
    assertEquals(res.status, 200);
  });
  const access = recs.find((r) => r.msg === "request")!;
  assertEquals(access.user_id, "user-123");
});

Deno.test("withObservability: ctx.span.startChild creates a child span on the same trace", async () => {
  const recs = await captureStdout(async () => {
    const handler = withObservability("child-fn", async (_req, ctx) => {
      const child = ctx.span.startChild("db.query");
      child.setAttribute("db.system", "postgres");
      child.recordException(new Error("deadlock"));
      child.end();
      return new Response("ok");
    });
    await handler(new Request("https://example.com/c"));
  });
  const spans = recs.filter((r) => r.type === "span");
  assertEquals(spans.length, 2, "expected root + child span");
  const root = spans.find((s) => s.name === "child-fn.handler")!;
  const child = spans.find((s) => s.name === "db.query")!;
  assertEquals(child.trace_id, root.trace_id);
  assertEquals(child.parent_span_id, root.span_id);
  assertEquals(child.attributes["db.system"], "postgres");
  assertEquals(child.status, "ERROR");
  const ev = (child.events as Array<Record<string, unknown>>).find((e) => e.name === "exception");
  assertExists(ev);
});

Deno.test("withObservability: SUPABASE_REQUEST_ID header is honored as request_id", async () => {
  const recs = await captureStdout(async () => {
    const handler = withObservability("rid-fn", () => new Response("ok"));
    await handler(
      new Request("https://example.com/r", {
        headers: { "supabase-request-id": "rid-from-gateway-7" },
      }),
    );
  });
  const access = recs.find((r) => r.msg === "request")!;
  assertEquals(access.request_id, "rid-from-gateway-7");
});
