import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Lightbulb, Users, Settings, BarChart3, History, Github, Award } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/dashboard/user-menu";
import { SidebarLink } from "@/components/dashboard/sidebar-link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sessions", label: "Sessions", icon: History },
  { href: "/dashboard/skills", label: "Skills", icon: Award },
  { href: "/dashboard/github", label: "GitHub", icon: Github },
  { href: "/dashboard/insights", label: "Insights", icon: Lightbulb },
  { href: "/dashboard/peak-self", label: "Peak Self", icon: BarChart3 },
  { href: "/dashboard/cohorts", label: "Cohorts", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("users")
    .select("id,display_name,email,avatar_url,onboarding_completed_at")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_completed_at) {
    redirect("/onboarding/profile");
  }

  const name = profile?.display_name ?? user.email ?? "User";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-muted/20 md:block">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="text-lg font-bold">
            Antarix
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
        <div className="absolute bottom-4 left-3 right-3 hidden md:block">
          <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Insights unlock in 7 days</p>
            <p className="mt-1">Track sessions daily to build your verified profile.</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-8">
          <Link href="/dashboard" className="text-lg font-bold md:hidden">
            Antarix
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <UserMenu
              name={name}
              email={user.email ?? ""}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
        </header>
        <main className={cn("flex-1 px-4 py-6 md:px-8 md:py-8")}>{children}</main>
      </div>
    </div>
  );
}
