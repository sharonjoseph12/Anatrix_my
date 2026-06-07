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

const INSTITUTION_TYPES = [
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "corporate_training", label: "Corporate Training" },
] as const;

export function CollegeSignupForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/college/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [type, setType] = useState<(typeof INSTITUTION_TYPES)[number]["value"]>("college");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("India");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (institutionName.trim().length < 2) {
      setError("Institution name is required");
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
            role: "placement_officer",
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

      const { data: inst, error: instErr } = await supabase
        .from("institutions")
        .insert({
          name: institutionName,
          type,
          city: city || null,
          country,
        })
        .select("id")
        .single();

      if (instErr) {
        setError(`Could not create institution: ${instErr.message}`);
        return;
      }

      const { error: memErr } = await supabase.from("institution_members").insert({
        institution_id: inst!.id,
        user_id: signUpData.user.id,
        role: "placement_officer",
      });

      if (memErr) {
        toast.warning("Institution created, but membership link failed. Contact support.");
      }

      setInfo("Check your email to confirm your account.");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your institution account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For placement officers and training program admins.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="display_name">Your name</Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inst_name">Institution name</Label>
          <Input
            id="inst_name"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="ABC Institute of Technology"
            required
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v: string) => setType(v as typeof type)} disabled={isPending}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTITUTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Mumbai"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={isPending}
            required
          />
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
          {isPending ? "Creating account..." : "Create institution account"}
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
