<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan

## Active features in development (5 features + roadmap)

- `004-eleven-of-ten` (P1 trust + reach + recruiter; 125 tasks; migration 034-038)
  — Anti-cheat, ATS sync, i18n, SSO, faculty grading, hackathons, mock interviews,
  public API, PWA, outcome pricing, next-best-skill.
  See: specs/004-eleven-of-ten/{plan,research,data-model,contracts/api,quickstart,tasks}.md

- `005-mobile-autoapply-leaderboard` (P1 mobile + monetization; 88 tasks; migration 051-052)
  — React Native + Expo mobile app, auto-apply agent (LLM cover-letter + Playwright
  headless), global cross-college leaderboards (materialized view), e-sports style UI.
  See: specs/005-mobile-autoapply-leaderboard/{plan,research,data-model,contracts/api,quickstart,tasks,checklists/requirements}.md

- `006-deep-signal-capture` (P2 trust + retention; 103 tasks; migration 043-044)
  — IDE telemetry (VS Code + Cursor extension), biometric integrations (Oura, Whoop,
  HealthKit, Google Fit), privacy center + audit log.
  See: specs/006-deep-signal-capture/{plan,research,data-model,contracts/api,quickstart,tasks}.md

- `007-adaptive-learning-graph` (P1 personalization; ~90 tasks; migration 045-046)
  — Alumni mentorship match (pgvector skill-trajectory embeddings), daily adaptive
  micro-curriculum (LLM-generated, 3 lessons/day/student), curriculum-mentor closed loop.
  See: specs/007-adaptive-learning-graph/{plan,research,data-model,contracts/api,quickstart,tasks,checklists/requirements}.md

- `008-collaborative-mode` (P2 engagement; 125 tasks; migration 047-048)
  — Live multiplayer coding (Y.js + Liveblocks + LiveKit + WebContainer), teamwork
  scoring (5% score cap), anti-collusion, recruiter observe mode.
  See: specs/008-collaborative-mode/{plan,research,data-model,contracts/api,quickstart,tasks,checklists/requirements}.md

- `009-onchain-mirror` (P3 trust, optional; 67 tasks; migration 049-050)
  — EAS-on-Base-L2 hash-only mirror of 002 W3C VCs, behind kill-switch flag default OFF,
  DPDP-safe revocation pointer, regulatory-safeguard audit trail.
  See: specs/009-onchain-mirror/{plan,research,data-model,contracts/api,quickstart,tasks,checklists/requirements}.md

## Cross-feature coordination
- Roadmap + sprint plan + dependency graph + feature-flag matrix + risk register:
  specs/_roadmap/cross-feature-rollout.md
- Migration number ledger: 034-038 (004), 043-050 (006-009), 051-052 (005)

## Score contribution budget (all new signals combined)
- 006: 3% IDE + 2% biometrics (5% combined)
- 007: 0 (engagement only, not a signal)
- 008: 5% teamwork
- 009: 0 (mirror, not a signal)
- 004: 10% faculty + 5% mock-interview
- **Total upside additions: 25%** (capped server-side)
- **Anti-cheat (004)**: -100% uncapped (defensive)
<!-- SPECKIT END -->
