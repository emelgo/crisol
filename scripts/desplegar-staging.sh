#!/usr/bin/env bash
# Despliega staging en este VPS desde origin/main: construye la imagen, migra la base de datos, reinicia y comprueba.
# Trabaja en una copia aparte (~/crisol-staging) para no depender de la rama en la que se esté trabajando.
# Con una rama, la de este repo tal cual (sin subirla a GitHub), para que Enrique revise una tanda desde fuera antes
# de fusionarla; al fusionar, se vuelve a desplegar main.
# Uso: scripts/desplegar-staging.sh [rama]
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${CRISOL_STAGING_DIR:-$HOME/crisol-staging}"
PUERTO="${CRISOL_PORT:-8140}"
RAMA="${1:-}"

# Un solo despliegue a la vez: dos migraciones simultáneas se pisan
exec 9>"$DESTINO.lock"
if ! flock -n 9; then
  echo "Ya hay un despliegue en marcha" >&2
  exit 1
fi

# Copia de main, aparte del repo de desarrollo
if [ ! -d "$DESTINO/.git" ]; then
  git clone --quiet "$(git -C "$REPO" remote get-url origin)" "$DESTINO"
fi
if [ -n "$RAMA" ]; then
  git -C "$DESTINO" fetch --quiet "$REPO" "$RAMA"
  git -C "$DESTINO" checkout --quiet --detach FETCH_HEAD
else
  git -C "$DESTINO" fetch --quiet origin main
  git -C "$DESTINO" checkout --quiet --detach origin/main
fi
echo "Desplegando $(git -C "$DESTINO" log -1 --format='%h %s')"

# Variables de staging, fuera de git: se añaden las que falten y nunca se cambian las que ya hay
ENV_FILE="$DESTINO/.env.staging"
(umask 077 && touch "$ENV_FILE")
asegura() { grep -q "^$1=" "$ENV_FILE" || printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"; }
asegura POSTGRES_PASSWORD "$(openssl rand -hex 24)"
asegura AUTH_SECRET "$(openssl rand -hex 32)"
asegura PUBLIC_URL "https://neo.crisol.144-91-122-245.sslip.io"
asegura CRISOL_PORT "$PUERTO"

compose() {
  docker compose --project-directory "$DESTINO" -f "$DESTINO/compose.prod.yaml" --env-file "$ENV_FILE" "$@"
}

compose build --quiet app postgres
compose up -d --wait postgres valkey
compose run --rm --no-deps app node packages/db/src/migrate.ts
compose up -d --wait app

# Comprobación final desde fuera del contenedor
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PUERTO/api/health" >/dev/null; then
    echo "Staging en marcha en http://127.0.0.1:$PUERTO"
    exit 0
  fi
  sleep 1
done
echo "Staging no responde en /api/health" >&2
compose logs --tail 50 app >&2
exit 1
