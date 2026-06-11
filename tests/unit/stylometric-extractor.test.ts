import { describe, it, expect } from "vitest";
import { extractStylometricVector, compareVectors, mapSimilarityToConfidence } from "../src/lib/authorship/stylometric-extractor";

describe("stylometric-extractor", () => {
  describe("extractStylometricVector", () => {
    it("should build a vector from keystroke data", () => {
      const vector = extractStylometricVector(
        [{ timestamp: 100, latency: 120 }, { timestamp: 200, latency: 80 }],
        [{ nodesAdded: 5, nodesRemoved: 2, maxDepthDelta: 3 }],
        [{ latency: 1500 }],
      );
      expect(vector.keystrokeTiming).toBeDefined();
      expect(vector.astDiffSequence).toHaveLength(1);
      expect(vector.errorRecovery.count).toBe(1);
    });
  });

  describe("compareVectors", () => {
    it("should return 1 for identical vectors", () => {
      const v = extractStylometricVector(
        [{ timestamp: 100, latency: 120 }],
        [],
        [],
      );
      expect(compareVectors(v, v)).toBeGreaterThan(0.99);
    });

    it("should return 0 for empty vectors", () => {
      expect(compareVectors(
        { keystrokeTiming: [], astDiffSequence: [], errorRecovery: { count: 0, latenciesMs: [], meanLatencyMs: 0, medianLatencyMs: 0 } },
        { keystrokeTiming: [], astDiffSequence: [], errorRecovery: { count: 0, latenciesMs: [], meanLatencyMs: 0, medianLatencyMs: 0 } },
      )).toBe(0);
    });
  });

  describe("mapSimilarityToConfidence", () => {
    it("should map 0.95 to 100", () => {
      expect(mapSimilarityToConfidence(0.95)).toBe(100);
    });
    it("should map 0.7 to 50", () => {
      expect(mapSimilarityToConfidence(0.7)).toBe(50);
    });
    it("should floor at 0", () => {
      expect(mapSimilarityToConfidence(0.1)).toBe(6);
    });
  });
});
