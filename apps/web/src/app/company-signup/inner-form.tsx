"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COMPANY_TIERS = [
  { value: "startup", label: "Startup" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
] as const;

export function CompanySignupForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/company/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [tier, setTier] = useState<(typeof COMPANY_TIERS)[number]["value"]>("startup");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (companyName.trim().length < 2) {
      setError("Company name is required");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split("@")[0],
            role: "recruiter",
            user_type: "professional",
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!signUpData.user) {
        setError("Signup failed");
        return;
      }

      const { data: companyId, error: rpcErr } = await supabase.rpc("register_company_account", {
        p_user_id: signUpData.user.id,
        p_name: companyName,
        p_industry: industry || null,
        p_city: city || null,
        p_tier: tier,
      });

      if (rpcErr || !companyId) {
        setError(`Could not create company: ${rpcErr?.message || "Unknown error"}`);
        return;
      }

      setInfo("Check your email to confirm your account.");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your company account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For recruiters, talent teams, and hiring managers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="display_name">Your name</Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex Chen"
            autoComplete="name"
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input
            id="company_name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            required
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Fintech, Healthcare, …"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bangalore"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tier">Subscription tier</Label>
          <Select value={tier} onValueChange={(v: string) => setTier(v as typeof tier)} disabled={isPending}>
            <SelectTrigger id="tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TIERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={isPending}
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {info}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Creating account..." : "Create company account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
