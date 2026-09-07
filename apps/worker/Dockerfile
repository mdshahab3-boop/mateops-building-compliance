# syntax=docker/dockerfile:1
# Background worker (BullMQ job processor). Runs the TypeScript entry via tsx.
# Built from the repo root (needs the pnpm workspace packages @scip/db, @scip/config):
#   docker compose -f docker-compose.hybrid.yml build worker

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# .dockerignore keeps node_modules/.git/.env out of the build context.
COPY . .
RUN pnpm install --frozen-lockfile

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs worker \
 && chown -R worker:nodejs /app
USER worker

# @scip/worker "start" runs `tsx src/index.ts`.
CMD ["pnpm", "--filter", "@scip/worker", "start"]
