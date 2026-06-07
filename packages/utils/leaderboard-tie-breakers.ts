// packages/utils/leaderboard-tie-breakers.ts
// Sort: score DESC, last_active_at DESC, user_id ASC. Mirrors the spec at
// T084; living in utils so it can be unit-tested and reused by web + edge.

export type LeaderboardEntry = {
  user_id: string;
  score: number;
  last_active_at: string;
};

export function compareLeaderboard(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  const ta = new Date(a.last_active_at).getTime();
  const tb = new Date(b.last_active_at).getTime();
  if (tb !== ta) return tb - ta;
  if (a.user_id < b.user_id) return -1;
  if (a.user_id > b.user_id) return 1;
  return 0;
}

export function rankLeaderboard(entries: LeaderboardEntry[]): Array<LeaderboardEntry & { rank: number }> {
  const sorted = [...entries].sort(compareLeaderboard);
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}
