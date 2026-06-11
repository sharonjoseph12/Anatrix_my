-- DPDP / SOC2 Audit Log Addendum
-- Ensure chain_mirror_audit is accessible to the auditor read-only role

DO $$
BEGIN
  -- Create audit_reader role if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_reader') THEN
    CREATE ROLE audit_reader NOLOGIN;
  END IF;

  -- Grant read access to chain_mirror_audit
  GRANT SELECT ON chain_mirror_audit TO audit_reader;
  GRANT SELECT ON chain_mirror_consents TO audit_reader;
  GRANT SELECT ON chain_mirror_revocations TO audit_reader;
  GRANT SELECT ON chain_mirror_queue TO audit_reader;
  GRANT SELECT ON chain_reputation_bonuses TO audit_reader;
  GRANT SELECT ON chain_mirror_schema TO audit_reader;

  -- Grant access to the metrics view
  GRANT SELECT ON daily_chain_mirror_metrics TO audit_reader;
END $$;
