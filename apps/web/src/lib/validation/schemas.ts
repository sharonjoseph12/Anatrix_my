import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address")
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, "Slug must be 3-40 chars, lowercase a-z, 0-9, or -");

export const jobMatchStatusSchema = z.enum([
  "matched",
  "reached_out",
  "interview_scheduled",
  "interview_completed",
  "hired",
  "rejected",
]);

export const positionStatusSchema = z.enum(["open", "closed", "filled"]);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: z.string().trim().min(1).max(80).optional(),
  next: z.string().startsWith("/").max(200).optional(),
});

export const collegeSignupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  institution_name: z.string().trim().min(2).max(120),
  institution_type: z.enum(["university", "college", "bootcamp", "training_provider"]),
  website: z.string().url().max(200).optional().or(z.literal("").transform(() => undefined)),
  contact_phone: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
});

export const companySignupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  company_name: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(120),
  website: z.string().url().max(200).optional().or(z.literal("").transform(() => undefined)),
  size_band: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]),
});

export const candidateSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  skills: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : []))
    .pipe(z.array(z.string().trim().min(1).max(60)).max(20))
    .optional(),
  min_score: z.coerce.number().int().min(0).max(100).default(0),
  max_score: z.coerce.number().int().min(0).max(100).default(100),
  batch_year: z.coerce.number().int().min(2000).max(2100).optional(),
  placement_ready: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const interviewScheduleSchema = z.object({
  candidate_id: z.string().uuid(),
  scheduled_for: z
    .string()
    .datetime({ message: "Use an ISO timestamp" })
    .refine((s) => new Date(s).getTime() > Date.now() - 60_000, {
      message: "Schedule must be in the future",
    }),
  duration_minutes: z.coerce.number().int().min(15).max(240).default(45),
  format: z.enum(["video", "phone", "in_person"]).default("video"),
  notes: z.string().trim().max(2000).optional(),
  position_title: z.string().trim().max(120).optional(),
  required_skills: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

export const jobMatchStatusUpdateSchema = z.object({
  status: jobMatchStatusSchema,
  notes: z.string().trim().max(2000).optional(),
});

export const profileVisibilitySchema = z.object({
  visibility: z.enum(["private", "cohort", "public", "recruiter_only"]),
  slug: slugSchema.optional(),
  show_peak_window: z.boolean().optional(),
  show_skills: z.boolean().optional(),
  show_projects: z.boolean().optional(),
});

export const intakePositionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  required_skills: z
    .array(
      z.object({
        skill_slug: z.string().trim().min(1).max(60),
        min_score: z.coerce.number().int().min(0).max(100).default(60),
      }),
    )
    .max(20)
    .optional(),
  status: positionStatusSchema.default("open"),
  close_at: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});

export const csvImportSchema = z.object({
  rows: z
    .array(
      z.object({
        email: emailSchema,
        full_name: z.string().trim().min(1).max(120),
        enrollment_id: z.string().trim().min(1).max(60),
        batch_year: z.coerce.number().int().min(2000).max(2100),
        primary_specialization: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .max(2000),
});

export const cohortJoinSchema = z.object({
  code: z.string().trim().min(2).max(60).toUpperCase(),
});

export const cohortCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  primary_specialization: z.string().trim().max(80).optional(),
  is_public: z.boolean().default(false),
});

export const integrationSyncSchema = z.object({
  source: z.enum(["github", "calendar"]),
  full: z.boolean().default(false),
});

export const dsaPlatformSchema = z.enum(["leetcode", "hackerrank"]);

const dsaUsernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "Username must be 2-30 chars, letters, digits, _ or -");

export const dsaConnectSchema = z.object({
  platform: dsaPlatformSchema,
  username: dsaUsernameSchema,
  force: z.boolean().default(false),
});

export const dsaSyncSchema = z.object({
  platform: dsaPlatformSchema,
});

export const slugClaimSchema = z.object({
  slug: slugSchema,
  is_public: z.boolean().default(true),
});

export const channelConnectSchema = z.object({
  channel: z.enum(["discord", "telegram", "whatsapp"]),
  handle: z.string().trim().min(2).max(80).optional(),
  return_path: z.string().startsWith("/").max(200).optional(),
});

export const channelVerifySchema = z.object({
  channel: z.enum(["discord", "telegram", "whatsapp"]),
});

export const channelDisconnectSchema = z.object({
  channel: z.enum(["discord", "telegram", "whatsapp"]),
  reason: z.string().trim().max(120).optional(),
});

export const institutionNudgeSettingsSchema = z.object({
  institution_id: z.string().uuid(),
  channel: z.enum(["telegram", "discord", "whatsapp"]),
  expires_at: z.string().datetime().optional(),
});

// ============================================================================
// 11/10 (004) — i18n + Outcome billing
// ============================================================================

export const supportedLocaleCodes = ["en", "hi", "ta", "te", "mr"] as const;
export type SupportedLocaleCode = (typeof supportedLocaleCodes)[number];

export const localeUpdateSchema = z.object({
  locale: z.enum(supportedLocaleCodes),
});

export const outcomeBillingEventSchema = z.object({
  contract_id: z.string().uuid(),
  student_id: z.string().uuid(),
  offer_id: z.string().uuid(),
});

export const outcomeBillingDisputeSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(500),
});

// ============================================================================
// 11/10 (004) — Developer console: API keys + Webhook subscriptions
// ============================================================================

export const apiKeyScopeSchema = z.enum([
  "read:public_profile",
  "read:verifiable_credential",
  "webhook:subscribe",
  "read:placement_aggregate",
]);

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(apiKeyScopeSchema).min(1).max(10),
});

export const webhookEventSchema = z.enum([
  "score.updated",
  "credential.issued",
  "placement.confirmed",
]);

export const webhookSubscribeSchema = z.object({
  event: webhookEventSchema,
  target_url: z.string().url().max(2048),
});

// Public-API variant of webhookSubscribeSchema. Used by
// POST /api/v1/public/webhooks/subscriptions. Differs from the developer-
// console variant only in that target_url has no explicit max-length (the
// DB column is text with no length cap). The event union is duplicated
// rather than reused so the public surface is fully self-describing for
// anyone reading the route file alone.
export const publicWebhookSubscribeSchema = z.object({
  event: z.enum(["score.updated", "credential.issued", "placement.confirmed"]),
  target_url: z.string().url(),
});

// ============================================================================
// 11/10 (004) — SSO + Faculty grading
// ============================================================================

export const facultyVerifySchema = z.object({
  user_id: z.string().uuid(),
  institution_id: z.string().uuid(),
});

export const facultyGradeSchema = z.object({
  student_id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  grade: z.number().int().min(0).max(100),
  comment: z.string().trim().max(2000).optional(),
});

export const ssoConnectionUpsertSchema = z.object({
  institution_id: z.string().uuid(),
  workos_connection_id: z.string().trim().min(1).max(200),
  idp_type: z.string().trim().max(40).optional(),
  status: z.enum(["pending", "active", "disabled"]).default("active"),
});

export const atsProviderSchema = z.enum(["greenhouse", "lever"]);

export const atsConnectSchema = z.object({
  provider: atsProviderSchema,
  api_key: z.string().trim().min(8).max(400),
  // Greenhouse-only: optional prospect pool id where created
  // candidates are placed. Ignored for Lever (Lever applications
  // target postings, not pools).
  pool_id: z.string().trim().max(40).optional().or(z.literal("").transform(() => undefined)),
});

export const atsSavedSearchQuerySchema = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  min_score: z.number().int().min(0).max(100).optional(),
  verified_only: z.boolean().optional(),
  graduation_year: z.number().int().min(2000).max(2100).optional(),
  institutions: z.array(z.string().uuid()).max(20).optional(),
});

export const atsSavedSearchSchema = z.object({
  connection_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  query_json: atsSavedSearchQuerySchema,
  min_score: z.number().int().min(0).max(100).optional(),
});

// 004 — Anti-cheat (US1, FR-AC-001..005). Mirrors the contract in
// specs/004-eleven-of-ten/contracts/api.md → "Internal: Anti-cheat".
export const anticheatAppealSchema = z.object({
  signal_id: z.string().uuid(),
  explanation: z.string().trim().min(30).max(2000),
  evidence_url: z.string().url().optional(),
});

export const anticheatDecideSchema = z.object({
  appeal_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  mentor_note: z.string().trim().max(2000).optional(),
});

export function parseOrError<T>(schema: z.ZodType<T>, data: unknown):
  | { ok: true; data: T }
  | { ok: false; error: string; issues: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const message = result.error.issues[0]?.message ?? "Invalid request";
  return { ok: false, error: message, issues: result.error.issues };
}

// ============================================================================
// 11/10 (004) — Hackathons + Mock Interviews
// ============================================================================

// 24-168h window is enforced via refine so the Zod message is
// student-readable. The DB-level CHECK is the source of truth; this
// catches the mistake before we burn a round trip.
export const hackathonCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    problem: z.string().trim().min(50).max(5000),
    test_cases_url: z.string().url(),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    prize_structure: z.record(z.string()),
  })
  .refine(
    (v) => {
      const s = new Date(v.starts_at).getTime();
      const e = new Date(v.ends_at).getTime();
      const hours = (e - s) / 3_600_000;
      return e > s && hours >= 24 && hours <= 168;
    },
    { message: "Hackathon window must be 24-168 hours", path: ["ends_at"] },
  );

export const hackathonSubmitSchema = z.object({
  code_url: z.string().url(),
  language: z.enum(["python", "javascript", "typescript", "go", "rust"]),
});

export const mockInterviewStartSchema = z.object({
  topic: z.string().trim().min(2).max(120),
});

export const mockInterviewTurnSchema = z.object({
  interview_id: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});
