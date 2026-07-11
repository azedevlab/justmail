# Build context = repo root. Next.js standalone output.

FROM node:26-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/webmail/package.json apps/webmail/
COPY packages/contracts/package.json packages/contracts/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/theme-engine/package.json packages/theme-engine/
RUN pnpm install --frozen-lockfile --filter @justmail/webmail...
COPY packages packages
# Build only what webmail transitively needs, honouring the dep graph.
RUN pnpm -r --filter '@justmail/shared-ui...' build
COPY apps/webmail apps/webmail
# NEXT_PUBLIC_* is inlined into the client bundle at build time — a runtime
# environment: entry never reaches the browser, so it must be a build arg.
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @justmail/webmail build

FROM node:26-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=build /repo/apps/webmail/.next/standalone ./
COPY --from=build /repo/apps/webmail/.next/static apps/webmail/.next/static
COPY --from=build /repo/apps/webmail/public apps/webmail/public
EXPOSE 3001
CMD ["node", "apps/webmail/server.js"]
