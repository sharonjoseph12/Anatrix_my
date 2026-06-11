/**
 * Exponential backoff schedule for mirror retries.
 * Schedule: 1m, 5m, 25m, 2h, 12h
 * Returns null when attemptCount >= 5 (dead-letter)
 */
export function nextBackoffDelay(attemptCount: number): number | null {
  const schedule = [1, 5, 25, 120, 720]; // minutes
  if (attemptCount >= schedule.length) return null; // dead-letter
  return schedule[attemptCount];
}
