export interface TypingCadence {
  user_id: string;
  keys_per_sec: number;
  commits_in_window: number;
}

export interface CollabCadenceEvent {
  user_id: string;
  event_type: string;
  created_at: string | number | Date;
  payload_json?: {
    keys_pressed?: number;
    keys?: number;
    characters?: number;
  } | null;
}

export const COLLAB_TYPING_DIVERGENCE_THRESHOLD = 0.65;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function divergence(a: TypingCadence, b: TypingCadence): number {
  const cadenceGap = Math.abs(a.keys_per_sec - b.keys_per_sec) / Math.max(a.keys_per_sec, b.keys_per_sec, 1);
  const commitConcentration = b.commits_in_window / (a.commits_in_window + b.commits_in_window + 1);
  return clamp01(cadenceGap * commitConcentration);
}

export function isDivergenceSignalActive(score: number, threshold = COLLAB_TYPING_DIVERGENCE_THRESHOLD): boolean {
  return score >= threshold;
}

export function extractCadence(
  events: readonly CollabCadenceEvent[],
  userId: string,
  windowStart: string | number | Date,
  windowEnd: string | number | Date,
): TypingCadence {
  const startMs = new Date(windowStart).getTime();
  const endMs = new Date(windowEnd).getTime();
  const windowSeconds = Math.max((endMs - startMs) / 1000, 1);

  let keys = 0;
  let commits = 0;

  for (const event of events) {
    if (event.user_id !== userId) continue;
    const eventMs = new Date(event.created_at).getTime();
    if (eventMs < startMs || eventMs > endMs) continue;

    if (event.event_type === "typing") {
      keys += event.payload_json?.keys_pressed ?? event.payload_json?.keys ?? event.payload_json?.characters ?? 0;
    }
    if (event.event_type === "code_commit") commits += 1;
  }

  return {
    user_id: userId,
    keys_per_sec: keys / windowSeconds,
    commits_in_window: commits,
  };
}
