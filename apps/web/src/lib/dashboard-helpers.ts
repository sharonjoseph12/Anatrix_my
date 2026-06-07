export function daysUntilInsights(createdAt: string | Date): number {
  const start = new Date(createdAt).getTime();
  const elapsedDays = (Date.now() - start) / (1000 * 60 * 60 * 24);
  return Math.max(0, 7 - Math.floor(elapsedDays));
}

export function greetingForHour(hour: number = new Date().getHours()): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
