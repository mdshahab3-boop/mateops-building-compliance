# Hybrid deployment (VPS + Neon + R2 + Cloudflare Tunnel)

Run the app on a Hostinger VPS in Docker, with the **data** on managed/edge
services so the eventual move to full Cloudflare never has to migrate data:

| Piece            | Where it runs            | Migrates later? |
|------------------|--------------------------|-----------------|
| Web + worker + Redis | VPS (Docker)         | app only (recompile for Workers) |
| PostgreSQL       | **Neon** (managed)       | ❌ stays        |
| File storage     | **Cloudflare R2**        | ❌ stays        |
| Ingress / TLS    | **Cloudflare Tunnel**    | ❌ stays        |

Target hostname: `https://bc.mateops.com.au`.

---

## 1. Neon Postgres (the database)

1. Create a free project at https://neon.tech in an **Asia-Pacific (Sydney)**
   region. Note the database name (default `neondb`).
2. Copy the **owner** connection string → this is `DATABASE_ADMIN_URL`.
3. Create the least-privilege runtime role. In the Neon **SQL Editor**, edit and
   run [`infrastructure/neon/00-app-user.sql`](../infrastructure/neon/00-app-user.sql)
   (set the password; adjust the db name if not `neondb`).
4. Build `DATABASE_URL` from the same host but user `app_user` and that password.

## 2. Cloudflare R2 (file storage)

Buckets already exist: `mateops-compliance-documents`,
`mateops-compliance-certificates`.

1. Cloudflare dashboard → **R2 → Manage R2 API Tokens → Create** (Object
   Read & Write, scoped to those buckets). Copy the **Access Key ID** and
   **Secret Access Key**.
2. Endpoint is `https://<account_id>.r2.cloudflarestorage.com`
   (account id `607dbd1c036f9b4ef08f4f8871f45ddb`).

## 3. Cloudflare Tunnel (ingress, no open ports)

1. Cloudflare **Zero Trust → Networks → Tunnels → Create a tunnel** (Cloudflared).
   Copy the **tunnel token** → `TUNNEL_TOKEN`.
2. Add a **Public Hostname**: `bc.mateops.com.au` →
   service `http://web:3000`. (Cloudflare creates the DNS record + TLS.)

## 4. Configure `.env` on the VPS

```bash
git clone https://github.com/mdshahab3-boop/mateops-building-compliance.git
cd mateops-building-compliance
cp .env.hybrid.example .env
# edit .env: Neon URLs, R2 keys, SESSION_SECRET (openssl rand -base64 48), TUNNEL_TOKEN
```

## 5. Run migrations against Neon (once)

Migrations use `DATABASE_ADMIN_URL` (Neon is reachable from anywhere), so run
them from the VPS host before the first boot:

```bash
corepack enable
pnpm install
pnpm --filter @scip/db migrate     # applies schema + RLS + grants to Neon
```

(Optional) seed a demo tenant: `pnpm --filter @scip/web seed`.

## 6. Boot the stack

```bash
docker compose -f docker-compose.hybrid.yml up -d --build
docker compose -f docker-compose.hybrid.yml logs -f cloudflared   # confirm "Registered tunnel connection"
```

Visit `https://bc.mateops.com.au`. Admin login is at `/admin/login`.

## Updating

```bash
git pull
docker compose -f docker-compose.hybrid.yml up -d --build
pnpm --filter @scip/db migrate     # if new migrations landed
```

## Notes

- **Data residency:** R2 buckets currently default to a US region and R2 has no
  AU jurisdiction. If AU residency is a hard requirement, keep documents on the
  AU VPS (MinIO, as in `docker-compose.yml`) instead of R2 and adjust `S3_*`.
- **No host ports** are exposed — all traffic arrives via the Cloudflare Tunnel,
  so the VPS needs no inbound firewall rules for the app.
- Moving to full Cloudflare later: re-host web/worker on Workers (OpenNext) +
  Queues; Neon (via Hyperdrive) and R2 stay exactly as they are.
