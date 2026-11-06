# Plan: Módulo 4 — biblioteca

Estado: en marcha (2026-11-06). Spec: `docs/specs/biblioteca.md` · Diseño: lienzo «Crisol: compendio y criaturas»,
tablero Biblioteca (`out/lienzo-compendio/project/Biblioteca.dc.html`) · Tareas: `tasks/todo.md`. Los planes
anteriores, en `tasks/<capacidad>/`.

## Cómo

- **El texto de cada página** de un PDF lo saca el servidor con pdf.js (`pdfjs-dist`, Apache-2.0) en segundo plano: al
  subirlo y, para los ya subidos, al arrancar. En tablas fuera del historial (salen del archivo): `file_texts` (su
  estado: pendiente, leyendo con su avance, hecho, sin texto o fallido; y sus páginas) y `file_pages` (el texto de cada
  página con su vector de búsqueda en `es_unaccent`, como la wiki). La cola, en BullMQ; en las pruebas, en el proceso.
- **Buscar dentro**: `searchLibrary` (los libros del mundo y los comunes que ve quien busca, por libro, con sus mejores
  páginas y su fragmento) y `getBookPages` (el texto de unas páginas, para la IA).
- **Por significado**: pgvector en una imagen propia de Postgres (`docker/postgres/`: `postgres:17-alpine` con pgvector
  compilado; en la CI, `pgvector/pgvector`), `search_chunks` con trozos de unos 300 tokens (de los libros, por página;
  de la wiki, por sección) y su vector de 384, con índice HNSW. El modelo (`multilingual-e5-small` cuantizado, MIT)
  con `onnxruntime-node` y SentencePiece en wasm, en un hilo aparte que se carga al usarlo y se descarga tras un rato.
  La búsqueda mezcla palabras y significado por rango (RRF); sin modelo, solo palabras.
- **La imagen de la app pasa a Debian** (`node:24-bookworm-slim`): la librería de `onnxruntime-node` es para glibc y
  no carga en Alpine (probado, también con `gcompat`); en wasm, el doble de lento y el triple de memoria (medido).
  Postgres sigue en Alpine (no cambia el orden del texto de sus índices). Límite de la app, 1 GB (permiso de Enrique).
- **Web**: «Biblioteca» en la barra de la campaña (del máster, como la wiki, hasta el módulo 5): buscar en los libros,
  la lista de libros con su estado, y el visor en la página con lo buscado marcado.
- **IA**: `buscar_libros` y `leer_libro`.

## Puntos de control

1. Tras la tarea 2: subir un PDF de prueba por la API, ver su estado y buscar una palabra de su página 3.
2. Tras la 5: buscar «qué hace la guardia» y que salga lo que dice «vigilancia de la ciudad».
