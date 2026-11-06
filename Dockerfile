# Imagen de Crisol: el servidor (TypeScript que ejecuta Node directamente) y la web compilada. Sobre Debian: la librería
# nativa del modelo de la búsqueda por significado (onnxruntime-node) es para glibc y no carga en Alpine
FROM node:24-bookworm-slim AS pnpm
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
RUN pnpm install --frozen-lockfile --prod --filter "@crisol/server..." \
  # De onnxruntime-node, solo la librería de Linux x64 sin CUDA (el paquete trae la de cada sistema: unos 500 MB)
  && for dir in node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v*; do \
    rm -rf "$dir/darwin" "$dir/win32" "$dir/linux/arm64" "$dir"/linux/x64/libonnxruntime_providers_cuda.so \
      "$dir"/linux/x64/libonnxruntime_providers_tensorrt.so; \
  done

# El modelo de la búsqueda por significado (MIT): multilingual-e5-small cuantizado y su tokenizador, de versiones
# fijas y comprobados por su huella
FROM pnpm AS model
WORKDIR /model
ADD https://huggingface.co/Xenova/multilingual-e5-small/resolve/761b726dd34fb83930e26aab4e9ac3899aa1fa78/onnx/model_quantized.onnx model.onnx
ADD https://huggingface.co/intfloat/multilingual-e5-small/resolve/614241f622f53c4eeff9890bdc4f31cfecc418b3/sentencepiece.bpe.model sentencepiece.bpe.model
RUN printf '%s  %s\n' \
    f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193 model.onnx \
    cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865 sentencepiece.bpe.model \
  | sha256sum -c - && chmod 644 model.onnx sentencepiece.bpe.model

# Producción: Node limpio, sin pnpm ni cachés
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Chromium para sacar el PDF de las hojas (permiso de Enrique, 2026-10-30), con una letra de reserva
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps /app /app
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=model /model /app/modelos/multilingual-e5-small
# Los datos que no van en Postgres (los bytes de los archivos): del usuario node, que el volumen nuevo lo herede
RUN mkdir -p /data/archivos && chown -R node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8130 WEB_DIR=/app/apps/web/dist DATA_DIR=/data CHROMIUM_PATH=/usr/bin/chromium \
  MODEL_DIR=/app/modelos/multilingual-e5-small
EXPOSE 8130
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8130/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "apps/server/src/main.ts"]
