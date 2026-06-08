// /api/v1/public/profiles/[slug]
// Public profile read endpoint. Requires API key with scope 'read:public_profile'.
// Rate limited per key. Cache-Control: public, 5 min.
// See specs/004-eleven-of-ten/contracts/api.md

import "server-only";
import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyApiKeyFromHeader, hasScope } from "@/lib/api/apikey";
import { enforcePublicApiRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

type ErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

function err(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): NextResponse<ErrorBody> {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="antarix-public-api"';
  }
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
  }
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status, headers },
  );
}

function ratelimitHeaders(rate: {
  remaining: number;
  reset_at: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.floor(rate.reset_at / 1000)),
  };
}

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    if (!slug || !SLUG_RE.test(slug)) {
      return err("invalid_input", "slug must match /^[a-z0-9-]{3,40}$/", 400);
    }

    const auth = await verifyApiKeyFromHeader(req.headers.get("authorization"));
    if (!auth.ok || !auth.key) {
      return err("unauthorized", "A valid API key is required.", 401);
    }
    if (!hasScope(auth.key, "read:public_profile")) {
      return err(
        "forbidden",
        "API key is missing scope read:public_profile.",
        403,
      );
    }

    const rate = await enforcePublicApiRateLimit(
      auth.key.id,
      auth.key.rate_limit_rpm,
    );
    if (!rate.ok) {
      const extraHeaders: Record<string, string> = {
        "Retry-After": String(Math.max(1, rate.retry_after_seconds)),
      };
      return err(
        "rate_limited",
        "Rate limit exceeded.",
        429,
        { retry_after_seconds: rate.retry_after_seconds },
        extraHeaders,
      );
    }

    const supabase = createSupabaseServiceClient();

    // Slug + is_public live on candidate_profiles (the denormalised student
    // record). We additionally require the underlying user to not be in the
    // soft-delete window (deletion_requested_at IS NULL) so an account that
    // has started account-deletion never leaks a profile.
    const { data: profile, error: profileErr } = await supabase
      .from("candidate_profiles")
      .select("user_id, slug, is_public, bio, overall_skill_proof_score")
      .eq("slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (profileErr) {
      console.error("v1/public/profiles: candidate_profiles query failed", {
        slug,
        error: profileErr.message,
      });
      return err("internal_error", "Internal error", 500);
    }
    if (!profile) {
      return err(
        "not_found",
        "Profile not found or not public",
        404,
      );
    }
    const p = profile as {
      user_id: string;
      slug: string;
      is_public: boolean;
      bio: string | null;
      overall_skill_proof_score: number | null;
    };

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, display_name, avatar_url, last_active_at")
      .eq("id", p.user_id)
      .is("deletion_requested_at", null)
      .maybeSingle();

    if (userErr) {
      console.error("v1/public/profiles: users query failed", {
        userId: p.user_id,
        error: userErr.message,
      });
      return err("internal_error", "Internal error", 500);
    }
    if (!user) {
      return err(
        "not_found",
        "Profile not found or not public",
        404,
      );
    }
    const u = user as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      last_active_at: string | null;
    };

    // Top 5 skills (skill_proof_score DESC). The skill_id join surfaces
    // the skill name from the public.skills table.
    const { data: topSkillsRows, error: skillsErr } = await supabase
      .from("user_skills")
      .select("skill_proof_score, skill:skills(name)")
      .eq("user_id", p.user_id)
      .order("skill_proof_score", { ascending: false })
      .limit(5);

    if (skillsErr) {
      console.error("v1/public/profiles: user_skills query failed", {
        userId: p.user_id,
        error: skillsErr.message,
      });
      return err("internal_error", "Internal error", 500);
    }

    const topSkills = (
      (topSkillsRows ?? []) as Array<{
        skill_proof_score: number;
        skill: { name: string } | { name: string }[] | null;
      }>
    ).map((s) => {
      const sk = Array.isArray(s.skill) ? s.skill[0] : s.skill;
      return sk?.name ?? "Skill";
    });

    const verifiedScore = p.overall_skill_proof_score ?? 0;

    const body = {
      slug: p.slug,
      display_name: u.display_name ?? "",
      bio: p.bio ?? null,
      avatar_url: u.avatar_url ?? null,
      verified_score: verifiedScore,
      top_skills: topSkills,
      is_verified: verifiedScore > 0,
      last_active_at: u.last_active_at ?? null,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Antarix-Response-Source": "direct",
        ...ratelimitHeaders(rate),
      },
    });
  } catch (e) {
    console.error("v1/public/profiles: unexpected error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return err("internal_error", "Internal error", 500);
  }
}
