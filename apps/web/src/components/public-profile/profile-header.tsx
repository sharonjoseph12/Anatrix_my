import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "./verified-badge";
import { initials } from "@antarix/utils";

export function ProfileHeader({
  displayName,
  avatarUrl,
  overallScore,
  specialization,
  tier,
  verified,
}: {
  displayName: string;
  avatarUrl: string | null;
  overallScore: number;
  specialization: string | null;
  tier: string;
  verified: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
      <Avatar className="h-20 w-20 ring-2 ring-primary/20">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback className="text-xl">{initials(displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          {verified ? <VerifiedBadge /> : null}
        </div>
        {specialization ? (
          <p className="text-sm text-muted-foreground">
            {specialization} · <span className="capitalize">{tier}</span>
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-3 text-sm sm:justify-start">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
            {overallScore} / 100
          </span>
          <span className="text-muted-foreground">verified Skill Proof Score</span>
        </div>
      </div>
    </div>
  );
}
