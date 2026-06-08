import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationHost } from "@/components/notifications/notification-host";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://antarix.app"),
  title: {
    default: "Antarix — Verified Skill Proof Ecosystem",
    template: "%s | Antarix",
  },
  description:
    "Track. Prove. Hire. The verified skill proof ecosystem connecting students, colleges, and companies.",
  keywords: ["skill proof", "verified skills", "student tracking", "placement", "recruiting"],
  authors: [{ name: "Antarix" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://antarix.app",
    siteName: "Antarix",
    title: "Antarix — Verified Skill Proof Ecosystem",
    description: "Track. Prove. Hire.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Antarix — Verified Skill Proof Ecosystem",
    description: "Track. Prove. Hire.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <NotificationHost />
        </ThemeProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
