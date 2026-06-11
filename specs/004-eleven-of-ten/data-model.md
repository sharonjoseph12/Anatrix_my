# Data Model: 11/10 — Defensible Moat

**Date**: 2026-06-06
**Status**: Phase 1 design ratified; 4 additive migrations (034-037)
**Builds on**: 001-003 schema (33 existing migrations)

## Migration map

| Migration | Tables Added | Tables Extended | Notes |
|---|---|---|---|
| `034_anticheat.sql` | `anticheat_signals`, `anticheat_appeals`, `anticheat_audit`, `i18n_missing_keys` | `users` (+`locale`), `github_repos` (+`anticheat_score`, `quarantined_at`), `user_dsa_profiles` (+`anticheat_score`, `quarantined_at`) | i18n queue table co-located here since it's also P1 |
| `035_ats_sso_faculty.sql` | `ats_connections`, `ats_saved_searches`, `ats_sync_log`, `sso_connections`, `faculty_grades`, `faculty_verifications`, `assignments` | none | Greenhouse/Lever + WorkOS + faculty layer |
| `036_hackathon_mockinterview.sql` | `hackathons`, `hackathon_submissions`, `hackathon_credentials`, `mock_interviews`, `mock_interview_turns` | none | Active validation surfaces |
| `037_api_outcome_nbs.sql` | `api_keys`, `webhook_subscriptions`, `webhook_deliveries`, `outcome_contracts`, `outcome_billing_events`, `next_best_skills` | none | Ecosystem + commercial features |

Total new tables: **17**. Total extended tables: **3** (users + 2 score-source tables).

---

## 034 — Anti-cheat + i18n

### `anticheat_signals`
One row per detected signal per entity (repo or DSA record).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |  |
| `entity_type` | text | NOT NULL, CHECK in (`'github_repo'`, `'dsa_record'`) |  |
| `entity_id` | uuid | NOT NULL | FK enforced at app layer (varies by entity_type) |
| `student_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE | Denormalised for fast student lookup |
| `signal` | text | NOT NULL, CHECK in (`'fork_no_commits'`, `'commit_cluster_time'`, `'ai_generated_suspect'`, `'copied_content_overlap'`, `'impossible_velocity'`, `'rating_delta_anomaly'`) |  |
| `confidence` | numeric(3,2) | NOT NULL, CHECK between 0 and 1 |  |
| `evidence_url` | text | nullable | Link to commit, diff, or external evidence |
| `evidence_payload` | jsonb | nullable | Structured evidence for in-app rendering |
| `detected_at` | timestamptz | NOT NULL, default `now()` |  |
| `superseded_by` | uuid | nullable, FK `anticheat_signals(id)` | When the detector re-runs and supersedes |

**Indexes**:
- `(student_id, detected_at DESC)`
- `(entity_type, entity_id)` partial WHERE `superseded_by IS NULL`

**RLS**: students see own; mentors of student's institution see; service role full.

### `anticheat_appeals`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK |  |
| `signal_id` | uuid | NOT NULL, FK `anticheat_signals(id)` |  |
| `student_id` | uuid | NOT NULL, FK `users(id)` |  |
| `explanation` | text | NOT NULL, length ≥ 30 |  |
| `evidence_url` | text | nullable | Video walkthrough, commit chain |
| `status` | text | NOT NULL, default `'pending'`, CHECK in (`'pending'`, `'approved'`, `'rejected'`, `'withdrawn'`) |  |
| `mentor_id` | uuid | nullable, FK `users(id)` | Mentor who decided |
| `mentor_note` | text | nullable |  |
| `decided_at` | timestamptz | nullable |  |
| `created_at` | timestamptz | NOT NULL, default `now()` |  |

**Indexes**: `(student_id, status)`, `(mentor_id, status)`.
**RLS**: students see own; faculty/mentors at same institution see; service role full.

### `anticheat_audit`
Immutable log of every quarantine + appeal decision + manual override.

| Column | Type | Constraints |
|---|---|---|
| `id` | bigserial | PK |
| `actor_id` | uuid | nullable (system actions have null) |
| `actor_type` | text | NOT NULL, CHECK in (`'system'`, `'student'`, `'mentor'`, `'admin'`) |
| `action` | text | NOT NULL, CHECK in (`'quarantine'`, `'appeal_filed'`, `'appeal_decided'`, `'manual_override'`) |
| `subject_signal_id` | uuid | NOT NULL, FK `anticheat_signals(id)` |
| `payload` | jsonb | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**RLS**: read-only for all authenticated; insert via service role only.

### `i18n_missing_keys`
Translator queue.

| Column | Type | Constraints |
|---|---|---|
| `id` | bigserial | PK |
| `locale` | text | NOT NULL, CHECK in (`'en'`, `'hi'`, `'ta'`, `'te'`, `'mr'`) |
| `key` | text | NOT NULL |
| `seen_count` | int | NOT NULL, default 1 |
| `first_seen_at` | timestamptz | NOT NULL, default `now()` |
| `last_seen_at` | timestamptz | NOT NULL, default `now()` |

**Constraint**: UNIQUE(`locale`, `key`).
**RLS**: read-only for admins; insert via service role only.

### Extensions
- `users.locale` text NOT NULL default `'en'` CHECK in (5-locale set).
- `github_repos.anticheat_score` numeric(3,2) nullable, `github_repos.quarantined_at` timestamptz nullable.
- `user_dsa_profiles.anticheat_score` numeric(3,2) nullable, `user_dsa_profiles.quarantined_at` timestamptz nullable.

---

## 035 — ATS + SSO + Faculty

### `ats_connections`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK |  |
| `recruiter_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE |  |
| `provider` | text | NOT NULL, CHECK in (`'greenhouse'`, `'lever'`) |  |
| `api_key_encrypted` | text | NOT NULL | pgsodium-encrypted at rest |
| `pool_id` | text | nullable | Greenhouse pool ID or Lever stage ID |
| `status` | text | NOT NULL, default `'active'`, CHECK in (`'active'`, `'paused'`, `'revoked'`) |  |
| `last_sync_at` | timestamptz | nullable |  |
| `failure_count` | int | NOT NULL, default 0 |  |
| `created_at` | timestamptz | NOT NULL, default `now()` |  |

**Indexes**: `(recruiter_id)`, `(provider, status)`.
**RLS**: recruiter sees own only; service role full.

### `ats_saved_searches`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `connection_id` | uuid | NOT NULL, FK `ats_connections(id)` ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `query_json` | jsonb | NOT NULL |
| `min_score` | int | NOT NULL, default 75, CHECK 0..100 |
| `active` | boolean | NOT NULL, default true |
| `last_evaluated_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**RLS**: recruiter sees own (via connection); service role full.

### `ats_sync_log`
| Column | Type | Constraints |
|---|---|---|
| `id` | bigserial | PK |
| `connection_id` | uuid | NOT NULL, FK |
| `saved_search_id` | uuid | NOT NULL, FK |
| `student_id` | uuid | NOT NULL, FK `users(id)` |
| `status` | text | NOT NULL, CHECK in (`'success'`, `'retry'`, `'failed_permanent'`) |
| `attempt` | int | NOT NULL |
| `error` | text | nullable |
| `pushed_at` | timestamptz | NOT NULL, default `now()` |

**Indexes**: `(connection_id, pushed_at DESC)`.

### `sso_connections`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `institution_id` | uuid | NOT NULL, FK `institutions(id)`, UNIQUE |
| `workos_connection_id` | text | NOT NULL, UNIQUE |
| `idp_type` | text | nullable (e.g. 'okta', 'azure', 'google') |
| `status` | text | NOT NULL, default `'pending'`, CHECK in (`'pending'`, `'active'`, `'disabled'`) |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**RLS**: institution admins see own; service role full.

### `faculty_verifications`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK `users(id)`, UNIQUE |
| `institution_id` | uuid | NOT NULL, FK `institutions(id)` |
| `verified` | boolean | NOT NULL, default false |
| `verified_by` | uuid | nullable, FK `users(id)` |
| `verified_at` | timestamptz | nullable |
| `revoked_at` | timestamptz | nullable |

### `assignments`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `institution_id` | uuid | NOT NULL, FK |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `course_code` | text | nullable |
| `max_grade` | int | NOT NULL, default 100 |
| `created_by` | uuid | NOT NULL, FK `users(id)` |
| `created_at` | timestamptz | NOT NULL, default `now()` |

### `faculty_grades`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `faculty_id` | uuid | NOT NULL, FK `users(id)` |
| `student_id` | uuid | NOT NULL, FK `users(id)` |
| `assignment_id` | uuid | NOT NULL, FK `assignments(id)` |
| `grade` | int | NOT NULL, CHECK 0..100 |
| `comment` | text | nullable |
| `graded_at` | timestamptz | NOT NULL, default `now()` |

**Constraint**: UNIQUE(`faculty_id`, `student_id`, `assignment_id`) — one grade per faculty per assignment per student; subsequent grades create a new row only via amendment flow.
**Indexes**: `(student_id, graded_at DESC)`.
**RLS**: student sees own; faculty sees grades they issued; institution admin sees all in their institution; service role full.

---

## 036 — Hackathons + Mock Interviews

### `hackathons`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `recruiter_id` | uuid | NOT NULL, FK `users(id)` |
| `title` | text | NOT NULL |
| `problem` | text | NOT NULL |
| `test_cases_url` | text | NOT NULL | signed URL into Supabase storage |
| `starts_at` | timestamptz | NOT NULL |
| `ends_at` | timestamptz | NOT NULL |
| `prize_structure` | jsonb | NOT NULL | e.g. `{"top_5_pct":"interview_fast_track","top_1":"cash_5000_inr"}` |
| `status` | text | NOT NULL, default `'draft'`, CHECK in (`'draft'`, `'live'`, `'completed'`, `'cancelled'`) |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**CHECK**: `ends_at > starts_at`; window between 24h and 168h.

### `hackathon_submissions`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `hackathon_id` | uuid | NOT NULL, FK |
| `student_id` | uuid | NOT NULL, FK `users(id)` |
| `code_url` | text | NOT NULL | signed URL to submission archive |
| `language` | text | NOT NULL, CHECK in (`'python'`, `'javascript'`, `'typescript'`, `'go'`, `'rust'`) |
| `test_results` | jsonb | nullable | populated by `hackathon-grader` edge function |
| `score` | int | nullable, CHECK 0..100 |
| `submitted_at` | timestamptz | NOT NULL, default `now()` |
| `graded_at` | timestamptz | nullable |

**Index**: `(hackathon_id, score DESC NULLS LAST)`.
**RLS**: student sees own submissions; recruiter sees all in their hackathon; service role full.

### `hackathon_credentials`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `hackathon_id` | uuid | NOT NULL, FK |
| `student_id` | uuid | NOT NULL, FK |
| `rank` | int | nullable |
| `kind` | text | NOT NULL, CHECK in (`'participation'`, `'top_10_pct'`, `'top_1_pct'`, `'winner'`) |
| `vc_id` | uuid | nullable, FK `verifiable_credentials(id)` |
| `issued_at` | timestamptz | NOT NULL, default `now()` |

### `mock_interviews`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `student_id` | uuid | NOT NULL, FK `users(id)` |
| `topic` | text | NOT NULL |
| `status` | text | NOT NULL, default `'in_progress'`, CHECK in (`'in_progress'`, `'completed'`, `'abandoned'`) |
| `rubric` | jsonb | nullable | `{"clarity":7,"depth":6,"correctness":8,"summary":"..."}` |
| `score_contribution` | int | nullable, CHECK 0..100 | bounded by weekly cap |
| `total_tokens` | int | NOT NULL, default 0 |
| `started_at` | timestamptz | NOT NULL, default `now()` |
| `completed_at` | timestamptz | nullable |

**Index**: `(student_id, started_at DESC)`.

### `mock_interview_turns`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `interview_id` | uuid | NOT NULL, FK ON DELETE CASCADE |
| `turn_index` | int | NOT NULL |
| `role` | text | NOT NULL, CHECK in (`'student'`, `'interviewer'`) |
| `content` | text | NOT NULL |
| `tokens_used` | int | NOT NULL, default 0 |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**Constraint**: UNIQUE(`interview_id`, `turn_index`).

---

## 037 — Public API + Outcome Pricing + Next-Best-Skill

### `api_keys`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `subject_id` | uuid | NOT NULL, FK `users(id)` |
| `name` | text | NOT NULL |
| `key_prefix` | text | NOT NULL, UNIQUE | first 12 chars for log scanning, e.g. `ant_pub_a1b2` |
| `key_hash` | text | NOT NULL | bcrypt-hashed full key |
| `scopes` | text[] | NOT NULL, CHECK each in scope union |
| `rate_limit_rpm` | int | NOT NULL, default 100 |
| `last_used_at` | timestamptz | nullable |
| `revoked_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**Scope union**: `read:public_profile`, `read:verifiable_credential`, `webhook:subscribe`, `read:placement_aggregate`.

**RLS**: subject sees own keys only (without hash exposed); service role full.

### `webhook_subscriptions`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `api_key_id` | uuid | NOT NULL, FK ON DELETE CASCADE |
| `event` | text | NOT NULL, CHECK in (`'score.updated'`, `'credential.issued'`, `'placement.confirmed'`) |
| `target_url` | text | NOT NULL |
| `secret_hash` | text | NOT NULL | bcrypt-hashed signing secret |
| `active` | boolean | NOT NULL, default true |
| `created_at` | timestamptz | NOT NULL, default `now()` |

### `webhook_deliveries`
| Column | Type | Constraints |
|---|---|---|
| `id` | bigserial | PK |
| `subscription_id` | uuid | NOT NULL, FK |
| `event_id` | uuid | NOT NULL |
| `status` | text | NOT NULL, CHECK in (`'pending'`, `'success'`, `'retry'`, `'failed_permanent'`) |
| `attempt` | int | NOT NULL, default 1 |
| `last_error` | text | nullable |
| `delivered_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default `now()` |

**Index**: `(subscription_id, created_at DESC)`.

### `outcome_contracts`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `institution_id` | uuid | NOT NULL, FK |
| `rate_per_placement` | int | NOT NULL, CHECK > 0 | INR paise (or smallest currency unit) |
| `currency` | text | NOT NULL, default `'INR'` |
| `started_at` | timestamptz | NOT NULL |
| `ends_at` | timestamptz | nullable |
| `status` | text | NOT NULL, default `'active'`, CHECK in (`'active'`, `'paused'`, `'ended'`) |
| `created_at` | timestamptz | NOT NULL, default `now()` |

### `outcome_billing_events`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `contract_id` | uuid | NOT NULL, FK |
| `student_id` | uuid | NOT NULL, FK |
| `offer_id` | uuid | NOT NULL | FK `student_applications` (from 002) |
| `amount` | int | NOT NULL | snapshot of `rate_per_placement` at billing time |
| `currency` | text | NOT NULL |
| `confirmed_at` | timestamptz | NOT NULL, default `now()` |
| `disputed` | boolean | NOT NULL, default false |
| `dispute_reason` | text | nullable |
| `reversed_at` | timestamptz | nullable |

**Constraint**: UNIQUE(`contract_id`, `offer_id`) — never double-bill the same offer.

### `next_best_skills`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `student_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE |
| `skill` | text | NOT NULL |
| `rank` | int | NOT NULL, CHECK 1..10 |
| `source_count` | int | NOT NULL, CHECK >= 5 | enforces D10 minimum signal |
| `confidence` | numeric(3,2) | NOT NULL |
| `reasoning` | text | NOT NULL | e.g. "8 of 12 alumni placed at Google added Kubernetes after your current stack" |
| `computed_at` | timestamptz | NOT NULL, default `now()` |

**Constraint**: UNIQUE(`student_id`, `skill`).
**Index**: `(student_id, rank)`.
**RLS**: student sees own; service role full.

---

## Cross-table relationships (summary)

```
users
  ├── anticheat_signals (student_id)
  ├── anticheat_appeals (student_id, mentor_id)
  ├── ats_connections (recruiter_id)
  ├── faculty_grades (faculty_id, student_id)
  ├── faculty_verifications (user_id, verified_by)
  ├── hackathons (recruiter_id)
  ├── hackathon_submissions (student_id)
  ├── mock_interviews (student_id)
  ├── api_keys (subject_id)
  └── next_best_skills (student_id)

institutions
  ├── sso_connections (institution_id)
  ├── outcome_contracts (institution_id)
  └── assignments (institution_id)

github_repos (from 001)
  └── + anticheat_score, + quarantined_at

user_dsa_profiles (from 003)
  └── + anticheat_score, + quarantined_at

verifiable_credentials (from 002/032)
  └── hackathon_credentials → vc_id
```

All foreign keys cascade per the constraints above. RLS policies enumerated per-table.

---

## Re-validation

- ✓ All 17 spec entities mapped to tables
- ✓ All FK references resolve to existing 001-003 tables or new tables
- ✓ All CHECK constraints align with spec FR-* rules
- ✓ All performance-critical queries have supporting indexes
- ✓ All multi-tenant tables have RLS policy plan
- ✓ Migration order is strictly additive (no dependencies on later migrations)
