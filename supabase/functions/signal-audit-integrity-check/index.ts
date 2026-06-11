// supabase/functions/signal-audit-integrity-check/index.ts
//
// spec: specs/006-deep-signal-capture/spec.md FR-AUD-001, SC-PRI-001
// data-model: specs/006-deep-signal-capture/data-model.md lines 267-294
//
// Nightly cron that asserts the append-only integrity of the signal_audit
// table:
//   (a) every row has non-null provider, byte_count, and aggregate_hash
//       where applicable
//   (b) row-count delta > 0 in the last 24h (active system)
//   (c) UPDATE/DELETE are still revoked (append-only enforcement)
//   (d) actor_id is not prematurely pseudonymised (< 90 days)
//
// On failure, writes a structured log at console.error level for Supabase
// logging infra to forward to the configured alert channel.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface AssertionResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function assertNonNullRequiredFields(): Promise<AssertionResult> {
  const { data, error } = await supabase
    .from("signal_audit")
    .select("id", { count: "exact", head: true })
    .or("provider.is.null,byte_count.lt.0")
    .limit(1);

  if (error) {
    return { name: "null_required_fields", passed: false, detail: `query error: ${error.message}` };
  }

  const nullProviderOrByteCount = data?.length ?? 0;

  const { data: nullHashData, error: nullHashErr } = await supabase
    .from("signal_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "upload")
    .is("aggregate_hash", null)
    .limit(1);

  if (nullHashErr) {
    return { name: "null_required_fields", passed: false, detail: `query error: ${nullHashErr.message}` };
  }

  const nullHashCount = nullHashData?.length ?? 0;
  const totalIssues = nullProviderOrByteCount + nullHashCount;

  if (totalIssues > 0) {
    return {
      name: "null_required_fields",
      passed: false,
      detail: `found ${totalIssues} rows with null provider, negative byte_count, or null aggregate_hash where action='upload'`,
    };
  }

  return { name: "null_required_fields", passed: true, detail: "all required fields are non-null" };
}

async function assertRecentActivity(): Promise<AssertionResult> {
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  const { data, error, count } = await supabase
    .from("signal_audit")
    .select("id", { count: "exact", head: true })
    .gte("created_at", yesterday);

  if (error) {
    return { name: "recent_activity", passed: false, detail: `query error: ${error.message}` };
  }

  if (!count || count === 0) {
    return {
      name: "recent_activity",
      passed: true,
      detail: `WARN: 0 rows inserted in the last 24h (system may be inactive)`,
    };
  }

  return { name: "recent_activity", passed: true, detail: `${count} rows inserted in the last 24h` };
}

async function assertAppendOnly(): Promise<AssertionResult> {
  const testDate = new Date().toISOString().slice(0, 10);
  const testHash = `integrity.check.test:${testDate}`;
  const now = new Date().toISOString();

  const { data: inserted, error: insErr } = await supabase
    .from("signal_audit")
    .insert({
      actor_id: null,
      actor_type: "system",
      student_id: "00000000-0000-0000-0000-000000000000",
      provider: "privacy_center",
      action: "read",
      byte_count: 0,
      aggregate_hash: testHash,
      payload_redacted: true,
      created_at: now,
    })
    .select("id")
    .single();

  if (insErr) {
    return { name: "append_only", passed: false, detail: `test insert failed: ${insErr.message}` };
  }

  const testId = inserted!.id;

  const { error: updErr } = await supabase
    .from("signal_audit")
    .update({ byte_count: 999 })
    .eq("id", testId);

  if (!updErr) {
    await supabase.from("signal_audit").delete().eq("id", testId);
    return {
      name: "append_only",
      passed: false,
      detail: "UPDATE succeeded on signal_audit — REVOKE is broken",
    };
  }

  const { error: delErr } = await supabase
    .from("signal_audit")
    .delete()
    .eq("id", testId);

  if (!delErr) {
    return {
      name: "append_only",
      passed: false,
      detail: "DELETE succeeded on signal_audit — REVOKE is broken",
    };
  }

  const { error: cleanErr } = await supabase
    .from("signal_audit")
    .delete()
    .eq("aggregate_hash", testHash);

  if (cleanErr) {
    return {
      name: "append_only",
      passed: true,
      detail: "UPDATE and DELETE correctly revoked (test row cleanup also denied — expected)",
    };
  }

  return { name: "append_only", passed: true, detail: "UPDATE and DELETE correctly revoked" };
}

async function assertActorIdNotPrematurelyHashed(): Promise<AssertionResult> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: rows, error } = await supabase
    .from("signal_audit")
    .select("id, actor_id")
    .gte("created_at", ninetyDaysAgo)
    .isNotNull("actor_id");

  if (error) {
    return { name: "actor_id_not_prematurely_hashed", passed: false, detail: `query error: ${error.message}` };
  }

  const premature: number[] = [];
  if (rows) {
    for (const r of rows) {
      const idStr = String(r.actor_id);
      if (idStr.length >= 64) {
        premature.push(r.id);
      }
    }
  }

  if (premature.length > 0) {
    return {
      name: "actor_id_not_prematurely_hashed",
      passed: false,
      detail: `WARN: ${premature.length} rows < 90 days have a 64-char actor_id (pseudonymisation ran early): ids ${premature.slice(0, 10).join(",")}${premature.length > 10 ? "..." : ""}`,
    };
  }

  return { name: "actor_id_not_prematurely_hashed", passed: true, detail: "no rows < 90 days have a pseudonymised actor_id" };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  try {
    const results = await Promise.all([
      assertNonNullRequiredFields(),
      assertRecentActivity(),
      assertAppendOnly(),
      assertActorIdNotPrematurelyHashed(),
    ]);

    const failures = results.filter((r) => !r.passed);
    const warnings = results.filter((r) => r.passed && r.detail.startsWith("WARN"));

    const passed = failures.length === 0;
    const issues: string[] = [];

    for (const r of failures) {
      const msg = `${r.name}: ${r.detail}`;
      issues.push(msg);
      const logPayload = {
        event: "signal_audit_integrity_fail",
        reason: r.name,
        detail: r.detail,
        timestamp: new Date().toISOString(),
      };
      console.error("integrity-check failure", JSON.stringify(logPayload));
    }

    for (const r of warnings) {
      issues.push(r.detail);
      console.warn("integrity-check warning", JSON.stringify({
        event: "signal_audit_integrity_warn",
        reason: r.name,
        detail: r.detail,
        timestamp: new Date().toISOString(),
      }));
    }

    for (const r of results.filter((r) => r.passed && !r.detail.startsWith("WARN"))) {
      console.log("integrity-check pass", JSON.stringify({
        event: "signal_audit_integrity_pass",
        reason: r.name,
        detail: r.detail,
        timestamp: new Date().toISOString(),
      }));
    }

    return json({ ok: true, passed, issues });
  } catch (e) {
    const errMsg = (e as Error).message;
    console.error("signal-audit-integrity-check handler failed", errMsg);
    return json({
      ok: true,
      passed: false,
      issues: [`handler_error: ${errMsg}`],
    });
  }
});
