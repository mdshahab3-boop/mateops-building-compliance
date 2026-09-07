# Progress

Living status file. Each stage lists what was built and how it was verified.
Do not mark a stage done until it has automated tests and (where relevant) a
manual verification path.

## Stage 1 — Foundation ✅ (in progress → complete when tests pass)

**Goal:** repository structure, docs, database schema + migrations, tenant
isolation strategy, authentication model, RBAC, and tests for tenant isolation
and permissions. No UI yet.

Delivered:
- [x] Monorepo scaffold (pnpm workspaces, TS base config).
- [x] Docs: product-requirements, architecture, database, security, progress.
- [x] Docker Compose: postgres, redis, minio, caddy (+ app/worker service defs).
- [x] DB init script creating least-privilege `app_user`.
- [x] Migrations `0001`–`0006`: full core schema, induction engine, attempts/
      compliance/certificates, audit/notifications/QR, **RLS policies**, roles/grants.
- [x] `@scip/db`: tenant-aware client (`withTenant`) + migration runner.
- [x] `@scip/auth`: argon2 passwords, hashed session tokens, RBAC matrix + `can()`.
- [x] `@scip/types`, `@scip/validation`, `@scip/config`.
- [x] Tests: RLS tenant-isolation integration test; RBAC unit tests.

Verification (performed 2026-09-03 against a real Postgres 16 instance):
- `pnpm test` → 12 unit tests pass (RBAC matrix + argon2/session crypto); the
  5 DB tests auto-skip when no `DATABASE_URL` is set.
- `pnpm -r typecheck` → all packages clean.
- All 7 migrations apply in order → 30 tables created.
- RLS proven as `app_user`:
  - a tenant sees only its own rows;
  - explicit cross-org read returns 0 rows;
  - cross-org INSERT is rejected ("new row violates row-level security policy");
  - platform-admin flag sees all orgs;
  - `SELECT password_hash` → "permission denied for table users" (column privilege),
    while allowed columns read fine.
- Auth definer path proven: `auth_find_user_for_login` returns password_hash
  (via SECURITY DEFINER) though app_user can't read the column; session
  create → resolve (identity + roles) → revoke (invalidates) all work.

Decisions logged:
- Self-hosted stack (MinIO + own auth) instead of Azure/Supabase — see architecture.md.
- Org-level isolation enforced in DB (RLS); property-level scoping in app layer.
- Insurance/licence expiry pulled forward from "future modules".
- Cross-org authentication uses a small set of SECURITY DEFINER functions
  (0007) rather than a second DB role or an app-settable RLS bypass flag.

Dev environment note:
- Running Node/tsx directly from the iCloud Drive path is very slow (file sync);
  `pnpm test` works, but `pnpm --filter @scip/db migrate` can stall. Run
  migrations either inside Docker on the VPS, or from a checkout on a local
  (non-iCloud) disk. Verification above was done by applying the migration SQL
  with `psql` directly, which is equivalent to what the runner executes.

## Stage 2 — Real induction app ✅ (demo vertical slice)

Built a working Next.js app (App Router + Tailwind, T&M branding) delivering the
full end-to-end journey, seeded with the real 101–121 Castlereagh content.

Delivered:
- [x] Admin login (workspace-scoped, scrypt + session cookie) and dashboard:
      property overview, per-induction share links + QR, compliance records table.
- [x] Contractor journey at `/i/[token]`: intro → narrated slideshow (with optional
      voice) → knowledge check → details → declaration + signature pad → submit.
- [x] Atomic submission: contractor + attempt + graded answers + declaration +
      signature + immutable certificate + compliance record, in one transaction.
- [x] Public QR verification `/verify/[token]` and on-the-fly PDF certificate `/c/[token]`.
- [x] Seed (`pnpm --filter @scip/web seed`): T&M org, property, admin, three
      published inductions (Site Induction, House Rules, Traffic Plan) as real
      slides + quizzes, share links, and one sample completion.

Verified (2026-09-03, local Postgres):
- Walked the whole contractor flow in a browser → COMPLIANT certificate issued,
  scored 100%, verify page + PDF generated.
- Admin login works; dashboard shows the completion; `next build` passes; all 17
  unit/integration tests pass.

Decisions:
- Password hashing switched argon2id → **scrypt** (Node built-in) to avoid a
  native addon that broke the Next server bundle and would complicate Docker.
- "Video" is a narrated auto-advancing slideshow for now; rendered MP4 + AI
  narration remains the Stage 6 pipeline.
- Demo is single-tenant-seeded on the multi-tenant foundation; unauthenticated
  contractor/verify paths resolve their org via SECURITY DEFINER token lookups
  (migrations 0008/0009), then run inside a normal `withTenant` transaction.

Not yet (future stages): induction builder UI (content is seeded), document
upload/AI drafting, multi-property admin CRUD, mobile app, insurance tracking.

## Stage 2b — Core Admin CRUD ⬜ (next)
Admin create/edit for properties, contractor companies, workers & users; the
induction builder UI; document upload. Server-side authorization on every route.

## Stage 3 — Induction Engine ⬜
Generic builder with draft/review/approved/published/archived; immutable versions,
sections/slides/media/questions; source-document/page references; immutability
triggers + tests.

## Stage 4 — Contractor Flow ⬜
QR/secure-link onboarding, playback, progress tracking, knowledge checks, retry
rules, declaration + signature; E2E for success and failure.

## Stage 5 — Compliance ⬜
Completion records, expiry calculation, re-induction on new mandatory version,
certificates, QR verification, compliance dashboards, insurance/licence expiry.

## Stage 6 — Documents / AI ⬜
Source upload + processing pipeline; AI-assisted draft (extract → slides →
narration → questions with source refs); mandatory human approval before publish.

## Stage 7 — Mobile ⬜
React Native / Expo contractor app + authorised verification against the API.

## Stage 8 — Production Hardening ⬜
Full repo review; unit/integration/E2E/lint/typecheck/security regression;
tenant-isolation + privilege-escalation tests; remove sample-only assumptions;
document deployment.
