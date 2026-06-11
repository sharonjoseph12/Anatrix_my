"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitHubIcon } from "@/components/icons/social";

export function GitHubConnectPanel() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("github_accounts")
        .select("username,status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.status === "active") {
        setIsConnected(true);
        setUsername(data.username);
      }
    })();
  }, []);

  function connect() {
    const supabase = createSupabaseBrowserClient();
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/onboarding/github?connected=1`,
          scopes: "read:user user:email repo",
        },
      });
      if (error) console.error(error);
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
      .update({ onboarding_step: "calendar", updated_at: new Date().toISOString() })
      .eq("id", user.id);
    router.push("/onboarding/calendar");
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
      .update({ onboarding_step: "calendar", updated_at: new Date().toISOString() })
      .eq("id", user.id);
    router.push("/onboarding/calendar");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitHubIcon className="h-5 w-5" />
          Connect GitHub
        </CardTitle>
        <CardDescription>
          We&apos;ll analyze your commits to detect skills and build your verified profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected ? (
          <div className="flex items-center justify-between rounded-md border bg-success/10 p-4">
            <div>
              <p className="font-medium">Connected as @{username}</p>
              <p className="text-sm text-muted-foreground">
                Your commit history will sync in the background.
              </p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        ) : (
          <>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• We detect skills from your commit languages and repos</li>
              <li>• Your activity appears on your profile and skills page</li>
              <li>• You can disconnect at any time from Settings</li>
            </ul>
            <Button onClick={connect} disabled={isPending} className="w-full">
              <GitHubIcon className="h-4 w-4" />
              {isPending ? "Connecting..." : "Connect with GitHub"}
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
            <Link href="/onboarding/calendar">
              <Button variant="outline">Continue without GitHub</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
