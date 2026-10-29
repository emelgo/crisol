# Tareas: Módulo 1 — Wiki

Plan: `tasks/plan.md` · Spec: `docs/specs/wiki.md` · ADR-0003. Cada tarea: rama corta → TDD → PR → merge con la CI en
verde → `scripts/desplegar-staging.sh` → «Dónde estamos» al día.

Comprobación local al acabar cada tarea: `pnpm lint && pnpm typecheck && pnpm test`, y `pnpm e2e` si toca la interfaz.
Cada vía nueva por la que salen datos amplía `@fugas` en la misma tarea.

## Fase 1: Páginas

- [x] **1. Páginas y árbol en la API** — hecha. `getPagePath` quedó dentro de `getPage` (con la ruta), y
  `listPageTree` es la acción de `ver_arbol`.
  - Acepta:
    - La tabla `pages` está en `TRACKED_TABLES` (mundo, padre, orden, título, icono, portada, propiedades, candado,
      hoja, `deleted_at`).
    - Acciones `createPage`, `updatePage` (título), `movePage`, `getPage`, `listPageChildren` y `getPagePath`.
      Mover nunca deja una página dentro de sí misma y el orden usa claves fraccionarias.
    - Solo leen y escriben el máster del mundo y el propietario. El canal avisa con `changed pages`.
    - MCP: `ver_arbol` y `mover_pagina`.
  - Comprueba:
    - dominio: claves de orden y ciclos;
    - integración: crear, mover y deshacer;
    - MCP: las dos herramientas en cada modo;
    - `@fugas`: un jugador no lista ni lee páginas.
  - Archivos: `packages/db/src/schema/pages.ts` (+ migración), `packages/domain/src/{tree,order}.ts`,
    `packages/contracts/src/pages.ts`, `apps/server/src/actions/pages.ts`, `apps/server/src/mcp/tools.ts`.

- [x] **2. El árbol en la web** — hecha. La flecha de desplegar va dentro de la fila (axe no admite botones entre
  las filas de un árbol).
  - Acepta:
    - `/mundos/:worldId/wiki/:pageId?` con el árbol a la izquierda. Carga por ramas, está virtualizado y sigue el
      patrón ARIA de árbol.
    - Crear una página o una subpágina, y el título en línea.
    - Recolocar arrastrando y con Alt + flechas.
    - En el móvil, el árbol va en un cajón. Se pone al día con `changed pages`.
  - Comprueba: pruebas de componentes (teclado y ARIA) y e2e (crear, renombrar, mover) con axe.
  - Archivos: `apps/web/src/wiki/{tree,page}.tsx` (+ módulos CSS), `apps/web/src/router.tsx`, `apps/web/src/i18n.ts`,
    `e2e/tests/wiki.spec.ts`.

- [x] **3. Propiedades, alias, etiquetas e icono** — hecha. Pulsar una etiqueta para buscar queda para la tarea 20.
  - Acepta:
    - Las propiedades son de tipo texto, número, sí/no, lista o enlace a página, y se ordenan a mano. `alias`,
      `etiquetas` (con jerarquía por «/») y `resumen` son reservadas.
    - El icono es un emoji.
    - El panel de etiquetas (`/mundos/:worldId/etiquetas`) dice cuántas páginas tiene cada una.
  - Comprueba: zod de cada tipo, integración (cambiar y deshacer propiedades) y e2e.
  - Archivos: `packages/contracts/src/pages.ts`, `packages/domain/src/properties.ts`,
    `apps/web/src/wiki/properties.tsx`, `apps/web/src/routes/tags.tsx`.

- [ ] **4. Papelera de páginas**
  - Acepta:
    - Borrar manda a la papelera la página y sus subpáginas en una sola operación, y deshacer las devuelve.
    - Las páginas salen en la papelera del mundo y se restauran desde ahí.
    - La purga de 30 días las incluye.
    - MCP: `borrar_pagina`, de tipo `delete`.
  - Comprueba: integración (borrar una rama, restaurar, purgar con el reloj simulado) y e2e.
  - Archivos: `apps/server/src/actions/{pages,trash}.ts`, `apps/server/src/jobs/purges.ts`,
    `apps/web/src/routes/trash.tsx`.

- [ ] **5. Pestañas, marcadores y navegación**
  - Acepta:
    - Pestañas que se pueden fijar, y marcadores con grupos. Se guardan en `wiki_preferences`, por cuenta y mundo, y
      no van al historial.
    - Migas de pan, y anterior y siguiente entre páginas hermanas.
    - En el móvil, la lista de recientes en lugar de pestañas.
  - Comprueba: integración de las preferencias, pruebas de componentes y e2e.
  - Archivos: `packages/db/src/schema/wiki-preferences.ts`, `apps/server/src/actions/preferences.ts`,
    `apps/web/src/wiki/{tabs,bookmarks,breadcrumbs}.tsx`.

### Punto de control 1

- [ ] CI en verde. En staging, Enrique crea un árbol, lo recoloca, le pone propiedades y lo manda a la papelera.

## Fase 2: Editor

- [ ] **6. Documentos de Yjs en el servidor**
  - Acepta:
    - Hocuspocus 4 en `/api/collab`: comprueba el origen y la sesión, y la política de cada documento. Sin permiso de
      escritura, abre en solo lectura; si la página está en la papelera, no abre.
    - La tabla `documents` guarda el estado. Guardar es fusionar con `Y.mergeUpdates`, con espera y un máximo.
    - Límites: 4 MB por estado y 1 MB por mensaje.
    - Las conexiones se cierran al perder el permiso. `dependentRow` mira solo `TRACKED_TABLES`.
  - Comprueba:
    - integración con dos `HocuspocusProvider` en Node y una conexión directa: convergen, y guardar en cualquier
      orden no pierde nada;
    - `@fugas`: un jugador no abre ningún documento.
  - Archivos: `packages/db/src/schema/documents.ts`, `apps/server/src/collab/{server,auth,persistence}.ts`,
    `packages/db/src/repos/undo.ts`, `e2e/tests/fugas.spec.ts`.

- [ ] **7. El editor en la web**
  - Acepta:
    - `packages/editor` con el esquema base: texto, títulos, listas, casillas, cita, código y separador.
    - El cuerpo de la página, editable con TipTap y Collaboration, con los cursores con nombre.
    - El candado pone el editor en lectura.
    - Sin conexión, sale «Sin conexión: se guardará al volver».
  - Comprueba: e2e con dos pestañas que convergen y con el aviso al cortar la red.
  - Archivos: `packages/editor/src/{schema,index}.ts`, `apps/web/src/wiki/{editor,collab}.tsx`,
    `.dependency-cruiser.cjs`.

- [ ] **8. Secretos y notas ocultas (riesgo)**
  - Acepta:
    - Cada secreto y cada nota oculta es su documento aparte (`documents` de tipo `secret` o `note`), con un editor
      anidado.
    - Se ven marcados. Se convierten en bloque normal y al revés. Copiarlos a otra página crea otro documento.
    - Ctrl+Z va por documento.
    - Una prueba garantiza que el estado guardado del cuerpo nunca lleva el texto de sus secretos.
  - Comprueba:
    - e2e de una página con dos secretos mientras una conexión directa escribe en ella, como hará Claude;
    - foco y teclado al entrar y salir del secreto.
  - Archivos: `packages/editor/src/nodes/secret.ts`, `apps/web/src/wiki/nodes/secret.tsx`,
    `apps/server/src/collab/documents.ts`, `apps/server/src/actions/secrets.ts`.

### Punto de control 2 (riesgo)

- [ ] Enrique prueba el editor y los secretos en staging. Si el editor anidado no va bien, se para y se decide con él
  el plan B del plan: editar el secreto en un panel propio.

- [ ] **9. Todos los bloques y marcas**
  - Acepta:
    - El menú «/» con filtro y todos los bloques de la spec, menos imagen, archivo e incrustado (llegan en las
      tareas 19 y 15).
    - Las marcas, los atajos de Markdown, la barra al seleccionar y el asa de arrastre con su menú.
    - Ids de bloque estables (`unique-id`).
    - Pegar HTML pasa por el esquema.
  - Comprueba: pruebas del esquema (pegar HTML sucio) y e2e del menú «/» con el teclado.
  - Archivos: `packages/editor/src/nodes/*.ts`, `apps/web/src/wiki/{slash-menu,bubble-menu,drag-handle}.tsx`.

## Fase 3: Markdown y Claude

- [ ] **10. El Markdown, de ida y vuelta**
  - Acepta:
    - Cada nodo y marca declara su forma en Markdown (la tabla de la spec), con `@tiptap/markdown` en el servidor.
    - Al leer, `> [!secreto]` y `%%…%%` devuelven el cuerpo y aparte los documentos de sus secretos.
    - Las propiedades van en YAML.
  - Comprueba: la prueba de ida y vuelta de cada nodo y marca. Un nodo sin su forma en Markdown hace fallar la prueba.
  - Archivos: `packages/editor/src/markdown/{serialize,parse,frontmatter}.ts` (+ pruebas).

- [ ] **11. Claude lee y escribe páginas**
  - Acepta:
    - MCP: `leer_pagina`, `crear_paginas` (hasta 50, anidables, en una operación) y `editar_pagina` (añadir, un
      bloque o una sección, todo el cuerpo, título y propiedades).
    - Si la página está abierta, el cambio entra en vivo por una conexión directa y se resalta.
    - Lo que espera aprobación guarda su huella de partida. Si ya no se puede aplicar, queda `failed`.
  - Comprueba:
    - MCP: cada herramienta en cada modo;
    - e2e: Claude edita una sección de una página abierta y se ve sin recargar;
    - `@fugas` del MCP.
  - Archivos: `apps/server/src/wiki/{write,apply}.ts`, `apps/server/src/mcp/tools.ts`,
    `packages/contracts/src/pages.ts`, `e2e/tests/claude-wiki.spec.ts`.

### Punto de control 3

- [ ] Desde claude.ai, Claude crea varias páginas con secretos y edita una que Enrique tiene abierta.

- [ ] **12. Exportar**
  - Acepta:
    - Exportar una página, una rama o el mundo entero en .zip (`Página/Página.md`), con `fflate`.
    - Los enlaces salen con el título del momento, con la ruta si dos se llaman igual.
    - Pasa por la proyección.
  - Comprueba: integración (exportar un mundo de prueba y volver a leerlo da lo mismo) y e2e de la descarga.
  - Archivos: `apps/server/src/wiki/export.ts`, `packages/contracts/src/pages.ts`, `apps/web/src/wiki/export.tsx`.

## Fase 4: Enlaces

- [ ] **13. Enlaces por id, sin resolver y rotos**
  - Acepta:
    - `[[` sugiere por título y alias, con erratas, y ofrece «Crear página «X»».
    - Los enlaces van a una página, una sección o un bloque, por id.
    - Lo que no existe queda sin resolver y se resuelve solo al crear, renombrar o poner un alias. Lo que está en la
      papelera se ve roto.
    - `page_links` se rehace al guardar, con el documento de origen.
  - Comprueba: dominio (resolución con repetidos y alias), integración (orden cualquiera) y e2e.
  - Archivos: `packages/editor/src/nodes/link.ts`, `packages/domain/src/links.ts`, `apps/server/src/wiki/links.ts`,
    `apps/web/src/wiki/link-suggest.tsx`.

- [ ] **14. Entrantes, menciones y aviso al borrar**
  - Acepta:
    - Un panel con los entrantes (con su fragmento) y las menciones sin enlazar, con «Enlazar» de un clic.
    - Borrar avisa: «La enlazan N páginas».
    - MCP: `enlaces_pagina`, con los enlaces sin resolver del mundo.
  - Comprueba: integración, MCP y e2e.
  - Archivos: `apps/server/src/actions/links.ts`, `apps/web/src/wiki/backlinks.tsx`, `apps/server/src/mcp/tools.ts`.

- [ ] **15. Vista previa e incrustados**
  - Acepta:
    - La vista previa sale a los 300 ms o con el foco, anclada, y se puede entrar en ella. Escape la cierra. En el
      móvil, en una hoja inferior. Si el enlace va a una sección, enseña esa sección.
    - Los incrustados van en solo lectura, hasta 3 niveles, con aviso de ciclo.
    - Las dos salen de la API, que proyecta, con caché hasta el aviso del canal.
  - Comprueba: pruebas de componentes (teclado y Escape), e2e en escritorio y en el móvil, y `@fugas` de la vista
    previa.
  - Archivos: `apps/server/src/actions/preview.ts`, `apps/web/src/wiki/{preview,embed}.tsx`,
    `packages/editor/src/nodes/embed.ts`.

## Fase 5: Versiones

- [ ] **16. Sesiones de edición en el historial**
  - Acepta:
    - La sesión se abre con el primer cambio y se cierra por inactividad, a los 15 minutos, al cerrar la última
      pestaña o antes de una operación del servidor.
    - Al cerrarse, una operación `editPage` sobre `page_bodies` y una versión (`page_versions`, `version_documents`,
      `snapshots`).
    - Deshacer aplica la versión anterior hacia delante y detecta los conflictos.
    - Si el servidor se paró con una sesión abierta, al cargar se cierra a nombre del último que escribió.
  - Comprueba: integración con dos cuentas y Claude a la vez, deshacer con un editor abierto sin que vuelva lo viejo, y
    la recuperación tras parar el servidor.
  - Archivos: `packages/db/src/schema/versions.ts`, `apps/server/src/collab/sessions.ts`,
    `packages/domain/src/undo.ts`, `packages/db/src/repos/undo.ts`, `apps/web/src/summaries.ts`.

- [ ] **17. Versiones de página**
  - Acepta:
    - Un panel con la lista (quién, persona o Claude, y cuándo), «Ver» en solo lectura y «Restaurar», que también se
      deshace.
    - Se guardan 90 días, más las 40 últimas de cada página siempre.
    - MCP: `versiones_pagina` y `restaurar_version`.
  - Comprueba: integración (restaurar y purgar con el reloj simulado), MCP y e2e.
  - Archivos: `apps/server/src/actions/versions.ts`, `apps/server/src/jobs/purges.ts`,
    `apps/web/src/wiki/versions.tsx`.

### Punto de control 4

- [ ] Enrique enlaza, ve la vista previa, restaura una versión y deshace lo que hizo Claude.

## Fase 6: Archivos

- [ ] **18. Archivos del mundo**
  - Acepta:
    - Subir un archivo, varios o una carpeta, de hasta 250 MB, en streaming. `files` está en `TRACKED_TABLES` y el
      disco va tras `Storage`.
    - Se sirven en `/api/files/:id` con permiso, con caché privada y CSP `sandbox` para SVG.
    - La pantalla `/mundos/:worldId/archivos` los ordena en carpetas por tipo, y deja renombrar, reemplazar y mandar a
      la papelera.
    - MCP: `listar_archivos`.
  - Comprueba: integración (límite, permiso y papelera), `@fugas` de los archivos y e2e de la subida.
  - Archivos: `packages/db/src/schema/files.ts`, `apps/server/src/files/{storage,routes}.ts`,
    `apps/server/src/actions/files.ts`, `apps/web/src/routes/files.tsx`.

- [ ] **19. Archivos en las páginas**
  - Acepta:
    - El bloque de imagen, con pie, ancho, texto alternativo y caja de luz. Pegar o arrastrar una imagen la sube.
    - La portada, con su encuadre.
    - El bloque de archivo, con el visor de PDF (`pdfjs-dist`, cargado al hacer falta, con `#page`).
    - Exportar lleva los archivos en `_archivos/`.
  - Comprueba: e2e (pegar una imagen, abrir un PDF por la página 3) y la ida y vuelta de `![[…]]`.
  - Archivos: `packages/editor/src/nodes/{image,file}.ts`, `apps/web/src/wiki/nodes/{image,file,pdf-viewer}.tsx`,
    `apps/server/src/wiki/export.ts`.

## Fase 7: Búsqueda

- [ ] **20. Búsqueda en español**
  - Acepta:
    - `search_documents` por documento, con `es_unaccent` y trigramas.
    - Agrupa por página, con secciones y extracto. Filtra por etiqueta y rama, va paginada y marca lo que sale de un
      secreto.
    - La pantalla `/mundos/:worldId/buscar`.
    - MCP: `buscar_paginas`.
  - Comprueba:
    - integración: «dragon» y «dargón» encuentran «Dragón»;
    - rendimiento: el 95 % de las búsquedas, por debajo de 300 ms con 5.000 páginas sintéticas;
    - `@fugas` de la búsqueda.
  - Archivos: `packages/db/src/schema/search.ts` (+ migración de `es_unaccent`), `apps/server/src/wiki/search.ts`,
    `apps/server/src/actions/search.ts`, `apps/web/src/routes/search.tsx`.

- [ ] **21. Selector rápido, órdenes y buscar en la página**
  - Acepta:
    - Ctrl+K abre el selector: títulos y alias a los 250 ms, primero los recientes, y «Ver todos».
    - «>» al principio pasa a la paleta de órdenes.
    - Buscar en la página abierta resalta lo encontrado en el texto.
  - Comprueba: pruebas de componentes (teclado y foco del diálogo) y e2e.
  - Archivos: `apps/web/src/wiki/{quick-switcher,commands,find-in-page}.tsx`.

### Punto de control 5

- [ ] Enrique sube archivos, los usa en páginas, abre un PDF y busca en español.

## Fase 8: Hojas

- [ ] **22. Bloques de hoja**
  - Acepta:
    - Salto de página, salto de columna, statblock, nota lateral, el atributo «a lo ancho» e índice de contenidos,
      cada uno con su forma en la vista sencilla y en Markdown (tabla de la spec).
    - Un grupo «Hoja» en el menú «/».
  - Comprueba: la ida y vuelta de cada uno y pruebas de componentes.
  - Archivos: `packages/editor/src/nodes/sheet/*.ts`, `apps/web/src/wiki/nodes/sheet/*.tsx`.

- [ ] **23. Vista de hoja: paginar y temas**
  - Acepta:
    - «Ver como hoja» y sus ajustes en la fila: papel, tema, numeración y pie.
    - Quien lee puede volver a la sencilla; se recuerda en `wiki_preferences`. En pantallas estrechas abre la sencilla.
    - Paginación automática por bloques: no parte bloques, no deja títulos sueltos, guiona en español y avisa si un
      bloque no cabe.
    - Temas Pergamino y Neutro con variables `--sheet-…` y `@fontsource/alegreya`. En escritorio ancho, la hoja al
      lado del editor, sincronizada por bloque.
  - Comprueba: dominio (el paginador con alturas simuladas y la página de 518 KB) y e2e de cambiar de vista y de tema.
  - Archivos: `packages/domain/src/paginate.ts`, `apps/web/src/wiki/sheet/{sheet,paginate,themes}.tsx`,
    `apps/web/src/wiki/sheet/sheet.module.css`.

- [ ] **24. Imprimir y PDF**
  - Acepta:
    - La ruta de impresión con `@page` del papel elegido.
    - En el papel no sale nada de la interfaz ni ningún bloque partido.
    - Los secretos solo salen si se marca «Incluir secretos», y las notas ocultas nunca.
  - Comprueba: e2e con `page.pdf()` sobre la ruta de impresión (número de páginas y que no haya interfaz) y una prueba
    a mano en Chrome, Firefox y Safari.
  - Archivos: `apps/web/src/routes/print.tsx`, `apps/web/src/wiki/sheet/print.module.css`, `e2e/tests/hoja.spec.ts`.

### Punto de control 6

- [ ] Enrique saca el PDF de una hoja con un statblock, una nota lateral y una tabla.

## Fase 9: Cierre

- [ ] **25. A la escala de Eana**
  - Acepta:
    - Un mundo sintético del tamaño de Eana (2.400 páginas con enlaces cruzados, secretos y alias), creado solo por el
      MCP con `crear_paginas`.
    - Cada llamada de 50 páginas tarda menos de 3 s, y todos los enlaces quedan resueltos.
    - Se repasan las descripciones de las herramientas pensando en la migración.
  - Comprueba: una prueba de rendimiento fuera de la CI normal, con sus números en el PR, y la búsqueda y el árbol en
    ese mundo.
  - Archivos: `apps/server/src/mcp/escala.integration.test.ts`, `apps/server/src/mcp/tools.ts`.

- [ ] **26. Cierre del módulo**
  - Acepta:
    - Revisiones de seguridad, servidor y web (esta con `web-design-guidelines`), con lo alto arreglado.
    - `@fugas` completa para la wiki.
    - Una página mediana se abre lista para escribir en menos de 1 s en staging.
    - `docs/modulos.md` y la tabla de módulos, al día.
  - Comprueba: los 8 criterios de éxito de la spec, uno a uno, con Enrique en staging.
  - Archivos: los que salgan de las revisiones y `docs/modulos.md`.

### Punto de control final

- [ ] Los criterios de éxito de `docs/specs/wiki.md`, en staging y con Enrique.
