import { ImageResponse } from "next/og";

export const runtime = "edge";

type Props = { params: Promise<{ slug: string }> };

export default async function OpengraphImage({ params }: Props) {
  const { slug } = await params;

  // Lazy import the server client so the edge bundle stays small.
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("is_public,overall_skill_proof_score,user:users(display_name,avatar_url)")
    .eq("slug", slug)
    .maybeSingle();
  const p = profile as null | {
    is_public: boolean;
    overall_skill_proof_score: number | null;
    user: { display_name: string | null; avatar_url: string | null } | null;
  };

  if (!p || !p.is_public) {
    return new ImageResponse(<div>Profile not found</div>, { width: 1200, height: 630 });
  }

  const score = p.overall_skill_proof_score ?? 0;
  const name = p.user?.display_name ?? "Antarix user";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0b1220 0%, #1e3a8a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, opacity: 0.8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#22d3ee" }} />
          <span>Antarix · verified skill proof</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 36, color: "#a5b4fc" }}>Skill Proof Score {score}/100</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, opacity: 0.7 }}>
          <span>antarix.app/{slug}</span>
          <span>Verified · updated automatically</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
