// supabase/functions/_shared/observability.ts
// v1 Edge Function observability wrapper for Antarix.
// Structured JSON logging, W3C trace context, OpenTelemetry-shaped span
// emitter (stdout only). No external deps; pure Deno runtime primitives.
// See docs/observability.md.

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(err: unknown): void;
  startChild(name: string): Span;
  end(): void;
}

export interface ObsContext {
  log: Logger;
  span: Span;
  requestId: string;
  userId?: string;
}

export type Handler = (
  req: Request,
  ctx: ObsContext,
) => Promise<Response> | Response;

interface LogRec {
  level: "info" | "warn" | "error";
  msg: string;
  function_name: string;
  request_id: string;
  timestamp: string;
  trace_id: string;
  span_id: string;
  user_id?: string;
  [k: string]: unknown;
}
interface SpanRec {
  type: "span";
  name: string;
  function_name: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  start_time_unix_nano: number;
  end_time_unix_nano: number;
  duration_ms: number;
  status: "OK" | "ERROR";
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; time_unix_nano: number; attributes?: Record<string, unknown> }>;
}

const HEX = "0123456789abcdef";
function hex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = "";
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    s += HEX[(x >> 4) & 0xf] + HEX[x & 0xf];
  }
  return s;
}
const newTraceId = () => hex(16);
const newSpanId = () => hex(8);
const nowNanos = () => Math.floor((performance.timeOrigin + performance.now()) * 1e6);
const emit = (r: LogRec | SpanRec) => console.log(JSON.stringify(r));

function parseTraceparent(h: string | null) {
  if (!h) return null;
  const p = h.split("-");
  if (p.length !== 4 || p[0] !== "00") return null;
  if (!/^[0-9a-f]{32}$/.test(p[1]) || !/^[0-9a-f]{16}$/.test(p[2]) || !/^[0-9a-f]{2}$/.test(p[3])) return null;
  return { traceId: p[1], parentSpanId: p[2] };
}

// Best-effort JWT `sub` extraction for log correlation. Not a verifier.
function tryExtractUserId(req: Request): string | undefined {
  const auth = req.headers.get("authorization");
  if (!auth) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return undefined;
  const parts = m[1].split(".");
  if (parts.length < 2) return undefined;
  try {
    const pad = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    const obj = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
    return typeof obj.sub === "string" ? obj.sub : undefined;
  } catch { return undefined; }
}

function makeSpan(
  name: string,
  fn: string,
  traceId: string,
  parentSpanId: string | undefined,
): Span & { spanId: string } {
  const start = nowNanos();
  const rec: SpanRec = {
    type: "span", name, function_name: fn, trace_id: traceId,
    span_id: newSpanId(), parent_span_id: parentSpanId,
    start_time_unix_nano: start, end_time_unix_nano: 0, duration_ms: 0,
    status: "OK", attributes: {}, events: [],
  };
  return {
    spanId: rec.span_id,
    setAttribute(k, v) { rec.attributes[k] = v; },
    recordException(err) {
      rec.status = "ERROR";
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      rec.events.push({
        name: "exception", time_unix_nano: nowNanos(),
        attributes: { "exception.message": msg, ...(stack ? { "exception.stacktrace": stack } : {}) },
      });
    },
    startChild(c) { return makeSpan(c, fn, traceId, rec.span_id); },
    end() {
      const end = nowNanos();
      rec.end_time_unix_nano = end;
      rec.duration_ms = (end - start) / 1e6;
      emit(rec);
    },
  };
}

function makeLogger(
  fn: string, reqId: string, traceId: string, rootSpanId: string, userId: string | undefined,
): Logger {
  const write = (level: LogRec["level"], msg: string, fields?: Record<string, unknown>) => {
    emit({
      level, msg, function_name: fn, request_id: reqId,
      timestamp: new Date().toISOString(), trace_id: traceId, span_id: rootSpanId,
      ...(userId ? { user_id: userId } : {}), ...(fields ?? {}),
    });
  };
  return { info: (m, f) => write("info", m, f), warn: (m, f) => write("warn", m, f), error: (m, f) => write("error", m, f) };
}

export function withObservability(
  name: string,
  handler: Handler,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const startMs = Date.now();
    const requestId =
      req.headers.get("supabase-request-id") ??
      req.headers.get("x-request-id") ??
      crypto.randomUUID();
    const tp = parseTraceparent(req.headers.get("traceparent"));
    const traceId = tp?.traceId ?? newTraceId();
    const userId = tryExtractUserId(req);
    const root = makeSpan(`${name}.handler`, name, traceId, tp?.parentSpanId);
    const log = makeLogger(name, requestId, traceId, root.spanId, userId);

    let res: Response;
    try {
      res = await handler(req, { log, span: root, requestId, userId });
    } catch (err) {
      root.recordException(err);
      const msg = err instanceof Error ? err.message : String(err);
      log.error("handler threw", { error: msg });
      res = new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dur = Date.now() - startMs;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    emit({
      level: res.status >= 500 ? "error" : res.status >= 400 ? "warn" : "info",
      msg: "request", function_name: name, request_id: requestId,
      timestamp: new Date().toISOString(), trace_id: traceId, span_id: root.spanId,
      method: req.method, path: new URL(req.url).pathname, status: res.status, duration_ms: dur,
      ...(userId ? { user_id: userId } : {}), ...(ip ? { client_ip: ip } : {}),
    });

    const headers = new Headers(res.headers);
    headers.set("traceparent", `00-${traceId}-${root.spanId}-01`);
    if (!headers.has("x-request-id")) headers.set("x-request-id", requestId);
    res = new Response(res.body, { status: res.status, headers });

    root.setAttribute("http.method", req.method);
    root.setAttribute("http.route", new URL(req.url).pathname);
    root.setAttribute("http.status_code", res.status);
    root.end();
    return res;
  };
}
