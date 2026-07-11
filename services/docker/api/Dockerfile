# Build context = repo root. Serves both `api` (dist/main.js) and `worker`
# (dist/worker.js — compose overrides the command).

FROM node:26-bookworm-slim AS build
RUN npm install --global corepack@latest && corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/mail-parser/package.json packages/mail-parser/
COPY packages/openapi/package.json packages/openapi/
COPY packages/plugin-sdk/package.json packages/plugin-sdk/
COPY packages/storage/package.json packages/storage/
COPY packages/theme-engine/package.json packages/theme-engine/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN pnpm install --frozen-lockfile --filter @justmail/api...
COPY packages packages
COPY apps/api apps/api
# Build only the packages @justmail/api transitively depends on. Topological
# order via `...` suffix; UI-only packages are skipped.
RUN pnpm -r --filter '@justmail/contracts...' \
      --filter '@justmail/mail-parser...' \
      --filter '@justmail/openapi...' \
      --filter '@justmail/plugin-sdk...' \
      --filter '@justmail/storage...' build \
    && pnpm --filter @justmail/api build

FROM node:26-bookworm-slim AS prod-deps
RUN npm install --global corepack@latest && corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/mail-parser/package.json packages/mail-parser/
COPY packages/openapi/package.json packages/openapi/
COPY packages/plugin-sdk/package.json packages/plugin-sdk/
COPY packages/storage/package.json packages/storage/
COPY packages/theme-engine/package.json packages/theme-engine/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN pnpm install --frozen-lockfile --prod --filter @justmail/api...

FROM node:26-bookworm-slim
ENV NODE_ENV=production
# postgresql-client-17 (matching the server major) provides pg_dump/pg_restore
# for the worker's backup engine. Pulled from the PGDG apt repository.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-17 \
  && apt-get purge -y curl gnupg \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/packages packages
COPY apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
