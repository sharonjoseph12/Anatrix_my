export function enforceCap(studentId: string, tenantId: string, attemptedTokens: number): { allowed: boolean; breachRow?: any } {
  // Mock cap enforcement
  const monthlyCap = parseInt(process.env.CURRICULUM_MONTHLY_TENANT_TOKEN_CAP || '5000000');
  const weeklyCap = parseInt(process.env.CURRICULUM_WEEKLY_TOKEN_CAP || '50000');
  
  if (attemptedTokens > weeklyCap) {
    return {
      allowed: false,
      breachRow: {
        scope: 'student',
        scope_id: studentId,
        kind: 'over_budget'
      }
    };
  }
  return { allowed: true };
}
