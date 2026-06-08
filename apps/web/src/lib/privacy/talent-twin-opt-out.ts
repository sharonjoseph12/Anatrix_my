import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

export async function toggleOptIn(
  userId: string,
  optIn: boolean,
): Promise<{ optIn: boolean; chunksCount?: number }> {
  const supabase = await createSupabaseServerClient();

  if (optIn) {
    await supabase.from("users").update({ talent_twin_opt_in: true }).eq("id", userId);
    const { count } = await supabase
      .from("talent_twin_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    return { optIn: true, chunksCount: count ?? 0 };
  }

  await supabase.rpc("delete_student_chunks", { p_user_id: userId });
  await supabase.from("users").update({ talent_twin_opt_in: false }).eq("id", userId);
  return { optIn: false };
}

export function hashQuestion(question: string): string {
  return createHash("sha256").update(question).digest("hex");
}

export function hashAnswer(answer: string): string {
  return createHash("sha256").update(answer).digest("hex");
}
