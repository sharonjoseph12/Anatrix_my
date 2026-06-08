# Competitor comparison — what Antarix does and does not compete on

> **Audience and purpose.** This file is the honest comparison sheet we hand to recruiters, college placement officers, and prospective students who ask "how is this different from X?" The point is not to trash competitors — most of them are good at what they do — but to be specific about the five things we believe matter and where we land differently on each. The five competitors below were chosen because they are the ones the team has actually been asked about in conversations. The "what we do not compete on" section at the end is the most important part of the file: it is what stops us from getting pulled into a market we cannot win.

---

## The comparison table

| Capability | Antarix | HackerRank | LeetCode | CodeSignal | LinkedIn Skills | Handshake |
|---|---|---|---|---|---|---|
| **What it is** | Verified skill proof + placement dashboard for entry-level | Coding assessment + hiring platform for companies | Coding practice + contest platform for developers | Coding assessment + certified skills for hiring | Professional network with self-reported skills | College-to-company job board for new grads |
| **Verifiable credential standard** | W3C VC v2.0 (signed JSON, public resolution) | Closed PDF certificate | Closed PDF certificate | Closed PDF certificate | None (self-asserted) | None (self-asserted) |
| **Continuous signal vs snapshot** | Continuous (months of GitHub data) | Snapshot (90-min test) | Snapshot (per-problem) | Snapshot (90-min test) | Self-reported, no signal | Self-reported, no signal |
| **WhatsApp-native** | Yes (primary nudge channel) | No | No | No | No | No |
| **Student pays** | No, forever | No (assessments are employer-paid) | Freemium (premium tier paid) | No (employer-paid) | Freemium (premium tier paid) | No |
| **Privacy model** | Opt-in (location, search visibility) | Opt-out (employer sees all) | N/A (no employer view) | Opt-out (employer sees all) | Opt-out (profile is public) | Opt-in to employers |
| **College dashboard** | Yes (placement readiness, leaderboard, skill gap) | No | No | No | No | Yes (job board + analytics) |
| **Open API** | Yes (public, OpenAPI 3.1, webhooks) | No (closed) | No (closed) | No (closed) | Limited (closed) | Limited (closed) |
| **Source code** | Closed (open-core planned) | Closed | Closed | Closed | Closed | Closed |
| **Pricing for companies** | $500/mo startup, $2,000/mo growth, custom enterprise | Contact sales (per-test pricing) | N/A (no company product) | Contact sales (per-test pricing) | Contact sales (Recruiter Lite from ~$170/mo) | Free for schools, paid for employers |
| **Geographic focus** | India beachhead, global-ready | Global (US/India strong) | Global (US/China strong) | Global (US/EU strong) | Global | US-only |
| **Founded** | 2026 <!-- TODO: confirm founding year --> | 2009 | 2015 | 2015 | 2003 | 2014 |
| **Backed by** | TBD <!-- TODO: confirm before launch --> | JMI Equity, Sequoia | Undisclosed | Index Ventures, Menlo | Microsoft (acquired 2016) | EQT Ventures, KPCB |

<!-- TODO: verify these competitors still exist and are accurate as of launch. Specifically: (a) HackerRank's current pricing model and whether it still offers a per-test SKU, (b) LeetCode's premium tier price, (c) CodeSignal's enterprise pricing structure, (d) LinkedIn Recruiter Lite's current US price, (e) Handshake's current funding and any recent acquisitions, (f) whether HackerRank has added any verifiable credential standard to its paid tier since 2024. The founding years are taken from public sources at time of writing; double-check. -->

## How to read this table

A few of these rows deserve a sentence of context, because the cell value is not the whole story.

**Verifiable credential standard.** HackerRank, LeetCode, and CodeSignal all issue a "certificate" of some kind — usually a PDF with a logo on it. A PDF is not a verifiable credential. It is a document you can edit. Antarix issues a W3C VC v2.0, which is a JSON envelope signed by a public key on a public record. The signature is mathematically tied to the issuer. A recruiter who doubts the certificate can resolve the credential at a public URL, see the issuer's DID, and check the signature themselves. This is the structural difference between "we say this candidate passed" and "this is cryptographically signed by the platform that watched the candidate work."

**Continuous signal vs snapshot.** A snapshot assessment is a 90-minute window. The candidate knows it is happening, has had time to prepare, and is performing under stress. A continuous signal is months of work the candidate did for reasons unrelated to the assessment. The continuous signal is harder to game and closer to what the candidate will actually do on the job. Antarix is built on continuous signal. HackerRank, CodeSignal, and LeetCode are built on snapshots. LinkedIn is built on self-report, which is a third category — neither signal nor snapshot, just claim.

**WhatsApp-native.** This is the India-specific differentiator and the one that matters least in the US market. Indian students live on WhatsApp. The fact that we can deliver a daily morning nudge on the channel the student is already looking at 30 times a day is the difference between 60% retention at 30 days and 20%. The other platforms do not have this; it would be a multi-year product investment for them to add it.

**Student pays.** LeetCode has a paid premium tier. LinkedIn has a paid premium tier. HackerRank, CodeSignal, and Handshake are free for the student. Antarix is free for the student, by design and by commitment. This is not a temporary promotion.

**Privacy model.** This is the row we are most proud of and the one that is hardest to verify from the outside. Opt-in means the student affirmatively chooses what is visible. Opt-out means the default is visible and the student has to ask. The RLS policies in `027_rls_policies_002.sql` enforce this at the database, not at the UI. A recruiter who tries to filter by location will not see opted-out candidates, and the result count will not include them, so the recruiter cannot infer presence from the count.

**College dashboard.** Handshake is the incumbent here. They are good at what they do — they are a job board that connects colleges to employers, with alumni tracking. Antarix is not competing on the job board side. We are competing on the placement-readiness side — the "who is on track, who needs help" view — which Handshake does not have.

**Open API.** We are the only platform on this list that publishes a full OpenAPI spec for both the public verification endpoint and the authed issuance endpoint, with a self-contained Swagger UI at `antarix.app/api-docs`. Webhooks are documented and signed Stripe-compatible HMAC-SHA256. The others are closed or have very limited partner-only APIs.

---

## What we do not compete on

These are the three areas we are deliberately not entering. We have looked at all of them. We are choosing not to.

**Job boards.** A job board is a marketplace for listings. It is a high-volume, low-margin, sales-driven business. Handshake, LinkedIn, Internshala, Naukri, and Indeed already do this. We have no structural advantage. Our value to a student is the proof of what they can do; that proof is more useful when it is portable across many job boards than when it is locked into ours. We will, eventually, have a "one-click apply" that sends the credential to a company that has a relationship with us — but that is a distribution feature, not a marketplace.

**Full LinkedIn replacement.** A professional network is a social graph. Antarix is a verification layer. We do not want to be where people post about their weekend. We want to be where recruiters check the claim they saw on LinkedIn. If LinkedIn says "Sharon knows Python", Antarix should be the place that proves it. We are a complement to LinkedIn, not a competitor. The credential embeds in LinkedIn as a badge; that is the integration we want.

**General skill assessments.** HackerRank, LeetCode, and CodeSignal own the "test a candidate on a contrived problem in 90 minutes" market. We are not going to beat them at it. Their models are good, their question banks are deep, their proctoring is mature. We do not need to win that market because we are not solving the same problem. A snapshot test tells you whether the candidate can solve a puzzle. Our continuous signal tells you whether the candidate can ship. Both are useful. They are not substitutes.

## How to use this file

- **In a sales call:** when the prospect asks "how are you different from HackerRank?", open the table on the rows that matter to them. For a recruiter, that is "verifiable credential standard" and "privacy model". For a placement officer, that is "college dashboard" and "continuous signal". Do not read the table top to bottom.
- **On the marketing site:** this file is the long-form backing for the "What makes Antarix different" bullets on the landing page. Every bullet on the landing page should be defensible from a row in this table.
- **In a competitive situation:** if a prospect is also evaluating HackerRank or CodeSignal, do not trash them. Acknowledge that they are good at snapshot assessments, and explain why we are a different product. The goal is for the prospect to use both — us for the continuous-signal first cut, them for the final interview round — not for us to "win" the deal at the competitor's expense.
