# Plan: Módulo 1 — Wiki

Spec: `docs/specs/wiki.md` (aprobada) · ADR: 0001, 0002, 0003 · Diseño: lienzo «Crisol: wiki» (aprobado) · Tareas con
detalle: `tasks/wiki/todo.md` · Fecha: 2026-10-29. El plan del módulo 0 está en `tasks/fundacion/`.

## Resumen

Se construye en nueve fases, que siguen el mapa de capacidades de la spec. Cada tarea es una porción vertical: datos,
servicio, API, interfaz, herramientas MCP y pruebas. Lleva su rama y su PR, se fusiona con la CI en verde y se
despliega en staging.

Lo más arriesgado va pronto:
- los documentos de Yjs dentro del servidor (tarea 6);
- el editor anidado de los secretos (tarea 8), con un punto de control propio;
- que Claude escriba en una página abierta (tarea 11).

Las herramientas MCP llegan con su capacidad. La última fase solo prueba a la escala de Eana y cierra.

## Decisiones de construcción

- **Rutas de la web**:
  - `/mundos/:worldId/wiki` y `/mundos/:worldId/wiki/:pageId`;
  - `/mundos/:worldId/wiki/:pageId/imprimir`, la ruta de impresión;
  - `/mundos/:worldId/buscar`, `/mundos/:worldId/archivos` y `/mundos/:worldId/etiquetas`.

  En la URL de una página va su id, más el título como adorno: si no coincide, se redirige al canónico.
- **El orden del árbol con claves fraccionarias** (cadenas que se ordenan entre dos vecinas). Mover una página solo
  escribe su fila, así que el historial no se llena de renumeraciones. La función está en `packages/domain`, con sus
  pruebas; no trae dependencia.
- **El árbol carga por ramas**: `listPageChildren` por padre y la ruta de antepasados de la abierta. Se pinta con
  `@tanstack/react-virtual`. Para arrastrar se usa lo nativo del navegador, con Alt + flechas como alternativa de
  teclado; sin librería.
- **Tablas**, según el ADR-0003:

  | Tabla | Para qué | Historial |
  |---|---|---|
  | `pages` | La fila de la página | con historial |
  | `page_bodies` | Una fila por página: en qué versión está su cuerpo | con historial |
  | `files` | Metadatos de los archivos | con historial |
  | `documents` | El estado de Yjs fusionado de cada documento | sin historial |
  | `page_versions` y `version_documents` | Las versiones | sin historial |
  | `snapshots` | El estado de cada documento por su huella, compartido entre versiones | sin historial |
  | `page_links` | La tabla de enlaces | sin historial |
  | `search_documents` | El índice de búsqueda | sin historial |
  | `wiki_preferences` | Pestañas, marcadores y vista elegida, por cuenta y mundo | sin historial |

  Las tablas sin historial cuelgan de la página o del mundo con borrado en cascada.
- **`dependentRow`** (`packages/db/src/repos/undo.ts`) pasa a mirar solo `TRACKED_TABLES`. Si no, un documento o un
  enlace impediría deshacer la creación de su página.
- **`packages/editor`**:
  - el esquema de TipTap: las extensiones y su Markdown, sin React;
  - lo usan la web y el servidor; las vistas de los nodos en React viven en `apps/web/src/wiki`;
  - dependency-cruiser comprueba que no importe React.
- **Colaboración**:
  - Hocuspocus en `apps/server/src/collab`, con una ruta de `@fastify/websocket` en `/api/collab` que reusa la
    comprobación de origen y de sesión del canal del módulo 0.
  - En la web, un `HocuspocusProviderWebsocket` por pestaña y un proveedor por documento abierto.
  - Los documentos se llaman `doc:<uuid>`.
- **Lo que cambia por el servidor**: Claude, restaurar y deshacer. Primero se calcula sobre una copia y se guarda en la
  transacción de la operación. Al confirmarse, el cambio se aplica al documento vivo por una conexión directa. Su
  origen se marca para que la sesión de edición no lo cuente dos veces.
- **Búsqueda**: una configuración de texto propia, `es_unaccent` (español con `unaccent`), creada en una migración, y
  `pg_trgm` en títulos y alias.
- **Archivos**:
  - la interfaz de almacenamiento `Storage`, con disco en el VPS (`DATA_DIR/archivos`);
  - subida en streaming con `@fastify/multipart` y progreso por XHR;
  - se sirven en `/api/files/:id`, con la sesión y la política, `Cache-Control: private` y una CSP `sandbox` para SVG.
- **La hoja**: el algoritmo de paginar es puro (`packages/domain`, recibe la altura de cada bloque) y la web mide con
  el DOM. La impresión es la misma vista con su CSS `@page`.
- **La prueba de fugas crece con cada canal nuevo**, no al final. Cada tarea que abre una vía (API, `/api/collab`,
  archivos, búsqueda, vista previa, MCP) añade su caso a `@fugas`.
- **Dependencias nuevas** (al aprobar el plan se aprueban también):

  | Paquete | Licencia |
  |---|---|
  | `@hocuspocus/server`, `@hocuspocus/provider` | MIT |
  | `yjs`, `y-protocols` | MIT |
  | De TipTap 3: `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`, `@tiptap/extension-unique-id`, `@tiptap/markdown` y las de tabla, índice, asa de arrastre y marcador de posición | MIT |
  | `@tanstack/react-virtual` | MIT |
  | `@fastify/multipart` | MIT |
  | `fflate`, para el .zip | MIT |
  | `pdfjs-dist` | Apache-2.0 |
  | `@fontsource/alegreya` | OFL-1.1 |

  De cada una, la última versión que cumpla la antigüedad mínima de pnpm, comprobando su licencia al añadirla. Si
  hiciera falta otra, se pregunta antes.

## Tareas

| # | Tarea | Fase | Depende de | Tamaño |
|---|---|---|---|---|
| 1 | Páginas y árbol en la API | Páginas | — | M |
| 2 | El árbol en la web | Páginas | 1 | M |
| 3 | Propiedades, alias, etiquetas e icono | Páginas | 2 | M |
| 4 | Papelera de páginas | Páginas | 2 | S |
| 5 | Pestañas, marcadores y navegación | Páginas | 2 | M |
| 6 | Documentos de Yjs en el servidor | Editor | 1 | L |
| 7 | El editor en la web | Editor | 6 | M |
| 8 | Secretos y notas ocultas (riesgo) | Editor | 7 | L |
| 9 | Todos los bloques y marcas | Editor | 8 | M |
| 10 | El Markdown, de ida y vuelta | Markdown | 9 | M |
| 11 | Claude lee y escribe páginas | Markdown | 10 | L |
| 12 | Exportar | Markdown | 10 | M |
| 13 | Enlaces por id, sin resolver y rotos | Enlaces | 10 | M |
| 14 | Entrantes, menciones y aviso al borrar | Enlaces | 13 | M |
| 15 | Vista previa e incrustados | Enlaces | 13 | M |
| 16 | Sesiones de edición en el historial | Versiones | 11 | L |
| 17 | Versiones de página | Versiones | 16 | M |
| 18 | Archivos del mundo | Archivos | 1 | M |
| 19 | Archivos en las páginas | Archivos | 18, 9 | M |
| 20 | Búsqueda en español | Búsqueda | 13 | M |
| 21 | Selector rápido, órdenes y buscar en la página | Búsqueda | 20 | M |
| 22 | Bloques de hoja | Hojas | 10 | M |
| 23 | Vista de hoja: paginar y temas | Hojas | 22, 19 | L |
| 24 | Imprimir y PDF | Hojas | 23 | M |
| 25 | A la escala de Eana | Cierre | 11, 20 | M |
| 26 | Cierre del módulo | Cierre | todas | M |

Los puntos de control con Enrique, en staging:
- **1**, tras la 5: el árbol y la fila de la página.
- **2**, tras la 8: el editor y los secretos. Es el punto del riesgo.
- **3**, tras la 11: Claude escribe en una página abierta.
- **4**, tras la 17: enlaces, versiones y deshacer.
- **5**, tras la 21: archivos y búsqueda.
- **6**, tras la 24: la hoja y el PDF.
- **Final**, tras la 26: los criterios de éxito de la spec.

## Riesgos

| Riesgo | Impacto | Qué se hace |
|---|---|---|
| El editor anidado de los secretos no va bien: el foco, el cursor o el deshacer | Alto | Va en la tarea 8, con su punto de control. Si falla, el secreto se edita en un panel o un diálogo propio, sin cambiar cómo se guarda (ADR-0003). Se decide con Enrique |
| Hocuspocus 4 detrás del WebSocket de Fastify | Medio | Tarea 6 lo primero, con pruebas de integración de dos clientes y una conexión directa |
| `@tiptap/markdown` pide un DOM en el servidor | Medio | Se comprueba al empezar la tarea 10. Si lo pide, `happy-dom` (MIT, ya está en las pruebas) solo para serializar |
| Deshacer el cuerpo con sesiones cruzadas | Medio | Pruebas de integración en la 16 con dos cuentas y Claude a la vez |
| Paginar una página grande (Eana tiene una de 518 KB) | Medio | El paginador es puro y por bloques, mide solo lo visible y se mide con esa página de tamaño |
| Archivos de 250 MB en el disco del VPS | Bajo | Subida en streaming y un aviso si queda poco disco. Se mira el espacio libre antes de la tarea 18 |
| La búsqueda con 5.000 páginas | Bajo | Una prueba de rendimiento con datos sintéticos en la 20 |

## Preguntas abiertas

Ninguna. Las de la spec se decidieron al aprobarla, y el diseño está aprobado.
