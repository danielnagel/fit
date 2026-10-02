#!/bin/sh
set -e

# Laeuft als /docker-entrypoint.d/-Skript des nginx:alpine-Images, bevor nginx seine Config liest.
# BACKEND_HOST erlaubt einem Deployment, /api an einen anderen Hostnamen als den Service-Namen aus
# docker-compose.yml ("fit-backend") zu schicken, ohne das Image neu zu bauen.
sed -i "s/__BACKEND_HOST__/${BACKEND_HOST:-fit-backend}/g" /etc/nginx/conf.d/default.conf
