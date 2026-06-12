"use client";

import { LayoutDashboard, Lightbulb, Users, Settings, BarChart3, History, Github, Award, BrainCircuit } from "lucide-react";
import { SidebarLink } from "@/components/dashboard/sidebar-link";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sessions", label: "Sessions", icon: History },
  { href: "/dashboard/skills", label: "Skills", icon: Award },
  { href: "/dashboard/github", label: "GitHub", icon: Github },
  { href: "/dashboard/insights", label: "Insights", icon: Lightbulb },
  { href: "/dashboard/peak-self", label: "Peak Self", icon: BarChart3 },
  { href: "/dashboard/cohorts", label: "Cohorts", icon: Users },
  { href: "/talent-twin", label: "Talent Twin", icon: BrainCircuit },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function SidebarNav() {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
      ))}
    </nav>
  );
}
