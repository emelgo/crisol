# Plan: Módulo 5 — conocimiento

Estado: en marcha (2026-11-06). Spec: `docs/specs/conocimiento.md` · ADR-0017 · Mapa: `docs/specs/modulo-5.md` ·
Diseño: lienzo «Crisol: lo que ven los jugadores» (`out/lienzo-jugadores/`) · Tareas: `tasks/todo.md`. Los planes
anteriores, en `tasks/<capacidad>/`.

## Cómo

- **El motor** (`packages/domain/src/knowledge.ts`, puro): con el árbol del mundo (id y madre), las filas de
  `knowledge` del mundo y de la campaña, si la campaña parte del mundo y los personajes de quien lee, dice qué páginas
  ve (manda la primera marca subiendo; en la misma página, la campaña antes que el mundo; sin marca, nadie), y si ve un
  secreto, una pestaña, un pin, una región o una entrada del mundo. Para el máster, además, **por qué**: de dónde sale
  lo que ve cada campaña («Por «Aldoria»», «Lo sabe el mundo»).
- **La base de datos** (migración 0051): `knowledge` (mundo, campaña o nada, tipo, id, la marca y el público por
  personajes), con historial (`TRACKED_TABLES`); `campaigns.knows_world`. «Oculto» va como `hidden` en cada campo de
  `pages.properties` y en cada bloque de `pages.panel`.
- **Quién lee** (`apps/server/src/wiki/reader.ts`): el máster (lo ve todo), un jugador en una campaña (con sus
  personajes) o el máster viendo como un personaje. Lo calcula el servidor con la sesión y la campaña pedida; nunca se
  fía del cliente. La política `page.read` deja entrar a quien juega en el mundo; `page.write`, no cambia.
- **La proyección**: para cada petición, el árbol y las filas del mundo se cargan una vez y el motor responde. Cada vía
  de lectura la usa: lo que no ve da `NotFoundError`, igual que lo que no existe.
- **El cuerpo del jugador**, por la API: el JSON del cuerpo con el contenido de los secretos que ve dentro de su nodo y
  sin los que no ve ni las notas (`projectBody`, en `apps/server/src/wiki/content.ts`). La web lo pinta con el editor
  en lectura, sin Yjs. `/api/collab` niega a los jugadores todos los documentos.
- **Tiempo real**: los avisos de páginas a un jugador solo si ve la página que nombran; al cambiar una marca, un aviso
  `knowledge` a la campaña (o a todas las del mundo) para que cada uno recargue lo que tenga abierto.
- **Web del máster**: «Quién la conoce» en la cabecera de la página y en el botón derecho del árbol, con la marca en
  el árbol; «Oculto» en el menú de un campo y de un bloque del panel; «Al empezar, los jugadores saben…» al crear una
  campaña y su ajuste.
- **Web del jugador**: en la barra de su campaña, el mundo («Páginas de Valdren»): el árbol, la página en lectura, la
  búsqueda y la vista previa, con las rutas bajo la campaña (`/mundos/$worldId/campanas/$campaignId/paginas/$pageId`).
  «Ver como jugador» reutiliza esa vista con la franja.
- **IA**: `marcar_conocimiento` (tipo `players`), `quien_conoce`, `ver_como_jugador`; las de leer la wiki aceptan
  `campaignId` y, para un jugador, lo deducen si solo juega una campaña del mundo.

## Puntos de control

1. Tras la tarea 3: por la API, el máster marca «Aldoria» para la campaña A; un jugador de A lee el árbol y la página,
   uno de B recibe «no existe».
2. Tras la tarea 6: todas las vías de lectura y el tiempo real, filtrados (pruebas de integración por cada una).
3. Tras la tarea 10: en la web, el máster marca y el jugador lee; «Ver como jugador».
4. Al final: la prueba de fugas e2e, el rendimiento con 5.000 páginas y la revisión.

## Riesgos

- **Una vía de lectura sin filtro.** Mitigación: la lista de las acciones que hoy comprueban `page.read`,
  `worldContent.read` o `creatures.manage` (25 archivos de `apps/server/src`) se repasa entera en las tareas 4 a 6, y
  la prueba de fugas recorre cada una.
- **El rendimiento** de calcular en cada petición: se mide con 5.000 páginas en la tarea 12; si no llega, memoria por
  mundo y campaña.
- **El editor en lectura** sin Yjs: los nodos propios (secretos, statblocks, tiradas, incrustados) tienen que pintarse
  con su JSON; se prueba con una página con todos.
