import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function fetchSourceData(
  userId: string,
  sourceTypes: string[],
): Promise<Record<string, unknown[]>> {
  const supabase = await createSupabaseServerClient();
  const result: Record<string, unknown[]> = {};

  for (const sourceType of sourceTypes) {
    switch (sourceType) {
      case "commits": {
        const { data } = await supabase
          .from("github_commits")
          .select("*")
          .eq("user_id", userId)
          .limit(500);
        result.commits = (data ?? []) as unknown[];
        break;
      }
      case "sessions": {
        const { data } = await supabase
          .from("ide_sessions")
          .select("*")
          .eq("user_id", userId)
          .limit(100);
        result.sessions = (data ?? []) as unknown[];
        break;
      }
      case "collab": {
        const { data } = await supabase
          .from("collab_artifacts")
          .select("*")
          .eq("user_id", userId)
          .limit(100);
        result.collab = (data ?? []) as unknown[];
        break;
      }
      default:
        break;
    }
  }

  return result;
}
