// apps/web/src/app/api/admin/audit/[student_id]/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US3 (FR-PRI-005, FR-AUD-001..003)
//   contracts/api.md → GET /api/admin/audit/{student_id}
// Paginated audit dump for a single student. Requires the audit:read
// scope (admin role, or college_admin at the same institution as the
// student). ?unmask=true additionally requires audit:unmask.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertCanReadAudit, assertCanUnmaskAudit, AuditPermissionError } from "@/lib/audit/admin-guard";
import { writeSignalAudit } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function err(code: string, message: string, status: number) {
  return json({ error: { code, message } }, { status });
}

function getStringParam(req: NextRequest, key: string): string | null {
  return req.nextUrl.searchParams?.get(key) ?? null;
}

async function loadCallerContext(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data: callerMembership } = await supabase
    .from("institution_members")
    .select("role, institution_id")
    .eq("user_id", userId)
    .in("role", ["admin", "college_admin"])
    .maybeSingle();
  const platformRole = (callerMembership as { role?: string } | null)?.role;
  if (platformRole === "admin") {
    return {
      user_id: userId,
      role: "admin" as const,
      institution_id: (callerMembership as { institution_id?: string } | null)?.institution_id ?? null,
      scopes: ["audit:read", "audit:unmask"],
    };
  }
  if (platformRole === "college_admin") {
    return {
      user_id: userId,
      role: "college_admin" as const,
      institution_id: (callerMembership as { institution_id?: string } | null)?.institution_id ?? null,
      scopes: ["audit:read"],
    };
  }
  return {
    user_id: userId,
    role: "student" as const,
    institution_id: null,
    scopes: [],
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ student_id: string }> },
) {
  const { student_id: targetStudentId } = await params;
  if (!targetStudentId) return err("invalid_input", "student_id is required", 400);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to read the audit log", 401);

  const cursorRaw = getStringParam(req, "cursor");
  const limitRaw = getStringParam(req, "limit");
  const unmaskRaw = getStringParam(req, "unmask");

  const limit = Math.max(1, Math.min(500, Number.parseInt(limitRaw ?? "100", 10) || 100));
  const cursorNum = cursorRaw !== null ? Number.parseInt(cursorRaw, 10) : null;
  const cursor = cursorNum !== null && Number.isFinite(cursorNum) ? cursorNum : null;
  const unmask = unmaskRaw === "true" || unmaskRaw === "1";

  const caller = await loadCallerContext(supabase, user.id);

  let auditActorType: "admin" | "college_admin";
  try {
    const actorType = await assertCanReadAudit(caller, targetStudentId);
    if (actorType !== "admin" && actorType !== "college_admin") {
      return err("forbidden", "audit:read scope required", 403);
    }
    auditActorType = actorType;
  } catch (e) {
    if (e instanceof AuditPermissionError) {
      return err("forbidden", e.message, 403);
    }
    return err("internal_error", (e as Error).message, 500);
  }

  if (unmask) {
    try {
      assertCanUnmaskAudit(caller);
    } catch (e) {
      if (e instanceof AuditPermissionError) {
        return err("forbidden", e.message, 403);
      }
      return err("internal_error", (e as Error).message, 500);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let query = supabase
    .from("signal_audit")
    .select("id, actor_id, actor_type, student_id, provider, action, byte_count, aggregate_hash, payload_redacted, created_at")
    .eq("student_id", targetStudentId)
    .order("id", { ascending: false })
    .limit(limit);
  if (cursor !== null) {
    query = query.lt("id", cursor);
  }

  const { data, error } = await query;
  clearTimeout(timeout);
  if (error) return err("internal_error", error.message, 500);

  const rows = (data ?? []).map((r) => {
    const row = r as {
      id: number;
      actor_id: string | null;
      actor_type: string;
      student_id: string;
      provider: string;
      action: string;
      byte_count: number;
      aggregate_hash: string | null;
      payload_redacted: boolean;
      created_at: string;
    };
    return {
      id: row.id,
      actor_id: unmask ? row.actor_id : null,
      actor_type: row.actor_type,
      student_id: row.student_id,
      provider: row.provider,
      action: row.action,
      byte_count: row.byte_count,
      aggregate_hash: row.aggregate_hash,
      payload_redacted: row.payload_redacted,
      created_at: row.created_at,
    };
  });

  const lastId = rows[rows.length - 1]?.id ?? null;
  const nextCursor = rows.length === limit ? lastId : null;

  const { count, error: countErr } = await supabase
    .from("signal_audit")
    .select("id", { count: "exact", head: true })
    .eq("student_id", targetStudentId);
  void countErr;
  const totalEstimated = typeof count === "number" ? count : null;

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: auditActorType,
      student_id: targetStudentId,
      provider: "admin_audit",
      action: "audit_read",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({
    rows,
    next_cursor: nextCursor,
    total_estimated: totalEstimated,
  });
}
