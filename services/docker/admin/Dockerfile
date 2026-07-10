# Build context = repo root. Next.js standalone output.

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/contracts/package.json packages/contracts/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/theme-engine/package.json packages/theme-engine/
RUN pnpm install --frozen-lockfile --filter @justmail/admin...
COPY packages packages
# Build only what admin transitively needs, honouring the dep graph.
RUN pnpm -r --filter '@justmail/shared-ui...' --filter '@justmail/theme-engine...' build
COPY apps/admin apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @justmail/admin build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static apps/admin/.next/static
COPY --from=build /repo/apps/admin/public apps/admin/public
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
