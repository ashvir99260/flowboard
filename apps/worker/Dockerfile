# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM runtime AS tools
WORKDIR /repo
RUN npm install --global pnpm@12.15.0 turbo@2.11.10

FROM tools AS prune
COPY . .
RUN turbo prune @flowboard/worker --docker

FROM tools AS build
ENV CI=true NEXT_TELEMETRY_DISABLED=1
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=flowboard-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=prune /repo/out/full/ .
RUN pnpm exec turbo run build --filter=@flowboard/worker
RUN --mount=type=cache,id=flowboard-pnpm,target=/pnpm/store \
    pnpm --filter @flowboard/worker deploy --prod --store-dir /pnpm/store /prod/worker

FROM build AS development
ENV CI=false NODE_ENV=development HOST=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY .gitignore .gitignore
RUN find /repo -name node_modules -prune -o -exec chown node:node {} +
USER node
EXPOSE 3002
HEALTHCHECK --interval=5s --timeout=3s --start-period=60s --retries=24 \
    CMD node --input-type=module -e "import net from 'node:net';const s=net.connect({host:'127.0.0.1',port:Number(process.env.PORT)});s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));s.setTimeout(2000,()=>process.exit(1))"
CMD ["pnpm", "exec", "turbo", "watch", "dev:docker", "--filter=@flowboard/worker", "--ui=stream"]

FROM runtime AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3002
COPY --from=build --chown=node:node /prod/worker/ .
USER node
EXPOSE 3002
# TODO(P11-02): Queue readiness is separate from this process-liveness probe.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
    CMD node --input-type=module -e "import net from 'node:net';const s=net.connect({host:'127.0.0.1',port:Number(process.env.PORT)});s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));s.setTimeout(2000,()=>process.exit(1))"
CMD ["node", "dist/main.js"]
