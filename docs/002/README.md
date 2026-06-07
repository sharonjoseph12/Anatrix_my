# 11/10 Vision — quick reference

This is a tour of the 002 layer that sits on top of the 001 base.

## Start here
- [Architecture overview](./architecture.md) — diagram + how the moving parts fit
- [Commands](./commands.md) — the AI Coach command set
- [WhatsApp setup](./whatsapp-setup.md) — T011 mitigation guide
- [Credential system](./credential-system.md) — snapshot, refresh, revocation

## Implementation map
- 002 migrations: `supabase/migrations/015-026`
- 002 edge functions: `supabase/functions/{whatsapp-*, nudge-*, exam-week-detector, extension-heartbeat, credential-*, recruiter-*, college-*, placement-predict, interview-schedule, one-click-apply, sources-disconnect, privacy-request-deletion, github-sync-fast}`
- 002 shared helpers: `supabase/functions/_shared/`
- 002 portal pages: `apps/web/src/app/(student)/{ai-coach, applications, credential, settings/{notifications, privacy, sources}, dashboard/{_components, action-plan, sessions}}`, `apps/web/src/app/(company)/{search, pipeline, analytics}`, `apps/web/src/app/verify/[slug]`
- 002 extension piece: `apps/extension/src/background/heartbeat.ts`
- 002 spec/plan/tasks: `specs/002-antarix-definitive-vision/`

## Scripts
- `scripts/apply-002-migrations.sh` — apply only 002 migrations on top of the 001 base

## What's external
- **T011** — Meta WhatsApp Business templates (4 templates)
- **VAPID keys** — for web-push
- **Chrome Web Store** — Power Mode extension
- **College and company portal signups** — for US6 and US7 live data
