export const COLLAB_DIVERGENCE_BLOCK_CODE = "collab_divergence_signal_active";

export interface SupabaseCoachGateClient {
  from(table: "anticheat_signals"): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          eq(column: string, value: string): {
            gte(column: string, value: string): {
              limit(count: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };
}

export interface CoachGateResult {
  allowed: boolean;
  status: 200 | 403;
  code?: typeof COLLAB_DIVERGENCE_BLOCK_CODE;
}

export async function canRequestCollabCoachHint(
  supabase: SupabaseCoachGateClient,
  args: { roomId: string; studentId: string; now?: Date; windowSeconds?: number },
): Promise<CoachGateResult> {
  const now = args.now ?? new Date();
  const windowSeconds = args.windowSeconds ?? 60;
  const since = new Date(now.getTime() - windowSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("anticheat_signals")
    .select("id")
    .eq("entity_type", "collab_room")
    .eq("entity_id", args.roomId)
    .eq("student_id", args.studentId)
    .gte("detected_at", since)
    .limit(1);
  if (error) throw new Error(error.message);
  if ((data ?? []).length > 0) {
    return { allowed: false, status: 403, code: COLLAB_DIVERGENCE_BLOCK_CODE };
  }
  return { allowed: true, status: 200 };
}
