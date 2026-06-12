"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoogleIcon } from "@/components/icons/social";

export function CalendarConnectPanel() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("calendar_accounts")
        .select("email,status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.status === "active") {
        setIsConnected(true);
        setEmail(data.email);
      }
    })();
  }, []);

  function connect() {
    const supabase = createSupabaseBrowserClient();
    startTransition(async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding/calendar?connected=1")}`,
          scopes: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) {
        console.error(error);
        return;
      }
      if (data?.url) window.location.href = data.url;
    });
  }

  async function continueOnboarding() {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("users")
      .update({ onboarding_step: "complete", updated_at: new Date().toISOString() })
      .eq("id", user.id);
    router.push("/onboarding/complete");
    router.refresh();
  }

  async function skipStep() {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("users")
      .update({ onboarding_step: "complete", updated_at: new Date().toISOString() })
      .eq("id", user.id);
    router.push("/onboarding/complete");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GoogleIcon className="h-5 w-5" />
          Connect Google Calendar
        </CardTitle>
        <CardDescription>
          We&apos;ll detect focused work blocks and help protect your peak hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected ? (
          <div className="flex items-center justify-between rounded-md border bg-success/10 p-4">
            <div>
              <p className="font-medium">Connected as {email}</p>
              <p className="text-sm text-muted-foreground">
                Your calendar events will sync in the background.
              </p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        ) : (
          <>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• We read your event titles and times only</li>
              <li>• We never write to or modify your calendar</li>
              <li>• You can disconnect at any time from Settings</li>
            </ul>
            <Button onClick={connect} disabled={isPending} className="w-full">
              <GoogleIcon className="h-4 w-4" />
              {isPending ? "Connecting..." : "Connect Google Calendar"}
            </Button>
          </>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={skipStep}>
            Skip for now
          </Button>
          {isConnected ? (
            <Button onClick={continueOnboarding}>Continue</Button>
          ) : (
            <Button variant="outline" onClick={continueOnboarding}>
              Continue without Calendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
