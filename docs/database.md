# Database Model

PostgreSQL 16. Migrations live in `packages/db/migrations/` and are the
**authoritative** schema (applied in filename order). UUID primary keys
(`gen_random_uuid()` via `pgcrypto`). `created_at` / `updated_at timestamptz`
everywhere; `updated_at` maintained by a shared trigger.

## Tenanting columns

- Every tenant-owned table has `organisation_id uuid not null references organisations(id)`.
- Property-scoped tables also carry `property_id uuid`.
- These columns are the basis for Row-Level Security (see `0005_rls_policies.sql`).

## Table groups

### Platform / identity (`0001`)
- `plans` — global subscription plans (not tenant-scoped).
- `organisations` — the tenant root.
- `subscriptions` — org ↔ plan, status, period.
- `properties` — buildings within an org (e.g. 101–121 Castlereagh St).
- `locations` — sub-areas within a property (loading dock, risers, plant rooms).
- `users` — a person who can sign in; `password_hash`, `organisation_id` (null
  for platform admins).
- `sessions` — opaque session tokens (hashed at rest).
- `roles` — role definitions (seeded: the 6 roles from the PRD).
- `user_roles` — user ↔ role, optionally scoped to a `property_id`.
- `contractor_companies` — a contracting business engaged to work.
- `contractors` — an individual worker belonging to a company.
- `contractor_documents` — uploaded insurances / licences / SWMS with expiry.

### Induction engine (`0002`)
- `documents` + `document_versions` — uploaded source PDFs/DOCX (immutable versions).
- `inductions` — an induction "template" for a property (generic engine; Site
  Induction / House Rules / Traffic Plan are **content types**, not hard-coded).
- `induction_versions` — immutable published versions (`version_number`, `status`,
  `effective_from`, `expires_after_days`, `source_document_version_id`,
  `published_by`, `published_at`, `content_hash`).
- `induction_sections` → `induction_slides` → `induction_media` — ordered content,
  each slide keeping a `source_document_id` / `source_page` and `safety_critical`
  flag for reviewer traceability.
- `induction_questions` + `induction_question_options` — knowledge check.

### Attempts / compliance / certificates (`0003`)
- `induction_attempts` — a contractor's attempt at a version (`started_at`,
  `completed_at`, `score`, `passed`, `verification_token`, device/IP metadata).
- `induction_answers` — answer rows per attempt.
- `declarations` — declaration text version accepted.
- `signatures` — captured signature (stored file id + metadata).
- `certificates` — immutable signed PDF record (`certificate_id`, storage ref,
  `content_hash`); files are never overwritten.
- `compliance_records` — the current computed status per (contractor × induction),
  with `valid_until` and re-induction flags.

### Audit / notifications / QR (`0004`)
- `qr_codes` — opaque verification tokens for a property and/or induction.
- `notifications` — outbound notification log (invites, reminders, expiry).
- `audit_logs` — immutable activity history: `actor_user_id`, `event_type`,
  `entity_type`, `entity_id`, `before`/`after` JSON, `request_id`, timestamp.

## Key invariants (enforced in code + triggers, Stage 3)

- `induction_versions.status = 'published'` rows are immutable.
- `certificates` rows are insert-only (no update/delete).
- `audit_logs` rows are insert-only.
- Completion is atomic: either all required requirements are satisfied and a
  completion record + certificate are issued, or nothing is.

## Roles / grants (`0006`)

- `app_user` — least-privilege login role used at runtime. RLS enforced.
- Migrations run as `postgres` (owner/superuser), which bypasses RLS.
- The DB init script (`infrastructure/docker/postgres-init/`) creates `app_user`
  with the password from `APP_DB_PASSWORD`; migration `0006` grants it table DML
  and sequence usage.
