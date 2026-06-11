import { z } from "zod";

export const collabEventTypes = [
  "join", "leave", "code_commit", "test_run", "chat", "help", "conflict",
  "voice_degraded", "sandbox_egress_blocked", "reconnect", "consent_change",
  "coach_blocked", "interviewer_posted_problem", "consent_revoked",
  "sandbox_restart_required", "voice_unavailable", "conflict_unresolved",
  "conflict_resolved", "help_event", "sandbox_boot", "sandbox_shutdown",
  "observer_joined", "observer_left",
] as const;

export const collabEventTypeSchema = z.enum(collabEventTypes);
export type CollabEventType = z.infer<typeof collabEventTypeSchema>;

const userActivitySchema = z.object({ active_seconds: z.number().nonnegative().optional() }).passthrough();

export const collabEventPayloadSchemas = {
  join: z.object({ role: z.string().optional() }).passthrough(),
  leave: z.object({ reason: z.string().optional() }).passthrough(),
  code_commit: userActivitySchema.extend({ lines_added: z.number().int().default(0), lines_deleted: z.number().int().default(0) }),
  test_run: z.object({ command: z.string().optional(), status: z.enum(["passed", "failed", "failed_environment"]) }).passthrough(),
  chat: z.object({ message: z.string().min(1), message_id: z.string().optional() }).passthrough(),
  help: z.object({ helper_id: z.string().uuid(), helpee_id: z.string().uuid() }).passthrough(),
  conflict: z.object({ region: z.string().optional() }).passthrough(),
  voice_degraded: z.object({ reason: z.string().optional() }).passthrough(),
  sandbox_egress_blocked: z.object({ target: z.string().optional() }).passthrough(),
  reconnect: z.object({ last_seq: z.number().int().nonnegative().optional() }).passthrough(),
  consent_change: z.object({ scopes: z.array(z.string()), granted: z.boolean() }).passthrough(),
  coach_blocked: z.object({ reason: z.literal("collab_divergence_signal_active") }).passthrough(),
  interviewer_posted_problem: z.object({ problem: z.string().min(1) }).passthrough(),
  consent_revoked: z.object({ consent_id: z.string().uuid() }).passthrough(),
  sandbox_restart_required: z.object({ reason: z.string().optional() }).passthrough(),
  voice_unavailable: z.object({ reason: z.string().optional() }).passthrough(),
  conflict_unresolved: z.object({ writer_id: z.string().uuid(), lock_holder_id: z.string().uuid() }).passthrough(),
  conflict_resolved: z.object({ resolver_id: z.string().uuid(), resolution_seconds: z.number().nonnegative() }).passthrough(),
  help_event: z.object({ helper_id: z.string().uuid(), helpee_id: z.string().uuid(), source_event_seq: z.number().int().nonnegative().optional() }).passthrough(),
  sandbox_boot: z.object({ sandbox_kind: z.enum(["webcontainer", "firecracker"]) }).passthrough(),
  sandbox_shutdown: z.object({ reason: z.string().optional() }).passthrough(),
  observer_joined: z.object({ observer_id: z.string().uuid() }).passthrough(),
  observer_left: z.object({ observer_id: z.string().uuid() }).passthrough(),
} satisfies Record<CollabEventType, z.ZodTypeAny>;

export function parseCollabEventPayload<T extends CollabEventType>(type: T, payload: unknown): z.infer<(typeof collabEventPayloadSchemas)[T]> {
  return collabEventPayloadSchemas[type].parse(payload);
}

export const collabEventInputSchema = z.object({
  room_id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_type: collabEventTypeSchema,
  payload_json: z.unknown(),
  seq: z.number().int().nonnegative(),
  created_at: z.string().datetime().optional(),
}).superRefine((event, context) => {
  const result = collabEventPayloadSchemas[event.event_type].safeParse(event.payload_json);
  if (!result.success) {
    for (const issue of result.error.issues) context.addIssue(issue);
  }
});
