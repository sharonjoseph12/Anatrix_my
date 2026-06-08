# Cross-Feature Rollout Gantt — Antarix 11/10 → 12/10

**Date**: 2026-06-07
**Status**: Draft (post-renumbering, post-cross-artifact analysis)
**Active features**: 003 (shipped), 004 (in progress), 005-009 (specs ratified, awaiting implementation)

---

## Migration Number Ledger (final, post-M1 fix)

| Slot | Owner | Status |
|---|---|---|
| 001-033 | 001-002-003 (shipped) | LOCKED |
| 034 | 004 anti-cheat + i18n | SPECIFIED |
| 035 | 004 ATS + SSO + faculty | SPECIFIED |
| 036 | 004 hackathon + mock-interview | SPECIFIED |
| 037 | 004 public API + outcome + NBS | SPECIFIED |
| 038 | 004 cron consolidation | SPECIFIED |
| 039 | w3c_vc_real_eddsa (existing) | LOCKED |
| 040 | institutions_slug + status_page (existing) | LOCKED |
| 041 | webhooks (existing) | LOCKED |
| 042 | verify_api_key (existing) | LOCKED |
| **043** | **006 deep-signal-capture (main)** | **RESERVED** |
| **044** | **006 deep-signal-capture (cron)** | **RESERVED** |
| **045** | **007 adaptive-learning-graph (main)** | **RESERVED** |
| **046** | **007 adaptive-learning-graph (cron)** | **RESERVED** |
| **047** | **008 collaborative-mode (main)** | **RESERVED** |
| **048** | **008 collaborative-mode (cron)** | **RESERVED** |
| **049** | **009 onchain-mirror (main)** | **RESERVED** |
| **050** | **009 onchain-mirror (cron)** | **RESERVED** |
| **051** | **005 mobile + auto-apply + leaderboard (main)** | **RESERVED** |
| **052** | **005 mobile + auto-apply + leaderboard (cron)** | **RESERVED** |
| 053+ | Future (006-extension, 010+, 011+) | FREE |

---

## Agent Allocation (6-agent parallel, no file conflicts)

| Agent | Feature | Branch | Status | Migration slots | Score-budget contribution |
|---|---|---|---|---|---|
| A1 | 004 (full) | `004-eleven-of-ten` | In progress | 034-038 | +10% faculty, +5% mock-interview |
| A2 | 005 | `005-mobile-autoapply-leaderboard` | Spec complete, awaiting Agent 2 | 051, 052 | 0 (no score change) |
| A3 | 006 | `006-deep-signal-capture` | Spec complete, awaiting Agent 3 | 043, 044 | +3% IDE, +2% biometrics |
| A4 | 007 | `007-adaptive-learning-graph` | Spec complete, awaiting Agent 4 | 045, 046 | 0 (engagement, not score) |
| A5 | 008 | `008-collaborative-mode` | Spec complete, awaiting Agent 5 | 047, 048 | +5% teamwork |
| A6 | 009 | `009-onchain-mirror` | Spec complete, awaiting Agent 6 | 049, 050 | 0 (mirror, not signal) |

**Score budget** (all new signals combined): 25% upside additions, 0% downside. Defensive (anti-cheat) remains -100% uncapped.

---

## Dependency Graph (cross-feature)

```
001 (foundation)
   ↓
002 (verified skill platform) ← contains pgvector, W3C VC infra, calendar_events
   ↓
003 (engage & showcase) ← contains nudges, streaks, public profile, web-push
   ↓
004 (P1 trust + reach + recruiter) ──→ 004 public API ──→ 005 auto-apply
   ↓
   ├──→ 005 mobile + auto-apply + leaderboard
   │       ↑ consumes 003 web-push (fallback), 004 PWA SW, 004 LLM client
   │       ↑ depends on 006 biometric mobile (006b), 007 mentor list, 008 collab
   │       ↑ leaderboard MV uses 003 streaks, 004 mock-int, 006/008 scores
   │
   ├──→ 006 deep-signal-capture
   │       ↑ consumes 002 peak-window detector
   │       ↑ biometric half depends on 005 mobile (HealthKit/Google Fit bridge)
   │       ↑ score: 3% IDE + 2% biometrics
   │
   ├──→ 007 adaptive-learning-graph
   │       ↑ consumes 002 calendar_events, 003 nudge dispatcher, 004 NBS + LLM
   │       ↑ depends on 008 VideoRoomProvider for mentor video (or Google Meet fallback)
   │       ↑ no score impact (engagement surface)
   │
   ├──→ 008 collaborative-mode
   │       ↑ consumes 004 anti-cheat signals (anti-collusion)
   │       ↑ provides VideoRoomProvider to 007
   │       ↑ score: 5% teamwork
   │
   └──→ 009 onchain-mirror
           ↑ consumes 002 W3C VC infra (mirror source + revocation pointer)
           ↑ consumes 004 feature_flags + audit patterns
           ↑ no score impact (mirror, not signal)
```

---

## Sprint Plan (12 weeks, 6 agents)

### Sprint 1 (Weeks 1-2) — Foundation
**A1 (004)**: Phases 0-2 (env, migration 034-037, types) → Phase 3 anti-cheat → Phase 4 i18n
**A2 (005)**: Phases 0-2 (env, migration 051-052, types)
**A3 (006)**: Phases 0-2 (env, migration 043, types) + Phase 3 VS Code extension
**A4 (007)**: Phases 0-2 (env, migration 045, types) + Phase 3 embedding job
**A5 (008)**: Phases 0-2 (env, migration 047, types) + Phase 3 Liveblocks setup
**A6 (009)**: Phases 0-2 (env, migration 049, types)

**Day-0 GA gates enabled**: 004_anticheat, 004_i18n_*, 005_global_leaderboard (after Phase 6 ships)

### Sprint 2 (Weeks 3-4) — Core surfaces
**A1 (004)**: Phase 5 ATS sync
**A2 (005)**: Phase 3 mobile app (Expo scaffold + tabs) + Phase 6 leaderboard
**A3 (006)**: Phase 4 Cursor extension + Phase 5 biometrics (server-side OAuth, no mobile bridge yet)
**A4 (007)**: Phase 4 mentor match + Phase 5 curriculum generator
**A5 (008)**: Phase 4 LiveKit + Phase 5 code sandbox
**A6 (009)**: Phase 3 EAS SDK setup + Phase 4 attestation edge function

**Day-14 cohort rollout**: 004_sso_workos, 004_faculty_grading, 004_next_best_skill, 005_mobile_app, 006_ide_extension_vscode

### Sprint 3 (Weeks 5-6) — Convergence
**A1 (004)**: Phase 6 SSO + faculty, Phase 7 hackathon, Phase 8 mock interview
**A2 (005)**: Phase 4 cover letter + Phase 5 auto-apply headless + Phase 7 e-sports UI
**A3 (006)**: Phase 6 privacy center UI + Phase 7 audit (006_biometrics_mobile stays OFF until 005 mobile GA)
**A4 (007)**: Phase 6 UI + Phase 7 video room integration + Phase 8 feedback loop
**A5 (008)**: Phase 6 UI shell + Phase 7 anti-collusion + Phase 8 teamwork scorer
**A6 (009)**: Phase 5 mirror queue cron + Phase 6 verification UI + Phase 7 kill-switch

**Day-21 cohort rollout**: 004_hackathons, 004_mock_interviews, 005_auto_apply_cover_letter, 007_alumni_mentorship, 008_collab

### Sprint 4 (Weeks 7-8) — Polish + public surfaces
**A1 (004)**: Phase 9 public API, Phase 10 PWA, Phase 11 outcome pricing, Phase 12 NBS
**A2 (005)**: Auto-apply headless GA + TestFlight/Play Internal submission
**A3 (006)**: 006_biometrics_mobile flag flips ON (now that 005 mobile is GA)
**A4 (007)**: Curriculum-mentor closed loop (US3)
**A5 (008)**: Recruiter observe mode (US4)
**A6 (009)**: 009_onchain_mirror_enabled flag (default OFF; opt-in only)

**Day-30 cohort rollout**: 004_public_api (invited-only), 004_pwa, 004_outcome_pricing, 005_auto_apply_headless, 005_esports_ui, 006_biometrics_*, 007_curriculum_daily, 008_teamwork_score, 009_onchain_mirror

---

## Feature Flag Enable Order (gating matrix)

A flag MAY NOT be enabled before all its dependencies are enabled. The matrix below is the source of truth for the SRE team.

| Flag | Depends on | Cohort | Owner |
|---|---|---|---|
| 004_anticheat | 004 migration 034 deployed | All | A1 |
| 004_i18n_hi | 004 migration 034 deployed + 004_anticheat | All | A1 |
| 004_ats_sync | 004 migration 035 deployed | All | A1 |
| 004_sso_workos | 004 migration 035 deployed + 004_anticheat | Partner colleges | A1 |
| 004_faculty_grading | 004_sso_workos + 004_anticheat | Partner colleges | A1 |
| 004_hackathons | 004_anticheat | All | A1 |
| 004_mock_interviews | 004_anticheat + 004 NBS (nbs) | All | A1 |
| 004_public_api | 004_anticheat + 004_ats_sync | Invited recruiters | A1 |
| 004_pwa | (none) | All | A1 |
| 004_outcome_pricing | 004_anticheat + 004_faculty_grading | Single-college pilot | A1 |
| 004_next_best_skill | 004_anticheat + 004_ats_sync | All | A1 |
| 005_mobile_app | 004_pwa + 005 migration 051 | All (with opt-out) | A2 |
| 005_auto_apply_cover_letter | 005_mobile_app + 004_public_api | All | A2 |
| 005_auto_apply_headless | 005_auto_apply_cover_letter | All | A2 |
| 005_global_leaderboard | 005 migration 051 + opt-out propagation | All | A2 |
| 005_esports_ui | 005_global_leaderboard | All | A2 |
| 006_ide_extension_vscode | 006 migration 043 + 004_anticheat | Beta → All | A3 |
| 006_ide_extension_cursor | 006_ide_extension_vscode | Beta → All | A3 |
| 006_biometrics_oura | 006_ide_extension_vscode + 004_anticheat | Opt-in | A3 |
| 006_biometrics_whoop | 006_biometrics_oura | Opt-in | A3 |
| 006_biometrics_google_fit | 005_mobile_app + 006_ide_extension_vscode | Opt-in | A3 |
| 006_biometrics_mobile | 005_mobile_app GA + 006_biometrics_google_fit | Opt-in | A3 |
| 006_privacy_center | 006_ide_extension_vscode | All | A3 |
| 007_alumni_mentorship | 007 migration 045 + 004_anticheat | All | A4 |
| 007_curriculum_daily | 007_alumni_mentorship + 004_next_best_skill | All | A4 |
| 007_curriculum_mentor_loop | 007_curriculum_daily + 007_alumni_mentorship (10 sessions/day) | All | A4 |
| 008_collab | 008 migration 047 + 004_anticheat | Cohort first → All | A5 |
| 008_teamwork_score | 008_collab (≥100 sessions) | All | A5 |
| 008_recruiter_observe | 008_collab + 008_teamwork_score | Recruiter opt-in | A5 |
| 008_anti_collusion | 008_collab + 004_anticheat | All | A5 |
| 009_onchain_mirror | 009 migration 049 + per-student opt-in (default OFF) | Opt-in | A6 |

**Default-OFF flags**: 005_auto_apply_headless, 006_biometrics_*, 008_recruiter_observe, 009_onchain_mirror — all require explicit per-user opt-in for privacy/regulatory reasons.

---

## Risk Register

| Risk | Owner | Mitigation |
|---|---|---|
| 005 mobile app store review delayed (TestFlight 7-30d, Play Internal 1-7d) | A2 | Submit sprint 3 mid; gate `005_mobile_app` on App Store approval, not on code completion |
| WorkOS SAML account setup (enterprise sales motion) | User (manual) | User handles WorkOS account creation; A1 cannot start Phase 6 without keys |
| Greenhouse/Lever sandbox credentials | User (manual) | User handles sandbox setup; A1 cannot start Phase 5 without keys |
| Meta WhatsApp template approval (T011) | User (manual) | Submit sprint 1 day 0; 1-7d review time; A1's 002 spec depends on this for nudge delivery in 003 |
| LLM provider cost overrun (004 mock-int + 007 curriculum) | A1 + A4 | Shared `WEEKLY_TOKEN_CAP_DEFAULT` in `packages/config/llm-cost-caps.ts`; enforced server-side; per-tenant monthly cap |
| Playwright service gets blocked by Cloudflare/bot detection (auto-apply) | A2 | Use residential proxies (configurable in `apps/auto-apply/src/proxy.ts`); fall back to manual handoff if blocked |
| EAS build minute quota (5,000 free/month) | A2 | Cache `node_modules` via EAS build cache; pin to specific SDK version to avoid re-resolution |
| Anti-cheat false positives (004 quarantines a real repo) | A1 | `anticheat_appeals` table; 48h mentor review SLA documented in runbook |
| On-chain regulatory shift in India (009 mirrors become illegal) | A6 | Kill-switch flag `009_onchain_mirror_enabled` defaults OFF; one-click unmirror; revocation pointer preserves W3C VC chain of trust |
| Leaderboard gaming (multiple accounts for one student) | A2 | Anti-collusion signal: cluster accounts by device fingerprint + IP + email-domain; flagged accounts dropped from MV with audit row |
| PII leakage in share-card images (005) | A2 | Share cards render only `tier + rank + college-logo`; never name, never score value, never profile photo |

---

## Coordination Points (cross-agent)

- **End of Sprint 1**: A2 (005) needs 003 web-push token migration to be `auto_apply_draft_cap` compatible. A1 (004) and A2 (005) sync on `WEEKLY_TOKEN_CAP_DEFAULT` constant.
- **Mid-Sprint 2**: A3 (006) biometric mobile depends on A2 (005) mobile app GA. A4 (007) mentor video depends on A5 (008) `VideoRoomProvider` OR Google Meet fallback.
- **End of Sprint 3**: A2 (005) auto-apply depends on A1 (004) public API; A6 (009) verification UI depends on 002 W3C VC `verifiable_credentials` table.
- **Ongoing**: All agents consume `packages/types/database.ts` regeneration after each migration. Convention: regenerate in same commit as migration.

---

## Success Metrics (12-week post-GA)

| Metric | Target | Owner |
|---|---|---|
| Daily active mobile app users (MAU) | ≥ 35% of 50K students | A2 |
| Cover letter drafts / day | ≥ 1,500 | A2 |
| Auto-apply headless completions / day | ≥ 300 | A2 |
| Global leaderboard opt-in rate | ≥ 70% | A2 |
| VS Code extension MAU | ≥ 4,000 students | A3 |
| Oura/Whoop/HealthKit opt-in rate | ≥ 8% | A3 |
| Curriculum completion rate | ≥ 40% of daily lessons | A4 |
| Mentor session completion rate | ≥ 75% | A4 |
| Collab rooms / week | ≥ 200 | A5 |
| Teamwork-score-flagged false-positive rate | ≤ 5% | A5 |
| On-chain mirrors / 60 days | ≥ 2,500 | A6 |
| EAS verification resolver load (p95) | ≤ 500ms | A6 |
| **Composite NPS** | **≥ 65** | All |
| **Recruiter activation rate (1st sync within 7d)** | **≥ 60%** | A1 |

---

## Next Steps (manual)

1. **User (manual)**: Submit Meta WhatsApp templates (T011 002) — wall-clock blocker for 002 GA
2. **User (manual)**: Create WorkOS + Greenhouse + Lever + Groq + Base + Oura + Whoop + Apple Dev + Google Play + EAS sandbox accounts
3. **All agents**: Begin Sprint 1 with their assigned feature's Phase 0 pre-flight
4. **User**: Review and approve this Gantt before any code is written
5. **Speckit analyze re-run**: After all 5 features ship their tasks, run `/speckit-analyze` on the consolidated artifacts to confirm cross-feature consistency holds at implementation time
