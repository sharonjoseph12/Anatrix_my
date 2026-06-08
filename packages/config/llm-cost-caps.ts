/**
 * Shared LLM cost-cap constants.
 *
 * Imported by: 004 (mock-interview), 005 (cover-letter drafter), 007 (curriculum generator).
 * Enforced server-side. Client-side caps are advisory only.
 *
 * Constitutional backing: Principle III (Cost-Aware).
 * See .specify/memory/constitution.md §III.
 */

export const LLM_COST_CAPS = {
  /** Per-student weekly token cap. Override per-feature if the use case warrants. */
  WEEKLY_TOKEN_CAP_DEFAULT: 30_000,

  /** Per-tenant monthly token cap. */
  MONTHLY_TENANT_TOKEN_CAP_DEFAULT: 3_000_000,

  /** Per-student daily draft cap (cover-letter only, 005). */
  COVER_LETTER_DAILY_DRAFT_CAP: 5,

  /** Max tokens per single cover-letter draft (005). */
  COVER_LETTER_TOKEN_BUDGET: 4_000,

  /** Max tokens per mock-interview turn (004). */
  MOCK_INTERVIEW_TOKEN_BUDGET: 2_000,

  /** Max tokens per micro-lesson (007). */
  LESSON_TOKEN_BUDGET: 1_500,

  /** Fallback provider order: primary first, fallback if primary errors. */
  PROVIDER_FALLBACK_ORDER: ['groq', 'openai'] as const,
} as const;

export type LlmProvider = (typeof LLM_COST_CAPS.PROVIDER_FALLBACK_ORDER)[number];

/**
 * Helper: throw a typed error if a per-student weekly cap would be exceeded.
 * Call this BEFORE every LLM call.
 */
export function assertWeeklyCapNotExceeded(
  studentId: string,
  tokensUsedThisWeek: number,
  requestedTokens: number,
  overrideCap: number = LLM_COST_CAPS.WEEKLY_TOKEN_CAP_DEFAULT
): void {
  if (tokensUsedThisWeek + requestedTokens > overrideCap) {
    throw new WeeklyCapExceededError(studentId, tokensUsedThisWeek, requestedTokens, overrideCap);
  }
}

export class WeeklyCapExceededError extends Error {
  constructor(
    public readonly studentId: string,
    public readonly used: number,
    public readonly requested: number,
    public readonly cap: number
  ) {
    super(
      `Weekly LLM cap exceeded for student ${studentId}: ` +
        `used ${used} + requested ${requested} > cap ${cap}. ` +
        `Next nudge must fall back to non-LLM channel.`
    );
    this.name = 'WeeklyCapExceededError';
  }
}

export class MonthlyTenantCapExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly used: number,
    public readonly requested: number,
    public readonly cap: number
  ) {
    super(
      `Monthly tenant LLM cap exceeded for tenant ${tenantId}: ` +
        `used ${used} + requested ${requested} > cap ${cap}. ` +
        `Feature flag will auto-disable for this tenant; escalate to SRE.`
    );
    this.name = 'MonthlyTenantCapExceededError';
  }
}
