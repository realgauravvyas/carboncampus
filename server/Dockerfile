# CarbonCampus API — build the shared engine, then the Fastify service.
#
# The workspace layout means the API and the PWA import the same emission
# engine, so the build stage compiles `shared` first and the runtime stage
# carries the resolved workspace links across intact.

FROM node:22-alpine AS build
WORKDIR /app

# Manifests first, so a dependency install is cached across code edits.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY shared shared
COPY server server
RUN npm run build:shared \
 && npm run build --workspace @carboncampus/server \
 && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S carbon && adduser -S carbon -G carbon

COPY --from=build --chown=carbon:carbon /app/node_modules ./node_modules
COPY --from=build --chown=carbon:carbon /app/package.json ./package.json
COPY --from=build --chown=carbon:carbon /app/shared ./shared
COPY --from=build --chown=carbon:carbon /app/server/dist ./server/dist
COPY --from=build --chown=carbon:carbon /app/server/db ./server/db
COPY --from=build --chown=carbon:carbon /app/server/package.json ./server/package.json

USER carbon
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=4s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
