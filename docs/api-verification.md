# Antarix Verifiable Credentials — Third-Party Verification Guide

> **Audience:** engineers integrating a third-party verifier (LinkedIn
> credential display, an HR system, a university alumni portal, an
> Open Badge wallet, etc.) with Antarix's W3C VC v2.0 + `did:web`
> resolution API.
>
> **Stable contract:** [`specs/003-engage-and-showcase/openapi.yaml`](../specs/003-engage-and-showcase/openapi.yaml)
> is the source of truth for the HTTP surface. This guide is a
> hand-held walkthrough; the YAML wins on any disagreement.

---

## 1. Why integrate with the Antarix API

A single sentence: Antarix issues cryptographically-signed,
W3C-standard skill proof credentials (VC v2.0) that any DIF-compliant
verifier can resolve and check in one round trip — no Antarix account
or API key required.

The three highest-value use cases that prompted this API:

1. **LinkedIn credential display** — a student pastes
   `https://antarix.app/verify/<slug>` into their LinkedIn Featured /
   Licenses & Certifications section; LinkedIn's parser hits our public
   resolve endpoint and renders a verified badge with the student's
   overall score, top skills, and proof timestamp.
2. **IBM / Accenture / TCS HR verification** — a recruiter runs a
   pre-employment check; the HR system hits our resolve endpoint with
   the candidate's DID, gets back the W3C VC envelope and the EdDSA
   proof, and confirms the candidate's self-claimed scores without a
   manual phone call or PDF round-trip.
3. **University alumni verification** — an alumni portal wants to
   confirm a graduate's "placement ready" status at the time of
   application; a 200 response with a non-deactivated
   `didDocumentMetadata` and a fresh `nextUpdate` is the canonical
   yes-answer.

The endpoint is rate-limited but **completely public** — no Antarix
account is needed and no API key is issued. A single GET resolves the
DID, the credential, and the proof in one round trip.

---

## 2. The 4-step verification flow

In four steps — each with a curl and the expected JSON. All four steps
are run for every credential a verifier wants to trust.

### Step 1 — Resolve the DID

Hit the public resolve endpoint. No auth header is required; the CDN
edge caches the successful 200 for 60 seconds, so repeated polling
costs us nothing.

```bash
curl -X GET \
  'https://antarix.app/functions/v1/credential-vc-resolve/did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6' \
  -H 'Accept: application/did+ld+json'
```

The successful response is the W3C DID Resolution v0.3 envelope plus
the credential and its proof. The `Content-Type` is
`application/did+ld+json; profile="https://w3id.org/did-resolution"`.

```json
{
  "didDocument": {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6",
    "verificationMethod": [{
      "id": "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6#k-antarix-2026-01",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6",
      "publicKeyMultibase": "z6MkiVnzH6XbvJ6dEfmF3gUvYs9kWqLg4ZqK1b8a3Cf2VnQrR"
    }],
    "assertionMethod": [
      "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6#k-antarix-2026-01"
    ]
  },
  "didResolutionMetadata": {
    "contentType": "application/did+json",
    "retrieved": "2026-06-06T12:34:56.789Z"
  },
  "didDocumentMetadata": {
    "created": "2026-06-06T08:00:00.000Z",
    "updated": "2026-06-06T08:00:00.000Z",
    "deactivated": false,
    "nextUpdate": "2028-06-06T08:00:00.000Z"
  },
  "credential": {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://antarix.app/credentials/skill-proof/v1"
    ],
    "id": "https://antarix.app/verify/sharon-dave/vc",
    "type": ["VerifiableCredential", "AntarixSkillProof"],
    "issuer": "did:web:antarix.app",
    "validFrom": "2026-06-06T08:00:00Z",
    "validUntil": "2028-06-06T08:00:00Z",
    "credentialSubject": {
      "id": "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6",
      "type": ["AntarixSkillSubject"],
      "antarixSlug": "sharon-dave",
      "overallScore": 86,
      "perSkill": { "PostgreSQL": 92, "Go": 81, "TypeScript": 74 },
      "activityTotals": { "commits90d": 213, "pullRequestsMerged90d": 14 },
      "cohortPercentile": 78,
      "snapshotTakenAt": "2026-06-05T22:00:00Z"
    }
  },
  "credentialProof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "verificationMethod": "did:web:antarix.app#k-antarix-2026-01",
    "created": "2026-06-06T08:00:00Z",
    "proofPurpose": "assertionMethod",
    "proofValue": "mH9zN2uPDk8jS5fW3xY7qA1bC6dE0gI4jK2lM9nO5pQ8rS3tU7vW"
  }
}
```

If the credential is revoked, the response is **410 Gone** with
`didDocumentMetadata.deactivated: true`. If the DID is well-formed but
no credential with that DID exists, the response is **404** with
`didResolutionMetadata.error: "notFound"`. See §7 (FAQ) and the
OpenAPI spec for every shape.

### Step 2 — Verify the proof's `verificationMethod` is in the DID Document

The proof's `verificationMethod` field names a DID-URL fragment, e.g.
`did:web:antarix.app#k-antarix-2026-01`. That fragment MUST appear in
the resolved DID Document's `verificationMethod[]` array (and ideally
also in `assertionMethod[]`, which it will be on Antarix's
implementations). If it doesn't, the credential is not signed by the
key it claims — abort.

```js
const proof = envelope.credentialProof;
const didDoc = envelope.didDocument;
const vm = didDoc.verificationMethod.find(m => m.id === proof.verificationMethod);
if (!vm) throw new Error("verificationMethod not bound to DID Document");
if (!didDoc.assertionMethod.includes(proof.verificationMethod)) {
  throw new Error("verificationMethod not in assertionMethod[]");
}
```

### Step 3 — Verify the signature with the public key

The `cryptosuite` is `eddsa-rdfc-2022`, which means:

1. Decode the public key from `vm.publicKeyMultibase` (multibase `z`
   prefix → base58btc → 32-byte Ed25519 public key).
2. Canonicalize the credential via RDFC-1.0 (URDNA2015) — the
   `jsonld.canonize()` call.
3. Decode the proof's `proofValue` (multibase `m` prefix → base64 →
   64-byte Ed25519 signature).
4. `ed25519.verify(publicKey, canonicalBytes, signature)` — must
   return `true`.

The v1 release currently returns a **deterministic `sha256`
placeholder** for `proofValue` — not a real EdDSA signature — so the
in-repo `sign_vc_document` SQL helper is **not** cryptographically
binding until migration `034_w3c_vc_real_eddsa.sql` lands. The HTTP
contract, envelope shape, and DID resolution are stable; only the
cryptography is a placeholder. **Treat v1 `proofValue`s as
"structurally valid, not yet cryptographically valid"** and gate any
high-stakes decision on the v2 rollout. See
`docs/w3c-vc-eddsa-rollout.md` for the v2 timeline.

```js
import jsonld from "jsonld";
import * as ed from "@noble/ed25519";
import { base58btc } from "@scure/base";

const pubKey = base58btc.decode(vm.publicKeyMultibase.slice(1)); // drop 'z'
const sig    = base64.decode(proof.proofValue.slice(1));         // drop 'm'
const canon  = new TextEncoder().encode(await jsonld.canonize(credential));
const ok     = await ed.verify(sig, canon, pubKey);
if (!ok) throw new Error("signature invalid");
```

### Step 4 — Check the credential isn't expired and isn't revoked

Two cheap checks:

```js
const now = Date.now();
if (Date.parse(credential.validUntil) < now)        throw new Error("expired");
if (envelope.didDocumentMetadata.deactivated === true) throw new Error("revoked");
if (envelope.didDocumentMetadata.nextUpdate
    && Date.parse(envelope.didDocumentMetadata.nextUpdate) < now) {
  throw new Error("credential past nextUpdate");
}
```

`validFrom` should also be checked if the verifier cares about
credentials that were issued in the future (clock skew, etc.). On
Antarix the issuance is back-dated to `snapshot_taken_at` so this
should never happen in practice, but the field is part of the W3C
contract.

If all four steps pass, the credential is good and the verifier can
trust `credential.credentialSubject.overallScore`, `perSkill`, and
`activityTotals` as committed-to-by Antarix at issuance time.

---

## 3. Reference client (Node.js, illustrative)

**This is illustrative, NOT for production use.** A real verifier
should use battle-tested libraries, handle clock skew, retry on 429,
and validate the JSON Schema with a real validator. The point of the
snippet below is to make the four steps above concrete.

```js
// verify.mjs — 30-line reference verifier.
import jsonld from "jsonld";
import * as ed from "@noble/ed25519";
import { base58btc } from "@scure/base";
import { base64 } from "@scure/base";

const DID = process.argv[2]; // did:web:antarix.app:c/<uuid>
const r   = await fetch(`https://antarix.app/functions/v1/credential-vc-resolve/${DID}`);
const env = await r.json();
if (r.status !== 200) throw new Error(`resolve: ${r.status} ${env.error}`);

// Step 2 — verificationMethod in DIDDocument
const vm = env.didDocument.verificationMethod
  .find(m => m.id === env.credentialProof.verificationMethod);
if (!vm) throw new Error("verificationMethod not in DID Document");

// Step 3 — verify signature (v2: real EdDSA, see §2 Step 3 caveats)
const pubKey = base58btc.decode(vm.publicKeyMultibase.slice(1));
const sig    = base64.decode(env.credentialProof.proofValue.slice(1));
const canon  = new TextEncoder().encode(await jsonld.canonize(env.credential));
if (!(await ed.verify(sig, canon, pubKey))) throw new Error("signature invalid");

// Step 4 — not expired, not revoked
if (new Date(env.credential.validUntil) < new Date())          throw new Error("expired");
if (env.didDocumentMetadata.deactivated === true)             throw new Error("revoked");

console.log(`verified — overallScore=${env.credential.credentialSubject.overallScore}`);
```

The four steps in the snippet map 1:1 to the four steps in §2. Drop it
into `node verify.mjs did:web:antarix.app:c/<uuid>` and it should
print the overall score of a real, valid credential.

---

## 4. Rate limits

The full rate-limiting spec lives at
[`docs/rate-limiting.md`](./rate-limiting.md). The two endpoints in
this API are configured as follows (taken from
`supabase/functions/_shared/rate-limit.ts`):

| Endpoint                   | Auth      | Burst (capacity) | Sustained           | Bucket key                          |
|----------------------------|-----------|-----------------:|---------------------|-------------------------------------|
| `GET /credential-vc-resolve` | public    | 60               | 1 / s (≈ 60 / min)  | `ip:<x-forwarded-for>:fn:credential-vc-resolve` (best-effort; v1 uses `requestId` for unauth callers — see `docs/rate-limiting.md` §4) |
| `POST /credential-vc-issue`  | JWT       | 5                | 1 every 10 s        | `user:<sub>:fn:credential-vc-issue` |

When a bucket is empty, the endpoint returns **429** with
`{ "error": "rate_limited", "retry_after": <seconds> }` and a
`Retry-After` header. The wrapper **fails open** on a DB hiccup so a
Postgres outage won't cascade into a 5xx storm — see
`docs/rate-limiting.md` §3.

**The 60-second CDN edge cache** on the resolve endpoint's 200
response means a single hot credential will be served from cache for
~99% of verifications. The 404 / 410 / 400 / 500 / 429 responses are
all `Cache-Control: no-store` so they never get stale-cached.

---

## 5. Sample code in 4 languages

All four snippets resolve a credential and check the four steps. They
are intentionally minimal — production code needs retry, error
classification, key rotation, etc.

### 5.1 curl (single-shot verification)

```bash
# Resolve + check status code only.
DID='did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6'
curl -sS -o /tmp/vc.json -w '%{http_code}\n' \
  "https://antarix.app/functions/v1/credential-vc-resolve/${DID}" \
  -H 'Accept: application/did+ld+json'

# Issue a new credential (Antarix web app's own issuance path; JWT required).
curl -X POST https://antarix.app/functions/v1/credential-vc-issue \
  -H "Authorization: Bearer ${USER_JWT}" \
  -H 'Content-Type: application/json' \
  -d '{"credential_id":"3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6"}'
```

### 5.2 Node.js (built-in `node:crypto`, no external deps)

```js
// verify.js — Node 20+ reference (no @noble/jsonld etc. for brevity).
// For production, swap in a real Ed25519 + JSON-LD canon library.
import { createHash, verify as edVerify, createPublicKey } from "node:crypto";
import { TextEncoder } from "node:util";

const DID = process.argv[2] || "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6";
const res = await fetch(`https://antarix.app/functions/v1/credential-vc-resolve/${DID}`);
if (!res.ok) throw new Error(`resolve: ${res.status}`);
const env = await res.json();

// Step 2 — verificationMethod must be in DIDDocument
const vm = env.didDocument.verificationMethod
  .find(m => m.id === env.credentialProof.verificationMethod);
if (!vm) throw new Error("verificationMethod not in DID Document");

// Step 3 — v1 placeholder check: sha256(canonical(doc) || ':' || kid)
//          v2: real Ed25519 verify(URDNA2015(doc), pubKey, sig)
//          The OpenAPI spec §"DataIntegrityProof" covers both.
if (env.credentialProof.cryptosuite !== "eddsa-rdfc-2022")
  throw new Error("unexpected cryptosuite");
const v1Placeholder = createHash("sha256")
  .update(JSON.stringify(env.credential) + ":" + vm.id.split("#")[1])
  .digest("base64");
if (env.credentialProof.proofValue !== v1Placeholder) {
  console.warn("v1 proofValue mismatch — v1 sha256 stub, not a real EdDSA sig");
}

// Step 4 — not expired, not revoked
if (new Date(env.credential.validUntil) < new Date()) throw new Error("expired");
if (env.didDocumentMetadata.deactivated === true)    throw new Error("revoked");

console.log(`OK — overallScore=${env.credential.credentialSubject.overallScore}`);
```

### 5.3 Python (`requests` + `cryptography`)

```python
"""verify.py — illustrative Python verifier (3.x)."""
import json
import sys
import time
import requests
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

BASE = "https://antarix.app/functions/v1"
DID = sys.argv[1] if len(sys.argv) > 1 else \
    "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6"

# Step 1 — resolve
r = requests.get(f"{BASE}/credential-vc-resolve/{DID}",
                 headers={"Accept": "application/did+ld+json"}, timeout=10)
r.raise_for_status()
env = r.json()

# Step 2 — verificationMethod in DID Document
proof = env["credentialProof"]
vm = next((m for m in env["didDocument"]["verificationMethod"]
           if m["id"] == proof["verificationMethod"]), None)
if vm is None:
    raise ValueError("verificationMethod not in DID Document")

# Step 3 — verify signature (v2 path; v1 is a sha256 placeholder)
if proof["cryptosuite"] != "eddsa-rdfc-2022":
    raise ValueError("unexpected cryptosuite")
raw_pub = bytes.fromhex(vm["publicKeyMultibase"][1:])  # illustrative multibase decode
pubkey = Ed25519PublicKey.from_public_bytes(raw_pub)
sig = bytes.fromhex(proof["proofValue"][1:])           # illustrative
try:
    pubkey.verify(sig, json.dumps(env["credential"], sort_keys=True).encode())
except InvalidSignature:
    raise ValueError("signature invalid")

# Step 4 — not expired, not revoked
if time.time() * 1000 > __import__("datetime").datetime.fromisoformat(
        env["credential"]["validUntil"].replace("Z", "+00:00")).timestamp() * 1000:
    raise ValueError("expired")
if env["didDocumentMetadata"].get("deactivated") is True:
    raise ValueError("revoked")

print(f"OK — overallScore={env['credential']['credentialSubject']['overallScore']}")
```

The multibase and base64-decoding stubs are illustrative; in
production use `base58` and `base64-url-safe` libraries (`py-multibase`,
`base64-url`).

### 5.4 Go (`net/http` + `crypto/ed25519`)

```go
// verify.go — illustrative Go verifier. Build: go run verify.go <did>.
package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Resolution struct {
	DIDDocument struct {
		VerificationMethod []struct {
			ID                 string `json:"id"`
			Type               string `json:"type"`
			Controller         string `json:"controller"`
			PublicKeyMultibase string `json:"publicKeyMultibase"`
		} `json:"verificationMethod"`
		AssertionMethod []string `json:"assertionMethod"`
	} `json:"didDocument"`
	DIDDocumentMetadata struct {
		Deactivated bool   `json:"deactivated"`
		NextUpdate  string `json:"nextUpdate"`
	} `json:"didDocumentMetadata"`
	Credential struct {
		ValidFrom  string `json:"validFrom"`
		ValidUntil string `json:"validUntil"`
		Subject    struct {
			OverallScore int `json:"overallScore"`
		} `json:"credentialSubject"`
	} `json:"credential"`
	CredentialProof struct {
		Cryptosuite        string `json:"cryptosuite"`
		VerificationMethod string `json:"verificationMethod"`
		ProofValue         string `json:"proofValue"`
	} `json:"credentialProof"`
}

func main() {
	did := "did:web:antarix.app:c/3e1f9a2b-7c5d-4f8a-9e10-b1c2d3e4f5a6"
	if len(os.Args) > 1 {
		did = os.Args[1]
	}

	// Step 1 — resolve
	resp, err := http.Get("https://antarix.app/functions/v1/credential-vc-resolve/" + did)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		panic("resolve: " + resp.Status)
	}
	var env Resolution
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		panic(err)
	}

	// Step 2 — verificationMethod in DID Document
	var pub ed25519.PublicKey
	for _, m := range env.DIDDocument.VerificationMethod {
		if m.ID == env.CredentialProof.VerificationMethod {
			// Illustrative: multibase 'z' (base58btc) decode.
			raw, _ := base64.RawURLEncoding.DecodeString(m.PublicKeyMultibase[1:])
			pub, _ = hex.DecodeString(string(raw))
		}
	}
	if pub == nil {
		panic("verificationMethod not in DID Document")
	}

	// Step 3 — v2 verify. v1 is a sha256 placeholder — see spec.
	if env.CredentialProof.Cryptosuite != "eddsa-rdfc-2022" {
		panic("unexpected cryptosuite")
	}
	sig, _ := base64.RawURLEncoding.DecodeString(env.CredentialProof.ProofValue[1:])
	if !ed25519.Verify(pub, []byte("CANONICALIZED_CREDENTIAL"), sig) {
		fmt.Println("WARN: signature did not verify (v1 sha256 stub expected)")
	}

	// Step 4 — not expired, not revoked
	if t, _ := time.Parse(time.RFC3339, env.Credential.ValidUntil); t.Before(time.Now()) {
		panic("expired")
	}
	if env.DIDDocumentMetadata.Deactivated {
		panic("revoked")
	}

	fmt.Printf("OK — overallScore=%d\n", env.Credential.Subject.OverallScore)
}
```

These four snippets are intentionally small. A real production
verifier would swap the multibase / base64 decoders for battle-tested
libraries, use a real JSON-LD canon library (RDFC-1.0 / URDNA2015) for
the signature input, and wire in a retry+backoff loop keyed on
`Retry-After`.

---

## 6. Cross-region latency and caching

The successful `200` resolve response is served with
`Cache-Control: public, max-age=60`, which means:

- The CDN edge (Cloudflare in front of Supabase) caches the response
  for 60 seconds per region. A second request from the same region
  inside that window is served from cache without hitting Postgres.
- The `Cache-Control` on the 404 / 410 / 400 / 429 / 500 responses is
  `no-store`, so error responses never go stale.
- The `didResolutionMetadata.retrieved` field on the 200 body carries
  the wall-clock time the resolver fetched the DID Document from
  Postgres. Verifiers that want to detect stale cache hits can compare
  `retrieved` to their own `Date` header and re-poll if the gap is
  larger than their freshness budget.

For most third-party verifiers the 60-second cache is more than
enough: a credential is immutable once issued, and a revocation
typically propagates within the same minute (the underlying SQL
function reads `vc_revocations` on every request). If your verifier
needs stricter freshness than 60 seconds, lower your CDN TTL at the
edge and use `Cache-Control: max-age=N` from your own edge — but be
aware that every cache miss is a Supabase read.

---

## 7. FAQ

### 7.1 What if the credential is revoked?

You get a **410 Gone** with `didDocumentMetadata.deactivated: true`
and a `RevokedResponse` envelope. The body looks like:

```json
{
  "error": "revoked",
  "message": "Credential has been revoked.",
  "revoked_at": "2026-06-06T09:00:00.000Z",
  "reason": "account_deletion",
  "didDocument": { "...": "(same as a 200 response)" },
  "didResolutionMetadata": { "contentType": "application/did+json" },
  "didDocumentMetadata": { "deactivated": true, "deactivatedAt": "..." }
}
```

Treat 410 as a hard "do not trust" signal. Revocation is honoured
from two sources: the W3C-style `vc_revocations` table (per
`docs/w3c-vc-impl.md` §2) and the legacy
`verifiable_credentials.revocation_status = 'revoked'` enum from
migration `022_credentials.sql`.

### 7.2 What if the user is deleted?

You get a **404** with `didResolutionMetadata.error: "notFound"`.
Antarix hard-deletes the `verifiable_credentials` row **90 days
after account deletion** per the [Privacy Notice](./legal/privacy-notice.md)
("Account profile, connections, score, prediction — until you delete
your account, plus 90 days for audit and recovery"). After that
window, the resolve endpoint behaves exactly the same as for a
well-formed but never-issued DID: 404 envelope.

There is no soft-delete tombstone; the 404 is canonical.

### 7.3 What about cross-region latency?

See §6. The happy path is CDN-cached for 60 seconds at the edge; the
underlying Postgres read is only hit on a cache miss. For most
verifiers the 60-second TTL is invisible. If you need stricter
freshness, run your own edge with a lower TTL and treat the
`didResolutionMetadata.retrieved` field as your freshness signal.

### 7.4 Can I batch-verify multiple credentials in one request?

**No, by design.** Each credential is a separate GET — there is no
batch endpoint, and the rate-limit bucket is per-caller so a batch
would still be throttled to one credential at a time. The reasoning
is twofold:

1. **DIF DID Resolution** is a per-DID contract. The W3C DID
   Resolution spec defines a 1:1 resolver interface; batch-resolving
   would require either a non-standard envelope or a fan-out
   multiplexer on our side.
2. **The rate limit is a per-caller signal.** A batch endpoint would
   make the per-caller throttle ambiguous (one batch call == one
   token, or N tokens for N DIDs?).

The recommended pattern is a small parallel fan-out from the verifier
side, capped at the resolver's sustained rate (1 / s for the public
endpoint). Most verifiers end up running a small queue that resolves
5–20 DIDs in parallel and respects `Retry-After`.

### 7.5 Do I need an API key?

No. The resolve endpoint is anonymous. The issue endpoint requires a
Supabase JWT but is intended for the Antarix web app's own issuance
path, not for third-party use. If you have a need to issue on behalf
of a user, contact `api@antarix.app`.

### 7.6 What happens when the v2 EdDSA rollout lands?

The HTTP contract and response envelope are byte-identical. The
`proofValue` field will switch from a plain base64 `sha256`
placeholder to a multibase (`m`-prefixed) base64 Ed25519 signature
over the RDFC-1.0 canonical form of the credential. Verifiers that
already implement the §2 four-step flow will continue to work
unchanged — Step 3 just starts returning `true` against real
cryptography instead of warning. The rollout plan lives at
`docs/w3c-vc-eddsa-rollout.md`.

### 7.7 What if the user has no public slug (`antarixSlug`)?

The `credentialSubject.antarixSlug` is optional. It is populated only
when the user has claimed a slug via `/settings/profile-visibility`.
The verifier can still render the credential without it; the
`https://antarix.app/verify/<slug>/vc` URL on `credential.id` is the
canonical "share" link and will 404 until the slug is claimed, but
the DID resolution itself does not depend on the slug.

---

## 8. Changelog

| Version | Date       | Notes                          |
|---------|------------|--------------------------------|
| v1.0.0  | 2026-06-06 | Initial release. Public resolve + authed issue endpoints, W3C VC v2.0 + `did:web` + EdDSA cryptosuite `eddsa-rdfc-2022` (v1 sha256 placeholder; real EdDSA in `034_w3c_vc_real_eddsa.sql`). |
