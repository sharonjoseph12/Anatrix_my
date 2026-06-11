# Three personas — what to say to whom

> **Audience and purpose.** This file is the working brief for anyone at Antarix who has to talk to a real human in 60 seconds or less — sales calls, campus visits, conference booths, demo days, the support inbox. It gives a one-page profile of each of our three primary audiences, what they care about, what they are afraid of, the pitch we open with, the objections we hear most, and the single CTA that closes the conversation. The personas are named (Riya, Arjun, Dr. Sharma) to make them easier to remember; the names are fictional but the concerns are real, lifted from conversations the team has had.

---

## Persona 1 — The student: Riya, 3rd-year CSE, IIT Hyderabad

**The short version.** Riya is in the middle of placement season. She has 200 applications out, 3 callbacks, and a CV she rewrote seven times. She does not want to write a portfolio. She wants the recruiter to look at her for 30 seconds and see that she can actually code.

### What she cares about

- Getting placed. Not getting famous. Not "building a personal brand".
- A callback that turns into an offer, not a callback that ends in a rejection email three weeks later.
- Not wasting time. Every hour spent on a portfolio is an hour not spent on DSA.

### What she fears

- Looking unprepared next to the guy who has 5 GitHub repos with 200 stars.
- Getting filtered out by an ATS that did not even read her resume.
- Saying she knows Python and then freezing in the first round.
- Her college placement officer asking why her score dropped this month.

### The 60-second pitch

> "Link GitHub. Build stuff. We watch. You share a credential that proves you can ship. Free. WhatsApp-native, so you do not have to install a thing."

### Objections she will have

**"Will my recruiter see my failures?"**
No. The credential shows the proof — your best 30 days, your current streak, your top three skills, and a public verification link. It does not show your half-finished repos, your failed submissions, or your score from the month you were sick. The things you have not opted to share are not visible to anyone.

**"Is this LinkedIn for nerds?"**
No. LinkedIn is self-report — you write a list of skills and hope someone believes you. Antarix is the opposite. We do not take your word for it. We watch what you actually do, and we sign the result with a W3C Verifiable Credential that any recruiter can audit. The whole point is that the proof is not yours to edit.

**"What if my GitHub is empty?"**
The credential will say so, honestly. No fake score. We will show you the gap — what you would need to add to reach a placement-ready threshold — and you can decide whether to work on it. An empty credential is better than a padded one.

**"Will it cost me marks if I stop using it?"**
No. Your credential only updates when you do. If you take a semester off, it does not decay into a bad score. The system shows the last verified date and what was true then. It does not punish you for resting.

### The single CTA

**"Get your proof"** → `/signup` — three-minute onboarding, no payment, no card.

---

## Persona 2 — The recruiter: Arjun, founding engineer turned talent lead at a 50-person startup

**The short version.** Arjun was a developer for eight years. He is now the person who has to read 500 resumes for five entry-level backend roles, run five interviews, and ship two hires before the quarter ends. He does not have a talent-acquisition team. He has a spreadsheet and a prayer. He has been burned by candidates who interviewed well and could not ship.

### What he cares about

- Filtering 500 applications to 5 interviews, in the time it used to take him to filter 50.
- Predicting, before the first call, whether a candidate can actually write code under deadline pressure.
- Not getting sued. Every filter he applies is a potential bias claim, and he knows it.
- A defensible signal he can show to his CEO and his board.

### What he fears

- A bad hire that costs six months of onboarding and a quarter of engineering velocity.
- A bias lawsuit from a candidate who was filtered out by a model he cannot explain.
- Building his whole pipeline on a tool that gets acqui-hired and shut down next year.
- Paying $2,000/month for a tool that just rebrands the same white-label assessment he could buy for $200.

### The 60-second pitch

> "Antarix is a verified-skill filter for entry-level. See proof of work, not claims. Continuous signal, not a 90-minute coding test on a Saturday. Thirty-day free trial, no credit card."

### Objections he will have

**"How is this different from a coding test?"**
Three ways. First, it is continuous — we watch what they actually built over months, not what they produced in 90 minutes under pressure. Second, it is based on real work, not contrived algorithmic puzzles. Third, it is auditable — every credential is a W3C Verifiable Credential with a signature on a public record, so if a candidate disputes a score, you can show them the proof. A coding test is a black box. This is a signed document.

**"Is the data accurate?"**
Yes, and you can verify it yourself. The credential resolves at a public URL with a JSON envelope. The signature is signed by our published EdDSA key. The candidate's GitHub user ID is on the credential. The score has a "last verified" timestamp. If a candidate says "that is not me", the URL proves it is. If a candidate says "the score is wrong", the snapshot is frozen and you can compare to the current live score.

**"What about bias?"**
We publish the inputs to the score. They are: commit frequency, language mix, project completion signals, collaboration, consistency, and a cohort percentile. There is no name, no photo, no college tier, no gender, no date of birth in the matching algorithm. The only demographic we expose is the one the candidate has chosen to expose, and location is opt-in. You can read the full model in our security docs.

**"What if I hire someone and they are bad?"**
The score is not a guarantee. It is a filter. The interview is still yours. What we are selling is the part of the funnel where you go from 500 resumes to 5 interviews with much higher hit rate. We do not replace your judgment. We just make the first cut more honest.

**"What if you shut down?"**
The credentials are W3C Verifiable Credentials. They are signed by a public key we publish in `did.json`. If we shut down, the credentials remain verifiable by anyone holding the public key. The data is yours to export. We will give you 90 days' notice and a one-click export.

### The single CTA

**"See a sample search"** → `/company/signup` — thirty-day free trial, no credit card, no commitment.

---

## Persona 3 — The college placement officer: Dr. Sharma, IIIT Bangalore

**The short version.** Dr. Sharma runs placement for 1,200 students across CSE, ECE, and IT. She reports to the director, who reports to the board, who cares about NIRF ranking and the percentage of students placed in Tier-1 companies. She has been doing this for 14 years. She has seen at least three "AI placement platforms" come and go. She is interested, but she is not going to be sold in a 10-minute demo.

### What she cares about

- Hitting the 95% placement number the board expects, every year.
- Catching the students who are about to fall through the cracks in March.
- Knowing which companies to invite for campus drives, based on real data, not the same five companies her predecessor invited in 2015.
- NIRF. Tier-1 vs Tier-2 vs Tier-3 classification. Median salary.
- Her own job security. If NIRF drops, the director asks questions.

### What she fears

- A cheating scandal. Fake internships, purchased GitHub histories, profile inflation. One bad story in the press and the entire placement season is in jeopardy.
- Missing the student who needed help. The quiet second-decile student who never raises a hand, never goes to office hours, and then does not get placed.
- Spending ₹5,00,000 on a tool that gives her a dashboard she has to teach 200 students to use.
- Being on the hook for a vendor that locks her data in.

### The 60-second pitch

> "Antarix is a placement-readiness dashboard for your cohort. See who is on track, who needs help, and who the companies want to interview. Aggregate metrics only — no PII leaves your institution unless a student opts in. ₹50,000 per year for up to 500 students."

### Objections she will have

**"Will students opt out?"**
Some will. That is fine. We will tell you your opt-out rate, by year and branch, on the dashboard. Opt-outs are not a failure signal — they are a data point. Most students opt in once they see the credential is a placement asset. In our pilot cohort, the opt-in rate was 76% within the first 30 days.

**"What about NIRF?"**
We report aggregate metrics — placement rate, median tier, cohort skill mix — that are useful inputs to NIRF reporting. We do not share individual student names with third parties. We do not allow companies to scrape your student list. The data is yours. You can export the whole thing as a CSV at any time.

**"What about cheating?"**
This is the most important question, and the answer is: it is structurally hard. We do not let students self-report skills. We do not let students edit their credential. The credential is signed by our key from the underlying GitHub data, and any unusual pattern (a sudden 10x spike in commits, a repo that did not exist a week ago) is flagged for review. We also let colleges see the full audit trail of every score change.

**"What if our students' data is on it after they leave?"**
Graduates transition to the alumni view. You see lifetime placement outcomes (with the graduate's consent). The data is yours for the cohort. When you stop paying, you get a full export and we delete our copy within 90 days.

**"Will my placement team have to learn a new tool?"**
There is a one-hour onboarding for placement officers. The dashboard is a single page with three segments (Ready Now, Development Path, Early Stage), a leaderboard, a skill-gap report, and a company-match list. That is the entire surface. If your team can use Google Sheets, they can use this.

### The single CTA

**"Book a 30-minute demo"** → `/institution/signup` — live walkthrough with the founding team, no slide deck, no sales engineer in between.

---

## How to use this file

- **Sales calls:** open with the 60-second pitch, then go straight to the objection the prospect is most likely to be thinking. Do not cover all five objections on a first call.
- **Campus visits:** use the student pitch and the placement-officer pitch back-to-back. They have different vocabularies. Respect that.
- **Support inbox:** when a student emails, they are Riya. When a recruiter emails, they are Arjun. When a college emails, they are Dr. Sharma. Same product, three different anxieties.
- **Marketing copy:** every line of copy that goes out the door should be readable by at least one of these three people without translation. If it requires explaining, it is the wrong line.
