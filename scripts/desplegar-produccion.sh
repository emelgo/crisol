#!/usr/bin/env bash
# Despliega el Crisol oficial en este VPS desde origin/main: construye la imagen, copia la base, migra, reinicia y comprueba.
# Va aparte de staging (~/crisol-prod, proyecto crisol-prod, puerto 8150): su propia base, sus archivos y su .env.produccion.
# Uso: scripts/desplegar-produccion.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${CRISOL_PROD_DIR:-$HOME/crisol-prod}"
PUERTO="${CRISOL_PROD_PORT:-8150}"

# Un solo despliegue a la vez
exec 9>"$DESTINO.lock"
if ! flock -n 9; then
  echo "Ya hay un despliegue en marcha" >&2
  exit 1
fi

# Siempre main, tal cual está en GitHub
if [ ! -d "$DESTINO/.git" ]; then
  git clone --quiet "$(git -C "$REPO" remote get-url origin)" "$DESTINO"
fi
git -C "$DESTINO" fetch --quiet origin main
git -C "$DESTINO" checkout --quiet --detach origin/main
echo "Desplegando $(git -C "$DESTINO" log -1 --format='%h %s')"

# Variables, fuera de git: se añaden las que falten y nunca se cambian las que ya hay
ENV_FILE="$DESTINO/.env.produccion"
(umask 077 && touch "$ENV_FILE")
asegura() { grep -q "^$1=" "$ENV_FILE" || printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"; }
asegura POSTGRES_PASSWORD "$(openssl rand -hex 24)"
asegura AUTH_SECRET "$(openssl rand -hex 32)"
asegura PUBLIC_URL "https://app.crisol.144-91-122-245.sslip.io"
asegura CRISOL_PORT "$PUERTO"
asegura CRISOL_IMAGE_TAG "prod"

compose() {
  docker compose -p crisol-prod --project-directory "$DESTINO" -f "$DESTINO/compose.prod.yaml" --env-file "$ENV_FILE" "$@"
}

compose build --quiet app postgres
compose up -d --wait postgres valkey
# Antes de migrar, una copia de la base (si ya hay algo)
if compose exec -T postgres psql -U crisol -d crisol -tAc 'select 1 from information_schema.tables limit 1' | grep -q 1; then
  "$DESTINO/scripts/copia-produccion.sh" antes-de-desplegar
fi
compose run --rm --no-deps app node packages/db/src/migrate.ts
compose up -d --wait app

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PUERTO/api/health" >/dev/null; then
    echo "Crisol oficial en marcha en http://127.0.0.1:$PUERTO"
    exit 0
  fi
  sleep 1
done
echo "El Crisol oficial no responde en /api/health" >&2
compose logs --tail 50 app >&2
exit 1
