# Actuary — Cloud Run image. RUN_MODE selects the process:
#   server      (default) — the paid score API
#   probe-loop            — the probe fleet (pair with a mounted DATA_DIR volume)
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
# Snapshot of local probe history so the cloud leaderboard shows real data;
# the deployed service keeps appending to its own (ephemeral) copy.
# Roadmap: shared GCS volume so fleet and API read/write one dataset.
COPY data ./data
ENV NODE_ENV=production
# NOTE: set CIRCLE_ACCEPT_TERMS=1 in the Cloud Run service env ONLY after the
# operator has personally accepted https://agents.circle.com/terms-of-use.
CMD ["sh", "-c", "if [ \"$RUN_MODE\" = probe-loop ]; then exec npx tsx src/probe/runner.ts --loop; else exec npx tsx src/server/index.ts; fi"]
