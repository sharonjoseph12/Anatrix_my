import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileVisibilityClient } from "./visibility-client";

export default async function ProfileVisibilityPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/profile-visibility");

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("is_public,is_open_to_opportunities,slug")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile visibility</h1>
        <p className="text-muted-foreground">
          Control who can see your verified skill profile and reach out.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Changes apply immediately. Recruiters will only see your profile
            when both toggles permit it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileVisibilityClient
            initialIsPublic={profile?.is_public ?? false}
            initialOpenToOpportunities={
              profile?.is_open_to_opportunities ?? false
            }
            initialSlug={profile?.slug ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
