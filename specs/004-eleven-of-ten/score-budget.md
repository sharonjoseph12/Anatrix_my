# Score Contribution Budget — Antarix Skill Proof Score

**Status**: Cross-cutting design (lives in 004 folder because 004 owns the score aggregator)
**Constitutional backing**: Principle III (Cost-Aware) + principle VI (Feature-Flagged Rollout)
**Applies to**: every feature that proposes a new signal source or weight on the Skill Proof Score

---

## Total Budget

| Direction | Cap | Notes |
|---|---|---|
| **Upside additions** | **+25%** (capped server-side) | All new signal sources combined cannot add more than 25 percentage points to any student's score |
| **Defensive deductions** | **-100%** (uncapped) | Anti-cheat can zero out a student's score if the cheat score is high enough |
| **Per-feature cap** | (varies) | See table below |
| **Per-tenant cap** | (admin-overridable) | A college admin can tighten per-feature caps for their cohort |

---

## Per-Feature Cap Table

| Feature | Signal | Cap | Justification |
|---|---|---|---|
| 002 (verified skill platform) | Skill Proof base | 100% (foundation) | The score itself |
| 003 (engage & showcase) | Streak weight | (inherits from 002 base) | Engagement, not a signal |
| 004 | Faculty grading | +10% | Human-in-the-loop, high signal-to-noise |
| 004 | Mock-interview rubric | +5% | Active validation, LLM-costed |
| 004 | Anti-cheat (defensive) | -100% uncapped | Cheat-score-driven deduction |
| 004 | Next-best-skill (engagement) | 0 (no score impact) | Retention loop, not a signal |
| 005 | Auto-apply (engagement) | 0 (no score impact) | Monopolizes the credential, not the score |
| 005 | Global leaderboard | 0 (consumes score) | Display only, not a signal |
| 006 | IDE telemetry | +3% | Aggregates only; opt-in; anti-cheat too |
| 006 | Biometrics | +2% | Aggregates only; opt-in; peak-window refinement |
| 007 | Alumni mentorship | 0 (engagement) | Not a signal |
| 007 | Daily curriculum | 0 (engagement) | Not a signal |
| 008 | Teamwork score | +5% | Anti-collusion gated |
| 008 | Recruiter observe | 0 (audit only) | Not a signal |
| 009 | On-chain mirror | 0 (mirror, not signal) | Trust propagation, not scoring |
| 010 | AI Talent Twin | 0 (insight surface, not signal) | RAG Q&A + authorship proof badge |
| **TOTAL upside** | | **+25%** | **004 (15) + 006 (5) + 008 (5)** |

---

## Server-Side Enforcement

The score aggregator (`apps/web/src/lib/algorithms/score-aggregator.ts`, in 002) is the single source of truth. It MUST:

1. Read each per-feature cap from a config row (`feature_flags` table, JSON column).
2. Apply each contribution as `min(raw_contribution, cap)`.
3. Sum all contributions; cap total upside at +25%.
4. Apply anti-cheat deduction AFTER all additions (defensive layer).
5. Emit a `score_audit` row for every recompute with per-feature contribution breakdown.

If a feature tries to add a contribution that exceeds its cap, the aggregator MUST:
- Cap the contribution
- Log a `score_audit` warning row tagged `cap_hit`
- Return the capped value, never the raw value

If total upside exceeds +25% (e.g. a power user with all signals on), the aggregator MUST:
- Apply a pro-rata reduction across all features until the total is ≤ +25%
- Log a `score_audit` warning row tagged `total_cap_hit`
- Return the reduced value

---

## Admin Override

A college admin (via the (college) admin portal) can:
- Tighten per-feature caps for their cohort (e.g. "faculty grading max +5%" instead of +10%)
- Disable a feature entirely for their cohort (delegated to the feature flag toggle)
- View the per-feature breakdown for any student in their cohort

A student (via the privacy center, 006) can:
- Disable a signal source entirely (eliminates that feature's contribution to 0)
- View their per-feature contribution breakdown

---

## Versioning

This budget is a v1 design. If Y3 scale requires loosening the +25% cap, it MUST be done via a constitution amendment (Principle I: Additive-Only Schema + Principle III: Cost-Aware), not a code change.
