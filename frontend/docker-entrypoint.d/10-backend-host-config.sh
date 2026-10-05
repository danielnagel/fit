#!/bin/sh
set -e

# Runs as a /docker-entrypoint.d/ script of the nginx:alpine image, before nginx reads its config.
# BACKEND_HOST lets a deployment send /api to a different hostname than the service name from
# docker-compose.yml ("fit-backend") without rebuilding the image.
sed -i "s/__BACKEND_HOST__/${BACKEND_HOST:-fit-backend}/g" /etc/nginx/conf.d/default.conf
