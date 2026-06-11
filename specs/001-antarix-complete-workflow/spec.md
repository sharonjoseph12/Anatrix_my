# Feature Specification: Antarix — Verified Skill Proof Ecosystem

**Feature Branch**: `001-antarix-complete-workflow`  
**Created**: 2026-06-04  
**Status**: Draft  
**Input**: User description: "Complete Antarix workflow — a verified skill proof system for the education-to-work pipeline connecting students, colleges, and companies"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Student Onboarding & Profile Setup (Priority: P1)

A new student visits Antarix, creates an account with email and password, verifies their email, and completes a multi-step onboarding flow. The student provides their display name, user type (student/professional), learning goals (Placement, DSA, AI/ML, Startup, Research, Freelancing), self-assessed skill level (Beginner/Intermediate/Advanced), and preferred working hours. The student then optionally connects external accounts (GitHub via OAuth, Google Calendar via OAuth) and is prompted to install the Chrome extension.

**Why this priority**: Without onboarding, no data enters the system. This is the entry point for every user in the ecosystem and the foundation for all downstream value.

**Independent Test**: Can be fully tested by creating an account, completing profile setup, connecting GitHub, and landing on the dashboard — delivers immediate value by establishing the user's identity and data connections.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they enter a valid email and password and click Sign Up, **Then** the system sends a verification email and the user sees a confirmation prompt.
2. **Given** an unverified user clicks the email verification link, **When** the link is valid and not expired, **Then** the user's email is confirmed and they are redirected to the profile setup step.
3. **Given** a user on the profile setup screen, **When** they fill in display name, select goals, skill level, and working hours and click Continue, **Then** their profile data is saved and they are redirected to the GitHub connection step.
4. **Given** a user on the GitHub connection step, **When** they click "Connect with GitHub," **Then** the system initiates GitHub OAuth, the user authorizes Antarix, and the system stores the access token and begins syncing repositories and recent commits in the background.
5. **Given** a user on the calendar connection step, **When** they click "Skip for now," **Then** the system skips the step and marks onboarding as complete.
6. **Given** onboarding is complete, **When** the user lands on the dashboard, **Then** they see a congratulations screen with a link to install the Chrome extension and an indicator showing days remaining until first insights.

---

### User Story 2 — Activity Tracking via Chrome Extension (Priority: P1)

A student installs the Antarix Chrome extension from the Chrome Web Store. When ready to work, the student opens the extension popup, selects a work category (DSA, Coding, Project, Learning, Research), optionally names the project, and starts a session. While the session is active, the extension tracks the active window, open browser tabs, and calculates a focus quality score (High/Medium/Low) in real time. The student sees a live timer and current focus level. When done, the student ends the session, rates their productivity (1–5), adds optional notes, and saves. The extension stores data locally and syncs to the backend periodically.

**Why this priority**: Activity tracking is the core data collection mechanism. Without it, the system has no behavioral data to generate insights or skill proofs.

**Independent Test**: Can be tested by installing the extension, starting a session, working for a period, ending the session, and verifying the session appears on the dashboard — delivers value by showing tracked time and activity.

**Acceptance Scenarios**:

1. **Given** the extension is installed and the user is logged in, **When** the user clicks the extension icon, **Then** the popup displays user greeting, category selection, optional project name field, and a "Start Session" button.
2. **Given** a session is started, **When** 5 minutes have elapsed, **Then** the popup displays a running timer, current focus level, and active application context.
3. **Given** a session is active, **When** the user opens more than 5 unrelated browser tabs, **Then** the focus quality degrades from High to Medium.
4. **Given** a session is active, **When** the user clicks "End Session," **Then** the popup shows a completion screen with duration, category, focus level, productivity rating input, notes field, and a "Save & Close" button.
5. **Given** a completed session is saved locally, **When** the hourly sync job runs, **Then** the session data is uploaded to the backend and persisted.

---

### User Story 3 — Automated GitHub & Calendar Sync (Priority: P2)

The system runs background jobs to continuously sync data from connected external accounts. For GitHub, a periodic job fetches new commits, repository metadata, and programming languages since the last sync. For Google Calendar, a periodic job fetches events and schedule data. All synced data is stored and associated with the student's account for downstream analysis.

**Why this priority**: External data enriches the activity picture beyond manual session tracking, enabling skill detection from code and schedule-aware insights.

**Independent Test**: Can be tested by connecting GitHub, waiting for the background sync, and verifying commit history and language breakdown appear in the student's profile data.

**Acceptance Scenarios**:

1. **Given** a user has connected GitHub, **When** the periodic sync job runs, **Then** all new commits since the last sync are fetched and stored with commit hash, repository name, primary language, and timestamp.
2. **Given** a user has connected Google Calendar, **When** the periodic sync job runs, **Then** recent calendar events are fetched and stored.
3. **Given** a sync job encounters an expired or revoked OAuth token, **When** the sync fails, **Then** the system marks the integration as disconnected and notifies the user to re-authorize.

---

### User Story 4 — Weekly Insight Generation & Dashboard (Priority: P2)

After sufficient data accumulation (minimum 7 days), the system generates personalized insights for each student via a scheduled job. Insights include: peak performance window (time of day when user is most productive, with a multiplier), workflow pattern detection (e.g., "DSA → Coding → Documentation" with success rate), skill detection from GitHub activity (language and domain proficiency), and category success rates. Students view their insights on a multi-page dashboard consisting of: a Brief page (greeting, performance score, recommended action, risk/opportunity), a Peak Self page (peak window, best metrics, daily blueprint), an Insights page (individual insight cards with confidence scores and recommendations), and activity history.

**Why this priority**: Insights are the primary value proposition for students — the reason they keep using the platform and tracking their activity.

**Independent Test**: Can be tested by accumulating 7 days of session data, triggering the insight generation job, and verifying that insights appear on the dashboard with correct calculations.

**Acceptance Scenarios**:

1. **Given** a user has 7+ days of tracked sessions, **When** the weekly insight generation job runs, **Then** the system produces at least one insight (peak window, workflow pattern, or skill detection) with a confidence score.
2. **Given** insights have been generated, **When** the user opens the Brief dashboard page, **Then** they see a greeting, performance score (0–100), a recommended next action, and any identified risks or opportunities.
3. **Given** insights have been generated, **When** the user opens the Peak Self page, **Then** they see their peak performance window (start/end hours), multiplier, best metrics (sleep, location, workflow), and a "Peak Day Blueprint" with step-by-step recommended schedule.
4. **Given** insights have been generated, **When** the user opens the Insights page, **Then** they see individual insight cards showing type, title, description, metric value, data points count, confidence score, and a recommended action.
5. **Given** new insights are generated, **When** the job completes, **Then** the system sends a push notification to the student: "Your Weekly Insights Are Ready."

---

### User Story 5 — Cohort Comparison & Community (Priority: P3)

Students can discover and join cohorts (e.g., "CSE 2024 @ St Joseph's" or "AI/ML Enthusiasts"). Within a cohort, students see anonymized aggregate metrics — cohort peak window, average focus quality, workflow patterns — and a comparison of their own metrics against the cohort average. Students can see their advantages or areas for improvement relative to peers. Students can also join study groups within a cohort.

**Why this priority**: Cohort comparison creates social proof, motivation, and community — driving retention and network effects.

**Independent Test**: Can be tested by joining a cohort with 2+ members and verifying the comparison view shows "You vs Cohort" metrics with correct advantage calculations.

**Acceptance Scenarios**:

1. **Given** a student visits the Cohorts page, **When** cohorts are available, **Then** they see a list of cohorts with member count, peak window, and average focus quality.
2. **Given** a student clicks "Join Cohort," **When** they confirm, **Then** they are added to the cohort and the member count increments.
3. **Given** a student is in a cohort, **When** they view the cohort comparison page, **Then** they see their own metrics side-by-side with cohort averages and calculated advantages (e.g., "+18% focus quality").

---

### User Story 6 — College Onboarding & Placement Dashboard (Priority: P3)

A college placement officer signs up on the institutional portal, creates an institution profile, and subscribes to a paid tier. The officer imports students via CSV upload (email, name, batch year, specialization) or manual entry. The system sends invitations to students to link their Antarix accounts. The placement dashboard shows: total vs. tracked students, placement readiness tiers (Ready Now / Development Path / Early Stage) with student counts and criteria, top performers with full skill profiles, curriculum skill gap analysis (demand vs. supply with recommendations), and a list of actively recruiting companies with auto-match capability.

**Why this priority**: Institutional adoption drives mass student adoption and is a primary revenue channel.

**Independent Test**: Can be tested by creating an institution, importing a CSV of students, and verifying the placement dashboard renders readiness tiers and skill gap analysis.

**Acceptance Scenarios**:

1. **Given** a placement officer signs up, **When** they complete institution registration, **Then** an institution record is created and the officer sees an empty dashboard with import options.
2. **Given** a placement officer uploads a CSV of students, **When** the CSV is valid, **Then** institution member records are created and invitation emails are sent to each student.
3. **Given** students have accumulated data, **When** the placement officer opens the dashboard, **Then** they see students segmented into Placement Ready (80%+ skill proof, 500+ hours), Development Path (50–80%), and Early Stage (<50%) tiers.
4. **Given** curriculum gap data is available, **When** the dashboard loads, **Then** the officer sees skills with high industry demand but low student supply, with actionable recommendations.
5. **Given** companies are actively recruiting, **When** the officer clicks "Auto-Match Students" for a company, **Then** the system filters students matching the company's skill requirements and sends profiles to the company while notifying matched students.

---

### User Story 7 — Company Recruiting & Candidate Search (Priority: P3)

A company recruiter signs up on the recruiting portal, registers the company, and subscribes to a paid tier. The recruiter creates job searches with filters: required skills, minimum skill proof score, batch years, preferred locations. The system returns matching candidates ranked by match score, showing verified skill proof scores, specializations, project counts, focus quality, peak productivity windows, and a fit analysis. The recruiter can view full candidate profiles, schedule interviews (with calendar integration suggesting optimal times based on the candidate's peak window), and track hiring pipeline from search → outreach → interview → hire. After hiring, the system tracks retention and provides ROI analytics.

**Why this priority**: Company revenue is the highest-margin channel and validates the entire skill proof model.

**Independent Test**: Can be tested by creating a job search with skill filters and verifying matching candidates are returned with correct match scores and verified profiles.

**Acceptance Scenarios**:

1. **Given** a recruiter is on the dashboard, **When** they click "Create New Search" and specify skills, min score, batch years, and locations, **Then** the system returns a ranked list of matching candidates with match scores.
2. **Given** search results are displayed, **When** the recruiter views a candidate card, **Then** they see skill proof score, specialization breakdown, projects completed, focus quality, peak window, college, batch year, and a fit recommendation.
3. **Given** a recruiter clicks "Schedule Interview" for a candidate, **When** they select a time, **Then** the system creates calendar events for both parties and sends notification emails.
4. **Given** an interview is completed, **When** the recruiter marks the candidate as hired, **Then** the system updates the match record, notifies the student, notifies the college, and updates hiring analytics.
5. **Given** the recruiter opens the analytics page, **When** a hiring campaign has completed, **Then** they see positions filled, candidates searched/reached/interviewed/hired, retention rate, average skill proof score of hires, and ROI metrics.

---

### User Story 8 — Skill Proof Score & Candidate Profile (Priority: P2)

The system calculates a Skill Proof Score (0–100) for each skill a student has demonstrated, based on four weighted components: hours logged (25%), project completion rate (35%), focus quality (25%), and consistency (15%). An overall candidate profile score is computed from the top 3 skills with bonuses for breadth (5+ skills) and deep specialization (any skill >85). The system auto-determines proficiency level (beginner/intermediate/advanced/expert) and placement readiness. Candidate profiles are updated daily and made searchable by companies (with student opt-in).

**Why this priority**: The Skill Proof Score is the core differentiator — the "verified credential" that makes the entire ecosystem valuable.

**Independent Test**: Can be tested by tracking sessions and GitHub activity for a specific skill, triggering the score calculation, and verifying the score components and proficiency level match expected values.

**Acceptance Scenarios**:

1. **Given** a student has sessions tagged to a skill category, **When** the weekly skill proof calculation runs, **Then** the system produces a skill proof score (0–100) with hours, projects, quality, and consistency components.
2. **Given** a student's top 3 skills are scored, **When** the daily profile update runs, **Then** an overall candidate profile score is calculated with breadth and specialization bonuses.
3. **Given** a student's overall score exceeds 80 and they have 200+ hours logged, **When** the profile is updated, **Then** the student is marked as placement-ready.
4. **Given** a student opts in to visibility, **When** their profile is updated, **Then** their candidate profile becomes searchable by companies.

---

### Edge Cases

- What happens when a student has fewer than 7 days of data and opens the dashboard? → Show a placeholder state with days remaining until first insights.
- What happens when a GitHub OAuth token expires mid-sync? → Mark integration as disconnected, notify user, queue re-sync after re-authorization.
- What happens when a CSV import contains duplicate or invalid emails? → Skip duplicates, flag invalid rows, and report a summary to the placement officer.
- What happens when a student is in no cohort? → Cohort comparison page shows "Join a cohort to see how you compare."
- What happens when a company search returns zero candidates? → Show "No candidates match your criteria" with suggestions to broaden filters.
- What happens when a session is started but the browser crashes before ending? → The extension recovers the session from local storage on next launch and prompts the user to end or discard it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create accounts with email and password, with email verification.
- **FR-002**: System MUST support multi-step onboarding: profile setup (name, type, goals, skill level, working hours), GitHub OAuth, Google Calendar OAuth (optional), and Chrome extension prompt.
- **FR-003**: System MUST provide a Chrome extension that tracks work sessions with category selection, project naming, live timer, focus quality monitoring (based on active window and tab count), and session completion with productivity rating and notes.
- **FR-004**: System MUST store session data locally in the extension and sync to the backend periodically (at least hourly).
- **FR-005**: System MUST run background jobs to sync GitHub commits (repository name, commit hash, language, timestamp) and Google Calendar events from connected accounts.
- **FR-006**: System MUST generate weekly insights after 7+ days of data: peak performance window with multiplier, workflow pattern detection with success rate, skill detection from GitHub, and category success rates — each with a confidence score.
- **FR-007**: System MUST display a student dashboard with: Brief (greeting, performance score, recommended action, risk, opportunity), Peak Self (peak window, best metrics, daily blueprint), Insights (individual cards with confidence and recommendations), and activity history.
- **FR-008**: System MUST support cohorts: discovery, joining, anonymous aggregate metrics, and personal comparison against cohort averages.
- **FR-009**: System MUST calculate Skill Proof Scores (0–100) per skill with weighted components: hours (25%), projects (35%), quality (25%), consistency (15%).
- **FR-010**: System MUST maintain daily-updated candidate profiles with overall score, specializations, placement readiness, and opt-in visibility for company search.
- **FR-011**: System MUST support institutional onboarding: registration, subscription, CSV student import with invitation emails, and a placement dashboard showing readiness tiers, skill gaps, and company matching.
- **FR-012**: System MUST support company onboarding: registration, subscription, job search creation with skill/score/batch/location filters, ranked candidate results with match scores, interview scheduling, and hiring pipeline tracking.
- **FR-013**: System MUST send notifications for: weekly insights ready, company interest, interview scheduled, and hiring outcome.
- **FR-014**: System MUST provide role-based access: students see personal data and cohort comparisons; placement officers see their institution's students; company recruiters see opted-in candidate profiles.
- **FR-015**: System MUST support three subscription tiers for institutions (Starter, Growth, Enterprise) and three for companies (Startup, Growth, Enterprise).

### Key Entities

- **User**: A person on the platform — has a type (student/professional), profile data (goals, skill level, working hours), and connections to external accounts.
- **Session**: A tracked work period — has category, project name, start/end times, duration, focus level, quality rating, and notes. Created by the Chrome extension.
- **GitHub Activity**: A synced commit record — has commit hash, repository name, primary language, and timestamp. Created by background sync.
- **Calendar Event**: A synced schedule event — has title, start/end times, and type. Created by background sync.
- **Skill**: A named competency (e.g., "Machine Learning") — has category, difficulty level, industry demand rating, and average hours to proficiency.
- **User Skill**: A student's verified proficiency in a specific skill — has hours logged, projects completed, completion rate, focus quality, proficiency level, and skill proof score.
- **Insight**: A generated behavioral pattern — has type (peak_window, workflow_pattern, skill_detection, category_success), title, description, metric value, data points count, confidence score, and recommended action.
- **Cohort**: A group of students (by institution, batch, interest) — has name, member count, and aggregated metrics.
- **Institution**: A college/university/bootcamp — has name, type, location, subscription tier, and student counts.
- **Company**: A hiring organization — has name, industry, subscription tier, skill preferences, and minimum score thresholds.
- **Candidate Profile**: An aggregated, searchable student record — has overall skill proof score, specializations, total hours, projects, placement readiness, and visibility settings.
- **Recruiter Search**: A saved company search — has filters (skills, score, batch, location) and pipeline metrics (found, reached, interviewed, hired).
- **Job Match**: A candidate-to-search pairing — has match score, skill/experience/availability sub-scores, and pipeline status (reached → interviewed → hired).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students can complete the entire onboarding flow (signup → profile → GitHub connect → dashboard) in under 5 minutes.
- **SC-002**: 80% of active students have at least one generated insight within 10 days of signing up.
- **SC-003**: Students who view their insights return to the platform at least 3 times per week (weekly active retention).
- **SC-004**: The system generates personalized weekly insights for all qualifying users within 1 hour of the scheduled generation time.
- **SC-005**: Placement officers can import 500 students via CSV and see a populated dashboard within 10 minutes.
- **SC-006**: Company recruiters receive candidate search results within 5 seconds for searches across 10,000+ candidate profiles.
- **SC-007**: 90% of students who connect GitHub have their commit history synced within 2 hours of connection.
- **SC-008**: Skill Proof Scores correlate with actual hiring outcomes — students with scores above 80 are hired at 2x the rate of those below 60.
- **SC-009**: Institutions using the platform see measurable improvement in placement visibility (100% of tracked students have skill proof data available for companies).
- **SC-010**: Companies report at least 25% faster time-to-hire compared to traditional recruiting methods.

## Assumptions

- Users have stable internet connectivity for the web application and Chrome extension sync.
- Students use Google Chrome as their primary browser (extension is Chrome-only for v1).
- GitHub is the primary code hosting platform for target students; GitLab/Bitbucket support is out of scope for v1.
- The Chrome extension can reliably detect the active window and open tabs using standard Chrome Extension APIs.
- Email is the primary communication channel for notifications in v1; push notifications require a Progressive Web App or native app in future iterations.
- Mobile-native apps (iOS/Android) are out of scope for v1; the web application is responsive but not a native experience.
- Subscription billing and payment processing are handled by a third-party payment provider; the system manages tier assignment and feature gating.
- Data privacy compliance (GDPR equivalent for Indian market) will be addressed — student data shared with companies requires explicit opt-in consent.
- The insight generation algorithms use deterministic statistical analysis in v1; ML-based models are a future enhancement.
- Calendar integration is optional and supplementary — the core product value functions without it.
