// ─── 009 On-Chain Mirror Types ───────────────────────────────────────────────
// Types for all 6 tables + action unions + consent version + chain ID literal

/** Base L2 chain ID */
export const BASE_CHAIN_ID = 8453 as const;
export type BaseChainId = typeof BASE_CHAIN_ID;

// ─── Action unions ──────────────────────────────────────────────────────────

export type MirrorAction =
  | 'mirror'
  | 'unmirror'
  | 'bulk_unmirror'
  | 'consent_granted'
  | 'consent_revoked'
  | 'denied_tenant_disabled'
  | 'denied_kill_switch'
  | 'resolution_failed'
  | 'kill_switch_engaged'
  | 'unmirror_post_deletion'
  | 'schema_registered'
  | 'reputation_bonus_issued';

export type QueueStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'dead_letter';

export type WalletType = 'self_custody' | 'platform_custodial';

export type RevocationReason =
  | 'user_request'
  | 'deletion'
  | 'tenant_disabled'
  | 'kill_switch'
  | 'dead_letter';

export type SchemaStatus = 'active' | 'superseded' | 'replaced';

export type ConsentVersion = 'v1.0';

// ─── Table row types ────────────────────────────────────────────────────────

export interface ChainMirrorAudit {
  id: number;
  student_id: string;
  institution_id: string | null;
  credential_id: string | null;
  attestation_uid: string | null;
  tx_hash: string | null;
  block_number: number | null;
  gas_used: number | null;
  effective_gas_price_wei: string | null; // numeric as string
  usd_cost: number | null;
  consent_version: string | null;
  action: MirrorAction;
  attempt_index: number;
  error_message: string | null;
  created_at: string;
}

export interface ChainMirrorQueue {
  id: string;
  student_id: string;
  credential_id: string;
  attestation_uid: string | null;
  status: QueueStatus;
  next_attempt_at: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface ChainMirrorConsent {
  id: string;
  student_id: string;
  consent_version: ConsentVersion;
  granted_at: string;
  revoked_at: string | null;
  wallet_type: WalletType;
  wallet_address: string;
  custodial_derivation_path: string | null;
  consent_text_hash: string;
  ip_hash: string;
  user_agent: string;
}

export interface ChainMirrorRevocation {
  id: string;
  audit_id: number;
  student_id: string;
  institution_id: string | null;
  credential_id: string;
  attestation_uid: string;
  revoke_tx_hash: string;
  block_number: number;
  revoked_at: string;
  reason: RevocationReason;
}

export interface ChainReputationBonus {
  id: string;
  student_id: string;
  credential_id: string;
  bonus_attestation_uid: string;
  bonus_level: 1;
  attester_reputation_contract: string;
  issued_at: string;
}

export interface ChainMirrorSchema {
  id: number;
  version: string;
  schema_string: string;
  schema_uid: string;
  registered_tx_hash: string;
  registered_at: string;
  status: SchemaStatus;
  registered_by: string | null;
}

// ─── Insert types ───────────────────────────────────────────────────────────

export type ChainMirrorAuditInsert = Omit<ChainMirrorAudit, 'id' | 'created_at'> & {
  created_at?: string;
};

export type ChainMirrorQueueInsert = Omit<ChainMirrorQueue, 'id' | 'created_at' | 'confirmed_at' | 'attempt_count' | 'max_attempts' | 'status' | 'next_attempt_at'> & {
  id?: string;
  status?: QueueStatus;
  next_attempt_at?: string;
};

export type ChainMirrorConsentInsert = Omit<ChainMirrorConsent, 'id' | 'granted_at' | 'revoked_at'> & {
  id?: string;
  granted_at?: string;
};
