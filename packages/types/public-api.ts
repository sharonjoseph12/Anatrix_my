// Public API types — mirrors migration 037 (api_keys, webhook_subscriptions, webhook_deliveries)
// SECURITY: ApiKey and WebhookSubscription intentionally omit `key_hash` / `secret_hash`.
// These fields are bcrypt-hashed and must never be returned to the client.

export type ApiKeyScope =
  | "read:public_profile"
  | "read:verifiable_credential"
  | "webhook:subscribe"
  | "read:placement_aggregate";

export type WebhookEvent =
  | "score.updated"
  | "credential.issued"
  | "placement.confirmed";

export type WebhookDeliveryStatus =
  | "pending"
  | "success"
  | "retry"
  | "failed_permanent";

export interface ApiKey {
  id: string;
  subject_id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface WebhookSubscription {
  id: string;
  api_key_id: string;
  event: WebhookEvent;
  target_url: string;
  active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: number; // bigserial
  subscription_id: string;
  event_id: string;
  status: WebhookDeliveryStatus;
  attempt: number;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

// Matches the "Error response shape" section of specs/004-eleven-of-ten/contracts/api.md.
// Used uniformly across internal and public API surfaces.
export interface PublicApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
