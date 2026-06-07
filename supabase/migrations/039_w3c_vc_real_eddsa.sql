-- 039_w3c_vc_real_eddsa.sql
-- T-W3C-VC-ED: Plan C — Defer real EdDSA signing to the Edge Function
--
-- =============================================================================
-- WHY PLAN C (not A or B)
-- =============================================================================
-- Plan A would call a real EdDSA implementation in PL/pgSQL, but the standard
-- Supabase extension set as of 2026 does NOT include `pg_eddsa`. Implementing
-- Ed25519 in PL/pgSQL is *possible* but a single sign-bit or curve-arithmetic
-- bug would silently invalidate every credential the system ever issues. We
-- CANNOT test SQL in this environment (no `psql`, no Postgres on Windows) and
-- the Antarix project rule "no cryptographic code without a test target" is
-- absolute. Plan A is therefore not shippable today.
--
-- Plan B would lift the SQL function to a `pgpy`-style PL/Python helper, but
-- PL/Python is not in the default Supabase extension set either; same test gap.
-- Plan B is also out of scope.
--
-- Plan C is the only path that ships:
--   1. SQL becomes a "canonicalize + handoff" function. It returns a fully
--      shaped W3C Data Integrity proof skeleton, but the cryptographic bytes
--      are filled in by the Edge Function using `@noble/ed25519` in Deno.
--   2. The Edge Function (a follow-up patch on `credential-vc-issue`) detects
--      `edge_signing_required: true` on the SQL response, signs the
--      canonicalized document with the private key material, attaches the
--      real `proofValue`, and writes the final `vc_proof` to the row.
--   3. The SQL function is a STABLE read-only helper that never writes. The
--      Edge Function is the only thing holding the private-key material.
--
-- =============================================================================
-- THE 3-STAGE ROLLOUT THIS MIGRATION IS THE MIDDLE OF
-- =============================================================================
-- Stage 1 — 032_w3c_vc.sql  (shipped)
--   `sign_vc_document` returns a deterministic sha256 stub `proofValue`.
--   Structurally valid W3C VC v2.0 envelope, cryptographically NOT valid.
--   No `edge_signing_required` flag.
--
-- Stage 2 — 039_w3c_vc_real_eddsa.sql  (THIS migration)
--   `sign_vc_document` returns a proof skeleton with:
--     - `proofValue: null`                   (was a base64 sha256 stub)
--     - `edge_signing_required: true`        (NEW)
--     - `document_hash_sha256: <hex>`        (NEW, integrity check for verifiers)
--     - `canonicalization_algorithm: ...`    (NEW, exposes the placeholder nature)
--   The signature is BYTE-IDENTICAL to Stage 1 from the caller's point of view:
--   `sign_vc_document(p_credential_id uuid, p_kid text) returns jsonb`.
--   Every field present in 032 is still present. Only `proofValue` flipped
--   from `<stub>` to `null` and three new top-level fields appeared.
--
-- Stage 3 — future 04x_w3c_vc_stage3.sql + Edge Function patch
--   The Edge Function `credential-vc-issue` reads `edge_signing_required`,
--   signs the canonicalized document with `@noble/ed25519`, attaches a real
--   `proofValue: "m" || base64url(64-byte-sig)`, and persists. The SQL function
--   is updated in a future migration to return `edge_signing_required: false`
--   and either (a) no-op, leaving the Edge Function as the signer, or (b) be
--   removed entirely if the Edge Function absorbs the envelope shaping too.
--   See docs/w3c-vc-eddsa-rollout.md for the full Stage 3 procedure.
--
-- =============================================================================
-- CONTRACT
-- =============================================================================
-- * `create or replace function` — idempotent re-apply is safe.
-- * Same parameter list and return type as the 032 stub: the Edge Function
--   (and any other caller) needs no code change to pick up the new shape.
-- * All 032 fields are preserved (`type`, `cryptosuite`, `verificationMethod`,
--   `created`, `proofPurpose`, `proofValue`). Additive fields only.
-- * `set search_path = public`, `language plpgsql`, `stable`, `security definer`
--   — same volatility / security profile as the 032 stub, so query planners
--   and the RLS bypass behaviour are unchanged.
-- * `digest()` comes from `pgcrypto` (already enabled; no new extensions).
-- * No DDL outside the function body. No table changes. No policy changes.
--
-- =============================================================================
-- CANONICALIZATION — KNOWN-WRONG, DOCUMENTED
-- =============================================================================
-- The hash below is `sha256(jsonb::text)` which is the *Postgres default
-- JSON serialization* — NOT a real JSON-LD canonicalization algorithm. The
-- W3C Data Integrity eddsa-rdfc-2022 cryptosuite requires the document to be
-- canonicalized with **RDFC-1.0** (a.k.a. URDNA2015) before hashing. The
-- Stage 3 Edge Function patch is the correct place to do that — recommend
-- `@digitalbazaar/rdf-canonize` (the reference Deno port). See
-- docs/w3c-vc-eddsa-rollout.md §Open items.
--
-- We expose the algorithm name as `canonicalization_algorithm` on the proof
-- so a verifier reading the envelope can detect the placeholder. The
-- `document_hash_sha256` is what a verifier should check for integrity
-- *before* the real signature is attached; it is the same value the
-- Edge Function will see when it (in Stage 3) re-canonicalizes the doc.

-- =============================================================================
-- The function
-- =============================================================================

create or replace function public.sign_vc_document(p_credential_id uuid, p_kid text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row        public.verifiable_credentials%rowtype;
  v_doc        jsonb;
  v_issuer_did text;
begin
  -- 1. Read the credential row.
  --    The Edge Function's current flow is: build_vc_document() -> sign_vc_document()
  --    -> UPDATE vc_document/vc_proof. So at sign time `vc_document` is typically
  --    NULL on the row. We prefer the row's value when present (re-issuance or a
  --    future flow that writes vc_document first), and fall back to building it
  --    from the snapshot fields so this function is self-sufficient.
  select * into v_row
  from public.verifiable_credentials
  where id = p_credential_id;

  if not found then
    return jsonb_build_object('error', 'credential_not_found');
  end if;

  if v_row.vc_document is not null then
    v_doc := v_row.vc_document;
  else
    v_doc := public.build_vc_document(p_credential_id);
    if v_doc is null then
      return jsonb_build_object('error', 'credential_not_found');
    end if;
  end if;

  v_issuer_did := coalesce(v_row.issuer_did, 'did:web:antarix.app');

  -- 2. Verify the issuer key exists. The actual private key material is NOT
  --    touched here — Stage 2 does not sign. We only need the row to exist
  --    so the `verificationMethod` we put on the proof resolves to a real
  --    key on the DID Document side.
  if not exists (select 1 from public.vc_issuer_keys where kid = p_kid) then
    return jsonb_build_object('error', 'issuer_key_not_found');
  end if;

  -- 3. Canonicalization placeholder hash.
  --    jsonb::text is the Postgres default JSON serialization. NOT RDFC-1.0.
  --    The Stage 3 Edge Function will re-canonicalize and the SQL function
  --    will be updated to a pass-through (or removed) at that point.
  --
  -- 4. & 5. Build the proof skeleton. All 032 fields preserved; proofValue
  --         is now `null`; three additive fields declare the handoff.
  return jsonb_build_object(
    'type',          'DataIntegrityProof',
    'cryptosuite',   'eddsa-rdfc-2022',
    'verificationMethod', v_issuer_did || '#' || p_kid,
    'created', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'proofPurpose',  'assertionMethod',
    'proofValue',    null,
    'edge_signing_required',   true,
    'canonicalization_algorithm', 'sha256-of-text-not-rdfc-1.0',
    'document_hash_sha256', encode(digest(v_doc::text, 'sha256'), 'hex')
  );
end $$;
