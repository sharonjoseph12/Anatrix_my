export interface TeamworkEvent {
  user_id: string;
  event_type: string;
  created_at?: string | number | Date;
  payload_json?: {
    active_seconds?: number;
    lines_added?: number;
    files_touched?: string[];
    helper_id?: string;
    helpee_id?: string;
  } | null;
}

export interface TeamworkParticipant {
  user_id: string;
  opt_out_teamwork?: boolean | null;
}

export interface TeamworkSubScores {
  turn_taking: number;
  code_balance: number;
  conflict_resolution: number;
  help_events: number;
}

export interface TeamworkScoreResult {
  subScores: TeamworkSubScores;
  score: number;
  breakdown: {
    reasons: string[];
    input_counts: Record<string, number>;
  };
}

export type TeamworkScoreByUser = Record<string, TeamworkScoreResult | null>;

const WEIGHTS = {
  turn_taking: 0.25,
  code_balance: 0.35,
  conflict_resolution: 0.2,
  help_events: 0.2,
} as const;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratioScore(values: readonly number[]): number {
  const positive = values.filter((value) => value > 0);
  if (positive.length === 0) return 0;
  if (positive.length === 1) return 25;
  return clampScore((Math.min(...positive) / Math.max(...positive)) * 100);
}

function keyedCounts(participants: readonly TeamworkParticipant[]): Record<string, number> {
  return Object.fromEntries(participants.map((participant) => [participant.user_id, 0]));
}

function aggregateEvents(
  events: readonly TeamworkEvent[],
  optedOut: Set<string>,
  activeSecondsByUser: Record<string, number>,
  linesByUser: Record<string, number>,
  filesByUser: Record<string, Set<string>>
) {
  let unresolvedConflicts = 0;
  let resolvedConflicts = 0;
  let helpEvents = 0;
  const helpers = new Set<string>();

  for (const event of events) {
    if (optedOut.has(event.user_id)) continue;
    if (event.user_id in activeSecondsByUser) {
      activeSecondsByUser[event.user_id] = (activeSecondsByUser[event.user_id] ?? 0) + (event.payload_json?.active_seconds ?? 0);
    }
    if (event.event_type === "code_commit" && event.user_id in linesByUser) {
      linesByUser[event.user_id] = (linesByUser[event.user_id] ?? 0) + Math.max(0, event.payload_json?.lines_added ?? 0);
      for (const file of event.payload_json?.files_touched ?? []) filesByUser[event.user_id]?.add(file);
    }
    if (event.event_type === "conflict_unresolved") unresolvedConflicts += 1;
    if (event.event_type === "conflict_resolved") resolvedConflicts += 1;
    if (event.event_type === "help_event") {
      helpEvents += 1;
      if (event.payload_json?.helper_id) helpers.add(event.payload_json.helper_id);
    }
  }

  return { unresolvedConflicts, resolvedConflicts, helpEvents, helpers };
}

function generateReasons(
  activeParticipants: number,
  activeValues: number[],
  unresolvedConflicts: number,
  helpEvents: number
): string[] {
  const reasons: string[] = [];
  const maxActive = Math.max(0, ...activeValues);
  const positiveActive = activeValues.filter((value) => value > 0);
  const minActive = positiveActive.length > 0 ? Math.min(...positiveActive) : 0;
  if (activeParticipants < 2) reasons.push("insufficient_participants: fewer than 2 non-opted-out participants");
  if (maxActive > 0 && minActive / maxActive < 0.1) reasons.push("low_engagement: one participant active for < 10% of the busiest participant");
  if (unresolvedConflicts > 0) reasons.push(`conflict_unresolved: ${unresolvedConflicts} unresolved conflict event(s)`);
  if (helpEvents > 0) reasons.push(`help_event: ${helpEvents} teammate unblock event(s)`);
  return reasons;
}

function calculateScores(
  activeValues: number[],
  lineValues: number[],
  fileValues: number[],
  unresolvedConflicts: number,
  resolvedConflicts: number,
  helpEvents: number,
  helpersSize: number
): { subScores: TeamworkSubScores; score: number } {
  const turnTaking = ratioScore(activeValues);
  const codeBalance = clampScore(ratioScore(lineValues) * 0.7 + ratioScore(fileValues) * 0.3);
  const conflictResolution = clampScore(100 - unresolvedConflicts * 30 + resolvedConflicts * 12);
  const helpScore = clampScore(Math.min(100, helpEvents * 30 + helpersSize * 10));
  
  const subScores = { turn_taking: turnTaking, code_balance: codeBalance, conflict_resolution: conflictResolution, help_events: helpScore };
  const score = clampScore(
    subScores.turn_taking * WEIGHTS.turn_taking +
    subScores.code_balance * WEIGHTS.code_balance +
    subScores.conflict_resolution * WEIGHTS.conflict_resolution +
    subScores.help_events * WEIGHTS.help_events
  );
  return { subScores, score };
}

export function computeTeamworkScore(
  events: readonly TeamworkEvent[],
  participants: readonly TeamworkParticipant[],
): TeamworkScoreByUser {
  const activeParticipants = participants.filter((p) => !p.opt_out_teamwork);
  const optedOut = new Set(participants.filter((p) => p.opt_out_teamwork).map((p) => p.user_id));
  const activeSecondsByUser = keyedCounts(activeParticipants);
  const linesByUser = keyedCounts(activeParticipants);
  const filesByUser = Object.fromEntries(activeParticipants.map((p) => [p.user_id, new Set<string>()]));

  const agg = aggregateEvents(events, optedOut, activeSecondsByUser, linesByUser, filesByUser);
  
  const activeValues = Object.values(activeSecondsByUser);
  const lineValues = Object.values(linesByUser);
  const fileValues = Object.values(filesByUser).map((files) => files.size);

  const reasons = generateReasons(activeParticipants.length, activeValues, agg.unresolvedConflicts, agg.helpEvents);
  const { subScores, score } = calculateScores(activeValues, lineValues, fileValues, agg.unresolvedConflicts, agg.resolvedConflicts, agg.helpEvents, agg.helpers.size);

  const result: TeamworkScoreResult = {
    subScores,
    score,
    breakdown: {
      reasons,
      input_counts: {
        participants: activeParticipants.length,
        opted_out_participants: optedOut.size,
        code_commits: events.filter((e) => e.event_type === "code_commit").length,
        conflict_unresolved_events: agg.unresolvedConflicts,
        conflict_resolved_events: agg.resolvedConflicts,
        help_events: agg.helpEvents,
      },
    },
  };

  return Object.fromEntries(participants.map((p) => [p.user_id, p.opt_out_teamwork ? null : result]));
}

