# Frequently asked questions

> **Audience and purpose.** This file is the public FAQ for `antarix.app/support`, the in-app help, and the sales-team's first-pass answer sheet. It is structured for skim-reading: the question, a one-line answer for someone in a hurry, and a longer answer for someone who needs to know more. The questions are split into four sections — students, recruiters, colleges, and general — because the same platform looks like a different product to each audience. The answers are deliberately short. If a question needs a 500-word answer, it probably belongs in the docs, not the FAQ.

---

## For students

### 1. Is Antarix free?

**Short answer:** Yes, forever. Recruiters and colleges pay; you do not.

**Long answer:** The student side of Antarix is and will stay free. The business model is that companies pay to search verified candidates, and colleges pay for a placement-readiness dashboard. We do not sell your data, we do not show you ads, and we do not have a "Pro" tier that hides the score behind a paywall. If we ever change this, we will give you 90 days' notice and a one-click export of everything you have built.

### 2. Can I delete my account?

**Short answer:** Yes. Settings → Privacy → Delete account. We delete everything within 90 days.

**Long answer:** Deletion is irreversible. Once you confirm, we purge your profile, your GitHub and Calendar sync data, your score history, your credential, and your messages. Audit logs are kept for 24 months as required by law, but they have your user ID scrubbed. Backups are overwritten on a 35-day rolling cycle, so the maximum time your data sits anywhere is 90 days from the day you click delete. Your credential stops resolving within 24 hours. Full details are in the [privacy notice](../legal/privacy-notice.md).

### 3. Will my recruiter see my failures?

**Short answer:** No. Only the proof is shareable. The rest is private by default.

**Long answer:** Your public credential shows your current score, your top three skills, your active streak, and a verification link. It does not show your half-finished repos, your failed contest submissions, your score from a bad month, or anything you have not opted to share. The full detail is visible only to you. Recruiters see a one-page summary. If you want to share more, you can attach specific projects or a longer transcript, but that is your choice, every time.

### 4. What does the Skill Proof Score actually mean?

**Short answer:** A 0-100 number based on the work you have already done publicly. Not a ranking against other students — a measure of consistency, depth, and breadth.

**Long answer:** The score is computed from your GitHub commit history, your calendar context (if you connected it), and your Power Mode sessions (if you installed the extension). The inputs are documented and stable: commit frequency, language mix, project completion signals, collaboration, and consistency. The score is recomputed every time we sync your data, which is every two hours for GitHub and every six hours for Calendar. It is not a personality test, not a survey, and not a coding interview. It is a number derived from work you have already done.

### 5. Do I need to install the Chrome extension?

**Short answer:** No. The extension is optional and gives you a richer view. Everything works without it.

**Long answer:** The Power Mode extension tracks your active work sessions, your focus quality, and the category of work you are doing (DSA, coding, project, learning, research). It is a 10x deeper data source than GitHub alone, and it is what unlocks the placement prediction at the highest accuracy. But every feature — score, credential, WhatsApp nudges, leaderboard — works without it. Install it when you want richer insights, not because we make you.

### 6. What is WhatsApp going to look like in my inbox?

**Short answer:** A daily morning message, a real-time nudge during your peak hours, a Sunday weekly summary, and a risk alert if you go quiet. Reply STOP to pause.

**Long answer:** The AI Coach sends four kinds of messages on WhatsApp: a morning summary at 8 AM local time, a real-time nudge 30 minutes before your historical peak window, a Sunday weekly summary, and a streak-at-risk alert if you have not committed in 48 hours. You can also text us commands: START, DONE, STATS, RANK, HELP. We do not message you outside these windows. We do not message you during exam weeks. We do not message you after you say pause. We cap messages at 20 per week per student — if you are a heavy user, the rest go to push notification.

### 7. Can my college see my data?

**Short answer:** Only aggregate metrics, and only if your college is a paid subscriber. Your individual profile is yours.

**Long answer:** If your college has a placement dashboard with us, they see cohort-level numbers: how many students are placement-ready, which skills are over- or under-supplied, which companies have expressed interest. They do not see your individual score, your individual repos, or your individual credential. The exception is if you opt in to a college's specific placement shortlist — that is an explicit action and you can revoke it.

### 8. What happens to my credential after I graduate?

**Short answer:** It stays valid. It is your proof, not your college's.

**Long answer:** Your credential is a W3C Verifiable Credential signed by our public key. The signature is independent of your enrollment status. After you graduate, the credential keeps resolving at the same URL. The score snapshot stays frozen at the value you had at the time it was issued; the live score on the verification page updates as you do more work. Your college can transition you to their alumni view, which is opt-in and shows lifetime placement outcomes — but only with your consent.

---

## For recruiters

### 9. How do I know the data is real?

**Short answer:** Every credential is a W3C Verifiable Credential. The signature is on the public record. The proof is auditable.

**Long answer:** The credential resolves at a public URL like `antarix.app/verify/<slug>`. The page shows the student's name, institution, current score, per-skill proficiency, activity totals, cohort percentile, and a "last verified" timestamp. The signature is on a JSON envelope that you can inspect, copy, and verify with standard W3C tools. The signing key is published in our `did.json` file. The score is derived from the student's actual GitHub data — their user ID is on the credential, so you can spot-check. Full technical details are in our [verification guide](../api-verification.md).

### 10. Can I filter by location?

**Short answer:** Yes, but only for candidates who have opted in to be searchable by location.

**Long answer:** Location is an opt-in field. If a student has chosen to expose their city or region, you can filter on it. If they have not, they are excluded from location-based searches and the result count does not include them — we do not leak presence in the count. This is enforced at the database level by the `candidate_profiles_recruiter_filter` policy, so it is not a UI promise, it is a schema promise.

### 11. How is this different from a coding test?

**Short answer:** Continuous, not snapshot. Based on real work, not contrived. Auditable, not a black box.

**Long answer:** A coding test is a 90-minute window in a contrived environment, with stress, with a single attempt. Our signal is months of real work, in the student's actual environment, on the problems they chose. The score is not a pass/fail — it is a 0-100 measure across multiple dimensions (commit frequency, language mix, project completion, collaboration, consistency). It is not a replacement for your interview. It is a better first cut. The full comparison is in [our methodology page](../api-verification.md#methodology).

### 12. Can I export the candidate data?

**Short answer:** Yes. CSV and JSON. Webhook for real-time events.

**Long answer:** Every recruiter account can export the candidates they have shortlisted as CSV (for ATS upload) or JSON (for pipeline integration). You can also subscribe to webhooks for events like `credential.viewed`, `invite.accepted`, and `placement.outcome`. The webhook signature is Stripe-compatible, with HMAC-SHA256. The full schema and signature scheme are in our [webhooks doc](../webhooks.md).

### 13. What if I hire someone through Antarix and they turn out to be bad?

**Short answer:** The score is a filter, not a guarantee. Your interview is still yours. We do not refund on outcome.

**Long answer:** We are selling you a better first cut, not a guarantee. The score is correlated with interview performance in our internal benchmarks, but it is not deterministic. We do not replace your judgment, your interview, your reference checks, or your probation period. What we do replace is the resume-skim stage where 90% of the filtering happens on self-reported claims. The honest framing: if you hire ten candidates from us, you should expect better hit rate than ten from a self-reported resume pile, but you should still interview all of them.

### 14. Can I see the source code of the algorithm?

**Short answer:** The methodology is public. The exact weightings are stable and documented. The source is closed for now.

**Long answer:** The inputs to the score (commit frequency, language mix, project completion signals, collaboration, consistency, cohort percentile) are documented in our [architecture doc](../architecture.md). The exact weightings are stable and listed in the [11/10 vision doc](../../ANTARIX_11_10_DEFINITIVE.md#8-skill-proof-score-how-it-works). The source code that computes the score is currently closed — it runs in our Edge Functions. We may open-core it in a future version; the scoring algorithm itself is a defensible asset, and we are not yet at the stage where we can open it without losing the business. If you need to audit the algorithm for a procurement decision, we offer a paid audit option. Contact `enterprise@antarix.app`.

### 15. What is the price?

**Short answer:** $500/month for 50 candidate views. $2,000/month for unlimited search. Enterprise is custom. Thirty-day free trial.

**Long answer:** The Startup plan is $500 per month and gives you 50 candidate profile views, basic search filters, and CSV export. The Growth plan is $2,000 per month and gives you unlimited search, API access, webhook subscriptions, and ATS integrations. Enterprise pricing is custom and includes a dedicated success manager, an SLA, and on-premise options for regulated industries. There is no per-hire fee. There is no placement fee. The thirty-day free trial needs an email and a company domain; we do not require a credit card to start.

### 16. What if Antarix shuts down?

**Short answer:** Your data exports in one click. Your integrations move to a successor tool. Your contracts are honoured for 90 days minimum.

**Long answer:** If we shut down or get acquired, you get a 90-day notice, a full export of your data in CSV and JSON, and a written commitment that any successor honours your existing contract for at least 90 days. Our verifiable credentials are signed by a public key we publish in `did.json`, so even after we shut down, the credentials remain cryptographically verifiable. The only thing that stops working is the live dashboard; the historical record does not. This is a real commitment in our [terms of service](../legal/terms.md) — it is not a marketing line.

---

## For colleges

### 17. Do you integrate with our LMS?

**Short answer:** Not yet. We have a public API; Moodle, Canvas, and Google Classroom integrations are on the roadmap for 2027.

**Long answer:** Antarix v1 does not read or write to your LMS. The data we collect comes directly from the student's GitHub and Google Calendar, with the student's explicit consent. We do not need LMS access to compute the score. We do, however, plan to add single-sign-on and roster sync with the major LMSes in 2027, so your students do not have to remember another password and your IT team does not have to provision accounts by hand. The public API is live now — you can pull cohort-level metrics into your own dashboard at `/functions/v1/recruiter-search` (with the right API key). Docs are at `antarix.app/api-docs`.

### 18. What about non-CS students?

**Short answer:** Antarix v1 is CS-focused. Design, data, and product tracks are planned for 2027.

**Long answer:** The score is built on GitHub activity, which is overwhelmingly a CS signal in 2026. We are honest about that. We are also honest that this leaves out the design student, the mechanical engineering student, the biotech student, and everyone whose work does not show up on GitHub. We have a roadmap to add design (Figma / Behance), data (Kaggle / Observable), and product (case-study platform) tracks in 2027. The Skill Proof framework is signal-agnostic — the same scoring principles work for any consistent, verifiable work output. We are starting with CS because that is where the data is, and that is where our placement-officer customers are seeing the most value.

### 19. Will our students' data be sold to recruiters?

**Short answer:** No. Aggregate metrics are sold. Individual profiles are visible only to recruiters the student has explicitly accepted an invite from.

**Long answer:** The college pays for a placement-readiness dashboard. That dashboard shows aggregate numbers — placement-ready count, skill gap, cohort ranking, company match suggestions. The college does not pay for access to individual student profiles; that is the student's decision. A recruiter can search for a candidate only if the candidate has opted in to company search visibility. A college cannot bulk-export its students' profiles to a recruiter, and a recruiter cannot bulk-import a college's roster. The data boundary is enforced at the database level, not at the UI.

### 20. How is cheating handled?

**Short answer:** The system flags it. The college decides what to do.

**Long answer:** The platform does not let students self-report skills or edit their credential. The credential is signed from underlying GitHub data. We run three classes of checks: (1) volume anomalies — a sudden 10x spike in commits in a 7-day window is flagged; (2) repo anomalies — a brand-new repo with a populated commit history older than the repo is flagged; (3) pattern anomalies — commits that look automated (uniform timestamps, no human variation) are flagged. The college sees flagged profiles on the dashboard with a "review needed" badge. The college decides whether to investigate, contact the student, or escalate. We do not auto-ban.

### 21. What about students who opt out?

**Short answer:** They are excluded from all company searches and from all aggregate counts that could leak their presence.

**Long answer:** A student can opt out of company search visibility at any time, from Settings → Privacy. When they do, they disappear from recruiter search results, from the company's match lists, and from the cohort's "placement-ready" counts. The college sees the opt-out rate, not the opt-out list. This is the same privacy-by-default model we use for location filtering, and it is enforced at the database level — the college cannot work around it by exporting a CSV, and a recruiter cannot work around it by inferring from result counts.

### 22. How much does it cost?

**Short answer:** ₹50,000 per year for up to 500 students. ₹1,50,000 for up to 2,000. Enterprise is custom.

**Long answer:** The Starter plan is ₹50,000 per year and includes the placement-readiness dashboard, the leaderboard, the skill-gap report, the company-match recommendations, and CSV export. The Growth plan is ₹1,50,000 per year and adds API access, custom aggregations, alumni tracking, and a dedicated success contact. Enterprise (₹5,00,000+) adds on-premise deployment, custom data residency, an SLA, and integration with your LMS or SIS. There is no per-student fee. There is no setup fee for the first year. We will not charge a college for students who have opted out.

### 23. Can we trial it before we commit?

**Short answer:** Yes. A 30-day pilot with up to 50 students is free. No procurement, no contract.

**Long answer:** We run pilots. You pick up to 50 students (we recommend a mix of years and skill levels), we set them up, you use the dashboard for 30 days, and you decide. If you do not see value, you walk away with no paperwork. If you do, the pilot fee is credited against your first year. The pilot does not auto-convert to a paid plan. We send a renewal form, you sign or you do not. The point of the pilot is to make the decision with data, not to lock you in.

### 24. Will this affect NIRF ranking?

**Short answer:** Indirectly, yes. We report aggregate metrics that are useful inputs to NIRF placement reporting.

**Long answer:** Antarix does not file NIRF reports for you, and we do not guarantee a NIRF ranking change. What we do is give you cleaner data for the reports you already file: placement rate by branch, median tier, time-to-placement, skill mix of placed vs. unplaced students. If your NIRF score improves because more students are placement-ready, that is correlation, not causation — but it is the kind of correlation placement officers tell us they want to track. We also do not share individual student data with NIRF, AISHE, or any government body, unless you ask us to in writing.

---

## General

### 25. What is Antarix?

**Short answer:** A verified skill proof platform. We turn real work — your GitHub commits, your contest submissions, your consistency — into a shareable credential that recruiters and colleges can verify in 10 seconds.

**Long answer:** Antarix is a three-sided platform. Students connect GitHub and Google Calendar; we compute a Skill Proof Score and a placement prediction; they share a verifiable credential with recruiters or colleges. Colleges get a placement-readiness dashboard for their cohort. Recruiters get a search engine for verified, not self-reported, candidates. The whole thing runs on a public API, the credentials are W3C-compliant, and the business model is that companies and colleges pay, students do not. We are based in India, we are targeting Indian students in higher education as the beachhead market, and we are open about the things we are not (we are not a job board, we are not a LinkedIn replacement, and we are not a general skill assessment).

### 26. Where is my data stored?

**Short answer:** In the region closest to you. India for Indian users, EU for EU users, US for everyone else. We do not transfer across regions without a legal basis.

**Long answer:** Antarix data is stored on Supabase, in `mumbai` for India, `eu-central-1` for EEA / UK / Switzerland, and `us-east-1` for everywhere else. Cross-border transfers rely on the EU–US Data Privacy Framework for certified US recipients, Standard Contractual Clauses as a fallback, and for transfers out of India, we transfer only to recipients not on the negative list under Section 16 of the DPDP Act 2023. The full sub-processor list (Supabase, Meta, Google Calendar API, GitHub, web push, email, observability) is in [sub-processor-list.md](../legal/sub-processor-list.md).

### 27. What if Antarix shuts down?

**Short answer:** You get a 90-day notice, a one-click data export, and a written guarantee that any successor honours your existing contract for at least 90 days.

**Long answer:** If we shut down or get acquired, you get 90 days' notice and a full export of your data in CSV and JSON. Any successor honours your contract for at least 90 days. The verifiable credentials are signed by a public key we publish in `did.json`, so even after shutdown, the historical credentials remain cryptographically verifiable. The only thing that stops working is the live dashboard; the historical record does not. This is a real commitment, not a marketing line — it is in our [terms of service](../legal/terms.md). The terms also say that if we ever change the data model in a way that breaks your existing exports, we will provide a transition tool for at least six months.

---

## What this FAQ does not cover

- **Pricing for student-side premium features:** there are none, by design.
- **API rate limits:** these change, so they live in the [API docs](../api-verification.md), not here.
- **Specific security incidents:** these are reported on `/status.html` and in our [security.txt](../../apps/web/public/.well-known/security.txt).
- **Roadmap items beyond 2027:** we have not committed to a roadmap past 2027, so we will not pre-announce in the FAQ.

If a question is missing that you think should be here, email `support@antarix.app` and we will consider it for the next refresh.
