# Feature Specification: Antarix 11/10 — Verified Skill Intelligence Platform

**Feature Branch**: `002-antarix-definitive-vision`
**Created**: 2026-06-04
**Status**: Draft
**Input**: User description: "Antarix 11/10 — THE DEFINITIVE VISION. The Verified Skill Intelligence Platform for Education-to-Work. Students connect GitHub + Google Calendar once for passive tracking and Day-1 value; optionally install the Chrome Extension (Power Mode) for session/focus tracking; an AI Coach pushes daily nudges via WhatsApp; the system produces verified Skill Proof Scores (0-100), placement predictions, verifiable credentials, and live college leaderboards across a three-actor ecosystem (students free, colleges paid, companies paid)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Student Onboarding with Day-1 Value (Priority: P1)

A new student visits antarix.app, signs up via "Continue with GitHub" (or email), grants GitHub OAuth, and within ~3 minutes is on a dashboard that already shows real, derived insights from their existing GitHub activity (commits, languages, peak hours, streak). They are invited — never required — to also connect Google Calendar (for schedule awareness) and to install the Power Mode Chrome Extension (for richer tracking).

**Why this priority**: This is the cold-start-killer moment. If a student leaves onboarding without seeing real value, the product fails. Day-1 value is the single biggest determinant of activation and word-of-mouth virality for a free-student product.

**Independent Test**: Create a brand-new student account against a GitHub profile that already has 3+ months of public commit history. After completing onboarding, the dashboard MUST display (a) total commits, (b) top 3 languages with percentages, (c) at least one peak-hours window, and (d) an initial Skill Proof Score (0-100), all without any Chrome Extension being installed and without waiting 7 days.

**Acceptance Scenarios**:
1. **Given** a new visitor at antarix.app, **When** they click "Continue with GitHub" and complete OAuth, **Then** an account is created and they are redirected to the quick profile setup screen within 5 seconds.
2. **Given** a returning student on the profile setup screen, **When** they select goals + skill level and click "Go to Dashboard", **Then** the dashboard renders real, GitHub-derived insights (commits, languages, streak, peak hours, first Skill Proof Score) within 60 seconds of OAuth completion.
3. **Given** a student on the dashboard, **When** they click "Connect Google Calendar" or "Skip", **Then** the choice is persisted and the dashboard updates accordingly without blocking access to existing insights.
4. **Given** a student on the dashboard, **When** they click "Install Power Mode Extension", **Then** they are taken to the Chrome Web Store listing and the dashboard shows an "extension not yet detected" hint until telemetry confirms install.
5. **Given** a student with an existing GitHub history, **When** they complete onboarding, **Then** the first AI Coach morning nudge is scheduled for the next 8 AM in their local timezone (or the next configured send window) — never immediately after signup.

---

### User Story 2 — Passive Tracking (GitHub + Calendar) Without Manual Effort (Priority: P1)

Once connected, GitHub and Google Calendar are synced automatically on a recurring schedule (GitHub every 2 hours, Calendar every 6 hours). Students do nothing and the system continuously refreshes their derived insights: language mix, commit velocity, peak coding hours, free-time windows, schedule density, deadline awareness, and project completion signals.

**Why this priority**: The "zero effort" promise is the platform's differentiator. If the system ever demands manual input from the student, it loses its only unfair advantage over a self-tracked spreadsheet.

**Independent Test**: With a connected student and no manual activity, force a sync tick and verify that new commits/events within the last window are reflected in the dashboard within one sync cycle, and that an unchanged source produces no duplicate derived events.

**Acceptance Scenarios**:
1. **Given** a student with GitHub connected, **When** 2 hours elapse since the last successful sync, **Then** the system performs a new sync, ingests new commits, and updates derived metrics (commit frequency, languages, peak hours, streak) without student action.
2. **Given** a student with Google Calendar connected, **When** 6 hours elapse since the last successful sync, **Then** the system performs a new sync, ingests new/updated events, and refreshes schedule density, free windows, and deadline flags.
3. **Given** an external source returns an error (rate limit, revoked token, network failure), **When** the sync attempt completes, **Then** the failure is logged, the student is shown a non-blocking "reconnect" prompt on their next dashboard visit, and previously-derived insights remain visible.
4. **Given** a student disconnects a source, **When** they confirm, **Then** future syncs for that source stop, derived metrics dependent solely on that source are marked as stale, and the student is informed which insights will degrade.
5. **Given** private GitHub repositories, **When** the student has not granted access to private repo data, **Then** only public repo activity contributes to insights and a clear "connect private repos for richer data" affordance is shown.

---

### User Story 3 — AI Coach Nudges via WhatsApp and Push (Priority: P1)

A student who has connected WhatsApp receives, on a daily cadence and on real-time triggers, actionable nudges that tell them what to do *now* (during their peak window) or *next* (tomorrow's plan). They can also reply with simple commands (START, DONE, STATS, RANK, HELP) to interact without opening the app. Students who do not connect WhatsApp receive the same nudges via push notification and dashboard cards.

**Why this priority**: The AI Coach is the single feature that keeps a free student engaged between onboarding and their first placement cycle. Without it, the dashboard decays into a static report and retention collapses.

**Independent Test**: For a connected student with at least 7 days of history, trigger each nudge type and verify (a) WhatsApp delivery within 60 seconds, (b) push fallback within 60 seconds when WhatsApp is not connected, (c) the nudge content is personalized (uses the student's actual peak window, current streak, current project progress, and current calendar free time), and (d) replies to interactive commands update the underlying state correctly.

**Acceptance Scenarios**:
1. **Given** a student connected to WhatsApp with a valid send window, **When** the local-clock time hits the daily-morning send time, **Then** a Daily Morning Nudge is delivered summarizing yesterday's stats and proposing a today plan grounded in the student's actual calendar free time.
2. **Given** a student approaching their historical peak window, **When** the trigger fires within a defined lead time, **Then** a Real-Time Nudge is sent referencing a specific in-progress project and a concrete next action (e.g., "3 more commits could finish it tonight").
3. **Given** a student with no commits for 48+ hours, **When** the streak-at-risk check runs, **Then** a Risk Alert nudge is sent with quick wins and the explicit change in placement prediction if the trend continues.
4. **Given** a student, **When** Sunday at the configured weekly-send time arrives, **Then** a Weekly Summary is delivered with sessions/hours, focus quality, cohort ranking change, score delta, and the updated placement prediction.
5. **Given** a student who has not connected WhatsApp, **When** any of the above triggers fires, **Then** the same nudge is delivered as a web/extension push notification with equivalent content, and the dashboard surfaces a "connect WhatsApp for daily coaching" call-to-action.
6. **Given** a student replying "START" on WhatsApp, **When** the message is received, **Then** an ad-hoc session is started and logged for the student, and a confirmation is returned.
7. **Given** a student replying "RANK" on WhatsApp, **When** the message is received, **Then** the current cohort rank and nearest-neighbor delta is returned in a single message.

---

### User Story 4 — Power Mode (Optional Chrome Extension) for Deeper Tracking (Priority: P2)

A student who installs the Chrome Extension gains a "⚡ Power Mode" badge on their profile. The extension lets them start/stop categorized work sessions (DSA, Coding, Project, Learning, Research), tracks active window/tab focus in real time, computes a session-level focus quality (HIGH/MEDIUM/LOW), and syncs sessions to the backend hourly. This is strictly additive — students who never install the extension retain a full, lower-granularity experience.

**Why this priority**: Power Mode is what converts a passive observer into a power user whose data makes the AI Coach and Skill Proof Score materially more accurate. It is the viral loop (visible badge + leaderboard edge) and the upsell path to company-recruiting visibility.

**Independent Test**: With the extension installed and a student starting a 30-minute "Coding" session focused on a single editor window, verify (a) a session row is logged with the correct category, duration, and HIGH focus, (b) the ⚡ Power Mode badge appears on the student's public profile, (c) the session appears in the dashboard timeline within one sync cycle, and (d) the AI Coach's next nudge references the new session data.

**Acceptance Scenarios**:
1. **Given** a student with the extension installed, **When** they click "Start Session" and select a category, **Then** a session begins, a visible timer/badge appears, and the active window/tab focus is sampled at the configured cadence.
2. **Given** an active session, **When** the student switches to many unrelated tabs or distraction sites, **Then** the in-session focus quality metric drops to MEDIUM or LOW and the UI reflects it.
3. **Given** an active session, **When** the student clicks "End Session", **Then** the student is prompted for a self-rating (1-5) and optional notes, and the completed session is queued for sync.
4. **Given** queued sessions, **When** the extension's hourly sync runs (or the student clicks "Sync now"), **Then** sessions are uploaded, the dashboard timeline updates, and the offline queue is cleared.
5. **Given** a student without the extension, **When** they view their profile, **Then** no ⚡ Power Mode badge is shown and no session-level data is presented, but Skill Proof, peak window, and placement prediction remain available from passive data alone.
6. **Given** a student with the extension, **When** the extension is uninstalled, **Then** new sessions stop syncing, the badge is removed, and historical sessions remain visible (with a "last seen" timestamp).

---

### User Story 5 — Verified Skill Proof Score, Placement Prediction, and Exportable Credential (Priority: P1)

Every student gets a continuously-updated Skill Proof Score (0-100) backed by real data. After at least 30 days of activity, a placement prediction (% probability and company tier) is generated. The student can export a verifiable credential (link + QR + PDF + LinkedIn badge) that any third party can validate against the live score.

**Why this priority**: This is the "thing students show off" and the "thing companies trust." It is the asset that ties together every other feature and is the explicit reason students return to the platform and companies pay to search it.

**Independent Test**: For a student with 90+ days of activity, verify (a) the Skill Proof Score recomputes on each new sync and is within the documented 0-100 range with documented weights, (b) the placement prediction generates a percentage and tier with a documented refresh cadence, and (c) the exported credential resolves at a public URL, shows current score, and exposes a "last verified" timestamp.

**Acceptance Scenarios**:
1. **Given** a student with any amount of GitHub data, **When** new data is ingested, **Then** the Skill Proof Score recomputes (asynchronously) and the new score replaces the old score with a visible delta on the dashboard.
2. **Given** a student with at least 30 days of activity, **When** the weekly placement prediction runs, **Then** a percentage (0-100), a company tier (Tier-1/Tier-2/Tier-3), an estimated time-to-ready, and a top-3 gap analysis are produced and shown on the dashboard.
3. **Given** a student, **When** they click "Export Credential", **Then** they receive a public verification URL, a downloadable PDF, a QR code, and a LinkedIn-shareable badge, all of which resolve to the student's current live score.
4. **Given** a third party visits a verification URL, **When** the page loads, **Then** it displays the student's name, institution, current overall score, per-skill proficiency, verified activity totals, cohort percentile, and a "last verified" timestamp.
5. **Given** a student is in "Power Mode", **When** the score recomputes, **Then** the documented Power-Mode weighting is applied (session quality replaces the calendar-context weight), and the student can see the difference vs passive-only on demand.

---

### User Story 6 — College Dashboard, Leaderboards, and Curriculum Intelligence (Priority: P2)

A college administrator who subscribes (paid tier) sees a live placement-readiness dashboard, per-batch leaderboards, skill-gap analysis, company matches, and alumni tracking for their enrolled students who have opted in.

**Why this priority**: Colleges are the institutional anchor that converts a free viral-student loop into a defensible, contract-backed revenue line. Without this, the product is consumer-only and exposed to churn.

**Independent Test**: For a college with at least 50 opted-in students across two batches, verify (a) the readiness segments (Ready Now / Development Path / Early Stage) sum to the total opted-in count, (b) the leaderboard ranking matches the individual student scores, (c) the skill-gap report reconciles to the underlying student data, and (d) a "company match" recommendation names specific students, not just counts.

**Acceptance Scenarios**:
1. **Given** a college administrator, **When** they open the dashboard, **Then** they see total enrolled students, opted-in tracked count, average Skill Proof Score, and a three-bucket readiness segmentation with counts and percentages.
2. **Given** a college administrator, **When** they open the leaderboard for a batch, **Then** the ranking reflects the current Skill Proof Score with documented tie-breakers, and Power-Mode and streak indicators are visible per row.
3. **Given** a college administrator, **When** they open the curriculum-intelligence view, **Then** they see a per-skill comparison of student supply vs. industry demand with at least one actionable recommendation.
4. **Given** a college administrator, **When** they click "Auto-Send" on a company match, **Then** a one-click invite is delivered to each named student (with documented consent) and the company receives a verified shortlist.
5. **Given** a graduating batch, **When** the year ends, **Then** graduates transition into the alumni view and lifetime metrics (placements, tier, salary band if shared) become visible to the college.

---

### User Story 7 — Company Search, One-Click Invite, and Interview Scheduling (Priority: P3)

A recruiter from a paying company searches verified candidates by skill, minimum score, batch, and location. The results show verified data (not resume claims) plus a fit/match score. The recruiter can one-click-invite a candidate, and accepted invites auto-schedule an interview against both calendars (candidate + interviewer) inside a candidate's confirmed peak window.

**Why this priority**: Companies are the second paid revenue line and the destination that makes the verified credential worth showing off. It is the third priority because the student and college funnels must exist before company search has inventory to monetize.

**Independent Test**: For a company with search credits, run a skill + score filter that returns at least 10 candidates, then issue a one-click invite to a specific candidate whose calendar is connected. Verify (a) the candidate receives an invite, (b) on acceptance, a proposed interview slot is generated that respects the candidate's confirmed peak window, and (c) the recruiter sees the candidate's current verified score and a "last verified" timestamp.

**Acceptance Scenarios**:
1. **Given** a company recruiter, **When** they run a candidate search with documented filters, **Then** results list only opted-in students and each row shows a current Skill Proof Score, Power-Mode status, match score, and verified activity summary.
2. **Given** a search result row, **When** the recruiter clicks "One-Click Invite", **Then** a standardized invite is sent to the candidate, the recruiter's seat usage is decremented per the plan, and the action is logged in the recruiter's pipeline view.
3. **Given** an accepted invite, **When** interview scheduling runs, **Then** the proposed time slots respect both parties' connected calendars and prefer the candidate's documented peak window.
4. **Given** a recruiter, **When** they open the pipeline view, **Then** they see the funnel from invite → accepted → interviewed → outcome, with documented attribution back to Antarix-sourced hires.
5. **Given** a candidate who is not opted-in to company search, **When** a recruiter's filter would otherwise include them, **Then** the candidate is excluded and no indirect signal of their existence is leaked in result counts.

---

### Edge Cases

- What happens when a student's GitHub access token is revoked? (Reconnect prompt; previously derived insights remain visible but are marked stale; no further passive sync.)
- What happens when a student's Google Calendar returns 410 Gone or a permanent error? (Calendar-specific derived insights are hidden; score reweights according to documented rules; reconnect prompt is shown on next dashboard visit.)
- What happens when a student has fewer than 30 days of GitHub history? (Skill Proof Score is shown with a "limited data" disclosure; placement prediction is suppressed until the 30-day minimum is reached.)
- What happens when a student has zero public repos / zero commits? (Onboarding still completes; an empty-state dashboard with concrete next steps is shown; no fabricated score is displayed.)
- What happens when the AI Coach detects a sudden schedule change (e.g., exam week) and there is no free time? (Daily nudge switches to a low-pressure "rest & recover" mode and the system does not push real-time peak-window nudges during exam-blocked windows.)
- What happens when the Chrome Extension cannot reach the network for >24 hours? (Sessions queue locally; no data loss; the student is informed at next sync attempt.)
- What happens when two students share a GitHub username (typo squat, account merge)? (Identity is anchored on the OAuth user ID, not the username; collisions are flagged in admin tooling.)
- What happens when a company pays but no candidates match? (Empty-state search surfaces a "broaden filters" hint and a "let us know what you are looking for" capture; no fake candidates are returned.)
- What happens when WhatsApp delivery fails (rate limit, opt-out)? (Push notification fallback is triggered; a permanent failure surfaces a "WhatsApp disconnected, please reconnect" prompt on next dashboard visit.)
- What happens when a student requests account deletion? (All personal data is purged per documented retention rules; aggregated, non-identifying metrics may persist; credentials become invalid within 24 hours.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a new student to create an account via "Continue with GitHub" OAuth or email+password, and to complete onboarding in under 3 minutes.
- **FR-002**: System MUST ingest a student's public GitHub activity (commits, repos, languages, timestamps) automatically on a recurring sync (target: every 2 hours) once connected, and MUST derive at minimum: total commits (90-day window), top 3 languages with percentages, active streak length, peak commit hours, and a list of currently-active projects.
- **FR-003**: System MUST allow a student to optionally connect Google Calendar and MUST ingest events on a recurring sync (target: every 6 hours), deriving: class schedule, deadline-flagged events, free time windows, and schedule density.
- **FR-004**: System MUST produce a first-pass dashboard with real, derived insights within 60 seconds of GitHub OAuth completion, with no 7-day waiting period.
- **FR-005**: System MUST compute and continuously update a Skill Proof Score (0-100) per the documented weighted formula, with separate documented weightings for passive-only vs Power-Mode students.
- **FR-006**: System MUST generate a placement prediction (0-100% probability, company tier, time-to-ready, top-3 gap items) for any student with at least 30 days of activity, refreshed on a documented cadence (target: weekly).
- **FR-007**: System MUST provide a publicly-resolvable verifiable credential for every student containing name, institution, current score, per-skill proficiency, verified activity totals, cohort percentile, and "last verified" timestamp, and MUST invalidate or update the credential when the live score changes by a documented threshold.
- **FR-008**: System MUST deliver AI Coach nudges via WhatsApp (primary) and web/extension push notifications (fallback) for: daily morning summary, real-time peak-window trigger, streak-at-risk alert, and weekly summary, each on documented triggers and time windows.
- **FR-009**: System MUST support the documented interactive WhatsApp commands: START, DONE, STATS, RANK, HELP, and each command MUST produce a documented state change or response.
- **FR-010**: System MUST provide a Chrome Extension ("Power Mode") that is optional, offline-first, and supports: starting/stopping categorized work sessions, sampling active window/tab focus, computing a session focus quality (HIGH/MEDIUM/LOW), capturing a self-rating and notes at session end, and syncing sessions on a documented cadence (target: hourly) plus an explicit "Sync now" affordance.
- **FR-011**: System MUST surface a "⚡ Power Mode" badge on a student's profile when the extension is detected as installed, and MUST remove the badge within a documented window (target: 24 hours) of the last confirmed telemetry heartbeat stopping.
- **FR-012**: System MUST support a paid college tier with: placement-readiness segmentation (Ready Now / Development Path / Early Stage), per-batch live leaderboards, skill-gap vs. industry-demand report, and company-match recommendations that name specific opted-in students.
- **FR-013**: System MUST support a paid company tier with: verified-candidate search by skill/score/batch/location, fit/match score, one-click invite, calendar-aware interview scheduling that prefers the candidate's confirmed peak window, and a hiring-pipeline funnel view.
- **FR-014**: System MUST allow a student to disconnect any data source (GitHub, Calendar, WhatsApp) or the Chrome Extension, and MUST stop ingesting from that source within a documented window (target: immediate) while preserving prior derived insights marked stale.
- **FR-015**: System MUST allow a student to delete their account, MUST purge personal data per documented retention rules, and MUST invalidate verifiable credentials within a documented window (target: 24 hours).
- **FR-016**: System MUST allow a student to opt out of company search visibility, and MUST exclude opted-out students from all company search results and aggregate counts that could leak their presence.
- **FR-017**: System MUST log, on the student's next dashboard visit, any sync failure (rate limit, revoked token, network error) for each connected source, with a non-blocking reconnect prompt and no loss of previously-derived insights.
- **FR-018**: System MUST compute cohort leaderboards per documented tie-breakers and MUST update rankings within a documented window (target: 1 hour) of a score change.
- **FR-019**: System MUST support privacy-aware cohort comparison (percentile, peer averages) using only opted-in students' data and MUST not expose individual non-opted-in students in any cohort view.
- **FR-020**: System MUST respect documented quiet hours, exam-week detection, and WhatsApp opt-out state when scheduling any nudge, and MUST provide a single "pause all nudges" control per student.
- **FR-021**: System MUST produce a "first insight" message at the end of onboarding that is grounded in the student's actual data (e.g., real peak hours, real languages, real project) and MUST NOT show fabricated or placeholder insights.
- **FR-022**: System MUST provide an "Install Power Mode" affordance on the dashboard at all times for non-Power-Mode students and MUST document what additional data and benefits the extension unlocks.

### Key Entities

- **Student**: An individual user. Attributes: identity (name, email, GitHub user ID), goals, skill level, opted-in sources, opted-in company-search visibility, Power-Mode status, last-active timestamp, current Skill Proof Score, current placement prediction, current cohort.
- **GitHub Connection**: A student's authorized link to GitHub. Attributes: OAuth scopes, last successful sync, sync status, last error, last ingested commit timestamp, public/private repo access scope.
- **Calendar Connection**: A student's authorized link to Google Calendar. Attributes: OAuth scopes, last successful sync, sync status, last error, last ingested event timestamp.
- **Commit Event**: A single ingested commit. Attributes: hash, repo, message, timestamp, files changed, additions, deletions, author identity.
- **Repository**: A tracked repo for a student. Attributes: name, language breakdown, stars, forks, is-private, completion signals (README, CI, releases).
- **Calendar Event**: A single ingested event. Attributes: source event ID, start, end, title, attendees, derived flags (class, deadline, study-group).
- **Free Window**: A derived gap between calendar events. Attributes: start, end, day-of-week bucket.
- **Work Session** (Power Mode): A categorized work block. Attributes: category (DSA/Coding/Project/Learning/Research), start, end, focus quality (HIGH/MEDIUM/LOW), self-rating, notes, extension version, sync status.
- **Skill Proof Score**: A point-in-time computed score. Attributes: overall (0-100), per-skill proficiency, weighting profile (passive-only vs Power-Mode), contributing components, computed-at timestamp, score-delta vs prior computation.
- **Placement Prediction**: A point-in-time ML inference. Attributes: probability (0-100), company tier (Tier-1/2/3), time-to-ready estimate, top-3 gap items, computed-at timestamp.
- **Nudge**: An AI Coach message. Attributes: channel (WhatsApp/push/dashboard), type (morning/real-time/streak-risk/weekly), trigger, sent-at, delivery status, student response (if any).
- **Cohort**: A group of students for comparison/leaderboards. Attributes: definition (e.g., institution+batch+specialization), member count, opted-in member count, last-computed-at timestamp.
- **Institution (College)**: A subscribing college. Attributes: name, plan tier, enrolled students, opted-in students, admin users.
- **Company**: A subscribing employer. Attributes: name, plan tier, recruiter users, search-credit balance, hiring-pipeline records.
- **Verifiable Credential**: A student's exportable proof. Attributes: public URL slug, current score snapshot, last-verified timestamp, revocation status, distribution channels (link/PDF/QR/LinkedIn badge).
- **Invite / Application**: A one-click-company-to-student or student-to-company flow. Attributes: initiator, recipient, status, attached credential snapshot, scheduled interview slot (if any).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new student with 3+ months of public GitHub history completes onboarding and sees a dashboard with at least 4 real, derived insights and a first Skill Proof Score within 3 minutes of arriving at the site, in 100% of measured onboarding sessions.
- **SC-002**: 70% of students who complete onboarding return to the dashboard at least once within their first 7 days.
- **SC-003**: 50% of students who complete onboarding connect at least one optional surface (Calendar, WhatsApp, or Power Mode) within 14 days.
- **SC-004**: Among students who connect WhatsApp, 60% are still receiving Daily Morning Nudges 30 days later (30-day WhatsApp retention).
- **SC-005**: For students with at least 30 days of activity, the placement prediction refresh completes within the documented weekly cadence with documented inputs, and the displayed probability matches the most recent inference for 100% of dashboard visits.
- **SC-006**: The verifiable credential public URL resolves in under 3 seconds for 95% of third-party visits and always shows the student's current live score and a "last verified" timestamp.
- **SC-007**: 100% of students who install the Chrome Extension and complete at least one session see that session reflected in their dashboard timeline within one sync cycle (target ≤ 1 hour from session end).
- **SC-008**: For any college administrator viewing a batch leaderboard, the ranking shown matches the underlying score ordering and the documented tie-breakers for 100% of rows.
- **SC-009**: For any company recruiter, a one-click invite sent to an opted-in candidate results in the candidate receiving the invite within 60 seconds in 95% of cases.
- **SC-010**: For accepted invites that proceed to interview scheduling, at least 80% of proposed slots fall within the candidate's confirmed peak window or another window the candidate has explicitly confirmed availability.
- **SC-011**: The system supports at least 5,000 active students in year 1 and at least 50,000 active students in year 2, with documented latency targets for dashboard load (target: p95 ≤ 2 seconds) and nudge delivery (target: p95 ≤ 60 seconds).
- **SC-012**: 100% of account-deletion requests result in personal-data purge within the documented window (target: 30 days) and verifiable-credential invalidation within 24 hours.
- **SC-013**: 0% of company search results ever include a student who has opted out of company-search visibility, verified by an automated privacy test.
- **SC-014**: 100% of WhatsApp messages are suppressed during documented quiet hours, exam-week windows, or after a student has issued a "pause all nudges" command.
- **SC-015**: Year 1 collects at least 1.8M passive data points (commits, calendar events, sessions) across enrolled students, establishing the data foundation for the documented competitive moat.

## Assumptions

- **A-001**: Students are the free tier and the primary growth engine; colleges and companies are paid tiers. The 11/10 product experience is defined for the student first.
- **A-002**: The product targets Indian students in higher education (engineering colleges) as the beachhead market, where WhatsApp is the dominant engagement channel and Tier-1/2/3 placement is the dominant outcome metric.
- **A-003**: GitHub is the canonical signal source for student technical activity in year 1. Additional sources (LeetCode, HackerRank, GitLab) are explicitly out of scope for v1.
- **A-004**: A "Day 1 value" experience is non-negotiable: any student with 3+ months of public GitHub history MUST see real insights within 3 minutes of onboarding. The 7-day warm-up period from the previous vision is removed.
- **A-005**: The Chrome Extension is strictly optional and additive. Removing the extension or never installing it MUST NOT remove any passive-tracking, score, prediction, credential, or nudge functionality. Power Mode is an upgrade, not a requirement.
- **A-006**: WhatsApp is the primary nudge channel; push notifications and dashboard cards are first-class fallbacks. The product must remain fully functional for students who never connect WhatsApp.
- **A-007**: The verifiable credential is the student's asset and must be exportable independent of any specific consumer (LinkedIn badge, PDF, QR, public URL). It must be resolvable by any third party with no Antarix account.
- **A-008**: College and company tiers are paid, contract-backed revenue lines. Students are never charged. Free-tier students are never the product being sold to colleges/companies without documented consent.
- **A-009**: Student privacy controls (source disconnect, opt-out of company search, account deletion, pause-nudges) are first-class and must be respected at every layer, including in aggregate counts that could leak presence.
- **A-010**: The "competitive moat" claims (data volume, network effects, institutional lock-in) are aspirational targets for years 1-3 and are not required to be true on day 1, but the data collection architecture must support them from day 1.
- **A-011**: The explicit risk called out in the input — WhatsApp API costs scaling with daily-messaging usage at 50,000 students — is acknowledged as a real operational cost. **Cost-model optimization** (template batching, per-student message-budgeting as a billing design, channel fallback as a cost lever) is treated as an out-of-scope engineering concern here. **Defensive cost guards** (a soft per-student weekly message cap that auto-falls-back to push when exceeded, with a metric emitted) are in scope as a safety measure, defined by env vars in `quickstart.md` and implemented as a guard in the dispatch path.
- **A-012**: All scoring weights, leaderboard tie-breakers, placement-prediction inputs, and badge thresholds are documented in the source vision (ANTARIX_11_10_DEFINITIVE.md §8, §9) and are treated as the initial product specification. Tuning them over time is a product decision, not a spec change, unless the change alters user-visible behavior documented above.
- **A-013**: Internationalization beyond English copy is out of scope for v1; however, all time/date handling, nudge scheduling, and "peak window" computation MUST be in the student's local timezone from day 1.
- **A-014**: The verifiable credential snapshot refreshes (re-issues a new snapshot and regenerates distribution artifacts) only when `abs(current_overall_score − snapshot_overall_score) ≥ CREDENTIAL_SNAPSHOT_REFRESH_DELTA` points, default `3`. Below the threshold, the public verification page still shows the current live score and discloses the delta; above the threshold, a new snapshot is taken so the credential's "as of" timestamp remains meaningful. The delta is a constant, not a user-configurable setting.
