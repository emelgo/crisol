# Bitácora del módulo 1

Notas de trabajo para no perder el hilo entre compactaciones: decisiones pequeñas, por dónde va la tarea en curso y lo
que queda pendiente de Enrique. Lo que ya está hecho va a `docs/modulos.md` § «Dónde estamos» y a `tasks/todo.md`.

## Encargo

2026-10-30: Enrique se fue a dormir y pidió terminar el módulo sin parar, apuntándolo todo.

- **Ciclo de cada tarea**: rama, TDD, PR, 4 checks en verde, merge, despliegue y comprobación de staging.
- **Puntos de control 3 a 6**: no se espera; se apuntan aquí como pendientes de Enrique.
- **Lo que pide permiso** no se hace: se aparta aquí y se sigue con lo demás.
- **Al acabar el módulo**: apuntar por dónde vamos y dedicarse a la interfaz, que Enrique ve «horrible».

## Lecciones

- **Nunca dos comprobaciones completas a la vez**: las e2e comparten la base de datos y se pisan (salen fallos
  falsos). Antes de lanzar otra, que acabe la anterior.
- **El despliegue sale de `origin/main`** en una copia aparte (`scripts/desplegar-staging.sh`): se puede desplegar con
  trabajo a medias en la carpeta.

## Permisos de Enrique (2026-10-30, antes de irse)

- **Dependencias**: cualquier extensión oficial de TipTap 3.32 con licencia MIT, y `@floating-ui/dom`. Se apuntan en el
  PR de cada tarea. Si hiciera falta otra dependencia fuera de TipTap, se programa a mano o se deja apuntada aquí.
- **Volumen**: «archivos» en `compose.prod.yaml`, montado en la app (tarea 18).
- **Chromium**: dentro de la imagen de la app, para «Descargar PDF» desde el servidor (tarea 24). Cambia la decisión 2
  de la spec («imprimir ahora»): hay que actualizar la spec y la tarea 24. Para manejarlo desde el servidor,
  `playwright-core` (Apache-2.0) o lo que use menos.

## Pendiente de Enrique

Hay que contárselo al final, con lo que tenga que probar o revisar:

- Los puntos de control 3 (Markdown y Claude), 4 (versiones), 5 (búsqueda), 6 (hojas) y el final.
- **Para el punto de control 3**, Enrique tiene que añadir en claude.ai un conector MCP a staging
  (`https://neo.crisol.144-91-122-245.sslip.io/mcp`), con su cuenta de propietario. Después prueba crear_paginas con
  secretos y editar_pagina sobre una página que tenga abierta.

## Tarea 19, archivos en las páginas (19a: PR #62; 19b: PR #63; las dos en staging)

Rama `wiki/tarea-19-archivos-en-paginas` (sobre main, tras la 18). En dos porciones, cada una con su PR:

**19a — imagen y archivo en el texto** (hecha, rama `wiki/tarea-19-archivos-en-paginas`, migración 0016)

- Nodo `fileEmbed` (`packages/editor/src/nodes/file-embed.ts`): `fileId`, `name`, `width`, `page`, `alt` y `caption`.
  Markdown `![[mapa.png|alt|300]]`, `#page=12` y el pie en la línea siguiente en cursiva. Es archivo por la extensión
  (`isFileName`); `pageEmbed` deja pasar esos nombres.
- `file_embeds` (sin historial) y `apps/server/src/wiki/file-embeds.ts`: se rehace con cada guardado (en
  `linksOfStored` y `linksOfNewPages`), y al subir, renombrar o restaurar se resuelve lo que esperaba ese nombre
  (`resolvePendingFiles`). `resolveIncoming` pone el `fileId` a lo que escribe Claude. `readPage` y exportar escriben el
  nombre de ahora (`fileName` en `pageToMarkdown`).
- `listFiles` lleva `usedBy` (páginas fuera de la papelera): el aviso al borrar «Lo usan N páginas».
- Los nombres de archivo no llevan `[ ] | # ^` (rompen `![[…]]`): al subir se cambian por «-».
- Web: `file-embed.tsx` (vista, `FileDrop` para pegar y soltar), «Imagen o archivo» en «/», `![[` propone archivos,
  «Subirlo» en un archivo que aún no está. El contexto de enlaces pasó a `links-context.ts` (había un ciclo).
- Un PDF, de momento, es una tarjeta con «Abrir» (`#page` lo entiende el visor del navegador).

**19b — visor de PDF, portada y `_archivos/`** (hecha, rama `wiki/tarea-19b-pdf-y-portada`, migración 0017)

- `pdfjs-dist` 6.4.299 (Apache-2.0) en el catálogo; `@napi-rs/canvas` (su opcional, solo para Node) va en
  `ignoredOptionalDependencies`. `apps/web/src/wiki/pdf-viewer.tsx`: enseña nombre y tamaño; pdf.js y su worker se
  piden con `import()` al pulsar «Ver aquí» (trozo aparte de 430 kB); `disableAutoFetch` y Range. Anterior, página N
  de M y siguiente; abre por `#page`.
- **Portada**: `pages.cover` (jsonb `{ fileId, x, y }`), en `updatePage` (`BAD_COVER` si no es una imagen del mundo).
  Cuenta como uso del archivo (`fileUses` y `filesUsedBy` miran también las portadas). Web `cover.tsx`: la franja de
  cabecera con `object-position`, y «Portada» con elegir de las del mundo, subir una, encuadre con dos deslizadores
  (se guarda al soltar) y quitar. La vista previa la enseña pequeña.
- **Exportar** va a trozos (`zipStream` con `Zip`, `ZipDeflate` y `ZipPassThrough` de fflate, esperando a `drain`):
  `_archivos/` con todos los del mundo, o los que usan las páginas exportadas.
- Dos e2e intermitentes en la CI del PR #62 (propiedades y vista previa con el teclado), arreglados en ese PR: esperar
  a guardar antes de recargar, y volver a elegir el enlace si se pierde la selección.

## Tarea 20, búsqueda en español (hecha, rama `wiki/tarea-20-busqueda`, migraciones 0018 a 0020)

- **Migración a mano** (no la saca drizzle): extensiones `unaccent`, `pg_trgm` y `fuzzystrmatch` (las tres «trusted»:
  las crea el dueño de la base), la configuración `es_unaccent` (copia de `spanish` con `unaccent` delante del
  lexema) y `crisol_unaccent(text)` inmutable.
- **`search_sections`**: una fila por sección (lo de debajo de cada título de primer nivel) de cada documento, con su
  título, el id del título (para el ancla), el tipo de documento (cuerpo, secreto, nota) y `tsv` generado. Se rehace
  donde ya se rehace `documents.text` (`setText`, con las secciones). Al arrancar, lo que no tenga secciones se
  indexa (para lo que ya había).
- **Páginas**: título, alias y propiedades, con una función inmutable y un índice GIN por expresión en `pages`.
- **Erratas**: `search_words` (palabras sin tildes por mundo, que llenan triggers de `search_sections` y `pages`).
  Cada palabra buscada se amplía con las del mundo parecidas: trigramas (similitud > 0.2) y `levenshtein` ≤ 1 (≤ 2 desde
  6 letras). «dargón» → «dragon»: la transposición son 2.
- **Consulta**: tsquery de alternativas por palabra (la última, con prefijo), filtro por etiqueta y por rama (CTE
  recursiva), agrupado por página (la mejor puntuación más un plus si coincide el título), 20 por página, y en cada una
  sus secciones con `ts_headline` (marcas que la web pinta con `<mark>`). Lo de un secreto, marcado.
- **Web** `/mundos/:worldId/buscar?q&etiqueta&rama&pagina`; **MCP** `buscar_paginas`; prueba de rendimiento con 5.000
  páginas sintéticas (p95 < 300 ms).

**Cómo quedó la 20** (lo que cambió del diseño):

- El vector de cada página (título y propiedades, peso A) es una columna generada, `pages.search_tsv`, con su índice:
  calcularlo al buscar costaba 150 ms con 5.000 páginas. `operation()` deja fuera del historial las columnas
  generadas (Postgres no deja escribirlas al deshacer), mirándolas en `information_schema` una vez por tabla.
- Las palabras parecidas, todas en una consulta (`lateral`); las rutas de los 20 resultados, en otra (`pagePaths`).
- Con 5.000 páginas sintéticas y `analyze`: p95 192 ms y mediana 79 ms en local (la prueba exige < 300).
- Lo de antes de la búsqueda se indexa al buscar en su mundo (`indexMissing`), como hacía `fillMissingText`.
- Extracto con `**` (lo lee bien Claude y la web lo pinta con `<mark>`).

## Hechas en esta tirada

- **9** (PR #52): bloques, marcas, menú «/», barras, asa e ids. Decisiones apuntadas en `docs/modulos.md`.
  «Enlace a página» y proponer enlazar quedan para la 13.
- **10** (PR #53, en staging): el Markdown de ida y vuelta. Lleva también el arreglo de `collab.close()`, por un
  deadlock de la CI.
- **11** (PR #54): leer_pagina, crear_paginas y editar_pagina. El diseño está en `docs/modulos.md`. En la CI, la
  prueba de la barra de formato falló una vez (Alt+F10 antes de la selección nueva); arreglada en #54.
- **12** (PR #55, en staging): exportar en .zip.
- **13** (PR #56, en staging, con la migración 0012): enlaces, `page_links`, resolución sola y `[[`.
- **14** (PR #57, en staging, con la migración 0013): entrantes, menciones, «Enlazar», aviso al borrar y
  `enlaces_pagina`.
- **15** (PR #58): vista previa, incrustados y aviso `pageContent`. La e2e del teclado falló una vez en la CI; se
  arregló avanzando hasta que el enlace queda elegido.
- **16** (PR #59, en staging, migración 0014): sesiones de edición, versiones y deshacer hacia delante.
- **17** (PR #60, en staging): panel de versiones, restaurar, purga y MCP.
- **18** (PR #61, en staging, migración 0015): archivos del mundo. Bytes en disco tras `Storage`
  (`DATA_DIR/archivos`, volumen «archivos» en staging); subir en crudo con XHR y progreso; el tipo por los primeros
  bytes (`sniff` en `@crisol/domain`); `GET /api/files/:id` con sesión, ETag, Range y CSP `sandbox` para SVG; papelera y
  purga (la fila a los 30 días; los bytes cuando ni el historial los nombra, y nunca los de menos de un día).
