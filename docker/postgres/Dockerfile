# Postgres de Crisol: el oficial de Alpine que ya usaba (el orden del texto de sus índices no cambia) con pgvector
# (licencia PostgreSQL) para la búsqueda por significado (docs/specs/biblioteca.md). Se compila sin -march=native
# (vale en cualquier procesador x86-64) y sin el código de JIT
FROM postgres:17-alpine
ARG PGVECTOR_VERSION=0.8.1
RUN apk add --no-cache --virtual .build-deps build-base git \
  && git clone --branch "v${PGVECTOR_VERSION}" --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && cd /tmp/pgvector \
  && make OPTFLAGS="" with_llvm=no \
  && make install with_llvm=no \
  && cd / && rm -rf /tmp/pgvector \
  && apk del .build-deps
