"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Download } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingCompletePanel() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("there");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("display_name,onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);

      if (data && !data.onboarding_completed_at) {
        await supabase
          .from("users")
          .update({
            onboarding_completed_at: new Date().toISOString(),
            onboarding_step: "complete",
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    })();
  }, []);

  function goToDashboard() {
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <CardTitle>You&apos;re all set, {displayName}!</CardTitle>
        <CardDescription>
          Your account is ready. Install the Chrome extension to start tracking sessions
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/50 p-4 text-sm">
          <p className="font-medium">What happens next?</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• Install the Chrome extension to track focused sessions</li>
            <li>• Insights unlock after 7 days of data</li>
            <li>• Your verified profile appears in candidate search once you opt in</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={goToDashboard} disabled={isPending}>
            {isPending ? "Loading..." : "Go to Dashboard"}
          </Button>
          <Button asChild variant="outline">
            <a href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Get Chrome Extension
            </a>
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Need help getting started?{" "}
          <Link href="/help" className="underline">
            Read the quickstart
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
