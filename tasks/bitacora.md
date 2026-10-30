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

## Tarea en curso: 19, archivos en las páginas

Rama `wiki/tarea-19-archivos-en-paginas` (sobre main, tras la 18). En dos porciones, cada una con su PR:

**19a — imagen y archivo en el texto**

- Nodo `fileEmbed` en `packages/editor` (bloque, átomo): `fileId` (null si no se ha resuelto), `name`, `width`
  (número o null), `alt`, `caption` y `page` (para un PDF).
  - Markdown: `![[nombre.ext|texto alternativo|300]]`; cada parte tras `|` es el ancho si es un número y si no, el
    texto alternativo. `#page=12` para un PDF. El pie, en la línea siguiente en cursiva (`*El pie*`).
  - Es un archivo (y no una página) si el nombre acaba en una extensión de la lista (imágenes, pdf, documentos, audio,
    vídeo, comprimidos). `.md` no: en Obsidian es una nota.
- **Tabla `file_embeds`** (sin historial, como `page_links`): de qué página y documento sale, `file_id` (null sin
  resolver), el nombre y su clave. Se rehace con cada guardado. De ella salen:
  - el aviso al borrar un archivo: «Lo usan N páginas»;
  - resolver solos los que esperaban a ese nombre al subir, renombrar o restaurar un archivo (en el texto también,
    con `writeDocument`, como `resolvePending`).
- Lo que escribe Claude: `resolveIncoming` también pone el `fileId` por nombre.
- La web pinta el nombre de ahora (de `listFiles`, por `fileId`): renombrar no rompe nada. Sin archivo: «por subir».
- **Web**: vista de React del nodo. Imagen con su ancho (asas o un campo), pie editable, texto alternativo y caja de luz
  (un `dialog`). Otro archivo: una tarjeta con nombre, tamaño y «Abrir». Un PDF, de momento, tarjeta con «Abrir».
- Pegar o arrastrar una imagen en el editor la sube (`api.uploadFile`) y pone el bloque. Menú «/»: «Imagen» y
  «Archivo», que eligen de los del mundo o suben uno.
- Exportar: los archivos usados (o todos, si se exporta el mundo) en `_archivos/`.

**19b — visor de PDF y portada**

- `pdfjs-dist` (Apache-2.0; está en el plan), cargado con `import()` al abrir el visor; antes enseña el tamaño.
  Va a una página y abre `#page=12`. Pide los bytes con Range (el servidor ya lo da).
- La portada de la página, con su encuadre (columna en `pages`: migración 0017 o la que toque).

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
- **18** (rama `wiki/tarea-18-archivos`, migración 0015): archivos del mundo. Bytes en disco tras `Storage`
  (`DATA_DIR/archivos`, volumen «archivos» en staging); subir en crudo con XHR y progreso; el tipo por los primeros
  bytes (`sniff` en `@crisol/domain`); `GET /api/files/:id` con sesión, ETag, Range y CSP `sandbox` para SVG; papelera y
  purga (la fila a los 30 días; los bytes cuando ni el historial los nombra, y nunca los de menos de un día).
