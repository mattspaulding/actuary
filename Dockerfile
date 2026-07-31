# Actuary — score API for Cloud Run
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production
# NOTE: set CIRCLE_ACCEPT_TERMS=1 in the Cloud Run service env ONLY after the
# operator has personally accepted https://agents.circle.com/terms-of-use.
CMD ["npx", "tsx", "src/server/index.ts"]
