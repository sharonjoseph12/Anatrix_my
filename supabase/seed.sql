-- seed.sql
-- Initial data: skills catalog

insert into public.skills (name, slug, category, difficulty_level, industry_demand, avg_hours_to_proficiency, description) values
  -- AI/ML
  ('Machine Learning', 'machine-learning', 'AI/ML', 7, 10, 250, 'Core ML algorithms: regression, classification, clustering, evaluation.'),
  ('Deep Learning', 'deep-learning', 'AI/ML', 9, 10, 300, 'Neural networks, CNNs, RNNs, transformers, training pipelines.'),
  ('Natural Language Processing', 'nlp', 'AI/ML', 8, 9, 280, 'Tokenization, embeddings, language models, text generation.'),
  ('Computer Vision', 'computer-vision', 'AI/ML', 8, 9, 260, 'Image classification, object detection, segmentation, OCR.'),
  ('MLOps', 'mlops', 'AI/ML', 7, 8, 200, 'Model deployment, monitoring, feature stores, retraining.'),

  -- Infrastructure
  ('DevOps', 'devops', 'Infrastructure', 6, 9, 200, 'CI/CD, infrastructure as code, deployment automation.'),
  ('Cloud (AWS)', 'cloud-aws', 'Infrastructure', 6, 9, 220, 'EC2, S3, Lambda, RDS, IAM, networking on AWS.'),
  ('Cloud (GCP)', 'cloud-gcp', 'Infrastructure', 6, 8, 220, 'Compute Engine, Cloud Storage, BigQuery, Cloud Run.'),
  ('Kubernetes', 'kubernetes', 'Infrastructure', 8, 8, 240, 'Pods, deployments, services, ingress, operators.'),
  ('Docker', 'docker', 'Infrastructure', 4, 9, 60, 'Containerization, images, volumes, networking.'),
  ('Terraform', 'terraform', 'Infrastructure', 6, 7, 150, 'Declarative infrastructure provisioning across providers.'),

  -- Frontend
  ('React', 'react', 'Frontend', 5, 10, 150, 'Components, hooks, state, context, performance.'),
  ('Next.js', 'nextjs', 'Frontend', 6, 9, 180, 'App router, server components, routing, data fetching.'),
  ('TypeScript', 'typescript', 'Language', 5, 10, 120, 'Static typing, generics, type narrowing, declaration files.'),
  ('Tailwind CSS', 'tailwind-css', 'Frontend', 3, 8, 40, 'Utility-first styling, design tokens, responsive design.'),
  ('Vue.js', 'vuejs', 'Frontend', 5, 7, 140, 'Composition API, reactivity, single-file components.'),

  -- Backend
  ('Node.js', 'nodejs', 'Backend', 5, 10, 160, 'Event loop, async patterns, streams, REST APIs.'),
  ('Python', 'python', 'Language', 4, 10, 120, 'Syntax, data structures, standard library, packaging.'),
  ('Go', 'go', 'Language', 5, 8, 140, 'Goroutines, channels, interfaces, modules.'),
  ('Rust', 'rust', 'Language', 8, 7, 280, 'Ownership, borrowing, lifetimes, async runtime.'),
  ('PostgreSQL', 'postgresql', 'Backend', 5, 9, 150, 'Relational modeling, indexing, transactions, performance tuning.'),
  ('GraphQL', 'graphql', 'Backend', 5, 7, 120, 'Schemas, resolvers, subscriptions, federation.'),
  ('REST API Design', 'rest-api', 'Backend', 4, 9, 80, 'Resource modeling, status codes, versioning, authentication.'),

  -- Data
  ('Data Structures', 'data-structures', 'Fundamentals', 5, 10, 200, 'Arrays, lists, trees, graphs, hash tables, complexity.'),
  ('Algorithms', 'algorithms', 'Fundamentals', 6, 10, 250, 'Sorting, searching, dynamic programming, graph algorithms.'),
  ('System Design', 'system-design', 'Fundamentals', 7, 10, 200, 'Scalability, caching, sharding, queues, consistency.'),
  ('SQL', 'sql', 'Data', 4, 10, 100, 'Joins, aggregations, window functions, query planning.'),
  ('Data Engineering', 'data-engineering', 'Data', 7, 8, 240, 'Pipelines, ETL, warehousing, batch and stream processing.'),

  -- Mobile
  ('React Native', 'react-native', 'Mobile', 6, 7, 180, 'Cross-platform mobile apps with React.'),
  ('Swift', 'swift', 'Mobile', 6, 7, 200, 'iOS native development with SwiftUI.'),
  ('Kotlin', 'kotlin', 'Mobile', 6, 7, 200, 'Android native development with Jetpack Compose.'),

  -- Other
  ('Git', 'git', 'Tools', 2, 10, 30, 'Version control: branching, merging, rebasing, conflict resolution.'),
  ('Linux', 'linux', 'Tools', 4, 8, 80, 'Shell, file system, process management, networking basics.'),
  ('Testing', 'testing', 'Fundamentals', 5, 8, 120, 'Unit, integration, e2e testing, mocking, coverage.')
on conflict (name) do nothing;

-- =============================================================================
-- 004 — Feature flag seeds
-- =============================================================================
-- The `feature_flags` table is introduced by feature 003 (see
-- specs/003-engage-and-showcase/data-model.md) and is not yet present in this
-- seed file's DDL surface. Once the `feature_flags` table is available in the
-- migration set, append the following rows here (all start OFF — Day-N cohort
-- rollout is driven by UPDATE statements in docs/004-rollout-runbook.md):
--
--   insert into public.feature_flags (key, default_enabled, description, created_at) values
--     ('004_anticheat',         false, 'Anti-cheat: GitHub repo fingerprinting + DSA anomaly detection', now()),
--     ('004_ats_sync',          false, 'Greenhouse + Lever ATS bidirectional sync',                     now()),
--     ('004_i18n_extended',     false, 'Hindi, Tamil, Telugu, Marathi locale catalogs',                now()),
--     ('004_sso_workos',        false, 'WorkOS SAML SSO for partner institutions',                     now()),
--     ('004_faculty_grading',   false, 'College faculty grading contribution to student score',         now()),
--     ('004_hackathons',        false, 'Recruiter-hosted hackathon sandbox + leaderboard',             now()),
--     ('004_mock_interviews',   false, 'AI mock interview LLM grading (Groq/OpenAI/Together)',         now()),
--     ('004_public_api',        false, 'Public REST API + scoped API keys + rate limits',              now()),
--     ('004_pwa',               false, 'PWA install + offline-first dashboard',                        now()),
--     ('004_outcome_pricing',   false, 'Outcome-based college billing + dispute window',               now()),
--     ('004_next_best_skill',   false, 'Next-best-skill recommender recompute job',                    now())
--     ('007_alumni_mentorship', false, 'Alumni mentorship match via trajectory embeddings + video calls', now())
--     ('007_daily_curriculum',  false, 'Daily adaptive micro-curriculum (3 lessons/day per student)',  now())
--     ('007_curriculum_mentor_loop', false, 'Struggle detection → mentor suggestion → re-weighted lessons', now())
--   on conflict (key) do nothing;
--
-- The INSERT is intentionally NOT emitted today: there is no `feature_flags`
-- table in the current migration set, so executing it would error. Operators
-- should copy the block above into supabase/seed.sql once the 003 feature_flags
-- migration has landed.

--   insert into public.feature_flags (key, default_enabled, description, created_at) values
--     ('006_ide_telemetry',         false, 'VS Code + Cursor IDE telemetry capture (US1)',                  now()),
--     ('006_biometrics_oura',       false, 'Oura Ring OAuth connection (US2)',                              now()),
--     ('006_biometrics_whoop',      false, 'Whoop OAuth connection (US2)',                                  now()),
--     ('006_biometrics_mobile',     false, 'HealthKit + Google Fit via 005 Expo app (US2)',                 now()),
--     ('006_privacy_center',        false, 'Privacy Center + audit log surface (US3)',                      now()),
--     ('006_audit_integrity_check', false, 'Nightly audit log integrity verification',                      now()),
--     ('007_alumni_mentorship',     false, 'Alumni mentorship match via trajectory embeddings + video calls', now()),
--     ('007_daily_curriculum',      false, 'Daily adaptive micro-curriculum (3 lessons/day per student)',   now()),
--     ('007_curriculum_mentor_loop',false, 'Struggle detection -> mentor suggestion -> re-weighted lessons', now()),
--     ('008_collab_rooms',          false, 'Live multiplayer coding rooms',                                 now()),
--     ('008_collab_javascript',     false, 'WebContainer JS sandbox',                                       now()),
--     ('008_collab_python',         false, 'WebContainer Python sandbox',                                   now()),
--     ('008_collab_go_rust',        false, 'Firecracker remote sandbox for Go/Rust',                        now()),
--     ('008_teamwork_scorer',       false, 'Compute teamwork score from session events',                    now()),
--     ('008_anti_collusion',        false, 'Typing divergence anti-cheat check',                            now()),
--     ('008_collab_opt_out_ui',     false, 'Privacy opt-out toggle for collab mode',                        now()),
--     ('008_recruiter_observe',     false, 'Recruiter invisible observe mode',                              now()),
--     ('008_collab_liveblocks_paid',false, 'Liveblocks paid tier limits active',                            now()),
--     ('008_collab_recordings',     false, 'Save LiveKit session recordings',                               now()),
--     ('005_mobile_app',            false, 'Mobile app GA',                                                 now()),
--     ('005_auto_apply_cover_letter', false, 'Auto-apply cover letter generation',                        now()),
--     ('005_auto_apply_headless',   false, 'Auto-apply headless Playwright execution',                      now()),
--     ('005_global_leaderboard',    false, 'Global cross-college leaderboard',                              now()),
--     ('005_esports_ui',            false, 'E-sports UI (animations, tier badges)',                         now()),
--     ('005_push_apns_fcm',         false, 'Native push notifications (APNs/FCM)',                          now()),
--     ('005_deep_link_resume',      false, 'Deep link resume flow for onboarding',                          now()),
--     ('005_share_card_native',     false, 'Native share card for leaderboard',                             now()),
--     ('005_leaderboard_opt_out',   false, 'Leaderboard opt-out functionality',                             now()),
--     ('005_auto_apply_kill_switch',false, 'Auto-apply kill switch per domain',                             now()),
--     ('005_cover_letter_cost_cap', false, 'Cover letter cost cap enforcement',                             now()),
--     ('005_apps_workspace_registered', false, 'Apps workspace registered',                                 now())
--   on conflict (key) do nothing;
