# W3C Verifiable Credentials v2.0 + DID Strategy

Status: v1 (additive layer over the existing Antarix credential system).
Owner: Agent A-1. Migration: `supabase/migrations/032_w3c_vc.sql`.
Related: `docs/credential-system.md`, `supabase/migrations/022_credentials.sql`.

---

## 1. Why W3C VC v2.0

The Antarix-native credential (`public.verifiable_credentials`) is already a
verifiable artifact: it has a snapshot, a public URL, a slug, a revocation
status, and a verification counter. That is enough to run our own
`/verify/{slug}` page, but it is **not** enough to travel.

A U.S. HR system, a German Ausbildungsstelle, an Indian edtech consortium, or
a Singapore SkillsFuture verifier cannot read our Postgres row. They expect a
[W3C Verifiable Credentials v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
JSON-LD document that they can resolve and verify locally, offline if needed,
with a generic DIF-compliant resolver.

The W3C VC v2.0 ecosystem is the only one with the install base to matter:
LinkedIn (Microsoft), IBM, Accenture, Workday, the Linux Foundation's
[Trust over IP](https://trustoverip.org/), the EU's EBSI / eIDAS, and the
[mDL / mDoc](https://www.iso.org/standard/69084.html) family all use it (or a
direct profile of it). By emitting a valid VC v2.0 document we get
"verification for free" in any of those systems, with no per-partner
integration. That is the leverage.

The two other shape families we deliberately *did not* pick:

- **Open Badges v3** — narrower (only education / achievement), not
  general-purpose, and the OBv3 JSON-LD envelope is itself a W3C VC v2.0
  profile. We get OBv3 compatibility for free by emitting VC v2.0.
- **SAML / OIDC assertions** — wrong shape, wrong lifetime semantics, and
  bearer tokens leak. Verifiers would have to call us on every check.

## 2. Field mapping (Antarix-native → W3C VC v2.0)

`public.build_vc_document(uuid)` does the mapping; the table below documents
the contract.

| Antarix column                          | W3C VC v2.0 path                          | Notes |
|-----------------------------------------|-------------------------------------------|-------|
| `issuer_did` (default `did:web:antarix.app`) | `issuer`                                | DID of the issuing entity. |
| `public_slug`                           | `id` (as `https://antarix.app/verify/{slug}/vc`) | Stable VC identifier, resolvable. |
| `id` (row uuid)                         | `credentialSubject.id` (as `did:web:antarix.app:c/{uuid}`) | Canonical subject DID. |
| `issuance_date` (default `snapshot_taken_at`) | `validFrom`                          | W3C VC v2.0 renamed `issuanceDate` → `validFrom`. |
| `expiration_date` (default +2y)         | `validUntil`                              | W3C VC v2.0 renamed `expirationDate` → `validUntil`. |
| `snapshot_overall_score`                | `credentialSubject.overallScore`          | Integer 0–1000. |
| `snapshot_per_skill` (jsonb)            | `credentialSubject.perSkill`              | `{ "javascript": 80, ... }`. |
| `snapshot_activity_totals` (jsonb)      | `credentialSubject.activityTotals`        | `{ "commits": 412, ... }`. |
| `snapshot_cohort_percentile` (int)      | `credentialSubject.cohortPercentile`      | Optional, nullable. |
| `snapshot_taken_at`                     | `credentialSubject.snapshotTakenAt`       | When the snapshot was actually taken. |
| `public_slug`                           | `credentialSubject.antarixSlug`           | Convenience copy for the Antarix app URL. |
| `revocation_status` = `'revoked'`       | (sentinel via `vc_revocations` registry)  | A revoked credential is still emitted, but the verifier checks the registry. |
| `vc_proof` (Data Integrity proof)       | (sibling to the document, not in it)      | W3C VC v2.0 places the proof in a `proof` envelope on the same envelope object. |

The credential `@context` is fixed at:

```
[
  "https://www.w3.org/ns/credentials/v2",
  "https://antarix.app/credentials/skill-proof/v1"
]
```

The second URL will host the JSON-LD context that defines `AntarixSkillProof`,
`AntarixSkillSubject`, `overallScore`, `perSkill`, `activityTotals`, and
`cohortPercentile`. Until that file is published, the JSON-LD document is
well-formed but third-party resolvers will treat the Antarix-specific terms
as opaque strings — which is the correct fallback for VC v2.0.

The credential `type` is `["VerifiableCredential", "AntarixSkillProof"]`. The
second type is what makes it discoverable as an Antarix-specific artifact
without changing the W3C semantics.

## 3. The `did:web` choice — and the upgrade path

We pick `did:web` (`did:web:antarix.app` for the issuer,
`did:web:antarix.app:c/{uuid}` for the subject) for v1 because it is the only
DID method that satisfies all four of the following constraints
simultaneously:

1. **No new infrastructure to run** — `did:web` is resolved via plain HTTPS
   from a `/.well-known/did.json` document we already control.
2. **No new third-party dependency** — `did:ion` requires Microsoft
   (SIDETREE), `did:key` is non-rotatable, `did:ethr` requires an on-chain
   transaction per credential. `did:web` is the boring choice.
3. **Compatible with the existing DNS** — `antarix.app` is already a domain
   we own; the issuer DID is just `did:web:antarix.app`.
4. **Cheap to rotate** — to add or revoke a key we just update
   `https://antarix.app/.well-known/did.json`. No migration, no on-chain
   tx, no waiting for block confirmations.

The subject DID encodes the credential row's uuid as a path segment under the
issuer. That gives us a stable, globally-unique, human-readable subject
identifier that any third party can dereference.

The **upgrade path** is documented so we are not painting ourselves into a
corner:

- **v1 (now):** `did:web:antarix.app` (issuer) +
  `did:web:antarix.app:c/{uuid}` (subject). Resolved via
  `https://antarix.app/.well-known/did.json` and
  `https://antarix.app/c/{uuid}/did.json` respectively.
- **v2 (when we need it):** Add a `did:key` alias on the subject. A subject
  DID can be expressed as `did:key:z6Mk...` derived from the user's device
  keypair; this gives the user a portable identifier that doesn't depend on
  `antarix.app` staying online. The `did:web` form stays as a primary alias
  in the credential subject's `alsoKnownAs`.
- **v3 (when on-chain attestation matters):** Add a `did:ion` alias. ION
  sidetrees post anchors to Bitcoin/Ethereum, giving the issuer a
  censorship-resistant presence. This costs ~$0.001 per write and adds
  ~30 min of latency, so we defer it until a verifier actually demands it
  (likely a public-sector EU eIDAS-2 verifier).

Crucially, the credential subject's `id` is a free-form URI in W3C VC v2.0 —
switching DID methods later does not invalidate previously-issued
credentials, as long as the `did:web` resolution stays online for the
credential's 2-year lifetime.

## 4. Signing: the stub, and the production migration path

`public.sign_vc_document(p_credential_id, p_kid)` is a v1 stub. The
`proofValue` it emits is a deterministic base64-encoded sha256 of
`canonicalized_document || kid`. That is structurally a valid Data Integrity
proof envelope, but it is not a real EdDSA signature — anyone with the
document can recompute the same bytes. **Do not use this stub in
production**; it is a contract test for downstream consumers.

The production migration path:

1. **Key generation.** The `credential-issue` Edge Function generates an
   Ed25519 keypair at deployment time. The private key is envelope-encrypted
   under the project's KMS data key and stored in
   `public.vc_issuer_keys.private_key_encrypted`. The public key is stored
   in `public.vc_issuer_keys.public_key` (multibase-encoded as
   `z6Mk...`). The kid is `antarix-ed25519-YYYYMMDD` or similar.
2. **DID Document publication.** An Edge Function (or a static-file
   generator in CI) renders
   `https://antarix.app/.well-known/did.json` from
   `public.resolve_did('did:web:antarix.app')` and serves it with
   `Content-Type: application/did+ld+json`. A second function serves
   `https://antarix.app/c/{uuid}/did.json` per subject.
3. **Signing.** `sign_vc_document` is rewritten to (a) decrypt the
   `private_key_encrypted` via the KMS, (b) canonicalize the document using
   the chosen JSON-LD canonicalization library (see §6), (c) sign the
   canonical bytes with Ed25519, and (d) return the proof envelope with the
   real `proofValue`.
4. **Key rotation.** To rotate, generate a new keypair, write it to
   `vc_issuer_keys` with a fresh `kid`, update the verificationMethod set in
   the DID Document, and stop signing with the old kid. Old credentials
   remain verifiable because the old public key is still in the DID
   Document's `verificationMethod` array until the credential's
   `expiration_date` passes.
5. **Revocation.** To revoke a credential, the service role inserts a row
   into `public.vc_revocations` (and flips the existing
   `revocation_status = 'revoked'` for the in-app UI badge). The
   `vc_revocations` table is the v1 revocation list; the W3C
   [VC Status List 2021](https://www.w3.org/TR/vc-status-list-2021/) is the
   target format, encoded as a bitstring in a future migration.

## 5. How a third-party verifier (U.S. HR system) verifies a credential

End-to-end flow, no Antarix involvement required after the credential is
issued:

1. The student pastes the credential URL `https://antarix.app/verify/abc123/vc`
   into the HR system, or shares the JSON-LD document directly.
2. The HR system's verifier parses the VC v2.0 JSON-LD. It sees:
   - `issuer: did:web:antarix.app`
   - `credentialSubject.id: did:web:antarix.app:c/3f5b6c7d-...`
3. The verifier dereferences the **issuer DID** to fetch the issuer's DID
   Document: `GET https://antarix.app/.well-known/did.json`. This returns
   the `verificationMethod` array with one or more Ed25519 public keys.
4. The verifier dereferences the **credential proof**:
   - `proof.verificationMethod = did:web:antarix.app#antarix-ed25519-2026`
   - It looks up the `#antarix-ed25519-2026` fragment in the DID Document
     to find the public key bytes.
5. The verifier checks the **proof**:
   - `proof.proofPurpose = assertionMethod` is present in the DID
     Document's `assertionMethod` array.
   - `proof.cryptosuite = eddsa-rdfc-2022` matches the algorithm.
   - The Ed25519 signature over the canonicalized (RDFC-1.0 / URDNA2015)
     document bytes verifies against the public key.
6. The verifier checks the **temporal validity**:
   - `now() in [validFrom, validUntil]`.
7. The verifier checks **revocation**:
   - `GET https://antarix.app/.well-known/vc-revocations.json` (or
     queries `public.vc_revocations` directly if it has read access).
   - The credential's `id` URL is not in the revoked set.
8. The verifier reads the **credentialSubject** claims and maps them into
   the HR system's ATS. `overallScore`, `perSkill`, `cohortPercentile`
   become profile fields.

No Antarix API call, no Antarix auth, no Antarix SDK. The HR system
verifies the credential against publicly-served files and standard
cryptography.

## 6. Open questions for Agent B / the Edge Function author

These are the contracts `032_w3c_vc.sql` *does not* settle, because they
belong to the next layer (the Edge Functions that sign, serve, and
canonicalize):

1. **JSON-LD canonicalization library.** W3C Data Integrity
   `eddsa-rdfc-2022` requires the document to be canonicalized per
   [RDFC-1.0](https://www.w3.org/TR/rdf-canon/). Candidate libraries:
   `@digitalbazaar/rdf-canonize` (Node/Deno) and
   `json-ld` (Node). Recommend
   `@digitalbazaar/rdf-canonize` for first-class RDFC-1.0 support.
   Decision needed before the signing function is wired in.
2. **Real EdDSA key import flow.** The `credential-issue` Edge Function
   needs to (a) check `vc_issuer_keys` for an existing active key, (b)
   generate a new one if none exists, (c) encrypt the private key under
   the project's KMS, and (d) write both keys to `vc_issuer_keys`.
   The KMS choice (Supabase Vault, AWS KMS, GCP KMS, HashiCorp Vault) is
   not made yet.
3. **Public DID Document hosting at `/.well-known/did.json`.** This is
   served from the `apps/web` Next.js app. A small Edge Function or
   Next.js API route should render it from
   `public.resolve_did('did:web:antarix.app')` and cache aggressively
   (the issuer DID Document changes only on key rotation, which is rare).
4. **Per-subject DID Document at `/c/{uuid}/did.json`.** Same as above,
   per subject. Currently we do not need a verification method on the
   subject (subjects are not signing), but the file should still resolve
   with the subject's `id` for completeness.
5. **VC Status List 2021 encoding.** `vc_revocations` is the v1
   revocation list. The W3C
   [VC Status List 2021](https://www.w3.org/TR/vc-status-list-2021/)
   format encodes revocations as a bitstring in a separate VC; migrating
   to that is a follow-up migration and unblocks the EU eIDAS-2
   verifier scenario.
6. **`vc_document` / `vc_proof` write-back path.** The current migration
   exposes the three SQL functions but does not call them. The
   `credential-issue` Edge Function needs to (a) call `build_vc_document`
   and `sign_vc_document` after snapshot refresh, (b) write the results
   back to `vc_document` and `vc_proof`, and (c) stamp the `did` column
   on first issuance.

## 7. Rollout checklist

- [x] `supabase/migrations/032_w3c_vc.sql` applied (idempotent).
- [x] `vc_issuer_keys` seeded with the production Ed25519 public key
      (after Agent B wires the KMS path; until then the table is empty
      and `resolve_did` returns a DID Document with an empty
      `verificationMethod` array).
- [ ] `credential-issue` Edge Function updated to call
      `build_vc_document` and `sign_vc_document` on issuance / refresh.
- [ ] `https://antarix.app/.well-known/did.json` served by the web app.
- [ ] `https://antarix.app/c/{uuid}/did.json` served by the web app.
- [ ] Revocation list endpoint published (and, in a future migration,
      migrated to VC Status List 2021).
- [ ] Third-party integration test: a DIF-compliant verifier
      (e.g. `veramo`, `vc-js`) successfully verifies a sample credential
      end-to-end without any Antarix API call.
