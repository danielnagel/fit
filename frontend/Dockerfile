# Build-Kontext ist das Repo-Root (npm workspaces, gemeinsames package-lock.json),
# siehe build.context/build.dockerfile in docker-compose.yml.

# ---- Build stage ---------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY e2e/package.json ./e2e/package.json
RUN npm ci --workspace=frontend

COPY frontend ./frontend

WORKDIR /app/frontend
RUN npm run build

# ---- Runtime stage -------------------------------------------------------
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

COPY frontend/docker-entrypoint.d/10-backend-host-config.sh /docker-entrypoint.d/10-backend-host-config.sh
RUN chmod +x /docker-entrypoint.d/10-backend-host-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
