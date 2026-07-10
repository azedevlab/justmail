# Build context = repo root. Serves both `api` (dist/main.js) and `worker`
# (dist/worker.js — compose overrides the command).

FROM node:22-bookworm-slim AS build
RUN corepack enable
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
RUN pnpm -r --filter '@justmail/contracts' --filter '@justmail/design-tokens' \
      --filter '@justmail/mail-parser' --filter '@justmail/openapi' \
      --filter '@justmail/plugin-sdk' --filter '@justmail/storage' \
      --filter '@justmail/theme-engine' build \
    && pnpm --filter @justmail/api build

FROM node:22-bookworm-slim AS prod-deps
RUN corepack enable
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

FROM node:22-bookworm-slim
ENV NODE_ENV=production
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
