# Build context = repo root. Next.js standalone output.

FROM node:26-bookworm-slim AS build
RUN npm install --global corepack@latest && corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/landing/package.json apps/landing/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN pnpm install --frozen-lockfile --filter @justmail/landing...
COPY packages/design-tokens packages/design-tokens
RUN pnpm --filter @justmail/design-tokens build
COPY apps/landing apps/landing
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @justmail/landing build

FROM node:26-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3002
WORKDIR /app
COPY --from=build /repo/apps/landing/.next/standalone ./
COPY --from=build /repo/apps/landing/.next/static apps/landing/.next/static
COPY --from=build /repo/apps/landing/public apps/landing/public
EXPOSE 3002
CMD ["node", "apps/landing/server.js"]
