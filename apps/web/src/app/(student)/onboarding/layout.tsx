import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingStepper } from "@/components/onboarding/stepper";

const STEP_INDEX: Record<string, number> = {
  profile: 0,
  github: 1,
  calendar: 2,
  complete: 3,
};

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/onboarding/profile");

  const { data: profile } = await supabase
    .from("users")
    .select("onboarding_step,onboarding_completed_at")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  const stepName =
    typeof profile?.onboarding_step === "string" ? profile.onboarding_step : "profile";
  const currentStep = STEP_INDEX[stepName] ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="container py-6">
          <OnboardingStepper currentStep={currentStep} />
        </div>
      </header>
      <main className="flex-1 py-10">
        <div className="container max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
