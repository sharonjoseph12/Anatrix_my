// supabase/functions/_shared/template-render.ts
// T021 — Handlebars helper used by every nudge type
// Renders a parameterized message body from a template + context object

import Handlebars from "npm:handlebars@4.7.8";

export type NudgeContext = {
  student: { display_name: string; timezone: string };
  stats: {
    yesterday_commits: number;
    yesterday_hours: number;
    streak_days: number;
    current_score: number;
    placement_prediction_pct: number;
  };
  calendar: {
    first_free_window_start_local: string | null;
    first_free_window_end_local: string | null;
    first_free_window_minutes: number;
    busy_today: boolean;
  };
  project?: { name: string; completion_pct: number };
  top_skill?: { name: string; proficiency_pct: number };
  weekly?: { sessions: number; hours: number; commits: number; focus_high_pct: number };
  ranking?: { position: number; cohort_size: number; delta: number };
};

export function renderTemplate(type: string, context: NudgeContext): { templateId: string; body: string } {
  const templateStr = NUDGE_TEMPLATES[type] ?? "";
  const compiled = Handlebars.compile(templateStr, { noEscape: true });
  return { templateId: type.toUpperCase(), body: compiled(context) };
}

export const NUDGE_TEMPLATES: Record<string, string> = {
  daily_morning: `🌅 Good morning {{student.display_name}}!

📊 Yesterday: {{stats.yesterday_hours}} hours coding, {{stats.yesterday_commits}} commits
🔥 Streak: {{stats.streak_days}} days

Today's plan:
{{#if calendar.first_free_window_start_local}}
1. You have free time {{calendar.first_free_window_start_local}}–{{calendar.first_free_window_end_local}} ({{calendar.first_free_window_minutes}} min)
{{/if}}
{{#if project}}
2. Your {{project.name}} project is {{project.completion_pct}}% complete — {{#if project.completion_pct}}keep going{{else}}let's start{{/if}}
{{/if}}

🎯 Current Skill Proof Score: {{stats.current_score}}/100
💡 Reply START to begin a session, STATS for full details, or PAUSE to stop nudges.`,

  real_time_peak: `⚡ {{student.display_name}}, your peak window is now!

{{#if project}}Your {{project.name}} project is {{project.completion_pct}}% complete. A focused session could push it across the line.{{else}}Time to start a focused work block.{{/if}}

Reply START or open Antarix to begin.`,

  streak_risk: `⚠️ {{student.display_name}}, your streak is at risk.

{{stats.streak_days}}-day streak, no commits in 48 hours.
{{#if project}}Your {{project.name}} is at {{project.completion_pct}}% — small wins keep momentum.{{/if}}

Quick wins to get back on track:
1. Solve 1 LeetCode (30 min)
2. Push your local changes

Your placement prediction: {{stats.placement_prediction_pct}}%.`,

  weekly_summary: `📈 Weekly Summary for {{student.display_name}}

Sessions: {{weekly.sessions}} | Hours: {{weekly.hours}} | Commits: {{weekly.commits}}
Focus Quality: {{weekly.focus_high_pct}}% HIGH | Streak: {{stats.streak_days}} days

{{#if ranking}}🏆 Cohort rank: #{{ranking.position}} of {{ranking.cohort_size}} ({{ranking.delta}} vs last week){{/if}}

📋 Skill Proof Score: {{stats.current_score}}/100
🎯 Placement prediction: {{stats.placement_prediction_pct}}% Tier-1
{{#if top_skill}}⭐ Top skill: {{top_skill.name}} ({{top_skill.proficiency_pct}}%){{/if}}`,
};
