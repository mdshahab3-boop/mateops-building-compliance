# @scip/web

Admin web application and API (`/api/*`). **Scaffolded in Stage 2** with Next.js
(App Router) + TypeScript. It will:

- resolve the session cookie → `AuthPrincipal` (via `@scip/auth`),
- authorize each route (`can()` + property scope),
- run every tenant query through `db.withTenant(...)`,
- write `audit_logs` for material mutations.

Until Stage 2 the `web` compose service (profile `app`) is not built.
