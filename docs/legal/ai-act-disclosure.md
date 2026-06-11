# Antarix AI Act Disclosure (EU Regulation 2024/1689, Article 50)

> **Disclaimer:** This is a template prepared for the Antarix 11/10 platform. It is not legal advice and has not been reviewed by qualified counsel. The EU AI Act is being phased in between 2025 and 2027; engage counsel before relying on this disclosure for production use in the European Union.

**Effective date:** TBD
**Last updated:** 2026-06-06

This is a plain-language summary of how the Antarix placement-prediction model works, what it does, and what it does not do, published under Article 50 of the EU AI Act for users in the European Union.

## 1. What it is and what it does

The placement-prediction model is a **limited-risk AI system** under the EU AI Act. It is not "high-risk" (Annex III) and not "prohibited" (Article 5). Given a student's Skill Proof Score, score trajectory, cohort percentile, project completion rate, consistency score, and (where available) Power Mode session data, it estimates the probability of placement into a Tier-1, Tier-2, or Tier-3 company within a defined window, plus a time-to-ready estimate and a top-3 gap list. The output is shown on the student's dashboard and is **never** used for adverse decisions (loans, credit, insurance, education, housing, employment). It is a learning aid.

## 2. What data feeds it

The model uses the same personal data described in our [Privacy Notice](privacy-notice.md): GitHub commit and PR metadata (last 90 days), Google Calendar event metadata (free windows, deadline density), Power Mode session data (if installed), the derived Skill Proof Score, and anonymized cohort history. We do not feed it with caste, religion, gender, ethnicity, disability, sexual orientation, or any other Article 9 GDPR special-category data, and we do not feed it with any data the student has not already provided to the platform.

## 3. Known limitations

- **Heuristic v1, not a deep model.** The current implementation is a weighted scoring function with documented component weights. It will be replaced or augmented by a learned model once we have sufficient labelled outcome data.
- **30-day minimum.** A student with fewer than 30 days of GitHub activity sees **"Insufficient data"** instead of a number.
- **Cohort minimum.** A cohort with fewer than 30 active members returns **"Insufficient data"** for cohort-relative features. The student still sees a personal score.
- **No causal claim.** The output is a correlational probability, not a guarantee.

## 4. Human oversight and opt-out

Every prediction on the dashboard is shown with a **"Why this?"** link listing the inputs in plain English. The model has no autonomy — it cannot send messages, take actions, or change the student's account. You can disable the prediction at any time from **Settings → Privacy → Placement prediction**; the rest of Antarix (Skill Proof Score, credential, AI Coach, leaderboards) continues to work unchanged.

## 5. Robustness, accuracy, cybersecurity

Documented in [docs/architecture.md](../architecture.md). <!-- TODO: operational runbooks do not exist yet; once they do, link them here. --> We log every prediction request for 24 months to support audit and drift detection. <!-- TODO: confirm 24-month retention against the platform's overall retention policy. -->

## 6. Provider

**Antarix** — `privacy@antarix.app` — Registered address: TBD <!-- TODO: confirm entity details with founders --> — EU representative under AI Act Art 47: TBD <!-- TODO: appoint an EU representative before any EU users are onboarded. AI Act Art 47 is separate from GDPR Art 27. -->

To report a wrong, unfair, or harmful output, email `privacy@antarix.app` with the request id from the **"Why this?"** panel. We acknowledge within 5 business days and respond within 30 days.
