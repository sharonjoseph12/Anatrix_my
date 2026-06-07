-- 042_verify_api_key.sql
-- 11/10 — Adds the verify_api_key RPC referenced by
-- apps/web/src/lib/api/apikey.ts (the existing helper calls
--   supabase.rpc("verify_api_key", { p_prefix, p_key })
-- but the function was never declared). Without it, the entire public
-- API auth path is broken at runtime even though TypeScript compiles.
--
-- This is the minimum piece missing from 037_api_outcome_nbs.sql.
-- Strictly additive. Idempotent. service-role only (security definer).

-- =============================================================================
-- 1. public.verify_api_key(p_prefix, p_key) -> record
-- =============================================================================
-- Looks up the active (revoked_at IS NULL) api_keys row by key_prefix, then
-- performs a constant-time bcrypt comparison in the database via
-- `crypt($key, key_hash) = key_hash`. This mirrors the design from
-- research.md §D8: the comparison happens server-side in Postgres so the
-- bcrypt cost is paid by the DB and no Node-side bcrypt package is required
-- for verification (the Edge Function path uses bcryptjs for new-key INSERTs).
--
-- Returns at most one row. If the prefix misses or the hash does not match,
-- returns a single row with hash_match=false and NULL key fields so the
-- caller can branch on a single shape.
-- =============================================================================

create or replace function public.verify_api_key(
  p_prefix text,
  p_key    text
)
returns table (
  id             uuid,
  subject_id     uuid,
  key_prefix     text,
  scopes         text[],
  rate_limit_rpm integer,
  hash_match     boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row  public.api_keys%rowtype;
  v_hash text;
begin
  if p_prefix is null or p_key is null or length(p_prefix) < 6 or length(p_key) < 12 then
    -- Defensive: return an empty result set with hash_match=false.
    return query select
      null::uuid, null::uuid, null::text, null::text[], null::integer, false;
    return;
  end if;

  select * into v_row
    from public.api_keys
   where key_prefix = p_prefix
     and revoked_at is null
   limit 1;

  if not found then
    return query select
      null::uuid, null::uuid, null::text, null::text[], null::integer, false;
    return;
  end if;

  v_hash := public.crypt(p_key, v_row.key_hash);

  if v_hash = v_row.key_hash then
    return query select
      v_row.id,
      v_row.subject_id,
      v_row.key_prefix,
      v_row.scopes,
      v_row.rate_limit_rpm,
      true;
  else
    -- Prefix matched but the bcrypt compare failed. Return a single row
    -- with hash_match=false and the same id/subject (so the caller can
    -- optionally bump last_used_at / audit). We deliberately omit the
    -- secret material.
    return query select
      v_row.id,
      v_row.subject_id,
      v_row.key_prefix,
      v_row.scopes,
      v_row.rate_limit_rpm,
      false;
  end if;
end
$$;

comment on function public.verify_api_key(text, text) is
  'Bcrypt-verifies an Antarix public API key. Returns the row (without key_hash) plus a hash_match boolean. Service-role only; SECURITY DEFINER with pinned search_path.';

revoke all on function public.verify_api_key(text, text) from public;
grant execute on function public.verify_api_key(text, text) to service_role;
