# Architecture

## Shape: modular monolith (not microservices)

Per the build spec: start with a well-structured modular backend + one worker
process. Split services only when there is a measured operational reason.

```
                         ┌────────────────────────────┐
   Internet ── Caddy ──▶ │  apps/web (Next.js)         │
   (TLS, LE)             │   • Admin UI (Stage 2+)     │
                         │   • /api/* route handlers   │
                         │   • server-side authz       │
                         └───────┬─────────────┬───────┘
                                 │             │
                    ┌────────────▼──┐    ┌─────▼──────────┐
                    │ PostgreSQL 16 │    │ MinIO (S3 API) │
                    │  + RLS        │    │ docs / certs   │
                    └────────────▲──┘    └────────────────┘
                                 │
                    ┌────────────┴──┐    ┌────────────────┐
                    │ apps/worker   │◀──▶│ Redis (BullMQ) │
                    │ jobs (Stage6) │    └────────────────┘
                    └───────────────┘
```

All boxes run as `docker compose` services on one Hostinger VPS.

## Packages (shared libraries)

- `@scip/db` — SQL migrations (authoritative schema), the RLS policy set, a
  migration runner, and a **tenant-aware DB client** (`withTenant`) that opens a
  transaction and sets `app.current_org_id` / `app.current_user_id` /
  `app.current_role` before running queries.
- `@scip/auth` — argon2 password hashing, opaque session tokens, and the RBAC
  permission matrix + `can()` check.
- `@scip/types` — shared enums/domain types (roles, statuses, permissions).
- `@scip/validation` — Zod schemas shared between API and UI.
- `@scip/config` — one validated `env` object; the app refuses to boot on bad config.

## Tenant isolation strategy (the important decision)

Two layers, defence in depth:

1. **Database layer (hard boundary).** Every tenant-owned row carries
   `organisation_id`. The app connects as the least-privilege role `app_user`,
   for which **Row-Level Security is enforced**. Policies restrict every row to
   the org in `current_setting('app.current_org_id')`. A bug in application code
   therefore *cannot* leak another organisation's data — the database refuses.
2. **Application layer (finer scoping).** Property-level scoping for Building
   Managers and Security, plus RBAC permission checks, happen in server-side
   authorization middleware. RLS is the safety net; the app layer is the
   day-to-day gate. Never trust a role or property id from the browser.

Migrations run as the `postgres` superuser (which bypasses RLS — appropriate for
DDL). Runtime traffic never uses that connection.

See [`database.md`](database.md) and [`security.md`](security.md) for detail.

## Request lifecycle (runtime, from Stage 2)

```
request → resolve session cookie → load user + roles + org/property scope
        → authorize (RBAC + scope)
        → db.withTenant(orgId, userId, role, async (tx) => { ...queries... })
        → response (consistent envelope, request id)
        → audit_log for material mutations
```

## Immutability rules

- Published `induction_versions` and generated `certificates` are **immutable**.
- Corrections create a **new version**; old completion records are never modified.
- Certificate files are never overwritten — a new version yields a new file.
- Enforced by: no UPDATE path in code + DB triggers guarding published rows
  (added with the induction engine, Stage 3).

## Technology choices vs. the original spec

The spec suggested Azure Blob + cloud Supabase. Adapted for **Hostinger VPS +
Docker**: MinIO replaces Azure Blob; self-hosted Postgres + our own session auth
replace Supabase. The domain model is unchanged.
