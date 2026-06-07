// supabase/functions/_shared/suppress-nudge.ts
// Thin re-export from @antarix/utils so edge functions and the shared webhook
// dispatcher all share a single source of truth that is also unit-tested.

export {
  shouldSuppress,
  isWithinQuietHours,
  isInExamWindow,
  type NudgePrefs,
  type NudgeType,
  type Channel,
  type ExamWindow,
  type SuppressReason,
} from "@antarix/utils";
