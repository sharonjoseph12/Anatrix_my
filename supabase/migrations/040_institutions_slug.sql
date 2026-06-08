-- 040_institutions_slug.sql
-- Adds a `slug` column to public.institutions so SSO login URLs can identify
-- the tenant: /api/sso/workos/login?institution_slug=<slug>.
--
-- Strictly additive. No edits to 001-039. The column is nullable for existing
-- rows; a separate backfill (manual or admin tooling) is required for the
-- institutions already in production. The unique index is created AFTER the
-- column to avoid a unique-constraint violation against duplicate slugs;
-- dedupe must happen before this index is created in production.

alter table public.institutions
  add column if not exists slug text;

create unique index if not exists uq_institutions_slug
  on public.institutions (slug)
  where slug is not null;

comment on column public.institutions.slug is 'URL-safe tenant identifier used by /api/sso/workos/login?institution_slug=<slug>. Nullable; backfill required.';
