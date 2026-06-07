import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Search, BarChart3, Settings, Briefcase } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SidebarLink } from "@/components/dashboard/sidebar-link";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/company/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/company/search", label: "Search", icon: Search },
  { href: "/company/pipeline", label: "Pipeline", icon: Briefcase },
  { href: "/company/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/company/settings", label: "Settings", icon: Settings },
] as const;

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/company/dashboard");

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id,companies:public.companies(name,subscription_tier)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-bold">No company linked</h1>
          <p className="text-muted-foreground">
            Your account isn&apos;t linked to a recruiter or admin role.
            Sign up via the company form to create one.
          </p>
          <Button asChild>
            <Link href="/company-signup">Create company</Link>
          </Button>
        </div>
      </div>
    );
  }

  const company = (membership as unknown as { companies: { name: string; subscription_tier: string } | null }).companies;
  const companyName = company?.name ?? "Your company";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-muted/20 md:block">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/company/dashboard" className="text-lg font-bold">
            Antarix
          </Link>
        </div>
        <div className="border-b px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Briefcase className="h-4 w-4" />
            {companyName}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">
            {company?.subscription_tier ?? "starter"} plan
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-8">
          <Link href="/company/dashboard" className="text-lg font-bold md:hidden">
            Antarix
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <UserMenu
              name={user.email ?? "Recruiter"}
              email={user.email ?? ""}
              avatarUrl={null}
            />
          </div>
        </header>
        <main className={cn("flex-1 px-4 py-6 md:px-8 md:py-8")}>{children}</main>
      </div>
    </div>
  );
}
