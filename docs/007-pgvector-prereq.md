# 007 — pgvector Prerequisite Documentation

## Overview
Feature 007 (Adaptive Learning Graph) requires the `pgvector` PostgreSQL extension to be enabled in the database. This extension provides vector similarity search capabilities using HNSW (Hierarchical Navigable Small World) indexes, which are essential for the alumni mentorship match feature (cosine similarity on 384-dimensional trajectory embeddings).

## Required Extension
- **Extension**: `pgvector`
- **Version**: 0.5.0+ (compatible with Supabase)
- **Enable Command**: `CREATE EXTENSION IF NOT EXISTS vector;`

## Where It's Enabled
The extension is enabled in migration `054_adaptive_learning_graph.sql` (the single additive migration for feature 007), specifically at the top of the migration file before any table creation:

```sql
-- 054_adaptive_learning_graph.sql
-- 007 — Adaptive Learning Graph

-- =============================================================================
-- 0. Extensions
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;
```

Note: `pgcrypto` is also enabled (for `gen_random_uuid()`) if not already present from earlier migrations.

## HNSW Index Configuration
Per research.md Decision D2, the HNSW index on `skill_trajectory_embeddings.embedding` uses:
- `m = 16` (number of bi-directional links created for each new element)
- `ef_construction = 64` (size of the dynamic candidate list during index construction)
- `ef_search = 40` (size of the dynamic candidate list during search)

```sql
create index if not exists skill_trajectory_embeddings_embedding_idx
on public.skill_trajectory_embeddings
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);
```

Query-time `ef_search` is set via:
```sql
set local hnsw.ef_search = 40;
```

## Supabase Compatibility
- **Supabase CLI**: pgvector is available in Supabase local development (`npx supabase start`)
- **Supabase Cloud**: pgvector is enabled by default on all Supabase projects
- **No additional configuration required** beyond the `CREATE EXTENSION` statement

## Verification
After applying the migration, verify the extension is active:

```sql
-- Check extension is installed
select * from pg_extension where extname = 'vector';

-- Check vector type is available
select 'test'::vector(3);

-- Check HNSW index exists
select indexname, indexdef from pg_indexes 
where indexname = 'skill_trajectory_embeddings_embedding_idx';
```

## Embedding Model
- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Consistency**: The dimension MUST remain 384 to keep the HNSW index size constant. If a different model is chosen in the future, it must also output 384 dimensions, or a new migration with index rebuild is required.

## Migration Number
- **Migration**: `054_adaptive_learning_graph.sql`
- **Dependencies**: Builds on 001-006 (migrations 001-053)
- **Next migration after 007**: 055+

## Rollback
To disable pgvector (not recommended once data exists):
```sql
drop extension if exists vector cascade;
```
Warning: This will drop all vector columns and indexes. Only use if no 007 data exists.