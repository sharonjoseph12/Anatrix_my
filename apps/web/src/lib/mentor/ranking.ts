export interface MatchInput {
  alumnusId: string;
  cosineScore: number;
  companyMatch: boolean;
  availSoon: boolean;
  ratingAvg: number;
}

export interface MatchResult extends MatchInput {
  finalScore: number;
}

export function applyRanking(matches: MatchInput[], topK = 5): MatchResult[] {
  const results = matches.map(m => {
    let score = (m.cosineScore * 0.6) + (m.companyMatch ? 0.3 : 0) + (m.availSoon ? 0.1 : 0);
    // Boost high rated
    if (m.ratingAvg >= 4.5) {
      score += 0.15; // boost equivalent to +3 positions roughly
    }
    return { ...m, finalScore: score };
  });

  results.sort((a, b) => b.finalScore - a.finalScore);
  return results.slice(0, topK);
}
