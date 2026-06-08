import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the user is actually a member (or cohort is public + visible)
  const { data: cohort, error: cErr } = await supabase
    .from("cohorts")
    .select("id,name,description,member_count,is_public")
    .eq("id", id)
    .single();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership && !(cohort?.is_public)) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: comparison, error: cmpErr } = await supabase.rpc("cohort_compare", {
    p_user_id: user.id,
    p_cohort_id: id,
  });

  if (cmpErr) {
    return NextResponse.json({ error: cmpErr.message }, { status: 500 });
  }

  return NextResponse.json({ cohort, comparison });
}
