# ADR 0001: Persistence on Supabase Postgres, with editorial separation enforced in the database

Status: Proposed (Stage 1). Date: 2026-10-20. Deciders: Sagolik (owner); drafted by Grok Bot.

## Context

- Master Prompt 3 §4 forbids a process-memory store for durable activity and requires transactions, backups with a tested restore, repeatable migrations, append-only publication, and a single canonical model.
- §3 requires the three data classes (canonical, user research, editorial revisions) to be separate and enforced on the server, and "with Supabase Auth, RLS too, not service-role-only".
- The app runs on Vercel serverless functions: there is no writable, persistent disk, and instances share no memory.
- The codebase already has a narrow `EvidenceStore` interface with a Supabase implementation and one migration (JSONB per analysis). The curated record (`src/lib/record`) is held in git with a content-hash lock and must stay reproducible.

## Decision

1. **Supabase Postgres** is the system of record for everything a person or the service creates at runtime: drafts, proposals, decisions, revisions, review assignments, attestations and audit events. No other database is introduced.
2. **The published record stays reproducible from git** until Stage 2 imports it. Import is a migration plus a dry-run mapping (docs/ID_MAPPING.md). After import, the database is canonical and git holds snapshots (`corpus_versions`).
3. **Two migration tracks**, both idempotent:
   - `20261020120000_editorial_workflow.sql` adds proposals and drafts beside the existing JSONB analyses, so the Stage 1 fix works the day a database is connected.
   - `20261020130000_canonical_model.sql` adds the §4 relational model (sources/editions, witnesses, passages, claims and immutable revisions, evidence, arguments/premises, assumptions, tradition positions, contradictions, dossiers, analysis runs, challenge proposals, reviewers, assignments, attestations, publication events, audit events, corpus versions, id mappings).
4. **Enforcement in three layers.**
   - Application: role checks (`src/lib/auth/roles.ts`), version-checked writes, idempotency.
   - RLS: anon reads published rows only; contributors write only their own proposals and drafts as themselves; editors write drafts and move states; reviewers attest only for themselves on their own open assignment.
   - Triggers, which bind even the service role:
     - revision content is immutable;
     - only allowed workflow transitions;
     - no approval by the author;
     - `externally_reviewed` requires an attestation;
     - audit, publication events and attestations are append-only;
     - a published revision's evidence is frozen.
5. **Roles come from `role_grants`**, written only by the service, with `granted_by <> user_id`. The app currently reads the role from Supabase `app_metadata.am_role`, which users cannot edit. In Stage 2 it reads `role_grants` directly, so revocation takes effect immediately rather than at token expiry.
6. **Service role only on the server**, only for seeding, migrations and writes on behalf of anonymous visitors (drafts and proposals with `proposed_by = null`). Authenticated users' writes use their own JWT so RLS applies.
7. **Concurrency.** Optimistic, using a version token (`updatedAt`, then `claim_revisions.version`), plus compare-and-set on proposal status. In Stage 2, approval becomes one Postgres function call in one transaction: insert revision, move pointer, close proposal, write audit.
8. **No silent fallback.** Each store declares `durable`. A deployed build without a database uses the read-only memory store, and every write answers 503.

## Consequences

- Production writes stay off until the owner connects a project (B1). This is intended.
- RLS tests run in CI against local Postgres with an `auth` stub. Before release they must be repeated against the staging Supabase project; a local pass is not a release pass.
- Backups need a Supabase plan with PITR, and a restore drill recorded in the runbook.
- JSONB analyses remain for the Evidence Intelligence demonstrations until Stage 2 maps them to the relational model. They are then read-only legacy.

## Alternatives considered

- **Keep the file or JSON store:** impossible on serverless and not durable.
- **Vercel KV/Blob:** no relational integrity, RLS or transactions across entities.
- **A separate auth provider (Clerk, Auth0):** adds a processor and a JWT bridge to RLS. Supabase Auth issues the JWTs that RLS reads directly.
- **Service-role-only writes with app checks:** rejected by §3. One application bug would then be enough to alter canonical data.
