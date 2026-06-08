import { compareVectors, mapSimilarityToConfidence, type StylometricVector } from "./stylometric-extractor";

export interface BaselineResult {
  similarity: number;
  confidenceScore: number;
  meetsThreshold: boolean;
}

const AUTHORSHIP_THRESHOLD = 0.8;

export async function compareToBaseline(
  sessionVector: StylometricVector,
  baselineVector: StylometricVector,
): Promise<BaselineResult> {
  const similarity = compareVectors(sessionVector, baselineVector);
  const confidenceScore = mapSimilarityToConfidence(similarity);

  return {
    similarity,
    confidenceScore,
    meetsThreshold: similarity >= AUTHORSHIP_THRESHOLD,
  };
}
