import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice — Antarix",
  description: "Practice mock interviews with AI to sharpen your technical skills.",
};

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
