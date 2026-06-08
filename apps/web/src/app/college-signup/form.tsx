"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { CollegeSignupForm } from "./inner-form";

export function CollegeSignupPageClient() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden bg-muted/30 p-10 md:flex md:flex-col md:justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <GraduationCap className="h-5 w-5" />
          Antarix for Colleges
        </Link>
        <div>
          <h2 className="text-2xl font-bold leading-tight">
            Placement readiness, verified.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Import students via CSV, see verified skill scores by department,
            and auto-match your placement-ready cohort with hiring companies.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© Antarix</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <CollegeSignupForm />
        </div>
      </div>
    </div>
  );
}
