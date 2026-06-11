-- 033_rate_limit.sql
-- T-RATE-LIMIT: Token-bucket rate limiter for the 28 Supabase Edge Functions.
--
-- Strictly additive. No edits to any 001–032 migration. Every DDL uses
-- `if not exists` / `or replace` / guarded `do` blocks so the file is safe
-- to re-apply.
--
-- Design notes
--   - One row per (subject, function). bucket_key is a free-form text
--     composite, e.g. "user:<uuid>:fn:ai-coach" or "ip:<reqid>:fn:credential-vc-resolve".
--   - The classic token-bucket: `capacity` is the burst size, `refill_per_second`
--     is the sustained rate. `tokens` is the current credit; a successful
--     consume decrements it by `p_cost`.
--   - Atomicity: `public.rate_limit_consume` does the upsert + refill + deduct
--     in a single function call (one client statement). INSERT ... ON CONFLICT
--     acquires a row-level lock that is held for the duration of the calling
--     transaction (i.e. the entire function call), so two concurrent calls on
--     the same bucket_key serialize. See docs/rate-limiting.md.
--   - RLS is enabled with no policies. Service-role bypasses RLS, so writes
--     and reads are service-role only. The wrapper in
--     `supabase/functions/_shared/rate-limit.ts` always uses the service
--     role key, never an anon JWT.
--   - 30-day retention: a GC delete is documented inline below and called
--     out in docs/rate-limiting.md; the actual `cron.schedule` call must be
--     added in a future migration (NOT 029_cron_002.sql, which was finalised
--     in the 002 layer).

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. public.rate_limit_buckets
-- =============================================================================

create table if not exists public.rate_limit_buckets (
  id                 uuid primary key default gen_random_uuid(),
  bucket_key         text not null,
  tokens             numeric not null default 0,
  capacity           numeric not null,
  refill_per_second  numeric not null,
  last_refill_at     timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- Idempotent column adds (so a partial earlier apply still converges).
alter table public.rate_limit_buckets
  add column if not exists bucket_key text;

alter table public.rate_limit_buckets
  add column if not exists tokens numeric not null default 0;

alter table public.rate_limit_buckets
  add column if not exists capacity numeric;

alter table public.rate_limit_buckets
  add column if not exists refill_per_second numeric;

alter table public.rate_limit_buckets
  add column if not exists last_refill_at timestamptz not null default now();

alter table public.rate_limit_buckets
  add column if not exists created_at timestamptz not null default now();

-- Unique index on bucket_key so the upsert in rate_limit_consume is O(log n)
-- and ON CONFLICT (bucket_key) is well-defined.
create unique index if not exists rate_limit_buckets_bucket_key_uidx
  on public.rate_limit_buckets(bucket_key);

-- Secondary index to make the 30-day GC scan cheap.
create index if not exists rate_limit_buckets_last_refill_idx
  on public.rate_limit_buckets(last_refill_at);

alter table public.rate_limit_buckets enable row level security;
-- No policies on purpose. service_role bypasses RLS; anon and authenticated
-- are denied. See the design note at the top of this file.

-- =============================================================================
-- 2. public.rate_limit_consume(bucket_key, capacity, refill_per_second, cost)
--    -> (allowed, remaining_tokens, retry_after_seconds)
--
--    Atomic refill + check + deduct. Returns a single row.
--
--    `language plpgsql volatile security definer set search_path = public`
--    so it can be called from any Edge Function's service-role client.
-- =============================================================================

create or replace function public.rate_limit_consume(
  p_bucket_key        text,
  p_capacity          numeric,
  p_refill_per_second numeric,
  p_cost              numeric default 1
)
returns table (
  allowed             boolean,
  remaining_tokens    numeric,
  retry_after_seconds numeric
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now      timestamptz := clock_timestamp();
  v_tokens   numeric;
  v_last     timestamptz;
  v_refilled numeric;
  v_after    numeric;
  v_retry    numeric;
begin
  -- Defensive defaults: a non-positive capacity or refill makes the limit
  -- degenerate. Treat as "no limit" rather than divide-by-zero downstream.
  if p_capacity is null or p_capacity <= 0 or p_refill_per_second is null or p_refill_per_second < 0 then
    return query select true, coalesce(p_capacity, 0::numeric), 0::numeric;
    return;
  end if;

  -- Upsert. On conflict, the row-level lock taken by ON CONFLICT DO UPDATE
  -- is held for the rest of this function call (and thus through the UPDATE
  -- below), serializing concurrent calls on the same bucket_key.
  insert into public.rate_limit_buckets (
    bucket_key, tokens, capacity, refill_per_second, last_refill_at
  ) values (
    p_bucket_key, p_capacity, p_capacity, p_refill_per_second, v_now
  )
  on conflict (bucket_key) do update
    set capacity          = excluded.capacity,
        refill_per_second = excluded.refill_per_second
  returning rate_limit_buckets.tokens, rate_limit_buckets.last_refill_at
       into v_tokens, v_last;

  -- Compute refilled tokens (capped at capacity).
  v_refilled := least(
    p_capacity,
    v_tokens + greatest(0, extract(epoch from (v_now - v_last))) * p_refill_per_second
  );

  if v_refilled >= coalesce(p_cost, 1) then
    -- Allowed: deduct cost, advance clock.
    v_after := v_refilled - coalesce(p_cost, 1);
    update public.rate_limit_buckets
       set tokens         = v_after,
           last_refill_at = v_now
     where bucket_key = p_bucket_key;
    return query select true, v_after, 0::numeric;
  else
    -- Denied: still write the refilled value so the clock advances; this
    -- keeps subsequent calls' refill calculation honest.
    update public.rate_limit_buckets
       set tokens         = v_refilled,
           last_refill_at = v_now
     where bucket_key = p_bucket_key;
    v_retry := case
                 when p_refill_per_second > 0
                   then (coalesce(p_cost, 1) - v_refilled) / p_refill_per_second
                 else 9999::numeric
               end;
    return query select false, v_refilled, v_retry;
  end if;
end
$$;

-- =============================================================================
-- 3. 30-day retention
--    The inline statement below is the GC the cron job will execute. It is
--    intentionally idempotent and side-effect-only. The actual schedule must
--    be added in a *future* migration; do NOT edit 029_cron_002.sql, which
--    was finalised in the 002 layer. See docs/rate-limiting.md for the
--    snippet to drop into the next cron migration:
--
--        select cron.schedule(
--          'rate-limit-gc-daily',
--          '0 3 * * *',
--          $$ delete from public.rate_limit_buckets
--               where last_refill_at < now() - interval '30 days' $$
--        );
--
-- One-off GC, safe to run any time:
delete from public.rate_limit_buckets
 where last_refill_at < now() - interval '30 days';
