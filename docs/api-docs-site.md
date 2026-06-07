# Antarix public API documentation site

> **Status:** shipped (v1).
> **Files:** `apps/web/public/api-docs/index.html` (the renderer),
> `apps/web/public/api-docs/openapi.yaml` (the spec, manually synced
> from `specs/003-engage-and-showcase/openapi.yaml`), and the
> human-readable companion at `docs/api-verification.md` (created
> in batch 3 by C-1).
> **Live at:** `https://antarix.app/api-docs/` (after the next
> Next.js deploy).

---

## 1. Why a static site, not a docs framework

The public Antarix API surface is currently **two endpoints**
(`GET /credential-vc-resolve/{did}` and `POST /credential-vc-issue`)
with a single OpenAPI document. Docusaurus, VitePress, Mintlify,
ReadMe and friends are all designed for *tens to hundreds* of
pages — a sidebar hierarchy, a search index, MDX components,
versioned docs, blog integration. The cost of that machinery is
substantial: a build step in CI, a Node version pin, a dep-update
cadence for the framework, a security-patch treadmill, a database
or filesystem-backed content store, and a search service.

We deliberately don't need any of that. The v1 docs site is one
HTML file, one YAML file, and a link to the human companion. The
trade-off is intentionally lopsided:

| | Static + Swagger UI CDN | Docusaurus / VitePress |
|---|---|---|
| Build step | **none** | yes (Node ≥ 18, framework version pin) |
| Dep update cadence | **zero** for the docs site itself | monthly security patches |
| Security surface | the CDN + the YAML | the framework, all transitive deps, the build host, and the YAML |
| Page count | 1 | unbounded |
| Search | Swagger UI's built-in `filter: true` is enough | Algolia/DocSearch (paid) or lunr (DIY) |
| Versioning | bump the URL path (`/api-docs/v1/`, `/api-docs/v2/`) | framework-native (still needs a build) |
| Dark mode | TODO (§6) | out-of-the-box |

The rule of thumb: if a spec fits on one page and the page
deliberately shows the raw schema (so the reader can map
`didDocument` ↔ `credentialSubject` visually), a static site is
the correct primitive. The framework bill only starts to make
sense when the docs grow past that — at which point we can
migrate *just the docs site* without touching the API itself.

The second-order benefit is operational. The public docs site has
**no build step**, so there is nothing to "fail to build" on a
redeploy, and no `pnpm install` on the CI host. The whole
deployment story is "the Next.js static export ships three extra
files at `/api-docs/`." This is the cheapest possible security
posture for a public trust boundary that doesn't actually host
application code.

---

## 2. The three components

### 2.1 `apps/web/public/api-docs/index.html` — the renderer

Self-contained HTML page. Loads Swagger UI 5.32.6 from `unpkg` and
points it at the same-origin YAML at `/api-docs/openapi.yaml`. No
JavaScript dependencies beyond Swagger UI itself, no CSS framework,
no analytics. The Antarix brand is added via a sticky top bar with
a 2 px solid `#1f2937` (slate-800) top border, an inline-SVG mark
(no new image files), and a footer with two mailto links.

Configuration exposed in the `SwaggerUIBundle` call (deliberately
locked-down, see the `info.description` in
`specs/003-engage-and-showcase/openapi.yaml` for the rationale on
each):

* `url: '/api-docs/openapi.yaml'` — same-origin, no CORS
* `deepLinking: true` — `#/operations/resolveCredential` deep links
* `presets: [SwaggerUIBundle.presets.apis]` — content preset, no
  top bar (we have our own)
* `layout: 'BaseLayout'` — drops the standalone preset's top bar
* `defaultModelsExpandDepth: 2` and
  `defaultModelExpandDepth: 3` — schemas show 2 levels, individual
  models 3
* `docExpansion: 'list'` — operations visible, schemas collapsed
* `filter: true` — Swagger UI's built-in search bar; covers the
  small spec adequately
* `showExtensions: true` / `showCommonExtensions: true` — surfaces
  the `x-codeSamples` blocks
* `persistAuthorization: true` — keeps the bearer token across
  reloads in `localStorage`. **Security note:** combined with the
  CDN-trust assumption in §7, this is the single biggest reason
  vendoring Swagger UI is a v2 priority. Don't paste production
  tokens here; the docs site is not an Antarix-controlled
  application.
* `tryItOutEnabled: true` — the "Try it out" button is on by
  default. The yellow banner above the renderer reiterates the
  security caveat.

The page is **162 lines / ~5.7 KB** of HTML. The 50 KB budget
leaves headroom for the inline `<style>` block to grow if the
brand expands (e.g. dark-mode tokens in v2, see §6).

### 2.2 `apps/web/public/api-docs/openapi.yaml` — the spec, copy

A verbatim copy of `specs/003-engage-and-showcase/openapi.yaml` with
a 14-line `#` header comment explaining the sync protocol. The body
of the file is **byte-identical to the source** (verified by the
shipping script in §3 — see `STATUS.md` for the byte-by-byte check
the D-2 agent ran on landing).

The copy is the *only* way the public docs site can read the spec
without a server-side route. Next.js 15 serves anything under
`apps/web/public/` as a static file at the same path under
`/api-docs/`, which is what we want.

### 2.3 `docs/api-verification.md` — the human companion

Already created in batch 3 (621 lines, C-1's deliverable). The
docs site footer doesn't deep-link into it directly because the
file is not in `apps/web/public/`, but the OpenAPI spec's
`externalDocs.url` already points at
`https://www.w3.org/TR/vc-data-model-2.0/`, and the homepage's
verify-portal documentation will link to
`/docs/api-verification.html` (rendered server-side by the docs
pipeline — outside this brief's scope).

---

## 3. How to update the spec

The protocol is intentionally a one-liner. The source of truth is
the YAML in `specs/003/`. The copy under `apps/web/public/` is
always re-derived from the source.

```
# 1. Edit the source of truth
$EDITOR specs/003-engage-and-showcase/openapi.yaml

# 2. Validate (C-1's swagger-cli check lives in the
#    C-1 log entry in agents/STATUS.md; the recommended
#    command is:)
npx @apidevtools/swagger-cli@4 validate \
  specs/003-engage-and-showcase/openapi.yaml

# 3. Re-sync the public copy
cp specs/003-engage-and-showcase/openapi.yaml \
   apps/web/public/api-docs/openapi.yaml

# 4. Verify byte-identity of the body (skip the
#    `# Auto-synced…` header the copy adds)
diff <(tail -n +15 apps/web/public/api-docs/openapi.yaml) \
     specs/003-engage-and-showcase/openapi.yaml

# 5. Commit both files in the same commit and redeploy.
```

The commit message convention is
`docs(api-docs): sync openapi.yaml to <short-hash>` so a future
audit can answer "what spec was live on date X?" by walking
`git log` on `apps/web/public/api-docs/openapi.yaml`.

A `pnpm sync:api-docs` script (open item §6) would wrap steps
3 and 4. Until that lands, the manual `cp` is fine because
"forget to re-sync" is the only failure mode, and that fails
loudly (the docs site and the spec drift in ways the byte-diff
in step 4 catches before merge).

---

## 4. Caching

Next.js 15's static-file serving defaults to
`Cache-Control: public, max-age=300` for assets in
`apps/web/public/` (5 minutes at the CDN edge; longer in
practice once Vercel's edge cache kicks in). The OpenAPI YAML
inherits that, which is the right knob for the public docs
site — short enough that a sync-and-redeploy is observable
within five minutes, long enough that the edge isn't re-fetching
the YAML on every page view.

The two interesting failure modes are:

1. **Breaking change deployed without a version bump.** A
   5-minute TTL means a reader who loaded the docs site
   *before* the redeploy can still hit the cached spec for up
   to 5 minutes. The escape hatch is to version the URL
   (`/api-docs/v1/openapi.yaml` → `/api-docs/v2/openapi.yaml`)
   and serve the old copy from a permanent URL while the new
   one is on `/api-docs/`. The OpenAPI spec's `info.version`
   field should match the URL path.
2. **HTML page cache is per-URL, but the page is per-version.**
   `index.html` itself is unversioned — the same HTML renders
   whatever spec the same-origin YAML fetch returns. The
   version URL is on the YAML, not the page.

The `Cache-Control` value is not overridden anywhere in this
brief. If a future spec needs a longer cache, the right move
is to add a `Cache-Control` header to a custom Next.js
rewrite, not to vendor the file into the bundle.

---

## 5. What if Swagger UI is blocked at a customer

Two failure modes to design for:

* **The customer's network blocks `unpkg.com` (or a CDN region
  it sits in).** The HTML loads, the CSS link fails, the JS
  bundle fails, and the page is just a header and a notice
  with an empty `<div id="swagger-ui">` underneath. The
  customer has *no way to read the spec* through the docs site.
* **The customer's CSP refuses inline styles or specific
  third-party origins.** The same outcome: empty renderer.

The current escape hatch is the raw YAML at
`https://antarix.app/specs/003-engage-and-showcase/openapi.yaml`
(served by Next.js from `specs/` if the path is added to
`apps/web/public/`, or by the Vercel static export). The raw
YAML is the canonical "the docs site broke, give me the spec"
fallback, and the open item to add a Redoc page at
`/api-docs/redoc` (which is a single-file renderer with no
CDN) is the proper second-tier fallback for the CSP case
(§6).

A future emergency playbook, not part of v1, is to publish a
mirror at `https://docs.antarix.app/api-docs/` with Swagger
UI vendored locally (see §7). That's the
"customer-network-blocks-the-CDN" answer for paid-tier
customers who can ask for it; the v1 site does not have it.

---

## 6. Open items

1. **Redoc fallback page** at `/api-docs/redoc`. Redoc is a
   single-file, no-CDN, opinionated OpenAPI renderer that
   produces a more "documentation-y" layout than Swagger UI.
   Useful for technical writers and for customers whose CSP
   refuses the Swagger UI bundle. Open question: do we vendor
   Redoc the same way we vendor Swagger UI in v2, or just
   CDN-load it? My recommendation is "vendor", for symmetry.
2. **`pnpm sync:api-docs` script.** A 6-line Node script that
   does steps 3 and 4 from §3 — copies the spec, runs the
   byte-diff, and exits non-zero on drift. This becomes a
   pre-commit hook on any branch that touches
   `specs/003-engage-and-showcase/openapi.yaml`. The brief
   explicitly defers the script; flagging it here so the next
   agent doesn't have to re-derive the protocol.
3. **Changelog page at `/api-docs/changelog`.** Powered by
   the "Changelog" section in `docs/api-verification.md` §8
   (already exists). The page would be a tiny static MDX
   file in `apps/web/public/api-docs/changelog.html` (or a
   server-rendered page if we want RSS). Out of scope for
   v1 because the spec is at version `1.0.0` and the
   changelog has one row.
4. **"Open in Postman" button.** Postman can import any
   OpenAPI 3.1 spec by URL. A small "Run in Postman" button
   in the docs site header would deep-link to
   `https://www.postman.com/` with a pre-filled import
   dialog. The button is a 6-line HTML addition (a static
   `<a>` with a `pm:import` URL). Low effort, high value for
   API consumers — the only reason it's not in v1 is to
   keep the brand bar focused on the two mailto contacts.
5. **Dark-mode toggle.** Swagger UI 5.x ships a
   `syntaxHighlight` theme option but not a full light/dark
   toggle. The cleanest implementation is a `prefers-color-scheme`
   media query in the inline `<style>` block + a
   Swagger UI `onComplete` hook that calls
   `ui.specActions.updateSpec` to re-render. Deferred —
   we don't have any customer request for it yet, and the
   brand bar is currently light-only.

---

## 7. Security

The single largest risk in v1 is the CDN dependency. The HTML
page loads two resources from `unpkg.com` (Swagger UI's CSS and
JS bundle). If `unpkg.com` is compromised, an attacker can ship
arbitrary JavaScript to every reader of the public docs site.

The concrete attack chain:

1. Attacker compromises `unpkg.com` (or a downstream npm
   mirror), or MITMs a reader on an insecure network and
   rewrites the bundle URL.
2. Malicious JS runs in the context of `https://antarix.app/api-docs/`.
3. Reader clicks "Authorize" in the Swagger UI header and
   pastes a production Supabase JWT.
4. Because `persistAuthorization: true` is set, the JWT is
   written to `localStorage` *anyway* — but the malicious
   script has already exfiltrated it before the click.

The risk is bounded by the JWT's own lifetime (1 hour by
default in Supabase) and by the fact that a stolen
`anon`/`authenticated` JWT can only call the Antarix
Edge Functions within the scope of the user's own `sub`. It
is not, by itself, a credential that lets an attacker into
the Antarix database. But it can be used to call
`/credential-vc-issue` as the user and to enumerate the
user's own `verifiable_credentials` rows, which is
non-trivial.

The mitigations, in order of effort:

1. **SRI hashes (planned, not yet shipped).** Pin the
   `integrity=` attribute on the `<link>` and `<script>` tags
   to the SHA-384 of the exact files at the exact version.
   `unpkg` does not currently publish per-asset SRI hashes in
   its package metadata, so this requires fetching the
   bundle once at build time, computing the hash, and
   checking it in. The `<!-- TODO: pin SRI hashes… -->`
   comment in `index.html` is the call-out.
2. **Vendoring (v2).** Download `swagger-ui-dist@5.32.6` once
   (one-time `pnpm pack swagger-ui-dist && cp -r .../dist
   public/api-docs/vendor/swagger-ui/`), check the SRI hashes
   in, and reference the vendored files instead of the CDN
   URL. Adds ~1.1 MB of static files to the deploy, which is
   cheap. Removes the entire CDN-compromise attack chain.
3. **Subresource allow-list in the customer CSP docs.**
   We can't enforce customer CSP, but the Antarix
   VDP/threat-model documentation can recommend that
   integrators using their own CSP at the verify-portal
   embed point to `https://unpkg.com/swagger-ui-dist@5.32.6/`
   as the only allowed third-party origin.

The current v1 stance is "ship the CDN version with a clear
security note in the yellow banner and a `TODO` in the
source". The v2 stance is "vendor it". The SRI hashes are
the intermediate step that gives us a 90-day window to vendor
without an emergency push.

The other security-relevant defaults in `index.html`:

* `meta name="robots" content="noindex,nofollow"` — the public
  docs site should not appear in search results. Verifiers
  should arrive via deep links from LinkedIn or the Antarix
  homepage, not via Google.
* No third-party analytics, no error reporting, no CDN with
  query-string telemetry. The page makes exactly one
  same-origin fetch (the YAML at `/api-docs/openapi.yaml`)
  and two same-origin JS/CSS loads from `unpkg.com`.
* The `persistAuthorization: true` setting is the single
  largest single-click risk (see attack chain above). The
  security note above the renderer tells the reader
  explicitly not to paste production tokens. We accept this
  risk in v1 because the same setting is the reason
  `tryItOutEnabled: true` is useful at all (without
  persistence, every page reload re-pastes the JWT).

---

## 8. Cross-references

* **Spec source of truth:**
  `specs/003-engage-and-showcase/openapi.yaml` (1570L, swagger-cli
  validates clean — see C-1 log entry in `agents/STATUS.md`).
* **Human companion (the "why" and the 4-step verification
  flow):** `docs/api-verification.md` (621L, C-1).
* **DID + signature crypto rollout (v1 stub → real EdDSA):**
  `docs/w3c-vc-eddsa-rollout.md` (C-3). The `proofValue` field
  shape will change at v2; the spec surface will not.
* **Rate-limit design that this page documents:**
  `docs/rate-limiting.md` (B-3). The `429` shape in
  `components/responses/RateLimited` is sourced from this
  doc.
* **Vulnerability disclosure:**
  `docs/security/vdp.md` (C-2). The footer's
  `security@antarix.app` link is the same address that
  `apps/web/public/.well-known/security.txt` lists.
