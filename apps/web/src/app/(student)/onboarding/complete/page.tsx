import type { Metadata } from "next";
import { OnboardingCompletePanel } from "./complete-panel";

export const metadata: Metadata = {
  title: "Welcome to Antarix",
};

export default function CompletePage() {
  return <OnboardingCompletePanel />;
}
