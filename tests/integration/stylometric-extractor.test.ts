import { describe, it, expect } from 'vitest';
import {
  extractStylometricVector,
  compareVectors,
  mapSimilarityToConfidence,
  StylometricVector
} from '../../apps/web/src/lib/authorship/stylometric-extractor';

describe('stylometric-extractor', () => {
  describe('extractStylometricVector', () => {
    it('should extract correct vector for empty input', () => {
      const vec = extractStylometricVector([], [], []);
      expect(vec.errorRecovery.count).toBe(0);
      expect(vec.errorRecovery.meanLatencyMs).toBe(0);
      expect(vec.errorRecovery.medianLatencyMs).toBe(0);
      expect(vec.astDiffSequence).toEqual([]);
      expect(vec.keystrokeTiming).toHaveLength(20); // 10 bins + 10 counts
    });

    it('should calculate mean and median error latencies', () => {
      const vec = extractStylometricVector(
        [{ timestamp: 1, latency: 50 }, { timestamp: 2, latency: 150 }],
        [{ nodesAdded: 1, nodesRemoved: 0, maxDepthDelta: 1 }],
        [{ latency: 100 }, { latency: 200 }, { latency: 300 }]
      );
      expect(vec.errorRecovery.count).toBe(3);
      expect(vec.errorRecovery.meanLatencyMs).toBe(200); // (100+200+300)/3
      expect(vec.errorRecovery.medianLatencyMs).toBe(200);
      
      // Test keystroke bins mapping:
      // bins start at 50, so latency 50 goes into bin 50 (index 0).
      // latency 150 goes into bin 150 (index 2).
      const counts = vec.keystrokeTiming.slice(10);
      expect(counts[0]).toBe(1); // 50-99
      expect(counts[2]).toBe(1); // 150-199
      expect(counts[1]).toBe(0); // 100-149
    });
  });

  describe('compareVectors', () => {
    it('should return 0 for empty vectors', () => {
      expect(compareVectors({} as any, {} as any)).toBe(0);
      expect(compareVectors(
        { keystrokeTiming: [] } as any,
        { keystrokeTiming: [] } as any
      )).toBe(0);
    });

    it('should return 1 for identical non-zero vectors', () => {
      const v1 = { keystrokeTiming: [1, 2, 3] } as StylometricVector;
      const v2 = { keystrokeTiming: [1, 2, 3] } as StylometricVector;
      expect(compareVectors(v1, v2)).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const v1 = { keystrokeTiming: [1, 0] } as StylometricVector;
      const v2 = { keystrokeTiming: [0, 1] } as StylometricVector;
      expect(compareVectors(v1, v2)).toBe(0);
    });

    it('should handle different length vectors up to minimum length', () => {
      const v1 = { keystrokeTiming: [1, 1, 1] } as StylometricVector;
      const v2 = { keystrokeTiming: [1, 1] } as StylometricVector;
      // Truncates to minLen=2, so dot=2, normA=2, normB=2. magnitude=2.
      expect(compareVectors(v1, v2)).toBeCloseTo(1, 5);
    });
  });

  describe('mapSimilarityToConfidence', () => {
    it('should map predefined thresholds', () => {
      expect(mapSimilarityToConfidence(0.96)).toBe(100);
      expect(mapSimilarityToConfidence(0.90)).toBe(90);
      expect(mapSimilarityToConfidence(0.86)).toBe(80);
      expect(mapSimilarityToConfidence(0.81)).toBe(70);
      expect(mapSimilarityToConfidence(0.75)).toBe(50);
    });

    it('should scale linearly below 0.7', () => {
      expect(mapSimilarityToConfidence(0.6)).toBe(36); // floor(0.6 * 60)
      expect(mapSimilarityToConfidence(0.5)).toBe(30);
      expect(mapSimilarityToConfidence(0)).toBe(0);
      expect(mapSimilarityToConfidence(-0.1)).toBe(0); // tests Math.max(0, ...)
    });
  });
});
