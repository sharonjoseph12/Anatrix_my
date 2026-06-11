import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Users, Briefcase, Settings, LogOut, Building2, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SidebarLink } from "@/components/dashboard/sidebar-link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/dashboard/user-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/college/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/college/students", label: "Students", icon: Users },
  { href: "/college/students/import", label: "Import", icon: Upload },
  { href: "/college/companies", label: "Companies", icon: Briefcase },
  { href: "/college/settings", label: "Settings", icon: Settings },
] as const;

export default async function CollegeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/college/dashboard");

  // The user must be a placement_officer/admin of some institution
  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id,institutions:public.institutions(name,type)")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-bold">No institution linked</h1>
          <p className="text-muted-foreground">
            Your account isn&apos;t linked to a placement officer or admin role.
            Sign up via the college form to create an institution.
          </p>
          <Button asChild>
            <Link href="/college-signup">Create institution</Link>
          </Button>
        </div>
      </div>
    );
  }

  const inst = (membership as unknown as { institutions: { name: string; type: string } | null })
    .institutions;
  const instName = inst?.name ?? "Your institution";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-muted/20 md:block">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/college/dashboard" className="text-lg font-bold">
            Antarix
          </Link>
        </div>
        <div className="border-b px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4" />
            {instName}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">
            {inst?.type ?? "Institution"}
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
          <Link href="/college/dashboard" className="text-lg font-bold md:hidden">
            Antarix
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <UserMenu
              name={user.email ?? "Officer"}
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
