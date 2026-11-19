#!/usr/bin/env bash
# Copia del Crisol oficial: la base (pg_dump comprimido) y los archivos de los mundos, en ~/crisol-backups, con 14 días.
# La lanza cada noche crisol-prod-copia.timer (deploy/systemd) y el despliegue antes de migrar.
# Uso: scripts/copia-produccion.sh [etiqueta]
set -euo pipefail

DESTINO="${CRISOL_PROD_DIR:-$HOME/crisol-prod}"
COPIAS="${CRISOL_BACKUP_DIR:-$HOME/crisol-backups}"
ETIQUETA="${1:-diaria}"
CUANDO="$(date +%Y%m%d-%H%M)"
mkdir -p "$COPIAS"
chmod 700 "$COPIAS"

compose() {
  docker compose -p crisol-prod --project-directory "$DESTINO" -f "$DESTINO/compose.prod.yaml" \
    --env-file "$DESTINO/.env.produccion" "$@"
}

# La base: a un archivo temporal y, si sale bien, a su nombre (nunca una copia a medias)
BASE="$COPIAS/crisol-$CUANDO-$ETIQUETA.sql.gz"
compose exec -T postgres pg_dump -U crisol -d crisol --no-owner | gzip >"$BASE.tmp"
mv "$BASE.tmp" "$BASE"

# Los archivos de los mundos (el volumen de la app)
ARCHIVOS="$COPIAS/archivos-$CUANDO-$ETIQUETA.tar.gz"
docker run --rm -v crisol-prod_archivos:/data:ro -v "$COPIAS":/copias alpine \
  tar czf "/copias/$(basename "$ARCHIVOS").tmp" -C /data .
mv "$ARCHIVOS.tmp" "$ARCHIVOS"

# 14 días
find "$COPIAS" -maxdepth 1 -type f \( -name 'crisol-*.sql.gz' -o -name 'archivos-*.tar.gz' \) -mtime +14 -delete
echo "Copia hecha: $(basename "$BASE"), $(basename "$ARCHIVOS")"
