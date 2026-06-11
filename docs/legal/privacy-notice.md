# Antarix Privacy Notice

> **Disclaimer:** This is a template prepared for the Antarix 11/10 platform. It is not legal advice and has not been reviewed by qualified counsel. Engage a privacy lawyer licensed in each jurisdiction where you have users before relying on this document for production use.

**Effective date:** TBD
**Last updated:** 2026-06-06

This notice explains what personal data Antarix collects, why, who we share it with, and the rights you have over it. It applies to `antarix.app`, the Power Mode Chrome extension, the verify portal, and the college and company portals.

## 1. Who is the controller

The data controller is:

**Antarix** — `privacy@antarix.app` — Registered address: TBD <!-- TODO: confirm entity name, registered address, company number with founders before public launch -->

- **EU representative under Art 27 GDPR:** TBD <!-- TODO: appoint an EU representative before any EEA users are onboarded -->
- **Grievance Officer (DPDP Act 2023):** TBD <!-- TODO: publish name, email, and postal contact for the Grievance Officer -->

## 2. What personal data we collect

We collect the minimum data we need to power the product.

**Account data**
- Email address, display name, hashed password (email sign-up only; we never store plain text)

**Profile data**
- Stated goals, self-declared skill level, optional institution, time zone and approximate locale

**GitHub data** (only if you connect GitHub)
- User ID, username
- Public commit metadata: hash, repository, branch, author, timestamp, file change counts, additions, deletions
- Repository metadata: name, primary language, stars, forks, private/public flag, README/CI/releases presence
- Pull request metadata: id, status, merged-at, review state
- We store **no more than the first 200 characters of a commit message** and never read code diffs beyond aggregate counts
- We do not read issues, issue comments, or discussion posts
- We never log into GitHub on your behalf beyond the OAuth scopes you grant

**Google Calendar data** (only if you connect Google Calendar)
- Event metadata: id, start, end, title, attendee count, your RSVP status
- Derived flags we compute: `is_class`, `is_deadline`, `is_study_group`, `is_free_window`
- We do **not** read event descriptions, attachments, conference links, the email addresses of other attendees, or any free-text content
- We never create, modify, or delete events on your calendar

**Power Mode extension data** (only if you install the extension)
- Work sessions: start, end, category (DSA, Coding, Project, Learning, Research), self-rated focus quality (1–5), optional short note
- Aggregate window- and tab-focus samples; we do not capture the content of any tab
- Extension version and heartbeat timestamps

**Skill Proof outputs**
- 0–100 Skill Proof Score, per-skill proficiency, weighting profile (passive vs. Power Mode), contributing components
- Placement prediction: 0–100 probability, predicted company tier, time-to-ready, top-3 gap items
- "Last verified" timestamp on any exportable credential

**Communications**
- WhatsApp phone number and bot message contents
- Web push subscription endpoint and key
- Transactional emails we send you (account, security)

**Usage telemetry**
- Dashboard visits, feature clicks, device metadata
- Error and performance events (see the sub-processor list for the current observability provider)

## 3. Why we use it (purposes and lawful basis)

| Purpose | Lawful basis under GDPR Art 6 |
|---|---|
| Operating the platform: score, credential, college and company portals | Art 6(1)(b) contract, and Art 6(1)(f) legitimate interest |
| WhatsApp nudges and bot interactions | Art 6(1)(a) explicit consent (opt-in from the dashboard) |
| Web push notifications | Art 6(1)(a) explicit consent (browser permission prompt) |
| Issuing and verifying Skill Proof credentials | Art 6(1)(b) contract |
| Aggregated, anonymized analytics (with k-anonymity thresholds) | Art 6(1)(f) legitimate interest |
| Security, fraud prevention, abuse detection | Art 6(1)(f) legitimate interest |

Where we rely on legitimate interest, you can object at any time (see §7).

## 4. Who we share data with

We do not sell personal data. We share it only with vetted sub-processors acting on our written instructions: **Supabase** (hosting), **Meta / WhatsApp Business API** (nudges you opted into), **Google Calendar API** (event sync you authorized), **GitHub OAuth + API** (commit/PR sync you authorized), a **VAPID-compatible web push provider** (the default is your browser vendor's push service), an **email provider** TBD <!-- TODO: pick Postmark / Resend / SES and sign a DPA before launch -->, and an **observability provider** TBD <!-- TODO: Agent A-3's wrapper is provider-agnostic. Pick Sentry or Datadog and sign a DPA before launch -->. The full list with locations, data shared, and opt-out paths is in [sub-processor-list.md](sub-processor-list.md).

## 5. International data transfers

We store data in the region closest to you:
- **EEA, UK, Switzerland** → `eu-central-1`
- **India** → Mumbai region
- **Elsewhere** → `us-east-1` (we will add regions as user density justifies)

Cross-border transfers rely on:
- The **EU–US Data Privacy Framework** (and UK / Swiss extensions) for certified US recipients
- **Standard Contractual Clauses (SCCs)** as a fallback, with a Transfer Impact Assessment on file
- For transfers out of India, we transfer only to recipients not on the negative list issued under Section 16 of the DPDP Act 2023

## 6. How long we keep data

| Data | Retention |
|---|---|
| Account profile, connections, score, prediction | Until you delete your account, plus 90 days for audit and recovery |
| Raw GitHub commit / PR rows | 24 months, then aggregated into monthly buckets |
| Raw Calendar event rows | 12 months, then aggregated into weekly free-window statistics |
| Power Mode session rows | 18 months |
| WhatsApp bot message content | 12 months; aggregated command counts kept indefinitely |
| Audit logs (who accessed what, when) | 24 months |
| Anonymized, aggregated metrics | Indefinitely — they cannot be linked back to you |
| Backups | 35 days rolling, then overwritten |

## 7. Your rights and how to exercise them

You have the right to access, rectify, erase, port, restrict, object, withdraw consent, and lodge a complaint with your supervisory authority.

To exercise any of these, go to **Settings → Privacy** in the app, or email `privacy@antarix.app`. We respond within **30 days** (extendable by up to 60 days for complex requests, with notice).

## 8. Children

Antarix is for users **18 or older**. We do not knowingly collect data from anyone under 18. If we discover an under-18 user, we delete their account and all associated data within **7 days**. Parents or guardians: email `privacy@antarix.app` for immediate deletion.

## 9. Automated decision-making

The placement prediction on your dashboard is generated automatically. It is a **learning aid only** — we never use it for adverse decisions (loans, credit, insurance). You can:
- See exactly which inputs fed your prediction (click **"Why this?"** on the placement card)
- Opt out from **Settings → Privacy → Placement prediction**; the rest of the product, including the Skill Proof Score and credential, remain fully functional

### 9.1 AI Talent Twin — automated answer approval

When a recruiter submits a question to your AI Talent Twin, a draft answer is held in a pending state and surfaced to you on your **Pending Answers** page. You have **24 hours** to review that answer and choose to approve it as-is, edit it before releasing it, or reject it entirely.

If you take no action within 24 hours, the answer is **automatically approved** and released to the recruiter. This is the only automated decision the AI Talent Twin feature makes without your active input. It does not affect your Skill Proof Score, your credentials, or any other aspect of your account.

You can disable this feature at any time by opting out of the AI Talent Twin (see §10 below). You can also exercise your right to erasure under §7 to delete all twin data before or after any answer auto-approves.

This automated decision falls within the scope of **EU GDPR Article 22** and equivalent provisions of the **DPDP Act 2023**. Because the decision produces no legal or similarly significant effect on you beyond controlling what answer text a recruiter receives, we rely on it being necessary for the performance of the service you have explicitly opted into. You retain the right to request human review of any auto-approved answer by contacting `privacy@antarix.app`.

## 10. AI Talent Twin — data processing details

The AI Talent Twin is an **opt-in only** feature. It is inactive unless you explicitly enable it from **Settings → AI Talent Twin** (database flag `talent_twin_opt_in = true`). Students on the platform who have not opted in have no Talent Twin data collected or processed, and recruiters receive an `access_denied` response for any query scoped to them.

### 10.1 What we process and how

When you opt in, the embedder pipeline processes your GitHub commits, IDE sessions (if you have the extension installed), collaborative coding sessions, and mock-interview transcripts into text chunks. Each chunk is converted to a vector embedding and stored in `talent_twin_chunks`. The raw source text is retained only to the extent it was already stored under the relevant feature (e.g., commit metadata under §2). No additional copies of your source artefacts are created by the Talent Twin pipeline.

When a recruiter asks a question, the following occurs:

1. **Question hashing.** The recruiter's raw question text is hashed using **SHA-256** before any value is written to the audit log (`talent_twin_qa_log`). Only the hex digest is stored in the log — the plaintext question is never persisted in audit storage. This means that even if the audit log were disclosed, the question cannot be reconstructed from the stored value.

2. **Answer generation.** The question is used in memory to perform a vector similarity search over your chunks and to prompt the large-language model. The generated answer, together with the original question text, is written to `answer_preview` so that you can review it on your Pending Answers page.

3. **Student review window.** You may inspect the full question text and the generated answer in `answer_preview` and take one of three actions: approve, edit the answer before approving, or reject. This is the only location where the plaintext question is stored, and it is accessible only to you.

4. **Auto-approval.** If you take no action within 24 hours, the answer status transitions to `approved` automatically (see §9.1). After approval — whether by you or by the timer — the answer is returned to the recruiter. The plaintext question in `answer_preview` is retained for the period described in §6 so that you can audit which questions were asked about you.

### 10.2 Recruiter question confidentiality and the hashing guarantee

The SHA-256 hashing step described above is a deliberate privacy control. Its purpose is to ensure that the question a recruiter asks about you cannot be read by Antarix staff or disclosed in a data-subject access response, even though a record that a question was asked (with a hash fingerprint, timestamp, and recruiter identifier) is retained for security and abuse-prevention purposes. If you submit a data access request, you will receive the hash digest and timestamp; you will not receive the plaintext question because we do not hold it outside of `answer_preview`.

### 10.3 Opting out and erasure

You may opt out of the AI Talent Twin at any time from **Settings → AI Talent Twin → Disable**. Opting out triggers **immediate deletion** of all your vector chunks via the `delete_student_chunks` database function. Your `answer_preview` rows and the hashed `qa_log` rows are retained for the standard audit-log period (24 months, see §6) and then deleted, because they form part of the security audit trail.

To request erasure of all Talent Twin data, including `answer_preview` and audit-log rows before the end of the standard retention period, use the **Settings → Privacy → Request erasure** flow or email `privacy@antarix.app`. Erasure requests for Talent Twin data are processed within 30 days under both GDPR Art 17 and DPDP Act 2023 §13.

### 10.4 Lawful basis

| Processing activity | Lawful basis (GDPR Art 6) | DPDP Act 2023 basis |
|---|---|---|
| Storing and embedding your work artefacts into Talent Twin chunks | Art 6(1)(a) explicit consent (opt-in toggle) | §7(a) consent |
| Answering recruiter questions using your chunks | Art 6(1)(a) explicit consent | §7(a) consent |
| Retaining hashed question log for security and abuse prevention | Art 6(1)(f) legitimate interest | §7(j) legitimate use |
| Retaining `answer_preview` rows for your review and audit | Art 6(1)(b) contract (necessary to provide the review feature you opted into) | §7(b) contractual necessity |
| Auto-approving answers after 24 h (see §9.1) | Art 6(1)(b) contract; Art 22(2)(a) necessary for service | §7(b) contractual necessity |

## 11. DPDP Act 2023 and GDPR Art 22 compliance

### 11.1 India — Digital Personal Data Protection Act 2023

All AI Talent Twin processing is designed to be consistent with India's **Digital Personal Data Protection Act 2023 (DPDP Act)**:

- **Consent.** Processing begins only on the basis of a freely given, specific, informed, and unambiguous consent notice presented at the point of opt-in, as required by §7 of the DPDP Act. You can withdraw consent at any time without detriment to your use of other platform features.
- **Purpose limitation.** Talent Twin data is used solely to respond to recruiter questions within the platform and to generate authorship badges you choose to issue. It is not used for profiling, advertising, or any purpose beyond what is described in this notice.
- **Data minimisation.** Only vector embeddings and the metadata strictly necessary for citation are stored; source code text is not duplicated.
- **Grievance Officer.** Complaints regarding AI Talent Twin processing may be directed to the Grievance Officer listed in §1.
- **Right to erasure (§13).** You may request deletion of all your Talent Twin data at any time via the erasure endpoint or the Settings panel. Erasure is fulfilled within 30 days.

### 11.2 EU/EEA — GDPR Article 22 (automated individual decision-making)

The auto-approval mechanism described in §9.1 is subject to **GDPR Article 22**. We take the following position:

- **Applicability.** The automated approval of a recruiter answer is a decision based solely on automated processing. We consider that it does not, in the ordinary case, produce a legal effect or a similarly significant effect on the student, because the student has already opted into the feature and the decision merely determines whether a text answer is visible to a recruiter.
- **Safeguard.** Even so, we implement the Art 22(2)(a) safeguard: the auto-approval is **necessary for the performance of the contract** (the Talent Twin service) and the student has provided explicit consent to the 24-hour review window at opt-in. We also implement a meaningful human-review right: you may contact `privacy@antarix.app` at any time to contest or retract an auto-approved answer.
- **Transparency.** The existence, logic, and timing of the auto-approval mechanism is disclosed in this notice and in the product UI before you opt in.

## 12. Changes to this notice

Material changes are announced at least 14 days before they take effect, with a dashboard banner and an email. Non-material changes (typos, clarifications, a new sub-processor on the same terms) take effect immediately.

## 13. Contact

`privacy@antarix.app`
