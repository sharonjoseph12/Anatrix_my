import { COLLAB_TYPING_DIVERGENCE_THRESHOLD, divergence, type TypingCadence } from "../collab/typing-divergence";

export interface SupabaseInsertClient {
  from(table: "anticheat_signals"): {
    insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

export interface CollabTypingDivergenceInput {
  roomId: string;
  requesterId: string;
  requesterCadence: TypingCadence;
  teammateCadence: TypingCadence;
  threshold?: number;
}

export async function writeCollabTypingDivergenceSignal(
  supabase: SupabaseInsertClient,
  input: CollabTypingDivergenceInput,
): Promise<{ written: boolean; confidence: number }> {
  const confidence = divergence(input.requesterCadence, input.teammateCadence);
  const threshold = input.threshold ?? COLLAB_TYPING_DIVERGENCE_THRESHOLD;
  if (confidence < threshold) return { written: false, confidence };

  const { error } = await supabase.from("anticheat_signals").insert({
    entity_type: "collab_room",
    entity_id: input.roomId,
    student_id: input.requesterId,
    signal: "collab_typing_divergence",
    confidence,
    evidence_payload: {
      requester_cadence: input.requesterCadence,
      teammate_cadence: input.teammateCadence,
      threshold,
    },
  });
  if (error) throw new Error(error.message);
  return { written: true, confidence };
}
