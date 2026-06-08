-- 025_privacy.sql
-- T018 — privacy_requests, account-deletion trigger
-- See spec/002 FR-015 (account deletion) and FR-016 (company-search opt-out)

create type privacy_request_type as enum (
  'account_deletion', 'company_search_opt_out', 'company_search_opt_in', 'data_export', 'source_disconnect'
);
create type privacy_request_status as enum ('pending', 'in_progress', 'completed', 'failed');

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  request_type privacy_request_type not null,
  status privacy_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  details jsonb
);
create index if not exists privacy_requests_user_idx on public.privacy_requests(user_id, requested_at desc);
create index if not exists privacy_requests_open_idx
  on public.privacy_requests(status, request_type) where status in ('pending', 'in_progress');

-- Account-deletion trigger
-- On INSERT of a privacy_request of type 'account_deletion', soft-delete the user:
--   * set deletion_requested_at = now()
--   * set deletion_purge_after   = now() + 30 days
--   * revoke verifiable_credentials.revocation_status within 24h
create or replace function public.handle_account_deletion_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.request_type = 'account_deletion' and new.status = 'pending' then
    update public.users
      set deletion_requested_at = now(),
          deletion_purge_after = now() + interval '30 days'
      where id = new.user_id;
    update public.verifiable_credentials
      set revocation_status = 'revoked',
          revoked_at = now()
      where user_id = new.user_id
        and revocation_status = 'active';
  end if;
  return new;
end $$;

drop trigger if exists trg_privacy_account_deletion on public.privacy_requests;
create trigger trg_privacy_account_deletion
  after insert on public.privacy_requests
  for each row execute function public.handle_account_deletion_request();
