FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY tools/next-lint-glob ./tools/next-lint-glob
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js embeds these public settings into the browser bundle.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_CONTENT_MODE=supabase
ARG SITE_URL
ENV DOCKER_BUILD=1 NEXT_TELEMETRY_DISABLED=1

RUN node -e 'const e = process.env; const mode = e.NEXT_PUBLIC_CONTENT_MODE; const url = new URL(e.NEXT_PUBLIC_SUPABASE_URL); const site = new URL(e.SITE_URL); if (!["supabase", "mock"].includes(mode) || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY || site.protocol !== "https:" || site.href !== site.origin + "/" || url.href !== url.origin + "/" || (mode === "supabase" && (url.protocol !== "https:" || url.hostname.endsWith(".test") || e.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("placeholder")))) throw new Error("Set the public Supabase configuration and HTTPS SITE_URL before building");' \
    && npm run build

FROM base AS runner
ARG SITE_URL
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 SITE_URL=${SITE_URL}

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
