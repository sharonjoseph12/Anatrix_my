-- 037_api_outcome_nbs.sql
-- 11/10 — Public API + Outcome Pricing + Next-Best-Skill
--
-- Adds six tables:
--   public.api_keys                   — programmatic API credentials (bcrypt-hashed)
--   public.webhook_subscriptions      — per-key event subscription
--   public.webhook_deliveries         — delivery attempt log
--   public.outcome_contracts          — institution outcome-pricing contracts
--   public.outcome_billing_events     — one row per confirmed placement billing
--   public.next_best_skills           — per-student top-N next-skill recommendations
--
-- Strictly additive. No edits to 001–036 migrations. Every DDL uses
-- `if not exists` / `or replace` / guarded `do` blocks so the file is safe
-- to re-apply.
--
-- Design notes
--   * `api_keys.key_hash` stores a bcrypt hash of the full key
--     (produced via pgcrypto's `crypt(key, gen_salt('bf'))`).
--     Only `key_prefix` (first 12 chars) is ever shown in API responses or
--     logs. The base table's RLS policy is subject-only, and the companion
--     view `public.api_keys_safe` exposes api_keys without `key_hash` so
--     clients cannot accidentally SELECT the secret column.
--   * `api_keys.scopes` CHECK: all elements must belong to the closed union
--     {'read:public_profile','read:verifiable_credential',
--      'webhook:subscribe','read:placement_aggregate'}. Implemented as
--     `not exists (select 1 from unnest(scopes) s where s not in (...))`
--     so the CHECK is fully self-contained (no subquery, no function).
--   * `api_keys.rate_limit_rpm` is enforced at the API layer by calling
--     `public.rate_limit_consume()` (defined in 033_rate_limit.sql) with
--       bucket_key         = 'apikey:' || api_keys.id
--       capacity           = api_keys.rate_limit_rpm
--       refill_per_second  = api_keys.rate_limit_rpm / 60.0
--     The token-bucket from migration 033 covers this use case; an
--     additional `api_rate_counters` table is therefore intentionally NOT
--     created. Do not introduce one without removing the reuse comment.
--   * `outcome_billing_events.offer_id` FKs `public.student_applications(id)`
--     (the PK is `id` per 023_applications.sql).
--   * RLS: subject-only on api_keys, webhook_*, next_best_skills. Institution
--     admins / placement officers (via public.institution_members.role) on
--     outcome_contracts and outcome_billing_events.

-- =============================================================================
-- 0. Extensions
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. public.api_keys
-- =============================================================================

create table if not exists public.api_keys (
  id              uuid        primary key default gen_random_uuid(),
  subject_id      uuid        not null references public.users(id) on delete cascade,
  name            text        not null,
  key_prefix      text        not null,
  key_hash        text        not null,
  scopes          text[]      not null,
  rate_limit_rpm  int         not null default 100,
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- Idempotent column adds (so a partial earlier apply still converges).
alter table public.api_keys add column if not exists subject_id      uuid        references public.users(id) on delete cascade;
alter table public.api_keys add column if not exists name            text;
alter table public.api_keys add column if not exists key_prefix      text;
alter table public.api_keys add column if not exists key_hash        text;
alter table public.api_keys add column if not exists scopes          text[];
alter table public.api_keys add column if not exists rate_limit_rpm  int         not null default 100;
alter table public.api_keys add column if not exists last_used_at    timestamptz;
alter table public.api_keys add column if not exists revoked_at      timestamptz;
alter table public.api_keys add column if not exists created_at      timestamptz not null default now();

-- Unique on key_prefix (12-char fragment used for log scanning / lookup).
create unique index if not exists api_keys_key_prefix_uidx
  on public.api_keys(key_prefix);

create index if not exists api_keys_subject_idx
  on public.api_keys(subject_id);

-- Scope-union CHECK: every element of `scopes` must be in the closed set.
-- Implemented as NOT EXISTS over unnest() so it works in any Postgres
-- version and does not require a helper function.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'api_keys_scopes_union_chk'
  ) then
    alter table public.api_keys
      add constraint api_keys_scopes_union_chk
      check (not exists (
        select 1
          from unnest(scopes) as s
         where s not in (
           'read:public_profile',
           'read:verifiable_credential',
           'webhook:subscribe',
           'read:placement_aggregate'
         )
      ));
  end if;
end $$;

-- Sanity CHECK: key_prefix should be a short, recognisable token. Not a
-- strict 12-char check (callers may use 10–16); just keep it bounded.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'api_keys_key_prefix_len_chk'
  ) then
    alter table public.api_keys
      add constraint api_keys_key_prefix_len_chk
      check (char_length(key_prefix) between 6 and 32);
  end if;
end $$;

comment on table  public.api_keys is
  'Programmatic API credentials. key_hash is bcrypt; only key_prefix is ever exposed.';
comment on column public.api_keys.key_prefix is
  'First ~12 chars of the issued key, safe to log and surface in UI.';
comment on column public.api_keys.key_hash is
  'bcrypt-hashed full key (crypt(key, gen_salt(''bf''))). Never SELECT this column for end users.';
comment on column public.api_keys.scopes is
  'Closed union of OAuth-style scopes. CHECK enforces membership.';
comment on column public.api_keys.rate_limit_rpm is
  'Per-minute sustained quota. Enforced via rate_limit_consume() with bucket_key = ''apikey:'' || id, capacity = rate_limit_rpm, refill_per_second = rate_limit_rpm / 60.';

alter table public.api_keys enable row level security;

drop policy if exists api_keys_subject_read on public.api_keys;
create policy api_keys_subject_read on public.api_keys
  for select using (auth.uid() = subject_id);

drop policy if exists api_keys_subject_insert on public.api_keys;
create policy api_keys_subject_insert on public.api_keys
  for insert with check (auth.uid() = subject_id);

drop policy if exists api_keys_subject_update on public.api_keys;
create policy api_keys_subject_update on public.api_keys
  for update using (auth.uid() = subject_id)
             with check (auth.uid() = subject_id);

drop policy if exists api_keys_subject_delete on public.api_keys;
create policy api_keys_subject_delete on public.api_keys
  for delete using (auth.uid() = subject_id);

-- -----------------------------------------------------------------------------
-- 1a. public.api_keys_safe — view that hides key_hash (and never includes
--     secret_hash; that column lives in webhook_subscriptions, not here).
--     Uses security_invoker = true so the underlying api_keys RLS still
--     applies to the calling user (i.e. the subject). Requires Postgres 15+
--     (Supabase default).
-- -----------------------------------------------------------------------------

create or replace view public.api_keys_safe
with (security_invoker = true) as
select
  id,
  subject_id,
  name,
  key_prefix,
  scopes,
  rate_limit_rpm,
  last_used_at,
  revoked_at,
  created_at
from public.api_keys;

comment on view public.api_keys_safe is
  'Subject-scoped view over api_keys. Excludes key_hash. The API layer MUST use this view (or SELECT only these columns) for any user-facing response.';

-- =============================================================================
-- 2. public.webhook_subscriptions
-- =============================================================================

create table if not exists public.webhook_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  api_key_id   uuid        not null references public.api_keys(id) on delete cascade,
  event        text        not null,
  target_url   text        not null,
  secret_hash  text        not null,
  active       boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.webhook_subscriptions add column if not exists api_key_id   uuid        references public.api_keys(id) on delete cascade;
alter table public.webhook_subscriptions add column if not exists event        text;
alter table public.webhook_subscriptions add column if not exists target_url   text;
alter table public.webhook_subscriptions add column if not exists secret_hash  text;
alter table public.webhook_subscriptions add column if not exists active       boolean     not null default true;
alter table public.webhook_subscriptions add column if not exists created_at   timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'webhook_subscriptions_event_chk'
  ) then
    alter table public.webhook_subscriptions
      add constraint webhook_subscriptions_event_chk
      check (event in ('score.updated', 'credential.issued', 'placement.confirmed'));
  end if;
end $$;

create index if not exists webhook_subscriptions_api_key_idx
  on public.webhook_subscriptions(api_key_id);

create index if not exists webhook_subscriptions_active_idx
  on public.webhook_subscriptions(active)
  where active;

comment on table  public.webhook_subscriptions is
  'Per-API-key webhook subscription. secret_hash is bcrypt and never returned to clients.';
comment on column public.webhook_subscriptions.secret_hash is
  'bcrypt-hashed signing secret (crypt(secret, gen_salt(''bf''))). Never SELECT this column for end users.';

alter table public.webhook_subscriptions enable row level security;

drop policy if exists webhook_subscriptions_subject_read on public.webhook_subscriptions;
create policy webhook_subscriptions_subject_read on public.webhook_subscriptions
  for select using (
    exists (
      select 1
        from public.api_keys k
       where k.id = webhook_subscriptions.api_key_id
         and k.subject_id = auth.uid()
    )
  );

drop policy if exists webhook_subscriptions_subject_write on public.webhook_subscriptions;
create policy webhook_subscriptions_subject_write on public.webhook_subscriptions
  for all using (
    exists (
      select 1
        from public.api_keys k
       where k.id = webhook_subscriptions.api_key_id
         and k.subject_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.api_keys k
       where k.id = webhook_subscriptions.api_key_id
         and k.subject_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. public.webhook_deliveries
-- =============================================================================

create table if not exists public.webhook_deliveries (
  id              bigserial  primary key,
  subscription_id uuid        not null references public.webhook_subscriptions(id) on delete cascade,
  event_id        uuid        not null,
  status          text        not null default 'pending',
  attempt         int         not null default 1,
  last_error      text,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.webhook_deliveries add column if not exists subscription_id uuid        references public.webhook_subscriptions(id) on delete cascade;
alter table public.webhook_deliveries add column if not exists event_id        uuid;
alter table public.webhook_deliveries add column if not exists status          text        not null default 'pending';
alter table public.webhook_deliveries add column if not exists attempt         int         not null default 1;
alter table public.webhook_deliveries add column if not exists last_error      text;
alter table public.webhook_deliveries add column if not exists delivered_at    timestamptz;
alter table public.webhook_deliveries add column if not exists created_at      timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'webhook_deliveries_status_chk'
  ) then
    alter table public.webhook_deliveries
      add constraint webhook_deliveries_status_chk
      check (status in ('pending', 'success', 'retry', 'failed_permanent'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'webhook_deliveries_attempt_chk'
  ) then
    alter table public.webhook_deliveries
      add constraint webhook_deliveries_attempt_chk
      check (attempt >= 1);
  end if;
end $$;

create index if not exists webhook_deliveries_sub_created_idx
  on public.webhook_deliveries(subscription_id, created_at desc);

create index if not exists webhook_deliveries_status_idx
  on public.webhook_deliveries(status)
  where status in ('pending', 'retry');

comment on table  public.webhook_deliveries is
  'Append-only log of webhook delivery attempts. Updated by the dispatcher; service-role writes are expected.';
comment on column public.webhook_deliveries.event_id is
  'Idempotency key supplied by the producer. Pairs with subscription_id to deduplicate retries.';

alter table public.webhook_deliveries enable row level security;

drop policy if exists webhook_deliveries_subject_read on public.webhook_deliveries;
create policy webhook_deliveries_subject_read on public.webhook_deliveries
  for select using (
    exists (
      select 1
        from public.webhook_subscriptions s
        join public.api_keys k on k.id = s.api_key_id
       where s.id = webhook_deliveries.subscription_id
         and k.subject_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated: dispatcher runs as
-- service_role, which bypasses RLS.

-- =============================================================================
-- 4. public.outcome_contracts
-- =============================================================================

create table if not exists public.outcome_contracts (
  id                  uuid        primary key default gen_random_uuid(),
  institution_id      uuid        not null references public.institutions(id) on delete cascade,
  rate_per_placement  int         not null,
  currency            text        not null default 'INR',
  started_at          timestamptz not null,
  ends_at             timestamptz,
  status              text        not null default 'active',
  created_at          timestamptz not null default now()
);

alter table public.outcome_contracts add column if not exists institution_id     uuid        references public.institutions(id) on delete cascade;
alter table public.outcome_contracts add column if not exists rate_per_placement int;
alter table public.outcome_contracts add column if not exists currency           text        not null default 'INR';
alter table public.outcome_contracts add column if not exists started_at         timestamptz;
alter table public.outcome_contracts add column if not exists ends_at            timestamptz;
alter table public.outcome_contracts add column if not exists status             text        not null default 'active';
alter table public.outcome_contracts add column if not exists created_at         timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'outcome_contracts_rate_positive_chk'
  ) then
    alter table public.outcome_contracts
      add constraint outcome_contracts_rate_positive_chk
      check (rate_per_placement > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'outcome_contracts_status_chk'
  ) then
    alter table public.outcome_contracts
      add constraint outcome_contracts_status_chk
      check (status in ('active', 'paused', 'ended'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'outcome_contracts_ends_after_starts_chk'
  ) then
    alter table public.outcome_contracts
      add constraint outcome_contracts_ends_after_starts_chk
      check (ends_at is null or ends_at > started_at);
  end if;
end $$;

create index if not exists outcome_contracts_institution_idx
  on public.outcome_contracts(institution_id);

create index if not exists outcome_contracts_status_idx
  on public.outcome_contracts(status)
  where status = 'active';

comment on table  public.outcome_contracts is
  'Outcome-pricing contract between Antarix and an institution. rate_per_placement is in the smallest currency unit (e.g. paise for INR).';
comment on column public.outcome_contracts.rate_per_placement is
  'Amount billed per confirmed placement, in smallest currency unit. Snapshot-copied into outcome_billing_events.amount at billing time.';

alter table public.outcome_contracts enable row level security;

drop policy if exists outcome_contracts_admin_read on public.outcome_contracts;
create policy outcome_contracts_admin_read on public.outcome_contracts
  for select using (
    exists (
      select 1
        from public.institution_members m
       where m.institution_id = outcome_contracts.institution_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  );

-- Writes are service-role only (contract onboarding is admin-driven via the
-- back office, not the API surface).

-- =============================================================================
-- 5. public.outcome_billing_events
--    offer_id FKs public.student_applications(id) per 023_applications.sql.
-- =============================================================================

create table if not exists public.outcome_billing_events (
  id             uuid        primary key default gen_random_uuid(),
  contract_id    uuid        not null references public.outcome_contracts(id) on delete cascade,
  student_id     uuid        not null references public.users(id) on delete cascade,
  offer_id       uuid        not null references public.student_applications(id) on delete cascade,
  amount         int         not null,
  currency       text        not null,
  confirmed_at   timestamptz not null default now(),
  disputed       boolean     not null default false,
  dispute_reason text,
  reversed_at    timestamptz
);

alter table public.outcome_billing_events add column if not exists contract_id    uuid        references public.outcome_contracts(id) on delete cascade;
alter table public.outcome_billing_events add column if not exists student_id     uuid        references public.users(id) on delete cascade;
alter table public.outcome_billing_events add column if not exists offer_id       uuid        references public.student_applications(id) on delete cascade;
alter table public.outcome_billing_events add column if not exists amount         int;
alter table public.outcome_billing_events add column if not exists currency       text;
alter table public.outcome_billing_events add column if not exists confirmed_at   timestamptz not null default now();
alter table public.outcome_billing_events add column if not exists disputed       boolean     not null default false;
alter table public.outcome_billing_events add column if not exists dispute_reason text;
alter table public.outcome_billing_events add column if not exists reversed_at    timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'outcome_billing_events_amount_positive_chk'
  ) then
    alter table public.outcome_billing_events
      add constraint outcome_billing_events_amount_positive_chk
      check (amount > 0);
  end if;
end $$;

-- Never double-bill the same offer under the same contract.
create unique index if not exists outcome_billing_events_contract_offer_uidx
  on public.outcome_billing_events(contract_id, offer_id);

create index if not exists outcome_billing_events_contract_idx
  on public.outcome_billing_events(contract_id, confirmed_at desc);

create index if not exists outcome_billing_events_student_idx
  on public.outcome_billing_events(student_id);

create index if not exists outcome_billing_events_disputed_idx
  on public.outcome_billing_events(disputed)
  where disputed;

comment on table  public.outcome_billing_events is
  'One row per confirmed placement billed under an outcome contract. amount is a snapshot of rate_per_placement at billing time.';
comment on column public.outcome_billing_events.amount is
  'Snapshot of the contract''s rate_per_placement at billing time (smallest currency unit).';
comment on column public.outcome_billing_events.disputed is
  'Set true if the institution has disputed this charge. Reversed events keep the row for audit (reversed_at is set instead of deleting).';

alter table public.outcome_billing_events enable row level security;

drop policy if exists outcome_billing_events_admin_read on public.outcome_billing_events;
create policy outcome_billing_events_admin_read on public.outcome_billing_events
  for select using (
    exists (
      select 1
        from public.outcome_contracts c
        join public.institution_members m on m.institution_id = c.institution_id
       where c.id = outcome_billing_events.contract_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  );

-- Writes are service-role only.

-- =============================================================================
-- 6. public.next_best_skills
-- =============================================================================

create table if not exists public.next_best_skills (
  id            uuid         primary key default gen_random_uuid(),
  student_id    uuid         not null references public.users(id) on delete cascade,
  skill         text         not null,
  rank          int          not null,
  source_count  int          not null,
  confidence    numeric(3,2) not null,
  reasoning     text         not null,
  computed_at   timestamptz  not null default now()
);

alter table public.next_best_skills add column if not exists student_id   uuid         references public.users(id) on delete cascade;
alter table public.next_best_skills add column if not exists skill        text;
alter table public.next_best_skills add column if not exists rank         int;
alter table public.next_best_skills add column if not exists source_count int;
alter table public.next_best_skills add column if not exists confidence   numeric(3,2);
alter table public.next_best_skills add column if not exists reasoning    text;
alter table public.next_best_skills add column if not exists computed_at  timestamptz  not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'next_best_skills_rank_chk'
  ) then
    alter table public.next_best_skills
      add constraint next_best_skills_rank_chk
      check (rank between 1 and 10);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'next_best_skills_source_count_chk'
  ) then
    alter table public.next_best_skills
      add constraint next_best_skills_source_count_chk
      check (source_count >= 5);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'next_best_skills_confidence_chk'
  ) then
    alter table public.next_best_skills
      add constraint next_best_skills_confidence_chk
      check (confidence between 0 and 1);
  end if;
end $$;

-- One row per (student, skill). Re-computations UPSERT this row.
create unique index if not exists next_best_skills_student_skill_uidx
  on public.next_best_skills(student_id, skill);

create index if not exists next_best_skills_student_rank_idx
  on public.next_best_skills(student_id, rank);

comment on table  public.next_best_skills is
  'Per-student top-N next-skill recommendations. Re-computed by the nbs-pipeline job; D10 minimum is source_count >= 5.';
comment on column public.next_best_skills.source_count is
  'Number of distinct alumni/placement signals used to derive this recommendation. D10 floor = 5.';
comment on column public.next_best_skills.confidence is
  'Model confidence in [0,1]. CHECK-constrained.';

alter table public.next_best_skills enable row level security;

drop policy if exists next_best_skills_student_read on public.next_best_skills;
create policy next_best_skills_student_read on public.next_best_skills
  for select using (auth.uid() = student_id);

-- Writes are service-role only (nbs-pipeline job).

-- =============================================================================
-- End of 037_api_outcome_nbs.sql
-- =============================================================================
