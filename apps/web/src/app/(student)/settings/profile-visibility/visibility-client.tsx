"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Briefcase, Link2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLUG_HINT } from "@/lib/validation/slug";

export interface ProfileVisibilityClientProps {
  initialIsPublic: boolean;
  initialOpenToOpportunities: boolean;
  initialSlug: string | null;
}

export function ProfileVisibilityClient({
  initialIsPublic,
  initialOpenToOpportunities,
  initialSlug,
}: ProfileVisibilityClientProps) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [openToOpps, setOpenToOpps] = useState(initialOpenToOpportunities);
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(
    "idle",
  );
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!slug || slug === initialSlug) {
      setSlugStatus("idle");
      return;
    }
    if (slug.length < 3) {
      setSlugStatus("invalid");
      return;
    }
    setSlugStatus("checking");
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public-profile/${encodeURIComponent(slug)}`);
        if (res.status === 404) setSlugStatus("available");
        else if (res.status === 200) setSlugStatus("taken");
        else setSlugStatus("invalid");
      } catch {
        setSlugStatus("invalid");
      }
    }, 350);
    return () => clearTimeout(id);
  }, [slug, initialSlug]);

  const save = async (next: { is_public: boolean; is_open_to_opportunities: boolean; slug?: string }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to save");
        return;
      }
      toast.success("Profile visibility updated");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  };

  const claimSlug = async () => {
    if (slugStatus === "taken" || slugStatus === "invalid" || slugStatus === "checking") return;
    if (slug === initialSlug) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 409) setSlugStatus("taken");
        toast.error(body.error ?? "Failed to claim handle");
        return;
      }
      toast.success("Handle claimed — your old handle will redirect here for 90 days");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = initialSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/${initialSlug}` : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Your public handle
          </CardTitle>
          <CardDescription>
            Pick a unique handle to share a public profile at <code>antarix.app/&lt;slug&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="slug">Public handle</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="sharon-dave"
                  className="pr-9"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {slugStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {slugStatus === "available" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {slugStatus === "taken" && <XCircle className="h-4 w-4 text-rose-500" />}
                  {slugStatus === "invalid" && <XCircle className="h-4 w-4 text-amber-500" />}
                </div>
              </div>
              <Button onClick={claimSlug} disabled={saving || slugStatus !== "available" && slug !== initialSlug}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{SLUG_HINT}</p>
            {slugStatus === "taken" && (
              <p className="text-xs text-rose-500">This handle is already taken — try another.</p>
            )}
            {slugStatus === "invalid" && slug.length > 0 && (
              <p className="text-xs text-amber-500">That handle isn&apos;t valid — see the rules above.</p>
            )}
          </div>

          {publicUrl ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Live at</p>
                <p className="font-mono">{publicUrl}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          ) : null}

          {initialSlug ? (
            <Badge variant="outline" className="text-[10px]">
              Old handles redirect here for 90 days
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      <Toggle
        icon={<Eye className="h-4 w-4" />}
        title="Public profile"
        description="Recruiters and colleges can view your verified profile via search."
        checked={isPublic}
        onChange={(v) => {
          setIsPublic(v);
          void save({ is_public: v, is_open_to_opportunities: openToOpps, slug: slug || undefined });
        }}
        disabled={saving}
      />
      <Toggle
        icon={<Briefcase className="h-4 w-4" />}
        title="Open to opportunities"
        description="Recruiters can reach out about matched roles and auto-suggested interviews."
        checked={openToOpps}
        onChange={(v) => {
          setOpenToOpps(v);
          void save({ is_public: isPublic, is_open_to_opportunities: v, slug: slug || undefined });
        }}
        disabled={saving}
      />
    </div>
  );
}

function Toggle({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            type="button"
            variant={checked ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
            className={cn("min-w-[88px]")}
          >
            {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : checked ? "Enabled" : "Disabled"}
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
