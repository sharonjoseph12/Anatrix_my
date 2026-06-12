export interface Suggestion {
  topic: string;
  negativeCount: number;
}

export function detectStruggles(studentId: string, recentFeedback: any[]): Suggestion[] {
  const grouped: Record<string, number> = {};
  for (const f of recentFeedback) {
    if (f.feedback_kind === 'too_hard' || f.feedback_kind === 'irrelevant') {
      const topic = f.lesson?.topic || 'Unknown Topic';
      grouped[topic] = (grouped[topic] || 0) + 1;
    }
  }

  const suggestions: Suggestion[] = [];
  for (const [topic, count] of Object.entries(grouped)) {
    if (count >= 2) {
      suggestions.push({ topic, negativeCount: count });
    }
  }
  return suggestions;
}
