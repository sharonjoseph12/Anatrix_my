-- 058_signup_rpcs.sql
-- RPCs for company and institution signup to bypass client-side RLS sequencing issues.

create or replace function public.register_company_account(
  p_user_id uuid,
  p_name text,
  p_industry text,
  p_city text,
  p_tier text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
begin
  insert into public.companies (name, industry, city, subscription_tier, owner_user_id)
  values (p_name, p_industry, p_city, p_tier::company_tier, p_user_id)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, p_user_id, 'admin');

  return v_company_id;
end;
$$;

create or replace function public.register_institution_account(
  p_user_id uuid,
  p_name text,
  p_type text,
  p_city text,
  p_country text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_inst_id uuid;
begin
  insert into public.institutions (name, type, city, country)
  values (p_name, p_type, p_city, p_country)
  returning id into v_inst_id;

  insert into public.institution_members (institution_id, user_id, role)
  values (v_inst_id, p_user_id, 'placement_officer');

  return v_inst_id;
end;
$$;
