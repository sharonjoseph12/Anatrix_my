"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { CompanySignupForm } from "./inner-form";

export function CompanySignupPageClient() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden bg-muted/30 p-10 md:flex md:flex-col md:justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <Briefcase className="h-5 w-5" />
          Antarix for Companies
        </Link>
        <div>
          <h2 className="text-2xl font-bold leading-tight">
            Hire students with verified skills, not résumés.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Search the candidate pool by specialization, score, location and
            focus quality. Schedule interviews directly from the dashboard.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© Antarix</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <CompanySignupForm />
        </div>
      </div>
    </div>
  );
}
