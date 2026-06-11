# Antarix Shields.io Badges

Static, [shields.io](https://shields.io/endpoint)-compatible badge endpoints served from `https://antarix.app/badges/<name>.json`. Embed them in any markdown, GitHub README, college placement page, recruiter careers page, or personal portfolio.

## How to use

```markdown
[![Antarix Credentials](https://img.shields.io/endpoint?url=https://antarix.app/badges/credential.json)](https://antarix.app/verify)
```

The link target is `https://antarix.app/verify` so the badge is a clickable deep-link into the Antarix verify portal. Swap the target for `https://antarix.app/verify/<slug>` to link to a specific student's public credential.

## Endpoint schema

The JSON shape is the [shields.io "endpoint" badge](https://shields.io/endpoint) schema:

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | integer | Currently `1`. |
| `label` | string | Left-side text. Keep it short. |
| `message` | string | Right-side text. The dynamic bit. |
| `color` | string | Use a [shields.io named color](https://shields.io/badges/static-badge) or a hex string. |

`color` and `label` are optional; shields.io fills in defaults. See [`credential.json`](./credential.json) for the current shipped shape.

## Files

| File | What it shows | When it changes |
|---|---|---|
| `credential.json` | "credentials" → "<N> issued" → blue | When the count of active verifiable credentials changes. |

The current `credential.json` is static with a placeholder count of `42`. It exists so the badge is live on day one. See "Live upgrade path" below for the v1.1.0 plan.

## Live upgrade path (v1.1.0)

The static file is replaced in v1.1.0 by a `badge-credentials` Edge Function that returns the same JSON shape with the live count. It runs:

```sql
select count(*) from public.verifiable_credentials
 where revocation_status = 'active';
```

and emits the same `credential.json` shape. The function is wrapped in `withRateLimit("badge-credentials", { capacity: 60, refillPerMin: 60 }, ...)` and `withObservability(...)`, and the response carries `Cache-Control: public, max-age=3600` so the CDN absorbs visitor bursts. The badge will lag reality by at most 1 hour, which is acceptable for a count badge.

## Use cases

1. **A college embeds it on their placement page.** "Our 1,200 alumni have Antarix-verified credentials." Links to `https://antarix.app/verify`. The most common use case for Pro and Strategic-tier college partnerships.
2. **A recruiter embeds it on their careers page.** "We hire from Antarix." A signal that the company trusts the Antarix verification flow. The most common use case for company-tier accounts.
3. **A student embeds it on their GitHub README.** "42 verified credentials on Antarix." The platform-wide count, not per-student; a per-student variant is on the v1.2.0 roadmap.

## Open items

- **`credentials-by-college` variant.** `?institution=<slug>` shows that college's count. Trigger: 5+ partnership requests.
- **`placement-rate` variant.** Rolling 6-month placement rate. Needs a `placement_outcomes` table (v1.2.0).
- **`median-time-to-place` variant.** Median days from first verified credential to first placement. Same table.
- **Per-student badge.** `?student=<slug>` shows that student's credential count. v1.2.0.
- **Signed response.** v2.0.0 carries a detached JWS signature in `X-Antarix-Signature`. Threat model does not yet warrant it.

## Related pages

- [Public status page](../status.html) — live subsystem health.
- [Vulnerability Disclosure Policy](../../../../docs/security/vdp.md) — how to report a security issue with the badge endpoint.
- [W3C VC implementation](../../../../docs/w3c-vc-impl.md) — what an "issued" credential actually means.
