export interface StylometricVector {
  keystrokeTiming: number[];
  astDiffSequence: Array<{ nodesAdded: number; nodesRemoved: number; maxDepthDelta: number }>;
  errorRecovery: { count: number; latenciesMs: number[]; meanLatencyMs: number; medianLatencyMs: number };
}

export function extractStylometricVector(
  keystrokes: Array<{ timestamp: number; latency: number }>,
  astDiffs: Array<{ nodesAdded: number; nodesRemoved: number; maxDepthDelta: number }>,
  errorRecoveries: Array<{ latency: number }>,
): StylometricVector {
  const latencies = keystrokes.map((k) => k.latency).filter((l) => l > 0);
  const bins = Array.from({ length: 10 }, (_, i) => i * 50 + 50);
  const counts = bins.map(
    (bin) => latencies.filter((l) => l >= bin && l < bin + 50).length,
  );

  return {
    keystrokeTiming: [bins, counts].flat(),
    astDiffSequence: astDiffs,
    errorRecovery: buildErrorRecovery(errorRecoveries),
  };
}

function buildErrorRecovery(errorRecoveries: Array<{ latency: number }>) {
  const errorLatencies = errorRecoveries.map((e) => e.latency);
  const meanLatency = errorLatencies.length > 0
    ? errorLatencies.reduce((a, b) => a + b, 0) / errorLatencies.length
    : 0;
  const sorted = [...errorLatencies].sort((a, b) => a - b);
  const medianLatency = sorted.length > 0
    ? (sorted[Math.floor(sorted.length / 2)] ?? 0)
    : 0;
  return {
    count: errorRecoveries.length,
    latenciesMs: errorLatencies,
    meanLatencyMs: meanLatency,
    medianLatencyMs: medianLatency,
  };
}

export function compareVectors(
  sessionVector: StylometricVector,
  baseline: StylometricVector,
): number {
  if (
    !sessionVector?.keystrokeTiming ||
    !baseline?.keystrokeTiming ||
    sessionVector.keystrokeTiming.length === 0 ||
    baseline.keystrokeTiming.length === 0
  ) {
    return 0;
  }

  return computeCosineSimilarity(sessionVector.keystrokeTiming, baseline.keystrokeTiming);
}

function computeCosineSimilarity(a: number[], b: number[]) {
  const minLen = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < minLen; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

export function mapSimilarityToConfidence(similarity: number): number {
  if (similarity >= 0.95) return 100;
  if (similarity >= 0.9) return 90;
  if (similarity >= 0.85) return 80;
  if (similarity >= 0.8) return 70;
  if (similarity >= 0.7) return 50;
  return Math.max(0, Math.floor(similarity * 60));
}
