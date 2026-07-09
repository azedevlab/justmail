# Build context = repo root. Serves both `api` (dist/main.js) and `worker`
# (dist/worker.js — compose overrides the command).

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @justmail/api...
COPY packages/types packages/types
COPY apps/api apps/api
RUN pnpm --filter @justmail/types build && pnpm --filter @justmail/api build

FROM node:22-bookworm-slim AS prod-deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --prod --filter @justmail/api...

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /repo/packages/types/node_modules packages/types/node_modules
COPY packages/types/package.json packages/types/package.json
COPY --from=build /repo/packages/types/dist packages/types/dist
COPY apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
