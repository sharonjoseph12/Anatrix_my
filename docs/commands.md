# docs/commands.md
# The AI Coach command set. WhatsApp and web inbox use the same verbs; the
# web inbox has a reply box at the bottom of `apps/web/(student)/ai-coach/`.

| Command | Channel | Effect | Reply |
| --- | --- | --- | --- |
| `START` | WhatsApp / Web | Opens an ad-hoc session (sets `sessions.started_at = now()`, `is_ad_hoc = true`, `source = 'whatsapp_command'`). | "Session started. Reply DONE when you're done." |
| `DONE` | WhatsApp / Web | Closes the most recent open session (`ended_at = now()`). | "Session closed. Focus quality X / 5." |
| `STATS` | WhatsApp / Web | Reads the current streak + score. | "Score 76, streak 4 days, 27 sessions this week." |
| `RANK` | WhatsApp / Web | Reads cohort rank (uses the leaderboard helper). | "You're rank 12 of 84 in your cohort." |
| `HELP` | WhatsApp / Web | Returns the command list. | The same table, formatted for chat. |
| `PAUSE` | WhatsApp / Web | Sets `nudge_preferences.pause_all = true`. | "All nudges paused. Reply RESUME to bring them back." |
| `RESUME` | WhatsApp / Web | Sets `nudge_preferences.pause_all = false`. | "Nudges resumed." |
| `JOIN <cohort_id>` | WhatsApp / Web | Opts into a study cohort. | "Joined cohort X." |
| `LEAVE <cohort_id>` | WhatsApp / Web | Leaves a study cohort. | "Left cohort X." |
| `WHY` | WhatsApp / Web | Explains the most recent nudge (the reason it was sent). | "Sent because you have a free window 10–12 local and your score is dropping." |

## Implementation
- Inbound handler: `supabase/functions/whatsapp-webhook/index.ts`
- Web inbox reply box: `apps/web/src/app/(student)/ai-coach/page.tsx`
- State mutations: `applyCommand(supabase, userId, cmd, raw)` in the webhook.
- Replies that need formatting (`STATS`, `RANK`, `HELP`, `WHY`) are enqueued as a `reply_*` nudge and dispatched by the same pipeline.

## Error responses
- Unknown command → "Unknown. Reply HELP for the list."
- Disabled channel (e.g., `whatsapp_channel = false` and a WhatsApp command arrives) → "This channel is off. Enable it in settings."
- Recruiter-only commands (`JOIN <cohort_id>`) when not a student → "Sorry, students only."

## Privacy
- All commands write a `nudge_responses` row with the channel, command, and payload (so we can audit what users asked for).
- We never store the message text beyond the payload field; long messages are truncated to 2000 chars at insert time.
