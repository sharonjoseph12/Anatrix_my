import { Suspense } from "react";
import type { Metadata } from "next";
import { CompanySignupPageClient } from "./form";

export const metadata: Metadata = {
  title: "Start hiring verified candidates",
  description:
    "Create your Antarix recruiter account. Search verified candidates, schedule inside their peak windows, and measure pipeline funnel conversion.",
  openGraph: {
    title: "Antarix for recruiters",
    description: "Hire verified skill proof, not self-reported résumés.",
    type: "website",
  },
};

export default function CompanySignupPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading…</div>}>
      <CompanySignupPageClient />
    </Suspense>
  );
}
