-- 049_onchain_mirror.sql
-- 6 new tables + RLS + triggers + column extensions

CREATE TABLE chain_mirror_audit (
  id bigserial PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
  credential_id uuid REFERENCES verifiable_credentials(id) ON DELETE SET NULL,
  attestation_uid text,
  tx_hash text,
  block_number bigint,
  gas_used bigint,
  effective_gas_price_wei numeric(38,0),
  usd_cost numeric(10,6),
  consent_version text,
  action text NOT NULL CHECK (action IN ('mirror', 'unmirror', 'bulk_unmirror', 'consent_granted', 'consent_revoked', 'denied_tenant_disabled', 'denied_kill_switch', 'resolution_failed', 'kill_switch_engaged', 'unmirror_post_deletion', 'schema_registered', 'reputation_bonus_issued')),
  attempt_index int NOT NULL DEFAULT 1,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chain_mirror_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id uuid NOT NULL REFERENCES verifiable_credentials(id) ON DELETE CASCADE,
  attestation_uid text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'cancelled', 'dead_letter')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE TABLE chain_mirror_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  wallet_type text NOT NULL CHECK (wallet_type IN ('self_custody', 'platform_custodial')),
  wallet_address text NOT NULL,
  custodial_derivation_path text,
  consent_text_hash text NOT NULL,
  ip_hash text NOT NULL,
  user_agent text NOT NULL,
  CONSTRAINT chain_mirror_consents_ua_length CHECK (char_length(user_agent) <= 512)
);

CREATE TABLE chain_mirror_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id bigint NOT NULL REFERENCES chain_mirror_audit(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
  credential_id uuid NOT NULL REFERENCES verifiable_credentials(id) ON DELETE CASCADE,
  attestation_uid text NOT NULL,
  revoke_tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (reason IN ('user_request', 'deletion', 'tenant_disabled', 'kill_switch', 'dead_letter'))
);

CREATE TABLE chain_reputation_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id uuid NOT NULL REFERENCES verifiable_credentials(id) ON DELETE CASCADE,
  bonus_attestation_uid text NOT NULL UNIQUE,
  bonus_level int NOT NULL DEFAULT 1 CHECK (bonus_level = 1),
  attester_reputation_contract text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chain_mirror_schema (
  id bigserial PRIMARY KEY,
  version text NOT NULL UNIQUE,
  schema_string text NOT NULL,
  schema_uid text NOT NULL UNIQUE,
  registered_tx_hash text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'replaced')),
  registered_by uuid REFERENCES users(id)
);

-- users extensions
ALTER TABLE users
  ADD COLUMN onchain_mirror_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN wallet_address text,
  ADD COLUMN custodial_address_index int;

ALTER TABLE users
  ADD CONSTRAINT users_wallet_address_chk
    CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$');

ALTER TABLE users
  ADD CONSTRAINT users_custodial_address_chk
    CHECK (
      (wallet_address IS NULL AND custodial_address_index IS NULL)
      OR
      (wallet_address IS NOT NULL AND custodial_address_index IS NOT NULL AND custodial_address_index >= 0)
    );

CREATE INDEX users_onchain_mirror_opt_in_idx ON users(onchain_mirror_opt_in) WHERE onchain_mirror_opt_in = true;

-- institutions extensions
ALTER TABLE institutions
  ADD COLUMN onchain_mirror_enabled boolean NOT NULL DEFAULT true;

-- Indexes
CREATE INDEX chain_mirror_audit_student_idx ON chain_mirror_audit(student_id, created_at DESC);
CREATE INDEX chain_mirror_audit_credential_idx ON chain_mirror_audit(credential_id, created_at DESC);
CREATE INDEX chain_mirror_audit_institution_idx ON chain_mirror_audit(institution_id, created_at DESC) WHERE institution_id IS NOT NULL;
CREATE INDEX chain_mirror_audit_attestation_idx ON chain_mirror_audit(attestation_uid) WHERE attestation_uid IS NOT NULL;
CREATE INDEX chain_mirror_audit_action_idx ON chain_mirror_audit(action, created_at DESC);

CREATE INDEX chain_mirror_queue_dispatch_idx ON chain_mirror_queue(status, next_attempt_at) WHERE status IN ('pending', 'failed');
CREATE INDEX chain_mirror_queue_student_idx ON chain_mirror_queue(student_id, status);
CREATE UNIQUE INDEX chain_mirror_queue_inflight_uniq ON chain_mirror_queue(credential_id) WHERE status IN ('pending', 'submitted');

CREATE INDEX chain_mirror_consents_active_idx ON chain_mirror_consents(student_id, granted_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX chain_mirror_consents_version_idx ON chain_mirror_consents(student_id, consent_version);

CREATE INDEX chain_mirror_revocations_student_idx ON chain_mirror_revocations(student_id, revoked_at DESC);
CREATE INDEX chain_mirror_revocations_credential_idx ON chain_mirror_revocations(credential_id);
CREATE UNIQUE INDEX chain_mirror_revocations_attestation_uniq ON chain_mirror_revocations(attestation_uid);

CREATE INDEX chain_reputation_bonuses_student_idx ON chain_reputation_bonuses(student_id, issued_at DESC);
CREATE UNIQUE INDEX chain_reputation_bonuses_credential_uniq ON chain_reputation_bonuses(credential_id);
CREATE UNIQUE INDEX chain_reputation_bonuses_attestation_uniq ON chain_reputation_bonuses(bonus_attestation_uid);

CREATE INDEX chain_mirror_schema_active_idx ON chain_mirror_schema(status) WHERE status = 'active';
CREATE UNIQUE INDEX chain_mirror_schema_version_uniq ON chain_mirror_schema(version);
CREATE UNIQUE INDEX chain_mirror_schema_uid_uniq ON chain_mirror_schema(schema_uid);

-- Triggers
CREATE OR REPLACE FUNCTION chain_mirror_audit_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'chain_mirror_audit is append-only';
END;
$$;

CREATE TRIGGER chain_mirror_audit_no_update
  BEFORE UPDATE ON chain_mirror_audit
  FOR EACH ROW EXECUTE FUNCTION chain_mirror_audit_immutable();

CREATE TRIGGER chain_mirror_audit_no_delete
  BEFORE DELETE ON chain_mirror_audit
  FOR EACH ROW EXECUTE FUNCTION chain_mirror_audit_immutable();

-- RLS
ALTER TABLE chain_mirror_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_mirror_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_mirror_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_mirror_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_reputation_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_mirror_schema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_see_own_audit" ON chain_mirror_audit FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "student_see_own_queue" ON chain_mirror_queue FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "student_see_own_consents" ON chain_mirror_consents FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "student_insert_own_consents" ON chain_mirror_consents FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student_see_own_revocations" ON chain_mirror_revocations FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "student_see_own_bonuses" ON chain_reputation_bonuses FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "schema_read_all" ON chain_mirror_schema FOR SELECT USING (true);
