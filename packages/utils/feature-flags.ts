export const COLLAB_FEATURE_FLAGS = [
  "008_collab_rooms",
  "008_collab_javascript",
  "008_collab_python",
  "008_collab_go_rust",
  "008_teamwork_scorer",
  "008_anti_collusion",
  "008_collab_opt_out_ui",
  "008_recruiter_observe",
  "008_collab_liveblocks_paid",
  "008_collab_recordings",
] as const;

export type CollabFeatureFlag = (typeof COLLAB_FEATURE_FLAGS)[number];
export type FeatureFlagState = Partial<Record<CollabFeatureFlag, boolean>>;

export function isCollabFeatureFlag(value: string): value is CollabFeatureFlag {
  return (COLLAB_FEATURE_FLAGS as readonly string[]).includes(value);
}

export function isCollabFeatureEnabled(flags: FeatureFlagState, flag: CollabFeatureFlag): boolean {
  return flags[flag] === true;
}
