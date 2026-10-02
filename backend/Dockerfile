# Build-Kontext ist das Repo-Root (npm workspaces, gemeinsames package-lock.json),
# siehe build.context/build.dockerfile in docker-compose.yml.

# ---- Build stage ---------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Nur die Workspace-Manifeste, damit npm ci das gemeinsame Lockfile aufloesen kann
# (alle Workspaces muessen vorhanden sein, installiert wird nur das Backend).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY e2e/package.json ./e2e/package.json
RUN npm ci --workspace=backend

COPY backend ./backend

WORKDIR /app/backend
RUN npm run build

# ---- Dev stage (nur lokal: docker-compose.yml, Hot-Reload per Bind-Mount) --
FROM build AS dev

CMD ["npm", "run", "dev"]

# ---- Runtime stage (Default-Target, wird in CI nach GHCR gepusht) --------
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

# NODE_ENV=production (Secure-Cookie) wird bewusst nicht hier gesetzt, sondern im Deployment hinter
# TLS -- ueber plain http (lokal, e2e) wuerde der Browser das Login-Cookie sonst verwerfen.
EXPOSE 3000

# Migrationen laufen beim Start (src/index.ts).
CMD ["node", "dist/index.js"]
