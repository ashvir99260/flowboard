# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9
FROM ${NODE_IMAGE} AS tools
WORKDIR /repo
RUN npm install --global pnpm@12.15.0 turbo@2.11.10

FROM tools AS prune
COPY . .
RUN turbo prune @flowboard/web --docker

FROM tools AS build
ENV CI=true NEXT_TELEMETRY_DISABLED=1
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=flowboard-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=prune /repo/out/full/ .
RUN pnpm exec turbo run build --filter=@flowboard/web

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone/ .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
    CMD node -e "const r=require('node:http').get('http://127.0.0.1:'+process.env.PORT,res=>{res.resume();process.exit(res.statusCode>=200&&res.statusCode<400?0:1)});r.on('error',()=>process.exit(1));r.setTimeout(2000,()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
