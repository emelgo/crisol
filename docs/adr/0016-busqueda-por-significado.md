# ADR-0016: Búsqueda por significado con un modelo propio, pgvector y la app sobre Debian

Fecha: 2026-11-06 · Estado: aceptada · Módulo 4, `docs/specs/biblioteca.md`

## Contexto

La biblioteca (los PDF de un mundo) y la wiki tienen que buscarse por significado además de por palabras («qué hace la
guardia» encuentra «los vigilantes patrullan»). Enrique pidió un modelo propio si cabe en el VPS (6 núcleos, 11 GiB),
sin sacar el texto a un servicio de fuera, y dio permiso para pgvector, para una imagen propia de Postgres y para subir
la app a 1 GB de memoria.

## Decisión

1. **El modelo**: `intfloat/multilingual-e5-small` (MIT, 384 dimensiones, español e inglés) cuantizado a int8, con
   `onnxruntime-node` (MIT) y su tokenizador SentencePiece en wasm (`@sctg/sentencepiece-js`, Apache-2.0). Medido en el
   VPS: 270 MB cargado, 290 MB de pico, unos 240 ms por trozo de 300 tokens con dos hilos. Va en un hilo aparte del
   proceso de la app, se carga al usarlo y se descarga tras 10 minutos sin uso. Sin sus archivos, la búsqueda sigue
   solo por palabras.
2. **Los vectores en Postgres con pgvector** (licencia PostgreSQL) e índice HNSW, en una **imagen propia**
   (`docker/postgres`): la `postgres:17-alpine` de antes con pgvector compilado. La oficial de pgvector va sobre Debian,
   y cambiar de libc cambiaría el orden del texto de los índices de staging. En la CI, que empieza de cero, la oficial
   de pgvector con el texto ordenado por bytes (`C.UTF-8`), como el de Alpine.
3. **La imagen de la app pasa de Alpine a Debian** (`node:24-bookworm-slim`). La librería de `onnxruntime-node` es
   para glibc: en Alpine no carga, ni con `gcompat` (probado). `onnxruntime-web` (wasm) sí carga, pero va al doble de
   lento y gasta el triple de memoria (medido: unos 500 ms por trozo y 800 MB). Chromium (el PDF de las hojas) pasa al de
   Debian. De la librería solo se deja la de Linux x64 sin CUDA.
4. **La búsqueda híbrida**: palabras (`es_unaccent`, como la wiki) y significado, mezclados por su puesto (RRF); lo que
   solo sale por significado se marca, y por debajo de un parecido de 0,78 no se enseña (lo relevante suele dar 0,8 o más; lo que no tiene que ver, 0,7).

## Consecuencias

- La app en staging, 1 GB de límite; la imagen crece unos 120 MB por el modelo.
- Los trozos (`search_chunks`) salen del texto: no pasan por el historial y se rehacen solos (al leer un PDF, al guardar
  una página); sus vectores se calculan en segundo plano.
- Si la calidad no basta con textos de verdad, se mide `multilingual-e5-base` (unos 280 MB más) antes de cambiar.
