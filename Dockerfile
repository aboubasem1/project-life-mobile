FROM node:22-alpine AS build

WORKDIR /src

ARG VITE_JEV_ENABLED=false
ARG VITE_JEV_AUTO_ACTIONS_ENABLED=false
ENV VITE_JEV_ENABLED=$VITE_JEV_ENABLED \
    VITE_JEV_AUTO_ACTIONS_ENABLED=$VITE_JEV_AUTO_ACTIONS_ENABLED

COPY package.json package-lock.json ./
RUN npm ci

COPY projectdashboardv1/package.json projectdashboardv1/package-lock.json ./projectdashboardv1/
RUN npm --prefix projectdashboardv1 ci

COPY api ./api
COPY server ./server
COPY projectdashboardv1 ./projectdashboardv1

RUN npm --prefix projectdashboardv1 run build \
  && npm --prefix projectdashboardv1 run build:server

FROM node:22-alpine AS api

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /src/dist-server/server.mjs ./server.mjs

USER node
EXPOSE 3000
CMD ["node", "server.mjs"]

FROM caddy:2.10-alpine AS web

COPY infrastructure/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/projectdashboardv1/dist /srv

EXPOSE 80 443 443/udp

FROM postgres:17-alpine AS backup

RUN apk add --no-cache aws-cli tzdata
COPY infrastructure/scripts/backup-database.sh /usr/local/bin/backup-database.sh
COPY infrastructure/scripts/backup-entrypoint.sh /usr/local/bin/backup-entrypoint.sh
RUN chmod 0755 /usr/local/bin/backup-database.sh /usr/local/bin/backup-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
