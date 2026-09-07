# Strata Contractor Induction & Compliance Platform

A multi-tenant SaaS that lets strata / facilities managers (like **T&M Management
Services**) onboard contractors, turn building documents (Site Induction, House
Rules, Traffic Management Plan) into approved inductions with knowledge checks
and a digital signature, and maintain an **auditable compliance record** with
signed certificates and QR verification.

> Build philosophy: this is a **contractor compliance platform** where induction
> is one module — not "a video player". Every published induction version is
> immutable so historical compliance evidence stays valid.

## Why self-hosted

This build targets a **Hostinger VPS running Docker** (no Azure / no cloud
Supabase). Everything runs in `docker compose`:

| Concern        | Choice                                        |
|----------------|-----------------------------------------------|
| Web + API      | Next.js (TypeScript) — *added in Stage 2*     |
| Background jobs | Worker process + Redis (BullMQ) — *Stage 6*  |
| Database       | PostgreSQL 16 with **Row-Level Security**     |
| File storage   | MinIO (S3-compatible)                         |
| Auth           | Self-hosted sessions (argon2 + httpOnly cookie) |
| TLS / proxy    | Caddy (automatic Let's Encrypt)               |

Australian data residency: pick a Hostinger region accordingly, and MinIO keeps
documents/videos/certificates on your own volume.

## Repository layout

```
apps/
  web/          Next.js admin + API            (Stage 2+)
  worker/       Background job processor        (Stage 6+)
packages/
  db/           SQL migrations, RLS, DB client  ✅ Stage 1
  auth/         Passwords, sessions, RBAC       ✅ Stage 1
  types/        Shared domain types/enums       ✅ Stage 1
  validation/   Zod schemas                     ✅ Stage 1
  config/       Validated environment loading   ✅ Stage 1
infrastructure/
  docker/       Compose, Caddyfile, DB init     ✅ Stage 1
docs/           Architecture, DB, security, PRD ✅ Stage 1
```

## Quick start (local)

```bash
cp .env.example .env          # then edit secrets
corepack enable
pnpm install
docker compose up -d postgres redis minio   # infra only
pnpm --filter @scip/db migrate               # apply schema + RLS
pnpm test                                     # tenant-isolation + RBAC tests
```

## Run the induction app (demo)

> Run from a **local disk**, not iCloud Drive — Node/Next are very slow on the
> synced path.

```bash
# 1. Start Postgres (Docker), or point DATABASE_URL at any Postgres 16.
docker compose up -d postgres
pnpm --filter @scip/db migrate          # apply schema + RLS

# 2. Configure the web app's env (cp apps/web/.env.example apps/web/.env.local) then seed
#    the demo tenant (T&M + 101–121 Castlereagh, 3 inductions, an admin login).
pnpm --filter @scip/web seed

# 3. Run it
pnpm --filter @scip/web dev             # http://localhost:3000
```

**Demo logins**

- Admin dashboard → `http://localhost:3000/admin/login`
  workspace `tmms` · `admin@tmmanagementservices.com.au` · `TMdemo2026!`
- Contractor induction links are printed by the seed command (e.g. `/i/<token>`),
  and also shown as QR codes on the admin dashboard.

The contractor flow: open a link → watch the narrated slides → answer the
knowledge check → enter details → sign → get a certificate + QR. Security scans
the QR (`/verify/<token>`) to confirm current compliance.

## Build stages

Progress is tracked in [`docs/progress.md`](docs/progress.md). Stage 1
(Foundation) and Stage 2 (the working induction app — admin dashboard + full
contractor journey, seeded with real content) are complete.

## The evidence chain

```
source document → approved induction version → contractor attempt →
knowledge result → declaration → signature → certificate →
current compliance status → audit history
```
