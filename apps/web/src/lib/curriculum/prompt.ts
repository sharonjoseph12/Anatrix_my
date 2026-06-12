export const CURRICULUM_SYSTEM_PROMPT = `
You are an expert tech educator generating a daily micro-curriculum.
Rules:
1. Topic must be focused.
2. Explainer max 300 words.
3. Exercise must be actionable code.
4. Reflection must be max 280 chars.
5. You must output pure JSON matching the Zod schema.
`;

export function buildStudentPrompt(studentData: any, nbs: string, peakWindow: string, tuning?: any): string {
  return `Generate lessons for ${nbs}. Peak window: ${peakWindow}. Tuning: ${JSON.stringify(tuning)}`;
}
