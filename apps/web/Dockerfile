# syntax=docker/dockerfile:1
# Next.js web app (admin + contractor journey) — production multi-stage build.
# Built from the repo root so the pnpm workspace packages are available:
#   docker compose -f docker-compose.hybrid.yml build web
#
# Runtime env (DATABASE_URL, DATABASE_ADMIN_URL, SESSION_SECRET, PUBLIC_URL,
# S3_*, REDIS_URL, …) comes from the container environment / .env at run time.

# ---- Builder: install workspace deps and compile the app -------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
# .dockerignore keeps node_modules/.next/.git/.env out of the build context.
COPY . .
RUN pnpm install --frozen-lockfile
# Pages are dynamic (DB-backed) so no database is needed at build time.
RUN pnpm --filter @scip/web build

# ---- Runner: minimal image that serves the standalone output ---------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js "standalone" output bundles a minimal server + traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
# server.js is emitted by the standalone build at apps/web/server.js.
CMD ["node", "apps/web/server.js"]
