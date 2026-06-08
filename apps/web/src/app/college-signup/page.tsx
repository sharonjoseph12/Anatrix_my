import { Suspense } from "react";
import type { Metadata } from "next";
import { CollegeSignupPageClient } from "./form";

export const metadata: Metadata = {
  title: "Create a college portal",
  description:
    "Spin up an Antarix placement portal for your institution. Bulk-import students, track placement readiness, and run cohort analytics.",
  openGraph: {
    title: "Antarix for colleges",
    description: "Verified placement readiness for your institution.",
    type: "website",
  },
};

export default function CollegeSignupPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading…</div>}>
      <CollegeSignupPageClient />
    </Suspense>
  );
}
