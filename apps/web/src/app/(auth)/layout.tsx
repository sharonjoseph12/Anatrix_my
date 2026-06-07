import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Antarix account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="text-3xl font-bold tracking-tight">
            Antarix
          </Link>
          <p className="text-sm text-muted-foreground">
            Verified skill proof for the next generation
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to Antarix&apos;s{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
