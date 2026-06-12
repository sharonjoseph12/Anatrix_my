export function calibrateDifficulty(studentId: string, topic: string, subTopic: string, recentFeedback: any[]): { difficulty: number; downweightedUntil: Date | null } {
  // If recent feedback has "too_hard", lower difficulty
  const tooHardCount = recentFeedback.filter(f => f.feedback_kind === 'too_hard').length;
  let difficulty = 3; // 1-5 scale
  if (tooHardCount > 0) {
    difficulty = Math.max(1, difficulty - tooHardCount);
  }
  return { difficulty, downweightedUntil: null };
}
