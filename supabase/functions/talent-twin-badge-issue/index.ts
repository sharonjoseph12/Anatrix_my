import { signBadge } from "../_shared/twin-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";
import { withRateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BADGE_EXPIRY_DAYS = 365;

function renderBadgeSvg(studentName: string, label: string, linesAuthored: number, repoCount: number, repos: string[], verificationUrl: string): string {
  const repoNames = repos.slice(0, 3).map((r) => r.split("/").pop() ?? r).join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" rx="12" fill="#1a1a2e"/>
  <text x="20" y="36" font-family="sans-serif" font-size="14" fill="#a0a0b0">Verified by Antarix</text>
  <text x="20" y="70" font-family="sans-serif" font-size="22" font-weight="bold" fill="#ffffff">${studentName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</text>
  <text x="20" y="100" font-family="sans-serif" font-size="14" fill="#c0c0d0">${label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</text>
  <text x="20" y="130" font-family="sans-serif" font-size="13" fill="#a0a0b0">${linesAuthored} lines in ${repoCount} repos</text>
  <text x="20" y="150" font-family="sans-serif" font-size="13" fill="#808090">${repoNames}</text>
  <text x="20" y="180" font-family="sans-serif" font-size="10" fill="#606070">Verify: ${verificationUrl}</text>
</svg>`;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized", message: "Invalid or expired JWT" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { data: profile } = await client.from("users").select("talent_twin_opt_in, name").eq("id", user.id).single();
  if (!profile?.talent_twin_opt_in) {
    return new Response(JSON.stringify({ error: "forbidden", message: "AI Talent Twin must be opted in to issue badges" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const { commits, label } = await req.json();
  if (!commits || !Array.isArray(commits) || commits.length === 0 || commits.length > 50) {
    return new Response(JSON.stringify({ error: "invalid_request", message: "commits must be an array of 1-50 commit SHAs" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { data: dbCommits } = await client
    .from("github_commits")
    .select("sha, repo, message, lines_added, committed_at")
    .in("sha", commits)
    .eq("user_id", user.id);

  if (!dbCommits || dbCommits.length === 0) {
    return new Response(JSON.stringify({ error: "commits_not_eligible", message: "None of the specified commits were found for this user." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const eligible = dbCommits.filter((c: Record<string, unknown>) => (c.lines_added as number ?? 0) > 0);
  if (eligible.length === 0) {
    return new Response(JSON.stringify({ error: "commits_not_eligible", message: "All specified commits have 0 lines added." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const totalLines = eligible.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.lines_added as number) ?? 0), 0);
  const repoSet = new Set(eligible.map((c: Record<string, unknown>) => c.repo as string));
  const topRepos = [...repoSet].slice(0, 3);

  const badgeNonce = crypto.randomUUID();
  const badgeId = crypto.randomUUID();

  const commitClaims = eligible.map((c: Record<string, unknown>) => ({
    sha: c.sha as string,
    repo: c.repo as string,
    lines: (c.lines_added as number) ?? 0,
    date: c.committed_at as string,
    messageSha256: c.sha as string,
  }));

  const jwt = signBadge({ sub: user.id, badgeNonce, commits: commitClaims });
  const studentName = (profile as Record<string, unknown>).name as string ?? "Student";
  const badgeLabel = label ?? `Top commits — ${new Date().getFullYear()}`;
  const verificationUrl = `https://antarix.app/badges/verify?badge_id=${badgeId}`;
  const svg = renderBadgeSvg(studentName, badgeLabel, totalLines, repoSet.size, topRepos, verificationUrl);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const svgKey = `badges/authorship/${badgeId}.svg`;
  const { error: uploadError } = await client.storage.from("public").upload(svgKey, svg, {
    contentType: "image/svg+xml",
    cacheControl: "public, max-age=604800",
    upsert: true,
  });

  if (uploadError) {
    console.error(`upload badge SVG: ${uploadError.message}`);
  }

  const { data: storageData } = client.storage.from("public").getPublicUrl(svgKey);
  const svgUrl = storageData?.publicUrl ?? `https://antarix.app/badges/authorship/${badgeId}.svg`;

  await client.from("authorship_proof").insert({
    id: badgeId,
    student_id: user.id,
    project_id: eligible[0].repo ?? "unknown",
    status: "completed",
    confidence_score: 100,
    verifiable_credential_url: svgUrl,
    completed_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({
    badge_id: badgeId,
    nonce: badgeNonce,
    svg_url: svgUrl,
    jwt,
    expires_at: new Date(Date.now() + BADGE_EXPIRY_DAYS * 86400000).toISOString(),
    commits_included: eligible.length,
    total_lines_authored: totalLines,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export default withObservability(withRateLimit(handler, "talent-twin-badge-issue"));
