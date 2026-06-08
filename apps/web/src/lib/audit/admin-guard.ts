import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditActorType } from "@antarix/types/audit";

export class AuditPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditPermissionError";
  }
}

interface CallerContext {
  user_id: string;
  role: "admin" | "college_admin" | "student" | "system";
  institution_id?: string | null;
  scopes: string[];
}

export async function assertCanReadAudit(
  caller: CallerContext,
  target_student_id: string,
): Promise<AuditActorType> {
  if (caller.role === "admin" && caller.scopes.includes("audit:read")) {
    return "admin";
  }
  if (caller.role === "college_admin" && caller.scopes.includes("audit:read")) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("institution_members")
      .select("institution_id, user_id")
      .eq("user_id", target_student_id)
      .eq("institution_id", caller.institution_id ?? "")
      .maybeSingle();
    if (error || !data) {
      throw new AuditPermissionError(
        "audit: college_admin is not at the same institution as the target student",
      );
    }
    return "college_admin";
  }
  throw new AuditPermissionError("audit:read scope required");
}

export function assertCanUnmaskAudit(caller: CallerContext): void {
  if (
    caller.role === "admin" &&
    caller.scopes.includes("audit:read") &&
    caller.scopes.includes("audit:unmask")
  ) {
    return;
  }
  throw new AuditPermissionError(
    "audit:unmask requires audit:read AND admin role",
  );
}
