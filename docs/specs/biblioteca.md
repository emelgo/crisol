# Spec: biblioteca (módulo 4)

Estado: **en marcha** (2026-11-06). Sexta capacidad del módulo 4 (`docs/specs/modulo-4.md`). Decisiones: memoria
«Búsqueda: PDF y pgvector» (2026-10-30) y la entrevista del módulo 4 (pgvector con permiso; «modelo propio si puede
correr en el vps»). La medida del modelo, en `docs/specs/modulo-4.md` § «La medida del modelo de embeddings».

## Objetivo

Que los PDF (los libros de un juego, los suplementos, las notas escaneadas con texto) **se busquen por dentro**: el
resultado dice el libro y la página, y al abrirlo **el visor va a esa página** con lo buscado marcado. Y que la
búsqueda entienda **por significado** («qué hace la guardia de la ciudad») además de por palabras, en la wiki, en el
compendio y en los PDF, con un modelo que corre en el VPS: gratis y sin sacar el texto fuera.

Para quién: el máster que prepara (y, con el módulo 5, los jugadores en lo que ven); la IA, que busca lo mismo.

## Requisitos

- **La biblioteca** son los PDF del mundo y los comunes de la cuenta (los archivos de hoy, ADR-0005): una vista que
  los lista como libros (portada de su primera página, título, páginas, si ya se puede buscar en él) y abre el visor.
- **El texto de cada página**, al subir un PDF (y para los ya subidos, una vez): pdf.js en el servidor, **en segundo
  plano** (BullMQ), con el avance a la vista. Un PDF sin texto (escaneado) lo dice: el OCR queda fuera.
- **Buscar dentro**: el texto de cada página entra en la búsqueda de Postgres (la misma configuración en español sin
  tildes de la wiki), con su libro y su página. En la búsqueda general (Ctrl+K y la página de búsqueda) salen los
  libros junto a las páginas de la wiki, con su fragmento; dentro de un libro, buscar en él.
- **Abrir en la página**: el visor de PDF abre en la página del resultado, con el texto buscado resaltado (la capa de
  texto de pdf.js, que hoy no tiene: hoy se lee con «Abrir aparte»).
- **Buscar por significado**, una búsqueda híbrida (palabras y significado, mezcladas por rango) en la wiki, el
  compendio de la campaña y los libros. Los trozos (unos 300 tokens, con su página o su sección) se calculan al
  guardar o al subir, en segundo plano; lo que cambia se recalcula.
- **El modelo**: `intfloat/multilingual-e5-small` (MIT, 384 dimensiones, español e inglés), cuantizado, con
  SentencePiece en wasm y `onnxruntime-node` (medido: 290 MB y 0,24 s por trozo). Va en un **proceso aparte** de la
  app (un hilo propio), que se carga al primer uso y se descarga tras un rato sin uso; si no está, la búsqueda sigue
  por palabras. Los archivos del modelo (118 MB) van en la imagen de Docker.
- **pgvector**: la columna de vectores y su índice HNSW, en una imagen propia de Postgres hecha sobre la
  `postgres:17-alpine` de hoy con pgvector compilado (licencia PostgreSQL), para no cambiar de base (la oficial va
  sobre Debian y cambiaría el orden del texto de los índices de staging). En desarrollo, la CI y staging.
- **La IA**: `buscar_paginas` busca también en los libros (con su página) y por significado; `leer_libro` lee el texto
  de unas páginas de un libro.
- **Permisos**: un libro lo busca y lo lee quien puede ver el archivo; nada de lo de un mundo sale en otro.

## Decisiones (propuestas, por confirmar al ver las pantallas)

1. **La app sube de 512 MB a 1 GB** de límite de memoria en staging, para el modelo.
2. **El índice por significado, para todo** (la wiki, el compendio y los libros) desde el principio; si pesa demasiado,
   se empieza por los libros.
3. **Sin modelos más grandes** de momento: si la calidad no basta con textos de prueba, se mide `multilingual-e5-base`
   (unos 280 MB más) antes de cambiar.

## Pruebas

- Servidor: sacar el texto por página de un PDF de prueba, buscarlo con tildes y sin ellas, el trozo y su página, los
  permisos entre mundos; la búsqueda híbrida con vectores de prueba (sin cargar el modelo); el proceso del modelo, con
  un modelo diminuto.
- Web: la biblioteca, el resultado de un libro, abrir en la página con lo buscado marcado.
- E2E: sube un PDF, busca una palabra de su página 3 y el visor abre en la 3.
- A mano (`tasks/probar.md`): un libro real, la calidad de buscar por significado y el ritmo en staging.

## Fuera

El OCR de los PDF escaneados, anotar o subrayar los PDF, los libros como contenido del compendio (eso es importar) y
los formatos que no son PDF (EPUB).
