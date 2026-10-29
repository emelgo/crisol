#!/usr/bin/env bash
# Despliega staging en este VPS desde origin/main: construye la imagen, migra la base de datos, reinicia y comprueba.
# Trabaja en una copia aparte (~/crisol-staging) para no depender de la rama en la que se esté trabajando.
# Uso: scripts/desplegar-staging.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${CRISOL_STAGING_DIR:-$HOME/crisol-staging}"
PUERTO="${CRISOL_PORT:-8140}"

# Copia de main, aparte del repo de desarrollo
if [ ! -d "$DESTINO/.git" ]; then
  git clone --quiet "$(git -C "$REPO" remote get-url origin)" "$DESTINO"
fi
git -C "$DESTINO" fetch --quiet origin main
git -C "$DESTINO" checkout --quiet --detach origin/main
echo "Desplegando $(git -C "$DESTINO" log -1 --format='%h %s')"

# Secretos de staging, fuera de git: se crean la primera vez
ENV_FILE="$DESTINO/.env.staging"
if [ ! -f "$ENV_FILE" ]; then
  (umask 077 && printf 'POSTGRES_PASSWORD=%s\nCRISOL_PORT=%s\n' "$(openssl rand -hex 24)" "$PUERTO" >"$ENV_FILE")
fi

compose() {
  docker compose --project-directory "$DESTINO" -f "$DESTINO/compose.prod.yaml" --env-file "$ENV_FILE" "$@"
}

compose build --quiet app
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
