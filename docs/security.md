# Security

Assumptions: contractors may be untrusted; organisation users may attempt to
reach another organisation's data. Authorization is enforced **server-side** for
every protected read and mutation.

## Tenant isolation

- Hard boundary at the database via Row-Level Security (see `architecture.md`
  and `database.md`). The runtime role `app_user` can only ever see rows whose
  `organisation_id` matches `current_setting('app.current_org_id')`.
- Context is set with `SET LOCAL` inside a transaction (`@scip/db` `withTenant`),
  so it cannot leak across pooled connections.
- Platform admins operate with `app.is_platform_admin = 'true'`, which policies
  honour explicitly; this is only ever set from a verified platform-admin session.

## Authentication

- Passwords hashed with **scrypt** (memory-hard, built into Node — no native
  addon, so it behaves identically in dev, the Next.js server bundle and Docker).
  Never stored or logged in plaintext. Stored as `scrypt$N$r$p$salt$hash`.
- Sessions are opaque random tokens; only a **SHA-256 hash** of the token is
  stored in `sessions`. The raw token lives only in an httpOnly, Secure,
  SameSite=Lax cookie.
- Sessions expire (`SESSION_TTL_HOURS`) and can be revoked (row delete).
- **Prohibited actions are not automated by the platform** on the user's behalf
  (e.g. entering payment/credentials). Billing is handled by a dedicated provider.

## Authorization (RBAC + scope)

- Permission matrix in `@scip/auth` (`rbac.ts`); `can(role, permission)` is the
  single source of truth.
- Property-level scoping (Building Manager / Security) is checked in the app layer
  against `user_roles.property_id`.
- Never trust a role, org id, or property id supplied by the browser.

## QR verification

- QR encodes an **opaque token**, never an internal database id or personal data.
- The public verification endpoint exposes only what establishes current
  compliance: contractor identity, company, property, required inductions, current
  status, valid-until. Nothing more.

## Data handling

- Private documents/videos/certificates served via short-lived signed URLs
  (MinIO presign); storage credentials never reach the frontend.
- Uploaded file type + size validated; malware scanning can be added before
  publication.
- Minimise personal data; define retention/deletion per customer requirement.
- Encrypt in transit (Caddy TLS) and use encrypted storage volumes on the VPS.

## Abuse resistance (implemented alongside the relevant endpoints)

- Rate-limit auth, public verification, and induction submission endpoints.
- Idempotency keys prevent duplicate completion submissions.
- Immutable published versions, certificates, and audit logs.
- Audit all administrative actions with before/after + request id.

## Secrets

- All secrets come from environment (`@scip/config` validates them at boot).
- `.env` is git-ignored; only `.env.example` (placeholders) is committed.
- Production config must contain no hard-coded secrets (checked in Stage 8).

## Security test targets (Stage 8 regression suite)

IDOR/BOLA, cross-tenant leakage, upload handling, auth bypass, QR token abuse,
privilege escalation.
