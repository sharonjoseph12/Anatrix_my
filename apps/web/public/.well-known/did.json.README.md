# did.json — operator notes (NOT part of the DID Document)

This sibling file documents the placeholders, maintenance contract, and
deployment expectations for `did.json` in the same directory. It is **not**
part of the W3C DID Document and is not served as JSON. Web servers should
not serve `*.README.md` from `/.well-known/` by default; if yours does, add
an explicit deny rule.

**Companion files in this directory**

- `did.json` — the DID Document for `did:web:antarix.app` (W3C DID Core compliant)
- `security.txt` — RFC 9116 machine-readable security contact

## What is the DID Document?

`did.json` resolves the DID `did:web:antarix.app` per the
[`did:web` method specification](https://w3c-ccg.github.io/did-method-web/).
Third-party verifiers (recruiters, college portals, vc-js / didkit / veramo
implementations) fetch this document to obtain the public key they use to
verify the EdDSA proof attached to every Antarix-issued Verifiable
Credential.

Resolution rule for the `did:web` method:

```
did:web:antarix.app  →  https://antarix.app/.well-known/did.json
```

The `service` block in `did.json` advertises the
`LinkedVerifiablePresentation` endpoint at
`https://antarix.app/functions/v1/credential-vc-resolve`, which is the
Edge Function created in batch 2 (`supabase/functions/credential-vc-resolve/[did]/index.ts`).
A verifier discovers the endpoint from `did.json` and then resolves any
specific `did:web:antarix.app:c/<uuid>` by appending the DID to that URL.

## Placeholder that MUST be replaced before launch

The `verificationMethod[0].publicKeyMultibase` value is currently:

```
z6MkTBD_REPLACE_WITH_PUBLIC_KEY_FROM_vc_issuer_keys.public_key_FOR_KID_key-2026-01
```

This is a literal placeholder string, not a valid multibase-encoded
Ed25519 public key. It is intentionally not a real key so that anyone who
deploys this file before the seed step accidentally publishes an
obviously-broken DID Document (verifiers will reject it cleanly) rather
than a subtly-broken one.

**TODO** — replace this placeholder with the real multibase value before
launch:

1. Agent C-3 will land `scripts/seed-issuer-key.ts` which generates an
   Ed25519 keypair and inserts it into `public.vc_issuer_keys` with
   `kid = 'key-2026-01'`.
2. After running the seed script, copy
   `vc_issuer_keys.public_key` (multibase-encoded, must start with `z6Mk`
   for Ed25519 per the multicodec table) into the
   `publicKeyMultibase` field of `did.json`.
3. Commit the updated `did.json` and deploy via the normal release flow
   for `apps/web/`.
4. Verify resolution with:

   ```
   curl -sS https://antarix.app/.well-known/did.json | jq .
   ```

5. End-to-end smoke test: issue a test credential, then fetch its DID
   from the public resolver and verify the proof using any DIF-compliant
   verifier (e.g., `vc-js`).

## Key rotation

The current `kid` is `key-2026-01` (one rotation per year by default; the
naming convention is `key-YYYY-NN`). To rotate:

1. Insert a new row in `vc_issuer_keys` with the next `kid`.
2. Add the new verification method as an additional entry in
   `verificationMethod[]` in `did.json` (do **not** remove the old one
   until all previously-issued credentials have expired).
3. Update `assertionMethod` to point to the new `kid`.
4. New credentials will be signed with the new key; existing credentials
   remain verifiable against the old key for the duration of their
   `validUntil`.
5. After all credentials signed with the old `kid` have expired (max
   2 years), remove the old entry from `verificationMethod` and
   `authentication`.

## JSON Schema constraints

`did.json` MUST satisfy:

- Valid JSON (no trailing comma, no HTML comments, no JS-style comments).
- Top-level keys exactly: `@context`, `id`, `verificationMethod`, `authentication`, `assertionMethod`, `service`.
- `id` equals `did:web:antarix.app`.
- Every entry in `verificationMethod[]` has an `id`, `type`, `controller`, and a key-material field (`publicKeyMultibase` for Ed25519 / `publicKeyJwk` for JWK).
- `authentication[]` and `assertionMethod[]` entries are either inline verification methods or string references matching an `id` in `verificationMethod[]`.
- `service[].serviceEndpoint` is an absolute HTTPS URL.

Run the validity check locally with:

```
node -e "JSON.parse(require('fs').readFileSync('apps/web/public/.well-known/did.json', 'utf8')); console.log('ok')"
```

## Related documents

- [`docs/w3c-vc-strategy.md`](../../../../docs/w3c-vc-strategy.md) — design rationale for the W3C VC layer
- [`docs/w3c-vc-impl.md`](../../../../docs/w3c-vc-impl.md) — Edge Function implementation details
- [`docs/security/vdp.md`](../../../../docs/security/vdp.md) — Vulnerability Disclosure Policy (governs reports against this endpoint)
- [`docs/security/threat-model.md`](../../../../docs/security/threat-model.md) — STRIDE analysis (T-02, T-19 cover DID-specific threats)
- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/) — specification
- [`did:web` method](https://w3c-ccg.github.io/did-method-web/) — resolution rule
- [Ed25519VerificationKey2020](https://w3c-ccg.github.io/lds-ed25519-2020/) — key suite

## Maintainers

This file and its sibling `did.json` are jointly maintained by the
Antarix security team and the W3C VC implementation owner. Changes go
through the same review process as any production credential change.

- Document owner: `security@antarix.app`
- Implementation owner: see `docs/w3c-vc-impl.md` header
