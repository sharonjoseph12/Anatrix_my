import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify a credential",
  description:
    "Look up a verified Antarix Skill Proof credential by its public slug. No login required.",
  openGraph: {
    title: "Verify an Antarix credential",
    description: "Public verification page for verified skill proof credentials.",
    type: "profile",
  },
  robots: { index: true, follow: true },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
