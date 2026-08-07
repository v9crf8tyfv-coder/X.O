# Bot X.O — image déployable sur n'importe quel host (Railway, Fly, VPS…)
FROM node:22-alpine

WORKDIR /app

# Manifestes (cache des dépendances)
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/bot/package.json ./apps/bot/

RUN npm install

# Code
COPY packages ./packages
COPY apps/bot ./apps/bot

ENV NODE_ENV=production
CMD ["npm", "run", "bot:start"]
