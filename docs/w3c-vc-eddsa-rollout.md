# W3C VC EdDSA Rollout — Stage-by-stage plan

This document is the source of truth for getting Antarix's W3C Verifiable
Credentials v2.0 issuance from "structurally-valid stub" to "cryptographically
valid EdDSA-signed credentials." It accompanies three artifacts:

- `supabase/migrations/032_w3c_vc.sql` — Stage 1, shipped.
- `supabase/migrations/039_w3c_vc_real_eddsa.sql` — Stage 2 (this rollout).
- `supabase/functions/credential-vc-issue/index.ts` — caller, will be patched
  in Stage 3.

The document is deliberately the *only* place that discusses the cryptographic
internals. The migration files and Edge Function code carry the "what is the
shipped shape" answer; this doc carries the "why this rollout and what's next."

---

## The 3-stage rollout

| Stage | Migration | State of `sign_vc_document` | `proofValue` | Cryptographic validity |
|---|---|---|---|---|
| **1** | `032_w3c_vc.sql` (shipped) | sha256 stub | base64( sha256( doc::text ‖ ':' ‖ kid ) ) | **Not valid.** Documented as such in the 032 header's "PRODUCTION NOTE". |
| **2** | `039_w3c_vc_real_eddsa.sql` (this rollout) | proof skeleton + handoff flag | `null` (with `edge_signing_required: true`) | **Not valid** until the Edge Function patch in Stage 3 attaches the real signature. Envelope is structurally valid; `document_hash_sha256` lets a verifier do an integrity check on the *envelope content* before the signature is attached. |
| **3** | future `04x_w3c_vc_stage3.sql` + Edge Function patch | real EdDSA signed by Edge Function | `m` + base64url(64-byte Ed25519 signature) | **Valid** per W3C VC v2.0 + eddsa-rdfc-2022 cryptosuite, *provided* canonicalization is RDFC-1.0. |

### Why three stages instead of one

A single migration that does "real EdDSA in PL/pgSQL" is **Plan A** in the 039
header. It is not shippable because:

1. The standard Supabase Postgres extension set as of 2026 does **not**
   include `pg_eddsa`. Implementing Ed25519 in PL/pgSQL by hand is possible
   but a single sign-bit or curve-arithmetic bug would silently invalidate
   every credential the system ever issues.
2. There is no `psql` or local Postgres in the Antarix dev environment, so
   SQL cannot be tested in CI. The project rule "no cryptographic code
   without a test target" is absolute.
3. Even with a test target, validating an EdDSA implementation against the
   W3C test vectors requires a real verifier — that's weeks of work for a
   single migration.

**Plan C** — Stage 2 + Stage 3 — is the only path that respects the
"don't ship crypto without tests" rule and still gets us to a real
signature. Stage 2 is the SQL handoff. Stage 3 is the Edge Function
signing.

> Plans A and B (PL/pgSQL Ed255SA, PL/Python `pgpy`) are explicitly **out
> of scope** for v1. They are mentioned here only so future maintainers
> understand why Stage 2 looks the way it does. They are *not* on the
> recommended path. The recommended v2 path, when Supabase eventually
> ships `pg_eddsa`, is to **re-absorb signing into SQL and remove the Edge
> Function from the signing path** — but only after a real verifier test
> suite is in place.

---

## Stage 2 — what ships in this rollout

### Schema

No schema changes. Migration 039 contains a single `create or replace
function public.sign_vc_document(...)` and no DDL.

### Function contract — byte-for-byte compatible

```
sign_vc_document(p_credential_id uuid, p_kid text) returns jsonb
```

The 032 stub and the 039 replacement have **identical** parameter lists
and return types. The return object's keys:

| key | 032 (Stage 1) | 039 (Stage 2) | Notes |
|---|---|---|---|
| `type` | `"DataIntegrityProof"` | `"DataIntegrityProof"` | unchanged |
| `cryptosuite` | `"eddsa-rdfc-2022"` | `"eddsa-rdfc-2022"` | unchanged |
| `verificationMethod` | `did:web:antarix.app#<kid>` | `did:web:antarix.app#<kid>` | unchanged |
| `created` | RFC 3339 UTC | RFC 3339 UTC | unchanged (real timestamp) |
| `proofPurpose` | `"assertionMethod"` | `"assertionMethod"` | unchanged |
| `proofValue` | `<base64 sha256 stub>` | **`null`** | **the only breaking shape change** |
| `edge_signing_required` | (absent) | **`true`** | **new** |
| `canonicalization_algorithm` | (absent) | `"sha256-of-text-not-rdfc-1.0"` | **new** |
| `document_hash_sha256` | (absent) | `<64 hex chars>` | **new** |

`proofValue` going from `<stub>` to `null` is a behavioural change. Verifiers
that check the field will reject Stage 2 proofs as "no signature yet." That
is **acceptable for the v1 dev environment** and is the entire point: the
caller (Edge Function) can now distinguish "signed" from "envelope ready,
signature pending" by reading `edge_signing_required` instead of
guessing from the `proofValue` length or contents.

### Error contract

The function returns `{"error": "<code>"}` on the failure paths, matching
the existing 032 convention of "the function never throws — callers
branch on null/error key":

- `{"error": "credential_not_found"}` — the UUID is not in
  `verifiable_credentials`. Returned as a non-null JSONB.
- `{"error": "issuer_key_not_found"}` — `p_kid` is not in
  `vc_issuer_keys`. Returned as a non-null JSONB.
- `null` is no longer a possible return — if the function gets to the end
  of its body, it returns a proof object. The Edge Function's current
  `if (signErr || !vcProof)` 500-handler will need a small tweak in Stage 3
  to also branch on `vcProof.error`. Stage 2 keeps the current behaviour
  intact for callers that don't check `error`.

### Deployment procedure

1. **Apply the migration.** Locally or via CI:
   ```bash
   npx supabase db reset                       # wipes + re-applies everything
   # or, in a shared dev project:
   npx supabase db push                        # additive, idempotent
   ```
   The migration is `create or replace function`-idempotent. Re-running it
   on a database that already has Stage 1 is a no-op except for replacing
   the function body.

2. **Confirm the new shape.** From the Supabase SQL editor or `psql`:
   ```sql
   select public.sign_vc_document(
     (select id from public.verifiable_credentials limit 1),
     (select kid from public.vc_issuer_keys limit 1)
   );
   ```
   Expect: a JSONB object whose `proofValue` key is JSON `null`,
   `edge_signing_required` is `true`, and `document_hash_sha256` is a
   64-char hex string.

3. **Seed the issuer key.**
   ```bash
   export SUPABASE_URL=https://<project>.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
   deno run --allow-net --allow-env --allow-read scripts/seed-issuer-key.ts
   ```
   Or, on Node 20+:
   ```bash
   npm install @supabase/supabase-js
   node --experimental-strip-types scripts/seed-issuer-key.ts
   ```
   The script will print the new `publicKeyMultibase` and a step-by-step
   `did.json` update instruction.

4. **Update `apps/web/public/.well-known/did.json`.** Replace the
   `z6MkTBD_REPLACE_…` placeholder with the printed `publicKeyMultibase`.
   The file is already W3C DID Core compliant; only that one field changes.

5. **Flag in the changelog.** Until Stage 3 lands, every `vc_proof` row in
   `verifiable_credentials` has `proofValue: null`. Add a banner to
   `docs/w3c-vc-impl.md` §Changelog noting that the v1 dev environment is
   shipping Stage 2 proofs and the cryptographic-validity ETA is Stage 3.

6. **(Optional) Re-run existing issuances.** There is no need to re-issue
   already-issued credentials. Stage 1's `proofValue` was a deterministic
   sha256 stub; Stage 2's `proofValue: null` is the *correct* signal that
   the row is ready for Stage 3. The Edge Function's 409-on-`vc_document`
   idempotency check will block re-issuance, which is the intended
   behaviour — see "Re-signing existing rows" below.

### Re-signing existing rows (admin path)

If a credential was issued under Stage 1 and you want to bring it forward
to Stage 3 *without* going through the Edge Function (e.g. a bulk
re-sign script), the procedure is:

1. Clear `vc_document` and `vc_proof` on the row:
   ```sql
   update public.verifiable_credentials
      set vc_document = null, vc_proof = null
    where id = '<uuid>';
   ```
2. Re-call `credential-vc-issue` with the same JWT. The Edge Function will
   treat it as a fresh issuance (no 409).

The function is the public, auditable re-sign path. Direct SQL rewrites
of `vc_proof` are a support-tier action only.

---

## Stage 3 — the Edge Function patch

Stage 3 is **not** shipped with this rollout. It is documented here so the
Stage 2 plumbing is intentionally shaped to receive it without further
schema work.

### What changes

`supabase/functions/credential-vc-issue/index.ts` gets a ~30-line patch:

1. After calling `sign_vc_document` and getting a proof with
   `edge_signing_required: true`:
   - Look up the matching `vc_issuer_keys.private_key_encrypted`.
   - Decrypt the PEM (Stage 3a: in-process; Stage 3b: KMS-backed; Stage 3a
     is acceptable for v1 dev, Stage 3b is the production path).
   - Import the PEM as a `CryptoKey` via
     `crypto.subtle.importKey("pkcs8", der, {name: "Ed25519"}, false, ["sign"])`.
2. Canonicalize the document with **`@digitalbazaar/rdf-canonize`** (the
   reference Deno port). The canonical bytes are the message to sign.
3. Sign with `crypto.subtle.sign("Ed25519", privateKey, canonicalBytes)`.
4. Encode the 64-byte signature as `m` + base64url-no-padding and write
   it back to `proof.proofValue`.
5. **Set `edge_signing_required: false`** on the returned proof object so
   downstream verifiers can tell the signature is final.
6. Persist the patched proof as `vc_proof` and return it to the caller.

### Pseudocode

```ts
import * as canonize from "https://esm.sh/@digitalbazaar/rdf-canonize@3.4.0";

const vcDoc = await rpc("build_vc_document", { p_credential_id: id });
const proof = await rpc("sign_vc_document", {
  p_credential_id: id, p_kid: kid,
});

if (proof?.edge_signing_required === true) {
  // Re-canonicalize and sign in Deno.
  const canonical = await canonize.default(vcDoc);
  const sig = new Uint8Array(
    await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))
  );
  proof.proofValue = "m" + bytesToBase64Url(sig);
  proof.edge_signing_required = false;
  proof.canonicalization_algorithm = "urdna2015";
}

await db.update("verifiable_credentials", { vc_document: vcDoc, vc_proof: proof }, id);
return { did, vc_document: vcDoc, vc_proof: proof };
```

### Stage 3 SQL migration

A small follow-up migration (placeholder filename:
`040_w3c_vc_stage3_passthrough.sql`) updates the SQL function so that it
returns `edge_signing_required: false` and is effectively a pass-through
for envelope shaping. The Edge Function becomes the only signer. A
*later* migration, when `pg_eddsa` is available, can absorb the signing
back into SQL and remove the Edge Function from the signing path.

---

## Key rotation

Same procedure as in `docs/w3c-vc-strategy.md` and `docs/w3c-vc-impl.md`,
restated for completeness:

1. Generate a new key by editing the `KID` constant in
   `scripts/seed-issuer-key.ts` to `key-2026-02` (or whatever the next
   `kid` is). Run the script. The new row is added; the old row is
   preserved.
2. Update `apps/web/public/.well-known/did.json` to add a new entry to
   `verificationMethod` and to add the new `kid` reference to
   `authentication[]` and `assertionMethod[]`. **Do not** remove the old
   `kid` — verifiers may hold credentials signed under it.
3. Update `supabase/functions/credential-vc-issue/index.ts` to pick the
   *new* key. The current implementation picks the earliest
   `created_at`; for rotation it should instead take a `kid` from an env
   var (e.g. `ACTIVE_VC_ISSUER_KID`) with a fallback to the earliest
   for dev.
4. After a **1-year overlap window** (the longest
   `expiration_date - issuance_date` we issue), delete the old key:
   ```sql
   delete from public.vc_issuer_keys where kid = 'key-2026-01';
   ```
   and remove its entry from `did.json`. Any verifier still holding a
   credential signed under the old key after that point will fail
   signature verification — that is correct.

---

## Compromise response

If the private key material in `private_key_encrypted` is suspected or
known to be compromised:

1. **Wipe the leaked key.**
   ```sql
   update public.vc_issuer_keys
      set private_key_encrypted = null
    where kid = '<compromised-kid>';
   ```
   Optionally delete the row outright; the public-key material in
   `did.json` is still useful for verifying historical credentials.
2. **Revoke every credential signed under the compromised key.** This
   requires a `credential_id` list, which the resolver join on
   `vc_revocations` makes straightforward:
   ```sql
   insert into public.vc_revocations (credential_id, reason)
   select id, 'issuer_key_compromised'
     from public.verifiable_credentials
    where vc_proof->>'verificationMethod' like '%#<compromised-kid>';
   ```
   The `credential-vc-resolve` Edge Function reads this table and
   returns `410` with `didDocumentMetadata.deactivated=true` for any
   revoked row.
3. **Generate a new key** via `scripts/seed-issuer-key.ts` (edit `KID`
   to e.g. `key-2026-02`), update `did.json`, and re-deploy. Existing
   users must re-issue; the user flow for re-issuance is already
   documented in `docs/w3c-vc-impl.md`.
4. **Post-mortem.** File an internal incident report, rotate the KMS
   key (or, in v1 dev, the `private_key_encrypted` column), and check
   the observability logs for any issuance request that came from an
   unusual IP / user agent / kid in the window of compromise.

---

## Open items

1. **KMS integration.** Stage 2 stores the private key as a PEM in a
   Postgres column with a `# DEV ONLY` comment. The v1 production
   posture is to move this to envelope-encrypted storage backed by
   Supabase Vault or an external KMS (AWS KMS, GCP KMS, HashiCorp Vault
   Transit). The Stage 3 Edge Function patch is the natural place to
   add a KMS `sign` RPC; the SQL function never needs to know the key
   is in KMS.
2. **`pg_eddsa` adoption.** When Supabase ships `pg_eddsa` (or when we
   move off Supabase), the SQL function can absorb signing again.
   Expected migration: re-write `sign_vc_document` in PL/pgSQL using
   `pg_eddsa.sign`, remove the `edge_signing_required` flag, and delete
   the Edge Function patch from Stage 3. No user-facing API change.
3. **W3C VC Status List 2021.** The `vc_revocations` table is the v1
   status-list registry. When we move to a proper Status List 2021
   credential, the table stays (it's the source of truth) and a new
   `vc_status_list2021_credential` materialized view is added. The
   resolver Edge Function is updated to return the credential instead
   of (or alongside) the raw table. Out of scope for this rollout.
4. **JSON-LD canonicalization library.** Stage 3 needs an
   RDFC-1.0 / URDNA2015 implementation in Deno.
   `@digitalbazaar/rdf-canonize@3.4.0` is the reference JS port and is
   available on `esm.sh`. Verification also needs
   `@digitalbazaar/crypto-ld` or `@noble/ed25519`. Both are first-class
   Deno targets.
5. **Verification test suite.** Once Stage 3 lands, the `docs/api-verification.md`
   curl example should be turned into a real end-to-end test (resolve
   DID → fetch credential → verify signature with the public key → check
   revocation). The Node.js reference client in that doc is the seed of
   that test.

---

## Test vector

This is a hand-verifiable Stage 1 / Stage 2 cross-check. Anyone reverting
to Stage 1 for debugging, or validating a re-implementation, can use it
to confirm the SQL function's output for a known input.

### Sample `vc_document`

The exact JSON the function reads (or builds, in the current Edge Function
flow) — written as Postgres `jsonb` canonical text (the serialization
`jsonb::text` produces):

```
{"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential"],"id":"https://antarix.app/verify/test-slug/vc","issuer":"did:web:antarix.app","validFrom":"2026-01-01T00:00:00Z","validUntil":"2028-01-01T00:00:00Z","credentialSubject":{"id":"did:web:antarix.app:c/00000000-0000-0000-0000-000000000000","type":["AntarixSkillSubject"]}}
```

(Note: no whitespace. Postgres `jsonb` strips formatting on input; `jsonb::text`
emits a single-line, key-order, compact form. The string above is that form.)

### Expected `document_hash_sha256` (Stage 2)

```
fe3283afb63f0b0f5592dadd548c2fd9d01c9afa4fb80c788f8539eceeba0547
```

Verify with:

```bash
echo -n '{"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential"],"id":"https://antarix.app/verify/test-slug/vc","issuer":"did:web:antarix.app","validFrom":"2026-01-01T00:00:00Z","validUntil":"2028-01-01T00:00:00Z","credentialSubject":{"id":"did:web:antarix.app:c/00000000-0000-0000-0000-000000000000","type":["AntarixSkillSubject"]}}' | sha256sum
```

In Postgres:

```sql
select encode(
  digest(
    '{"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential"],"id":"https://antarix.app/verify/test-slug/vc","issuer":"did:web:antarix.app","validFrom":"2026-01-01T00:00:00Z","validUntil":"2028-01-01T00:00:00Z","credentialSubject":{"id":"did:web:antarix.app:c/00000000-0000-0000-0000-000000000000","type":["AntarixSkillSubject"]}}',
    'sha256'
  ),
  'hex'
);
-- fe3283afb63f0b0f5592dadd548c2fd9d01c9afa4fb80c788f8539eceeba0547
```

### Expected `proofValue` (Stage 1, for debugging only)

If you revert to the 032 stub for debugging, the `proofValue` for this
document with `kid = 'key-2026-01'` is:

```
iwTWURw/TpVdhIZVCOn2s8mZ09ne8n4fAbkKpkdKzXQ=
```

That is `base64( sha256( vc_document::text || ':' || 'key-2026-01' ) )`.
Verify with:

```bash
echo -n '<vc_document_text>:key-2026-01' | sha256sum | xxd -r -p | base64
```

The fact that Stage 1 has a deterministic, *reproducible* `proofValue` for
this input is the property that makes it useful as a test vector even
though it is **not** a real Ed25519 signature.

### What Stage 3 should produce for the same input

Not computable from this doc — depends on the canonicalization library and
the actual private key. Stage 3 will publish its own test vector
(pubkey, message, signature) in a follow-up doc, sourced from
[`@noble/ed25519`'s test vectors](https://github.com/paulmillr/noble-ed25519)
to keep the spec in lockstep with the reference implementation.
