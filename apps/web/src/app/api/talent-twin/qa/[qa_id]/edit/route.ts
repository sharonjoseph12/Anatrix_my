import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(
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
  const edited_answer = typeof json.answer === "string" ? json.answer : null;
  if (edited_answer === null) {
    return NextResponse.json({ error: "answer field is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("answer_preview")
    .update({ edited_answer })
    .eq("id", qa_id)
    .eq("student_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "saved" });
}
