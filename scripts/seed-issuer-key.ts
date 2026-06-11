// scripts/seed-issuer-key.ts
// T-W3C-VC-ED-SEED: one-time keypair generator + upsert into public.vc_issuer_keys
//
// USAGE
//   Deno : deno run --allow-net --allow-env --allow-read scripts/seed-issuer-key.ts
//   Node : node --experimental-strip-types scripts/seed-issuer-key.ts
//          (requires `npm install @supabase/supabase-js` first; no other deps)
//
// ENV
//   SUPABASE_URL                 — project URL, e.g. https://abcd.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    — service-role JWT (NEVER commit; never expose
//                                  to the browser). Bypasses RLS so the row
//                                  write is allowed.
//
// WHAT IT DOES
//   1. Generates a fresh Ed25519 keypair via Web Crypto.
//   2. Exports the public key as `publicKeyMultibase`
//        = "z" + base64url-no-padding of the 32 raw bytes
//   3. Exports the private key as PKCS#8 PEM
//   4. Upserts into public.vc_issuer_keys with kid='key-2026-01'.
//   5. Prints the new publicKeyMultibase + a step-by-step did.json instruction.
//
// SECURITY
//   * The private key is base64-armored as a PEM and written to
//     private_key_encrypted with a leading '# DEV ONLY' comment line. The
//     column name says "encrypted" — in v1 dev we are NOT yet integrating KMS;
//     a follow-up migration will move the private key to envelope-encrypted
//     storage backed by Supabase Vault or an external KMS. The script will be
//     updated to use a KMS sign call at that point and stop writing the
//     plaintext PEM to the table entirely.
//   * Do NOT run this against a production database without first moving
//     the KMS integration in. See docs/w3c-vc-eddsa-rollout.md §Compromise
//     response and §Open items.
//
// IDEMPOTENCY
//   * Uses `.upsert(..., { onConflict: 'kid' })`. Re-running with the same
//     `kid` overwrites the row. Rotating to a new key means editing the
//     `KID` constant below to e.g. 'key-2026-02' — the old row is NOT
//     deleted so the 1-year overlap window in the rollout doc is honoured.

const KID = "key-2026-01";
const ALG = "ed25519";

// -----------------------------------------------------------------------------
// Runtime detection: Deno vs Node 20+
// -----------------------------------------------------------------------------

const isDeno = typeof (globalThis as { Deno?: unknown }).Deno !== "undefined";
const runtime: "deno" | "node" = isDeno ? "deno" : "node";

// -----------------------------------------------------------------------------
// Helpers — base64url-no-padding (RFC 4648 §5)
// -----------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  if (runtime === "node") {
    // Node 16+ has `base64url` encoding in Buffer.
    return Buffer.from(bytes).toString("base64url");
  }
  // Deno: convert to standard base64 via btoa(), then rewrite.
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToPem(bytes: Uint8Array, label: string): string {
  // Standard base64, 64-char line wrapping, BEGIN/END armor.
  // Avoid `String.fromCharCode(...bytes)` — the spread can fail for
  // large arrays on some runtimes. A loop is safe for all sizes.
  const b64 = runtime === "node"
    ? Buffer.from(bytes).toString("base64")
    : btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return [
    `-----BEGIN ${label}-----`,
    ...lines,
    `-----END ${label}-----`,
    "",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Generate Ed25519 keypair
// -----------------------------------------------------------------------------

async function generateKeypair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  // `Ed25519` is supported in Web Crypto on:
  //   - Deno 1.40+
  //   - Node 20.0+ (via `crypto.subtle` exposed on `globalThis.crypto`)
  // The "extractable: true" flag is REQUIRED for exportKey('raw' | 'pkcs8') below.
  return await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
}

async function exportPublicMultibase(publicKey: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  if (raw.length !== 32) {
    throw new Error(
      `Unexpected Ed25519 public key length: ${raw.length} bytes (want 32).`,
    );
  }
  return "z" + bytesToBase64Url(raw);
}

async function exportPrivatePem(privateKey: CryptoKey): Promise<string> {
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
  return bytesToPem(pkcs8, "PRIVATE KEY");
}

// -----------------------------------------------------------------------------
// Supabase client — dynamic import so the script works on both runtimes
// -----------------------------------------------------------------------------

type SupabaseLike = {
  from: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

async function getSupabase(): Promise<SupabaseLike> {
  const supabaseUrl = Deno.env?.get("SUPABASE_URL") ?? process.env.SUPABASE_URL;
  const serviceKey =
    Deno.env?.get("SUPABASE_SERVICE_ROLE_KEY") ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.",
    );
  }

  // For Deno, use the npm: specifier. For Node, require the package to be
  // installed locally (`npm install @supabase/supabase-js`).
  const mod = await (runtime === "deno"
    ? import("npm:@supabase/supabase-js@2.45.0")
    : (import("@supabase/supabase-js") as Promise<{
        createClient: (
          url: string,
          key: string,
          opts: Record<string, unknown>,
        ) => SupabaseLike;
      }>));

  const createClient = (mod as {
    createClient: (
      url: string,
      key: string,
      opts: Record<string, unknown>,
    ) => SupabaseLike;
  }).createClient;

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const { publicKey, privateKey } = await generateKeypair();
  const publicKeyMultibase = await exportPublicMultibase(publicKey);
  const privateKeyPem = await exportPrivatePem(privateKey);

  const devOnlyComment = "# DEV ONLY — REPLACE WITH KMS-MANAGED KEY\n";
  const privateKeyStored = devOnlyComment + privateKeyPem;

  const supabase = await getSupabase();
  const { error } = await supabase
    .from("vc_issuer_keys")
    .upsert(
      {
        kid: KID,
        alg: ALG,
        public_key: publicKeyMultibase,
        private_key_encrypted: privateKeyStored,
      },
      { onConflict: "kid" },
    );

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  console.log("");
  console.log("=".repeat(72));
  console.log(`Key inserted into vc_issuer_keys (kid=${KID})`);
  console.log("=".repeat(72));
  console.log("");
  console.log("publicKeyMultibase:");
  console.log("");
  console.log(`  ${publicKeyMultibase}`);
  console.log("");
  console.log("Next step: update apps/web/public/.well-known/did.json");
  console.log("Replace the placeholder publicKeyMultibase with:");
  console.log("");
  console.log(`  ${publicKeyMultibase}`);
  console.log("");
  console.log(
    "Also update docs/api-verification.md if you want to refresh the curl example.",
  );
  console.log("");
  console.log("=".repeat(72));
  console.log("Security notes:");
  console.log(
    "  * The PEM is stored with a leading '# DEV ONLY' comment line. Move",
  );
  console.log(
    "    private-key material to KMS-backed envelope encryption before any",
  );
  console.log("    non-dev deployment. See docs/w3c-vc-eddsa-rollout.md.");
  console.log(
    "  * Re-running this script with the same kid OVERWRITES the row. To",
  );
  console.log(
    "    rotate, edit the KID constant to a new value (e.g. 'key-2026-02')",
  );
  console.log(
    "    and keep the old row for the 1-year overlap window described in",
  );
  console.log("    the rollout doc.");
  console.log("=".repeat(72));
  console.log("");
}

if (isDeno) {
  // Deno: import.meta.main is the canonical entry-point flag.
  // Cast through unknown because the type isn't on Node's import.meta.
  const denoMeta = import.meta as unknown as { main?: boolean };
  if (denoMeta.main === true) {
    await main();
  }
} else {
  // Node ESM (including --experimental-strip-types). The module is the
  // entry point iff its URL matches process.argv[1].
  const { fileURLToPath } = await import("node:url");
  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await main();
  }
}
