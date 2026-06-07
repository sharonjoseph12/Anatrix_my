import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Users, Briefcase, Building2, BarChart3, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Antarix — Verified Skill Proof Ecosystem",
  description:
    "Track. Prove. Hire. Students build verified skill proof scores, colleges surface placement readiness, and recruiters hire with confidence.",
  openGraph: {
    title: "Antarix — Verified Skill Proof Ecosystem",
    description: "Track. Prove. Hire.",
    type: "website",
  },
};

const PRICING_TIERS = [
  {
    name: "Student",
    price: "Free",
    description: "Track sessions, prove skills, get discovered.",
    cta: { label: "Sign up free", href: "/signup" },
    features: [
      "Chrome extension session tracking",
      "GitHub + Google Calendar sync",
      "Verified Skill Proof Score",
      "Public credential at /verify/[slug]",
      "Cohort comparison",
    ],
  },
  {
    name: "College",
    price: "₹4",
    suffix: "/ student / mo",
    description: "Placement dashboards, curriculum intelligence, and bulk import.",
    cta: { label: "Start college trial", href: "/college-signup" },
    features: [
      "Readiness segmentation",
      "Leaderboards & alumni view",
      "CSV student import",
      "Auto-match with hiring partners",
      "Privacy-preserving aggregates",
    ],
    featured: true,
  },
  {
    name: "Recruiter",
    price: "$99",
    suffix: "/ seat / mo",
    description: "Search verified candidates and schedule interviews in one place.",
    cta: { label: "Start hiring", href: "/company-signup" },
    features: [
      "Skill-Proof ranked search",
      "Peak-window scheduling",
      "Pipeline kanban + status flow",
      "Funnel + retention analytics",
      "Public-credential deep links",
    ],
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Power Mode tracking",
    body: "Chrome extension logs focus quality per minute. Sessions land on the dashboard without manual entry.",
  },
  {
    icon: Sparkles,
    title: "Skill Proof Score",
    body: "Hours, projects, quality, and consistency combine into one weighted score recruiters can trust.",
  },
  {
    icon: BarChart3,
    title: "Weekly insights",
    body: "Cron-generated briefs surface peak windows, focus drift, and recommended next experiments.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by default",
    body: "Profile visibility is opt-in. Colleges see aggregates unless students publish their profile.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            Antarix
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#portals" className="text-muted-foreground hover:text-foreground">For you</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" /> Verified skill proof, end to end
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Track. Prove. Hire.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              The verified skill proof ecosystem connecting students, colleges, and companies.
              Replace self-reported resumes with signals captured in real time.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  I&apos;m a student
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/company-signup">I&apos;m a recruiter</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/college-signup">I&apos;m a college</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { k: "33", l: "Skills indexed" },
              { k: "4", l: "Cron jobs" },
              { k: "3", l: "Portals unified" },
              { k: "24/7", l: "Live telemetry" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border bg-card p-4 text-center">
                <p className="text-2xl font-semibold">{s.k}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-16">
            <h2 className="text-3xl font-bold tracking-tight">Built for the full proof chain</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Every signal is collected passively, scored deterministically, and made useful to the
              right audience — students first, then their college, then recruiters.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <CardHeader>
                    <f.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="portals" className="container mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Three portals, one source of truth</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Each audience gets the slice they need — without leaking the rest.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PortalCard
              icon={Users}
              title="Students"
              body="Build a verifiable record of focused work. Get discovered by colleges and recruiters without résumé theatre."
              href="/signup"
              cta="Get started"
            />
            <PortalCard
              icon={Building2}
              title="Colleges"
              body="See cohort readiness, track curriculum efficacy, and run a placement office without spreadsheets."
              href="/college-signup"
              cta="Create institution"
            />
            <PortalCard
              icon={Briefcase}
              title="Recruiters"
              body="Search verified candidates by skill proof, schedule inside their peak windows, and measure funnel conversion."
              href="/company-signup"
              cta="Start hiring"
            />
          </div>
        </section>

        <section id="pricing" className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-16">
            <h2 className="text-3xl font-bold tracking-tight">Simple, per-portal pricing</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              No per-seat creep. Students are always free.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <Card
                  key={tier.name}
                  className={
                    tier.featured
                      ? "border-primary shadow-md"
                      : ""
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{tier.name}</CardTitle>
                      {tier.featured && <Badge>Most adopted</Badge>}
                    </div>
                    <CardDescription>{tier.description}</CardDescription>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">{tier.price}</span>
                      {tier.suffix && (
                        <span className="ml-1 text-sm text-muted-foreground">{tier.suffix}</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="w-full" variant={tier.featured ? "default" : "outline"}>
                      <Link href={tier.cta.href}>{tier.cta.label}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground md:flex-row">
          <p>© Antarix. Verified skill proof for the next billion learners.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}

function PortalCard({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full" variant="outline">
          <Link href={href}>{cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
