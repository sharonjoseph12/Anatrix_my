export function validateIntro(text: string): { ok: boolean; reason?: string } {
  if (!text) {
    return { ok: false, reason: 'Intro text cannot be empty' };
  }
  const len = text.trim().length;
  if (len < 10) {
    return { ok: false, reason: 'Intro text is too short (min 10 chars)' };
  }
  if (len > 200) {
    return { ok: false, reason: 'Intro text is too long (max 200 chars)' };
  }
  return { ok: true };
}
