export function issueBadge(
  studentId: string,
  badgeNonce: string,
  commits: Array<{ sha: string; repo: string; lines: number; date: string }>,
  label: string,
): { jwt: string; badgeId: string } {
  const badgeId = crypto.randomUUID();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: studentId,
      badgeNonce,
      label,
      commits,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 31536000,
    }),
  );
  const jwt = `${header}.${payload}.placeholder-sig`;

  return { jwt, badgeId };
}
