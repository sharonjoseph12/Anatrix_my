export const IDE_SCORE_CAP = 3;
export const BIOMETRIC_SCORE_CAP = 2;
export const COMBINED_SCORE_CAP = 5;

export function clampIDEScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(IDE_SCORE_CAP, raw));
}

export function clampBiometricScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(BIOMETRIC_SCORE_CAP, raw));
}

export function clampCombinedScore(
  ideRaw: number,
  biometricRaw: number,
): { ide: number; biometric: number; total: number } {
  const ide = clampIDEScore(ideRaw);
  const biometric = clampBiometricScore(biometricRaw);
  const sum = ide + biometric;
  if (sum <= COMBINED_SCORE_CAP) return { ide, biometric, total: sum };
  const factor = COMBINED_SCORE_CAP / sum;
  const ideScaled = Math.round(ide * factor * 100) / 100;
  const biometricScaled = Math.round(biometric * factor * 100) / 100;
  return { ide: ideScaled, biometric: biometricScaled, total: COMBINED_SCORE_CAP };
}
