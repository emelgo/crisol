# Imagen de Crisol: el servidor (TypeScript que ejecuta Node directamente) y la web compilada
FROM node:24-alpine AS pnpm
RUN npm install --global pnpm@12.6.0 && npm cache clean --force
WORKDIR /app

# Compila la web con todas las dependencias del monorepo
FROM pnpm AS build
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @crisol/web build

# Dependencias de producción del servidor y sus paquetes
FROM pnpm AS prod-deps
# Los manifiestos de todos los paquetes, para que el lockfile cuadre con el workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY scripts/package.json scripts/
COPY e2e/package.json e2e/
COPY apps/server apps/server
COPY packages packages
RUN pnpm install --frozen-lockfile --prod --filter "@crisol/server..."

# Producción: Node limpio, sin pnpm ni cachés
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app /app
COPY --from=build /app/apps/web/dist apps/web/dist
# Los datos que no van en Postgres (los bytes de los archivos): del usuario node, que el volumen nuevo lo herede
RUN mkdir -p /data/archivos && chown -R node:node /data
# Chromium para sacar el PDF de las hojas (permiso de Enrique, 2026-10-30), con una letra de reserva
RUN apk add --no-cache chromium ttf-dejavu
USER node
ENV HOST=0.0.0.0 PORT=8130 WEB_DIR=/app/apps/web/dist DATA_DIR=/data CHROMIUM_PATH=/usr/bin/chromium-browser
EXPOSE 8130
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8130/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "apps/server/src/main.ts"]
