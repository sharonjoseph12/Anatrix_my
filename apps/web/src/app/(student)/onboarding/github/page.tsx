import type { Metadata } from "next";
import { GitHubConnectPanel } from "./github-connect";

export const metadata: Metadata = {
  title: "Connect GitHub",
};

export default function GitHubPage() {
  return <GitHubConnectPanel />;
}
