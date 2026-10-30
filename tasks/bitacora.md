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

## Tarea 21, selector rápido, órdenes y buscar en la página (hecha, rama `wiki/tarea-21-selector`)

- **Ctrl+K** (o Cmd+K) desde cualquier pantalla de la wiki abre un `dialog` modal con un combobox (patrón ARIA:
  `aria-activedescendant` sobre un `listbox`). Vacío: los recientes (las pestañas abiertas, de la última a la primera).
  Al escribir, a los 250 ms, títulos y alias con `searchNames` (con erratas), hasta 8, y al final «Ver todos los
  resultados» (lleva a `/buscar?q=`). Escape lo cierra y el foco vuelve a donde estaba.
- **«>» al principio**: la paleta de órdenes (página nueva, buscar, archivos, etiquetas, historial, papelera), filtradas
  por lo escrito sin tildes.
- **Buscar en la página**: botón en las acciones de la página (y Ctrl+Alt+F, sin quitarle Ctrl+F al navegador). Una
  barra con el campo, «n de m», anterior y siguiente; las coincidencias se resaltan con decoraciones de ProseMirror
  (sin tildes ni mayúsculas) y la actual se elige y se lleva a la vista. Los secretos (otros editores) quedan fuera:
  apuntarlo.

**Cómo quedó la 21**: `quick-switcher.tsx` (montado en `WikiLayout`), `find-in-page.tsx` (extensión `FindInPage` y
`FindBar`, siempre a mano, también con candado). Escape se atiende en el campo (happy-dom no cierra el `dialog` solo).
El foco vuelve al botón «Buscar en la página» cuando ya está pintado.

## Tarea 22, bloques de hoja (hecha, rama `wiki/tarea-22-bloques-de-hoja`)

- `packages/editor/src/nodes/sheet.ts`: `pageBreak` y `columnBreak` (`<div class="salto-pagina"></div>`), `statblock`
  (`> [!statblock]`, con `|ancho`), `sidenote` (`> [!lateral]`, `> [!lateral|izquierda]`), `wideBlock` (`> [!ancho]`) y
  `tableOfContents` (`> [!indice]`, no guarda nada). `wide.ts`: el atributo «a lo ancho» del recuadro, la caja y el
  statblock (`|ancho`). `calloutTokenizer` pasa ahora las opciones de tras «|».
- Web `sheet-blocks.tsx`: los saltos, una raya con rótulo solo al editar; el statblock, un marco; la nota lateral con
  su lado y un botón para cambiarlo; «a lo ancho» con rótulo al editar; el índice, los títulos como enlaces. Grupo
  «Hoja» en el menú «/». Tras un salto o el índice va un párrafo (si no, Intro cambiaba el bloque recién puesto).
- La ayuda de Markdown de Claude (`MARKDOWN_HELP`) ya cuenta los archivos y los bloques de hoja.

## Tarea 23, vista de hoja (hecha, rama `wiki/tarea-23-vista-de-hoja`, migración 0021)

- **Ajustes** en `pages.sheet` (ya existe la columna): `{ paper: 'a4'|'letter', theme: 'pergamino'|'neutro', numbers,
  firstNumber, footer }`; null, sin hoja. `page` los devuelve y `updatePage` los cambia (frase «activó la hoja…»).
- **Quien lee**: `wiki_preferences.simple_pages` (uuid[]; migración) y la acción `setPageView`. En pantallas estrechas,
  la sencilla con «Ver la hoja».
- **Paginador** en `@crisol/domain` (`paginate.ts`), puro y probado con alturas simuladas: páginas de filas; una fila es
  a dos columnas (la primera se llena antes) o a lo ancho. Los saltos fuerzan; un título va con el bloque siguiente;
  ningún bloque se parte; antes de un bloque a lo ancho se equilibran las columnas (salvo salto de columna a mano); lo
  que no cabe ni en una página vacía va igual y la página lo avisa.
- **Web** `apps/web/src/wiki/sheet/`: la hoja pinta lo que da `getPageContent` (con los secretos y los incrustados ya
  proyectados; se pone al día con el aviso `pageContent`). Mide cada bloque en un medidor oculto con el ancho de la
  columna, pagina y pinta páginas de tamaño fijo (A4 794×1123 px, Letter 816×1056). Pie con número y título. Índice con
  número de página y puntos guía. Temas con variables `--sheet-…`: Pergamino (Alegreya, `@fontsource/alegreya`, OFL,
  del plan; textura propia con gradientes) y Neutro. `hyphens: auto` con `lang="es"`.
- **Escritorio ancho**: el editor y la hoja lado a lado; pulsar un bloque de la hoja lleva al del editor (por `data-id`)
  y el cursor del editor lleva la hoja a su bloque.

**Cómo quedó la 23**: `paginate` en `@crisol/domain` (7 pruebas, 4.000 bloques en < 200 ms). `pages.sheet` se valida
con `sheetSettings` al leer. `wiki_preferences.simple_pages` y `setPageView`. Web `wiki/sheet/{sheet,controls}.tsx`:
la hoja mide en un medidor oculto (cada bloque en `display: flow-root`, a su ancho) y solo vuelve a pintar si cambian
las medidas (un bucle de React, el #185, salió por un `?? []` nuevo en cada pintada). El botón «Hoja» va en las
acciones de la página; la fila de ajustes encima del texto; a partir de 1500 px, el editor y la hoja lado a lado
(pulsar un bloque de la hoja lleva el editor a él; el cursor del editor lleva la hoja, con `selectionchange`).

## Tarea 24, imprimir y PDF (hecha, rama `wiki/tarea-24-imprimir-y-pdf`)

- **Ruta de impresión** `/mundos/:worldId/imprimir/:pageId?secretos=1&imprimir=1`: `RootLayout` la pinta sin nada de la
  interfaz. Solo las páginas de la hoja, con `@page { size: A4|Letter; margin: 0 }`, `break-after: page` y sin sombras.
  Las notas ocultas nunca; los secretos, solo con `secretos=1`. Al acabar de paginar pone `data-sheet-ready` (para
  Chromium) y, con `imprimir=1`, abre el diálogo de imprimir.
- **En la fila de la hoja**: «Incluir secretos», «Imprimir» (abre la ruta en otra pestaña) y «Descargar PDF».
- **PDF en el servidor** (permiso de Enrique: Chromium en la imagen): `GET /api/pages/:id/pdf?secretos=1`, con
  `playwright-core` (Apache-2.0) y el Chromium del sistema (`CHROMIUM_PATH`; en la imagen, `apk add chromium`). Abre la
  ruta de impresión en `http://127.0.0.1:PORT` con la cookie de quien lo pide (`extraHTTPHeaders`), espera a
  `data-sheet-ready` y saca `page.pdf({ preferCSSPageSize: true, printBackground: true })`. De uno en uno (memoria de
  512 MB). El guardián de origen acepta también el origen interno (solo lo puede abrir el propio servidor). Sin
  Chromium o sin la web compilada: 503.

## Tarea 25, a la escala de Eana (hecha, rama `wiki/tarea-25-escala`)

- `apps/server/src/mcp/escala.integration.test.ts` (solo con `CRISOL_ESCALA=1`; `CRISOL_ESCALA_PAGINAS` para menos):
  2.400 páginas por `crear_paginas` de 50 en 50, con alias, etiquetas, secretos y enlaces cruzados (también hacia
  delante). Los ayudantes OAuth del MCP pasaron a `src/mcp/test-client.ts`.
- **Primera medida**: 15 s por llamada (búsqueda 188 ms y árbol 97 ms, bien). Lo que se arregló:
  - los ids de las páginas se dan de antemano: los enlaces de la tanda salen ya resueltos (antes se reescribía cada
    texto por Hocuspocus: 2,5 s);
  - `patchDocument`/`patchDocuments`: poner su página a un enlace que esperaba no pasa por Hocuspocus si nadie tiene el
    documento abierto, y se guardan todos de una vez (antes, hasta 5 s);
  - indexar (texto y secciones) y rehacer los enlaces de la tanda, en una sola transacción cada cosa;
  - la posición de cada rama se pregunta una vez, y las propiedades van ya en el INSERT.
- Con 300 páginas: 2,3 s por llamada. Con 2.400, aún 3,9 s: `resolveName` recorría todas las páginas por enlace. Ahora
  indexa cada lista una vez (`WeakMap` en `@crisol/domain`).
- **Final, 2.400 páginas**: mediana 2,2 s y máxima 2,4 s por llamada, ningún enlace sin resolver, búsqueda 149 ms y
  árbol 100 ms.

## Estado de los PR

- #61 (18), #62 (19a), #63 (19b), #64 (20), #65 (21), #66 (22), #67 (23) y #68 (24): fusionados y en staging. Staging
  tiene Chromium (probado: saca un PDF dentro del contenedor).

## Tarea 26, cierre (hecha, rama `wiki/tarea-26-cierre`)

Revisiones hechas con dos agentes (seguridad del servidor; interfaz con `web-design-guidelines`).

- **Interfaz, arreglado**:
  - el botón de la imagen se nombra con su texto alternativo;
  - la hoja lleva los colores del tema claro en su papel;
  - las imágenes de la hoja se cargan ya y se vuelve a medir al llegar (la hoja no está lista hasta entonces);
  - el visor de PDF no pierde el foco, avisa al cargar y al fallar, y usa `aria-disabled`;
  - los ajustes de la hoja cambian al momento y dicen si no se guardan;
  - la subida dice cuántos fallaron;
  - «Carta» en vez de «Letter».
- **Seguridad, arreglado**:
  - subida sin flujo → 415 sin abrir archivo;
  - Chromium con el entorno limpio y sin pedir nada fuera del propio origen;
  - cola del PDF con tope (2) y plazo total, y Chromium que se relanza si se cae;
  - límites por IP de Caddy (`x-forwarded-for`), no por la del proxy;
  - palabras de búsqueda de 3 a 64 letras;
  - indexar lo de antes sin romper la búsqueda si un documento falla.
- **Para Enrique** (son de infraestructura o de producto):
  - Chromium en un contenedor aparte, sin secretos y con sandbox (hoy va sin sandbox en el de la app, con el entorno
    limpio);
  - una cuota de almacenamiento por organización;
  - quizá más memoria para la app si se sacan PDF grandes.

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
