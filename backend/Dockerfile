# The build context is the repo root (npm workspaces, shared package-lock.json),
# see build.context/build.dockerfile in docker-compose.yml.

# ---- Build stage ---------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Only the workspace manifests, so npm ci can resolve the shared lockfile
# (all workspaces must be present, only the backend gets installed).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY e2e/package.json ./e2e/package.json
RUN npm ci --workspace=backend

COPY backend ./backend

WORKDIR /app/backend
RUN npm run build

# ---- Dev stage (local only: docker-compose.yml, hot reload via bind mount) --
FROM build AS dev

CMD ["npm", "run", "dev"]

# ---- Runtime stage (default target, pushed to GHCR by CI) ----------------
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY e2e/package.json ./e2e/package.json
RUN npm ci --workspace=backend --omit=dev && npm cache clean --force

COPY --from=build /app/backend/dist ./backend/dist
COPY backend/db ./backend/db

WORKDIR /app/backend
USER node

# NODE_ENV=production (secure cookie) is deliberately not set here but in the deployment behind
# TLS -- over plain http (local, e2e) the browser would otherwise drop the login cookie.
EXPOSE 3000

# Migrations run on startup (src/index.ts).
CMD ["node", "dist/index.js"]
