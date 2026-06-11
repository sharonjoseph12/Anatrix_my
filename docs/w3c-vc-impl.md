# W3C Verifiable Credentials — Edge Function implementation (v1)

Companion to [`docs/w3c-vc-strategy.md`](./w3c-vc-strategy.md) and migration
[`supabase/migrations/032_w3c_vc.sql`](../supabase/migrations/032_w3c_vc.sql).
This doc covers the *runtime* layer: two new Edge Functions that wrap the
SECURITY DEFINER SQL helpers from 032 and expose them to issuance clients
and third-party verifiers.

## 1. File index

| Path                                                            | Role                                |
|-----------------------------------------------------------------|-------------------------------------|
| `supabase/functions/credential-vc-issue/index.ts`               | Authenticated issuer endpoint       |
| `supabase/functions/credential-vc-resolve/[did]/index.ts`       | Public DID + credential resolver    |
| `supabase/functions/_shared/observability.ts`                   | (from A-3) `withObservability` wrap |
| `supabase/migrations/032_w3c_vc.sql`                            | Schema + 3 SQL helpers              |

Both functions are wrapped with `withObservability(name, handler)` so every
request is emitted as a structured JSON access log and an OpenTelemetry-
shaped span tree. Child spans are created around each DB call
(`db.select.*`, `db.update.*`, `rpc.*`) so a slow trace points directly at
the offending SQL helper.

## 2. How the two functions chain with the 032 SQL helpers

### Issue (`POST /functions/v1/credential-vc-issue`, JWT-gated)

```
[client] --(POST { credential_id })--> credential-vc-issue
                  │
                  ├─ ctx.userId from JWT.sub                (401 if absent)
                  ├─ SELECT id,user_id,did,vc_document … FROM verifiable_credentials
                  │     - 404 if !row OR row.user_id ≠ ctx.userId
                  │     - 409 if row.vc_document IS NOT NULL  (idempotency)
                  ├─ SELECT kid FROM vc_issuer_keys ORDER BY created_at LIMIT 1
                  │     - 500 "no_issuer_key" if empty
                  ├─ RPC build_vc_document(credential_id)      (032 §4)
                  ├─ RPC sign_vc_document(credential_id, kid)  (032 §5)
                  └─ UPDATE verifiable_credentials
                       SET vc_document, vc_proof, did,
                           issuance_date, expiration_date
                  → 200 { did, vc_document, vc_proof }
```

The same `kid` is used to sign and is what `resolve_did` (032 §6) will
publish as the DID Document's earliest `verificationMethod`. That symmetry
is the only thing that ties signature and verification together until the
real EdDSA crypto lands (see §3).

### Resolve (`GET /functions/v1/credential-vc-resolve/<did>`, public)

```
[verifier] --(GET <did>)--> credential-vc-resolve
                  │
                  ├─ Parse path, decodeURIComponent, regex-match
                  │     ^did:web:antarix\.app:c\/<uuid>$
                  │     - 400 "invalid_did" on mismatch
                  ├─ RPC resolve_did(did)                       (032 §6)
                  ├─ SELECT vc_document, vc_proof, issuance_date,
                  │         expiration_date, revocation_status
                  │     FROM verifiable_credentials WHERE did = $1
                  │     - 404 with didResolutionMetadata.error="notFound"
                  ├─ SELECT revoked_at, reason FROM vc_revocations
                  │     WHERE credential_id = $1
                  │     - 410 "revoked" + didDocumentMetadata.deactivated=true
                  │     - also honours legacy revocation_status='revoked'
                  └─ → 200 W3C DID Resolution envelope:
                       { didDocument, didResolutionMetadata,
                         didDocumentMetadata, credential, credentialProof }
```

Both functions use the **service-role** Supabase client. The SQL helpers
are SECURITY DEFINER, but the table UPDATE in `credential-vc-issue` is
not, and the public SELECT in `credential-vc-resolve` runs against tables
that intentionally have no anon SELECT policy on `verifiable_credentials`
(only `vc_revocations` is public-readable). Service-role bypasses RLS for
both. Ownership in the issue function is enforced **in code** (`row.user_id
=== ctx.userId`) on top of RLS — the resolve function performs **no**
ownership check, that is the whole point.

## 3. Cryptography: v1 stub → v2 real EdDSA (follow-up `034_*.sql`)

`public.sign_vc_document` currently returns a Data Integrity proof whose
`proofValue` is a deterministic `sha256(canonical(doc) || ':' || kid)`,
base64-encoded. It claims `cryptosuite: "eddsa-rdfc-2022"` but the bytes
are **not** an EdDSA signature. This is a deliberate v1 placeholder so
the Edge Functions, DID Resolution flow, third-party integration shape,
and downstream UI can all be built and end-to-end-tested before the
crypto wiring lands.

**Upgrade path — migration `034_w3c_vc_real_eddsa.sql`:**

1. The 034 migration replaces the body of `sign_vc_document(uuid, text)`
   with one that:
   - Reads `vc_issuer_keys.private_key_encrypted` for the given `kid`.
   - Calls `extensions.kms_decrypt(private_key_encrypted)` (Supabase Vault
     or AWS KMS, decision TBD per `w3c-vc-strategy.md` §6 Q2) to recover
     the raw Ed25519 private scalar.
   - Canonicalizes the JSON-LD document per
     [RDFC-1.0](https://www.w3.org/TR/rdf-canon/) (URDNA2015 in legacy
     terms). Postgres cannot do this; the canonicalization is done in
     the Edge Function and passed in as a new third argument, OR the
     whole sign step moves out of SQL into Deno.
   - Produces a real Ed25519 signature.
2. **Recommended Deno deps** (import via esm.sh, no npm install needed):

   ```ts
   import * as rdfc from "https://esm.sh/@digitalbazaar/rdf-canonize@4.0.1";
   import * as ed   from "https://esm.sh/@noble/ed25519@2.1.0";
   ```

   `rdfc.canonize(quads, { algorithm: "RDFC-1.0" })` produces the
   canonical N-Quads. `ed.signAsync(bytes, privKey)` produces the
   64-byte signature; multibase-encode (`z` prefix, base58btc) for the
   `proofValue` field.
3. Because the v1 SQL function signature is preserved (`(uuid, text) ->
   jsonb`), `credential-vc-issue/index.ts` does **not** need to change
   when 034 lands — the same RPC call returns a real proof instead of a
   sha256 stub.
4. **Why we did not do this in v1:** Postgres has no Ed25519 primitives
   built in, and adding `pgcrypto`'s minimal EC support pulls in
   complexity that is not justified before the third-party integration
   shape is locked. Deferring also lets KMS choice (Vault vs AWS KMS vs
   GCP KMS) be made independently of the schema.

## 4. Why `did:web`, and the upgrade path to `did:key`

We chose `did:web:antarix.app:c/<uuid>` because:

- **Zero new infra.** Resolution is a static GET against a domain we
  already own. Verifiers do not need a Hyperledger Indy node, an ION
  endpoint, an Ethereum RPC, or any blockchain access.
- **Human-debuggable.** `curl https://antarix.app/c/<uuid>/did.json`
  returns the same DID Document that the verifier will load.
- **Aligns with EU EBSI / EUDI Wallet roadmap.** Both reference
  architectures accept `did:web` for institutional issuers.

The cost is **centralization**: every resolution hits an antarix.app
endpoint, so we can theoretically observe verifier traffic and we are a
single point of failure for revocation.

### Upgrade path to `did:key` (per-credential, self-certifying)

`did:key:z<multibase-pubkey>` embeds the public key in the DID itself.
A verifier needs only the DID string to recover the signing key — no
network call required. This is ideal for short-lived per-credential DIDs
(score snapshots that are valid for ≤ 2 years).

To migrate:

1. In `credential-vc-issue`, generate a fresh Ed25519 keypair per
   credential (Deno `crypto.subtle.generateKey({ name: "Ed25519" })`,
   or `@noble/ed25519`).
2. Compute `did = "did:key:z" + multibase(publicKey)`. Write it to
   `verifiable_credentials.did` (the unique partial index from 032 §1
   already enforces uniqueness).
3. Sign with the per-credential private key, then **discard the private
   key**. This is a *commit-and-forget* pattern: the public key is in
   the DID, the signature in `vc_proof`; the credential cannot be
   re-signed or revoked-by-rotation, but it also cannot be silently
   forged later if our issuer KMS is compromised.
4. Revocation continues to use `vc_revocations` (the registry is keyed
   by `credential_id`, not by DID method). The resolve function does
   not need to change.

`did:web` and `did:key` can co-exist: the resolve function's regex would
relax to `^did:(web|key):…`, and `resolve_did` would branch on the
method portion.

## 5. End-to-end third-party verification flow

A recruiter platform wants to verify that *student S has Skill Proof
Score 78, signed by Antarix, not revoked, valid right now*.

### 5.1 Discover the DID

The student's public profile page (or LinkedIn badge) embeds
`did:web:antarix.app:c/<uuid>`.

### 5.2 Resolve

```bash
curl -sS \
  "https://<project>.functions.supabase.co/credential-vc-resolve/did:web:antarix.app:c/3e1f9a2b-...-..."
```

(URL-encode the DID's colons and slashes if your HTTP client is fussy —
the function accepts both forms.)

Successful response (`200 application/did+ld+json`):

```jsonc
{
  "didDocument": {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:web:antarix.app:c/3e1f9a2b-...",
    "verificationMethod": [{
      "id": "did:web:antarix.app:c/3e1f9a2b-...#key-2024-01",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:web:antarix.app:c/3e1f9a2b-...",
      "publicKeyMultibase": "z6Mk…"
    }],
    "assertionMethod": ["did:web:antarix.app:c/3e1f9a2b-...#key-2024-01"]
  },
  "didResolutionMetadata": { "contentType": "application/did+json" },
  "didDocumentMetadata": {
    "created":   "2026-06-01T12:00:00Z",
    "updated":   "2026-06-01T12:00:00Z",
    "deactivated": false,
    "nextUpdate": "2028-06-01T12:00:00Z"
  },
  "credential": {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://antarix.app/credentials/skill-proof/v1"
    ],
    "type": ["VerifiableCredential", "AntarixSkillProof"],
    "id": "https://antarix.app/verify/<slug>/vc",
    "issuer": "did:web:antarix.app",
    "validFrom":  "2026-06-01T12:00:00Z",
    "validUntil": "2028-06-01T12:00:00Z",
    "credentialSubject": {
      "id": "did:web:antarix.app:c/3e1f9a2b-...",
      "type": ["AntarixSkillSubject"],
      "antarixSlug":     "<slug>",
      "overallScore":    78,
      "perSkill":        { "python": 82, "sql": 71, … },
      "activityTotals":  { "github_commits_90d": 142, … },
      "cohortPercentile": 87,
      "snapshotTakenAt": "2026-06-01T12:00:00Z"
    }
  },
  "credentialProof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "verificationMethod": "did:web:antarix.app#key-2024-01",
    "created": "2026-06-01T12:00:01Z",
    "proofPurpose": "assertionMethod",
    "proofValue": "z3MvX…"
  }
}
```

### 5.3 Verify (verifier-side, no Antarix call needed after this point)

1. **Schema.** `credential.@context` contains
   `https://www.w3.org/ns/credentials/v2` and the type array contains
   `VerifiableCredential`.
2. **Temporal.** `now ∈ [credential.validFrom, credential.validUntil]`.
3. **Issuer key bound to DID.**
   `credentialProof.verificationMethod` resolves to an entry in
   `didDocument.verificationMethod[]`, and that entry's id appears in
   `didDocument.assertionMethod[]`.
4. **Signature.** Recover the Ed25519 public key from the verification
   method's `publicKeyMultibase`. Canonicalize `credential` per RDFC-1.0,
   verify the signature in `credentialProof.proofValue`.
   *(v1 stub note: the proofValue is currently a sha256 placeholder; a
   verifier built against v2 will fail on this step until migration 034
   lands. v1 third-party tests should treat the signature step as
   advisory.)*
5. **Revocation.** The 410-Gone status from this same endpoint is the
   single source of truth. Verifiers SHOULD re-resolve before relying on
   a cached document older than `Cache-Control: max-age=60`.

### 5.4 Status codes the verifier will see

| HTTP | meaning                                            |
|-----:|----------------------------------------------------|
| 200  | resolved, credential present, not revoked          |
| 400  | malformed DID — do not retry                       |
| 404  | DID well-formed but no row — treat as "unknown"    |
| 410  | revoked — body includes `revoked_at` + `reason`    |
| 5xx  | transient — retry with backoff                     |

## 6. Rate-limiting

`credential-vc-resolve` is internet-facing and unauthenticated; it is the
function most likely to be scraped or DoS'd. Two layers are planned:

1. **Per-IP edge rate-limit** at the CDN in front of Supabase Functions
   (Cloudflare / Fastly rule: 60 req/min per IP per DID-prefix). This
   should be configured *before* this function is publicly announced.
2. **Application-layer wrapper** once Agent B-3's
   `supabase/functions/_shared/rate-limit.ts` lands. The shape will be
   approximately:

   ```ts
   serve(withObservability("credential-vc-resolve",
     withRateLimit({ key: "ip+did", capacity: 60, refillPerMin: 60 },
       handler)));
   ```

   Drop-in once that file ships; no other code in this function needs to
   change.

The `credential-vc-issue` function is JWT-gated and therefore already
rate-limited per-user via Supabase Auth's built-in throttle, but it
SHOULD pick up the same `withRateLimit` wrapper (key by `ctx.userId`,
capacity ~10 issuances per hour) when available, to defend against a
compromised user token issuing thousands of credentials.

## 7. Follow-ups & open questions inherited from A-1

These are tracked in `docs/w3c-vc-strategy.md` §6; restated here for the
implementer's benefit:

- [ ] `034_w3c_vc_real_eddsa.sql` — replace `sign_vc_document` body.
- [ ] Static endpoints `https://antarix.app/.well-known/did.json` and
      `https://antarix.app/c/<uuid>/did.json` served by `apps/web`.
      Both should render from `public.resolve_did(...)` and cache hard.
- [ ] VC Status List 2021 bitstring (`vc_revocations` is the v1
      registry; the v2 format encodes revocations as a separate VC).
- [ ] Seed `vc_issuer_keys` with the production Ed25519 key — until
      this row exists `credential-vc-issue` returns
      `500 { "error": "no_issuer_key" }` and `resolve_did` returns a
      DID Document with an empty `verificationMethod`.
- [ ] DIF-verifier integration test against `veramo` or `vc-js`.
