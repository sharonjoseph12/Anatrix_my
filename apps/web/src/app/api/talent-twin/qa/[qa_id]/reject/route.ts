import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ qa_id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { qa_id } = await params;
  const json = await req.json().catch(() => ({}));
  const edit = typeof json.edit === "string" ? json.edit : null;

  const update: Record<string, string | null> = {
    status: "rejected",
    rejected_at: new Date().toISOString(),
  };
  if (edit !== null) {
    update.edited_answer = edit;
  }

  const { error } = await supabase
    .from("answer_preview")
    .update(update)
    .eq("id", qa_id)
    .eq("student_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "rejected", edited: edit !== null });
}
