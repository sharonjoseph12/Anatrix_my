// apps/web/src/lib/algorithms/leaderboard-tie-breakers.ts
// Re-export from @antarix/utils so the existing import paths continue to
// resolve while the implementation lives in the shared package.

export {
  compareLeaderboard,
  rankLeaderboard,
  type LeaderboardEntry,
} from "@antarix/utils";
