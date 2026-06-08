import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SignalProvider, SignalAction } from "@antarix/types/signals";
import type { AuditActorType } from "@antarix/types/audit";

export interface WriteSignalAuditInput {
  actor_id: string | null;
  actor_type: AuditActorType;
  student_id: string;
  provider: SignalProvider;
  action: SignalAction;
  byte_count?: number;
  aggregate_hash?: string | null;
}

export async function writeSignalAudit(input: WriteSignalAuditInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const row = {
    actor_id: input.actor_id,
    actor_type: input.actor_type,
    student_id: input.student_id,
    provider: input.provider,
    action: input.action,
    byte_count: input.byte_count ?? 0,
    aggregate_hash: input.aggregate_hash ?? null,
    payload_redacted: true,
  };
  const { error } = await supabase.from("signal_audit").insert(row);
  if (error) {
    throw new Error(`writeSignalAudit: ${error.message}`);
  }
}
