-- 032_w3c_vc.sql
-- T-W3C-VC: W3C Verifiable Credentials v2.0 + DID support for verifiable_credentials
--
-- Strictly additive. No edits to 022_credentials.sql, 026_user_deltas.sql, or any
-- other existing migration. Every DDL uses `if not exists` / `or replace` / guarded
-- `do` blocks, so the file is safe to re-apply.
--
-- Layer model:
--   public.verifiable_credentials   (existing Antarix-native shape)
--     + vc_document  jsonb         (W3C VC v2.0 JSON-LD payload, nullable)
--     + vc_proof     jsonb         (W3C Data Integrity proof,    nullable)
--     + did          text          (canonical did:web for the subject, nullable)
--     + issuer_did   text          (issuer DID; defaults to did:web:antarix.app)
--     + issuance_date    timestamptz  (defaults to snapshot_taken_at at write)
--     + expiration_date  timestamptz  (defaults to snapshot_taken_at + 2y)
--
-- New tables:
--   public.vc_revocations   — W3C VC Status List 2021 v1 registry (append-only)
--   public.vc_issuer_keys   — issuer signing key registry (EdDSA / Ed25519)
--
-- New functions:
--   public.build_vc_document(uuid)         returns jsonb
--   public.sign_vc_document (uuid, text)   returns jsonb  (deterministic stub)
--   public.resolve_did       (text)        returns jsonb
--
-- All SECURITY DEFINER functions pin `set search_path = public` per the repo
-- convention (see 025_privacy.sql, 012_cron_jobs.sql, etc.).

-- =============================================================================
-- 1. New columns on public.verifiable_credentials
-- =============================================================================

alter table public.verifiable_credentials
  add column if not exists vc_document     jsonb;

alter table public.verifiable_credentials
  add column if not exists vc_proof        jsonb;

alter table public.verifiable_credentials
  add column if not exists did             text;

alter table public.verifiable_credentials
  add column if not exists issuer_did      text not null default 'did:web:antarix.app';

alter table public.verifiable_credentials
  add column if not exists issuance_date   timestamptz;

alter table public.verifiable_credentials
  add column if not exists expiration_date timestamptz;

-- CHECK: vc_proof must be either NULL or a JSON object (not array / scalar).
-- Guarded by a do block so re-running the migration is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'verifiable_credentials_vc_proof_is_object_chk'
  ) then
    alter table public.verifiable_credentials
      add constraint verifiable_credentials_vc_proof_is_object_chk
      check (vc_proof is null or jsonb_typeof(vc_proof) = 'object');
  end if;
end $$;

-- Unique partial index on `did`: many NULLs are allowed, but once a DID is
-- assigned it must be globally unique across the table.
create unique index if not exists verifiable_credentials_did_uniq_idx
  on public.verifiable_credentials(did)
  where did is not null;

-- Backfill existing rows so the schema is immediately useful without touching
-- the application layer. All three UPDATEs are idempotent (no-op on re-apply).
update public.verifiable_credentials
   set did = 'did:web:antarix.app:c/' || id::text
 where did is null;

update public.verifiable_credentials
   set issuance_date = snapshot_taken_at
 where issuance_date is null;

update public.verifiable_credentials
   set expiration_date = snapshot_taken_at + interval '2 years'
 where expiration_date is null;

-- =============================================================================
-- 2. public.vc_revocations — W3C-style revocation registry (v1)
-- =============================================================================

create table if not exists public.vc_revocations (
  id            uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.verifiable_credentials(id) on delete cascade,
  revoked_at    timestamptz not null default now(),
  reason        text
);

create index if not exists vc_revocations_credential_idx
  on public.vc_revocations(credential_id);

create index if not exists vc_revocations_revoked_at_idx
  on public.vc_revocations(revoked_at desc);

alter table public.vc_revocations enable row level security;

-- Public SELECT: third-party verifiers must be able to read the revocation
-- list without holding Supabase credentials.
drop policy if exists vc_revocations_public_read on public.vc_revocations;
create policy vc_revocations_public_read on public.vc_revocations
  for select using (true);

-- No INSERT / UPDATE / DELETE policies are created. With RLS enabled and no
-- permissive policy, anon and authenticated are denied; only the service_role
-- bypasses RLS, so writes are service-role-only.

-- =============================================================================
-- 3. public.vc_issuer_keys — issuer signing key registry
-- =============================================================================
-- The EdDSA (Ed25519) keypair used to sign `vc_proof`. The private key column
-- is intended to hold an *encrypted* blob (envelope encryption via the project's
-- KMS); never store plaintext private material here.

create table if not exists public.vc_issuer_keys (
  kid                  text primary key,
  alg                  text not null,
  public_key           text not null,        -- multibase / base64url per cryptosuite
  private_key_encrypted text,                 -- envelope-encrypted, null if pub-only
  created_at           timestamptz not null default now()
);

alter table public.vc_issuer_keys enable row level security;
-- No policies: service_role only. The private key is sensitive and must not
-- leak through anon / authenticated reads.

-- =============================================================================
-- 4. public.build_vc_document(p_credential_id) -> jsonb
-- Pure function of the input row. Constructs the W3C VC v2.0 JSON-LD envelope
-- from a verifiable_credentials row. Returns NULL if the row is missing.
-- =============================================================================

create or replace function public.build_vc_document(p_credential_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_row public.verifiable_credentials%rowtype;
  v_doc jsonb;
begin
  select * into v_row
  from public.verifiable_credentials
  where id = p_credential_id;

  if not found then
    return null;
  end if;

  v_doc := jsonb_build_object(
    '@context', jsonb_build_array(
      'https://www.w3.org/ns/credentials/v2',
      'https://antarix.app/credentials/skill-proof/v1'
    ),
    'type', jsonb_build_array(
      'VerifiableCredential',
      'AntarixSkillProof'
    ),
    'id', 'https://antarix.app/verify/' || v_row.public_slug || '/vc',
    'issuer', coalesce(v_row.issuer_did, 'did:web:antarix.app'),
    'validFrom', to_char(
      v_row.issuance_date at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ),
    'validUntil', to_char(
      v_row.expiration_date at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ),
    'credentialSubject', jsonb_build_object(
      'id', coalesce(v_row.did, 'did:web:antarix.app:c/' || v_row.id::text),
      'type', jsonb_build_array('AntarixSkillSubject'),
      'antarixSlug', v_row.public_slug,
      'overallScore', v_row.snapshot_overall_score,
      'perSkill', coalesce(v_row.snapshot_per_skill, '{}'::jsonb),
      'activityTotals', coalesce(v_row.snapshot_activity_totals, '{}'::jsonb),
      'cohortPercentile', v_row.snapshot_cohort_percentile,
      'snapshotTakenAt', to_char(
        v_row.snapshot_taken_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"'
      )
    )
  );

  return v_doc;
end $$;

-- =============================================================================
-- 5. public.sign_vc_document(p_credential_id, p_kid) -> jsonb
-- v1 STUB. Returns a W3C Data Integrity proof whose proofValue is a
-- deterministic sha256 placeholder over (canonicalized document || kid).
--
-- PRODUCTION NOTE
--   Replace the body of this function with a real EdDSA signature over the
--   document's RDFC-1.0 canonical form, using the private key material stored
--   in public.vc_issuer_keys.private_key_encrypted. The decryption key lives
--   in the project's KMS and should be fetched via the supabase service_role
--   inside the Edge Function rather than inlined here. This SQL function is a
--   safe placeholder until the EdDSA / canonicalization libraries are wired in.
-- =============================================================================

create or replace function public.sign_vc_document(p_credential_id uuid, p_kid text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_doc         jsonb;
  v_issuer_did  text;
  v_proof_value text;
begin
  v_doc := public.build_vc_document(p_credential_id);
  if v_doc is null then
    return null;
  end if;

  select coalesce(issuer_did, 'did:web:antarix.app')
    into v_issuer_did
  from public.verifiable_credentials
  where id = p_credential_id;

  -- Deterministic placeholder: sha256(canonicalized document text || kid).
  -- The `created` field below is a real timestamp (per W3C Data Integrity),
  -- but the proofValue itself is a function only of (doc, kid) so re-signing
  -- the same inputs yields the same bytes. PRODUCTION will replace this with
  -- ed25519 sign(URDNA2015(v_doc), private_key) from vc_issuer_keys.
  v_proof_value := encode(
    digest(
      v_doc::text || ':' || coalesce(p_kid, ''),
      'sha256'
    ),
    'base64'
  );

  return jsonb_build_object(
    'type', 'DataIntegrityProof',
    'cryptosuite', 'eddsa-rdfc-2022',
    'verificationMethod', v_issuer_did || '#' || p_kid,
    'created', to_char(now() at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'proofPurpose', 'assertionMethod',
    'proofValue', v_proof_value
  );
end $$;

-- =============================================================================
-- 6. public.resolve_did(p_did) -> jsonb
-- Returns a minimal W3C DID Document for the given DID, populated with the
-- default (earliest) verification method from public.vc_issuer_keys. This
-- function is what backs the `/.well-known/did.json` endpoint and the DID
-- resolution path used by third-party verifiers.
-- =============================================================================

create or replace function public.resolve_did(p_did text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_key     public.vc_issuer_keys%rowtype;
  v_methods jsonb := '[]'::jsonb;
  v_asserts jsonb := '[]'::jsonb;
  v_vm      jsonb;
begin
  select * into v_key
  from public.vc_issuer_keys
  order by created_at asc
  limit 1;

  if found then
    v_vm := jsonb_build_object(
      'id', p_did || '#' || v_key.kid,
      'type', case
                when v_key.alg like 'ed%'   then 'Ed25519VerificationKey2020'
                when v_key.alg like 'p-%'   then 'EcdsaSecp256k1VerificationKey2019'
                when v_key.alg like 'ec%'   then 'EcdsaSecp256k1VerificationKey2019'
                else 'JsonWebKey2020'
              end,
      'controller', p_did,
      'publicKeyMultibase', v_key.public_key
    );
    v_methods := jsonb_build_array(v_vm);
    v_asserts := jsonb_build_array(p_did || '#' || v_key.kid);
  end if;

  return jsonb_build_object(
    '@context',          jsonb_build_array('https://www.w3.org/ns/did/v1'),
    'id',                p_did,
    'verificationMethod', v_methods,
    'assertionMethod',   v_asserts
  );
end $$;
