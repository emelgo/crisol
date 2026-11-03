# Tareas: Módulo 2 — Tipos de página y plantillas

Plan: `tasks/plan.md` · Spec: `docs/specs/plantillas.md` · ADR-0009. Cada tarea: TDD → comprobación local → commit en
la rama de la tanda (`modulo-2/campos`, PR #93) → «Dónde estamos» al día. La CI gasta cuota mensual (Enrique,
2026-11-03): se sube y se pasa una sola vez tras muchas tareas; entonces merge y `scripts/desplegar-staging.sh`. Los
puntos de control intermedios se prueban en el servidor de desarrollo local.

Comprobación local al acabar cada tarea:
`pnpm lint && pnpm typecheck && pnpm test`, y `pnpm e2e` si toca la interfaz. Cada vía nueva por la que salen datos
amplía `@fugas` en la misma tarea. Cobertura ≥ 80 % de lo cambiado (bloquea desde el 2026-11-12).

## Fase 1: Campos

- [x] **1. Campos con id y tipos nuevos (riesgo)** — hecha. Hasta la tarea 2, la web enseña las opciones y los relojes
  sin poder cambiarlos, y al guardar otra propiedad no pierden su campo ni su forma.
  - Acepta:
    - `PageProperty` admite `field` en todos los tipos, y dos tipos nuevos: `choice` (un valor que no esté en sus
      opciones se guarda y se marca) y `clock` (de 2 a 12 segmentos, sin pasar del máximo). El enlace a una sola
      página es `pages` con `single` (así la búsqueda y las tablas tratan igual los dos); `pages` admite `targets`.
    - El servidor comprueba, venga de la web o de la IA, que cada página enlazada existe y es del mismo mundo
      (`setPageProperties`, `editPage`, `createPages`).
    - El Markdown, de ida y vuelta: `choice` como texto, `page` como `"[[Título]]"` y `clock` como `"3/8"`. Lo
      guardado antes sigue saliendo igual.
    - MCP: `editar_pagina` escribe los tipos nuevos, y al reescribir las propiedades (también con el YAML de un
      cuerpo) cada una conserva el campo y la forma que tenía. `crear_paginas` los escribe con plantilla (tarea 4).
  - Comprueba:
    - dominio: cada tipo, con valores fuera de la lista y relojes fuera de rango;
    - `packages/editor`: ida y vuelta del frontmatter con los tipos de antes y los nuevos;
    - integración: enlazar una página de otro mundo se rechaza; cambiar y deshacer.
  - Archivos: `packages/domain/src/properties.ts`, `packages/contracts/src/pages.ts`,
    `packages/editor/src/markdown/frontmatter.ts`, `apps/server/src/actions/{pages,page-content}.ts`.

- [x] **2. Los controles de los campos en el panel** — hecha. El buscador que enseña primero las páginas de los
  `targets` va en la tarea 5 (hasta la 4 las páginas no saben su plantilla). La forma de una propiedad hecha a mano
  (opciones, segmentos) está siempre a la vista: si salía al editarla, el panel se movía bajo el ratón.
  - Acepta:
    - Opciones con su desplegable. Enlace y enlaces con un buscador que enseña primero las páginas de sus `targets`, y
      «Todas las páginas» para el resto. Reloj con sus segmentos, que se marcan pulsando.
    - Una página enlazada que está en la papelera sale tachada. Un valor que no vale se ve marcado, sin perderse.
    - Al añadir una propiedad a mano se puede elegir cualquiera de los tipos.
  - Comprueba: pruebas de componentes (teclado y ARIA de cada control) y e2e (poner Estado y Facción, recargar) con
    axe.
  - Archivos: `apps/web/src/wiki/properties.tsx` (+ CSS), `apps/web/src/wiki/field-controls.tsx` (nuevo),
    `apps/web/src/i18n.ts`, `e2e/tests/campos.spec.ts`.

### Punto de control 1

- [ ] En local, Enrique pone a una página un desplegable, un enlace a una página y un reloj desde el panel.

## Fase 2: Plantillas de serie y crear desde ellas

- [x] **3. Plantillas de serie: los datos y verlas** — hecha. El número admite estar vacío (Población, Número de
  sesión), para que un campo sin rellenar no diga «0». Los bloques «Miembros» y demás tablas entran en sus paneles con
  la tarea 7, cuando exista el bloque. La prueba del canal en tiempo real de la web falla a veces con todo a la vez
  (por carga, ya pasaba): sola pasa.
  - Acepta:
    - Las seis de la spec en `packages/domain/src/templates.ts`, con el mismo formato que tendrán las propias: campos
      (id, nombre, tipo, forma, valor inicial), bloques del panel y esqueleto en Markdown.
    - Reglas puras: el linaje de una plantilla y lo que sale de ella (`instantiate`: propiedades, panel y Markdown).
    - Acciones `listTemplates` y `getTemplate`. MCP: `listar_plantillas` y `ver_plantilla`.
  - Comprueba: dominio (cada plantilla de serie es válida contra el contrato de propiedades y del panel) y MCP en
    cada modo.
  - Archivos: `packages/domain/src/templates.ts`, `packages/contracts/src/templates.ts`,
    `apps/server/src/actions/templates.ts`, `apps/server/src/mcp/tools.ts`.

- [x] **4. Crear desde plantilla en el servidor y por el MCP** — hecha. `createPage` pasó a `page-content.ts`: con
  plantilla va por el mismo camino que `createPages` (con plantilla, la colocación es al final de su rama). El texto que
  explica qué campos tiene la plantilla lo recibe la IA por el MCP; la web, solo el código.
  - Acepta:
    - Migración 0035: `pages.template` y `pages.template_line`, con sus índices GIN (`template_line` y `properties`).
    - `instantiateTemplate` en el servidor, usado por `createPage` (con `template`) y `createPages` (con
      `plantilla`): campos con su valor inicial, panel y cuerpo desde el esqueleto. Es una sola operación y se
      deshace entera.
    - Con plantilla, cada propiedad del frontmatter que se llame como un campo (sin mayúsculas ni tildes) toma su id y
      su forma. Si no encaja de tipo, el error dice qué campos tiene la plantilla.
    - `leer_pagina` y `getPage` dicen la plantilla de la página. MCP: `crear_paginas` con `plantilla`.
  - Comprueba: integración (crear y deshacer, 50 páginas desde plantilla enlazadas entre sí en cualquier orden en
    menos de 3 s) y MCP.
  - Archivos: `packages/db/drizzle/0035_*.sql` y `packages/db/src/schema/pages.ts`, `packages/db/src/repos/pages.ts`,
    `apps/server/src/wiki/templates.ts` (nuevo), `apps/server/src/actions/{pages,page-content}.ts`.

- [x] **5. «Desde plantilla» en «Página nueva»** — hecha. También: el árbol pinta el icono de la plantilla, el resumen
  de cada página dice su plantilla, y los guardados de las propiedades van en fila sin que lo que llega de fuera pise lo
  de aquí mientras quede alguno (se perdía un valor al guardar dos cosas seguidas). El ritmo de 50 páginas desde
  plantilla va en la prueba de escala (1,5 s); con todo a la vez en el VPS, las pruebas de tiempo fallan a veces.
  - Acepta:
    - El recuadro «Desde plantilla» junto a Texto y Mapa abre la lista (tuyas primero y de serie, con buscador); Intro
      crea con la plantilla elegida, como en el lienzo.
    - En los campos de enlace, el buscador enseña primero las páginas de sus `targets`, con «Todas las páginas» para el
      resto (de la tarea 2).
    - La página nueva sale con sus campos en el panel y sus apartados en el texto.
    - Junto al título, la plantilla con su icono (sin enlace hasta la tarea 10).
  - Comprueba: pruebas de componentes y e2e (crear un PNJ desde plantilla y rellenar su Facción) con axe.
  - Archivos: `apps/web/src/wiki/new-page.tsx`, `apps/web/src/wiki/template-picker.tsx` (nuevo),
    `apps/web/src/wiki/wiki.tsx`, `apps/web/src/i18n.ts`, `e2e/tests/plantillas.spec.ts`.

- [x] **6. Crear desde un enlace sin resolver, con plantilla** — hecha. Pulsarlo ya no la crea al momento: abre un
  menú (con flechas) con «Texto» y las plantillas, tuyas primero.
  - Acepta: pulsar un enlace sin resolver (en el texto y en los enlaces sin resolver) ofrece «Texto» o una plantilla,
    y la página nace con ese título por el mismo camino del servidor.
  - Comprueba: e2e (escribir `[[El Viejo Gyles]]`, crearla como PNJ y que el enlace quede resuelto).
  - Archivos: `apps/web/src/wiki/page-links.tsx`, `apps/web/src/wiki/editor.tsx`,
    `apps/web/src/wiki/template-picker.tsx`.

### Punto de control 2

- [ ] Enrique crea un PNJ desde plantilla en local, y la IA crea varios desde claude.ai.

## Fase 3: Tablas

- [x] **7. La consulta de las tablas (riesgo)** — hecha. Con 5.000 páginas (100 facciones de 49 miembros), mediana 30 ms
  y p95 43 ms (prueba de escala, `CRISOL_ESCALA=1`): no hace falta el plan B. Las plantillas de serie ya traen sus
  tablas. `buscar_paginas` sin texto, con plantilla, da sus páginas por título. Al guardar el panel solo se comprueban
  las tablas nuevas o cambiadas (una ya guardada puede ser de una plantilla propia borrada).
  - Acepta:
    - El bloque `related` en el contrato del panel: `template`, `field`, hasta tres `columns` y `sort`.
      `setPagePanel` comprueba que la plantilla y el campo existen y que el campo es de enlace.
    - `getPageTables(pageId)`: las páginas del mundo, fuera de la papelera, cuyo linaje tiene la plantilla y cuyo campo
      (por su id) apunta a la página, con sus columnas y en su orden. Si la configuración ya no vale, lo dice.
    - `leer_pagina` incluye las tablas ya calculadas. `buscar_paginas` filtra por plantilla y por el valor de un campo.
    - Al purgar una página, se quita de los campos que la apuntan.
  - Comprueba: integración (miembros de serie, de copias, en la papelera y con el campo renombrado) y la prueba de
    ritmo: con 5.000 páginas, el 95 % de las tablas en menos de 150 ms.
  - Archivos: `packages/contracts/src/panel.ts`, `packages/db/src/repos/pages.ts`,
    `apps/server/src/wiki/tables.ts` (nuevo), `apps/server/src/actions/{pages,page-content,search}.ts`,
    `apps/server/src/jobs/purges.ts`.

- [x] **8. «Tabla de páginas» en el panel** — hecha. Sus opciones van con los seis puntos, como las de los demás
  bloques, más anchas; «Elegir otro» en una tabla que ya no vale las abre.
  - Acepta:
    - El bloque se pinta con sus columnas y sus enlaces, y se pone al día con `changed pages`.
    - «Tabla de páginas» en «Añadir bloque» (Listas). Sus opciones: el título, «Páginas de [plantilla] cuyo [campo]
      es esta página», las columnas y el orden, como en el lienzo.
    - Una tabla que ya no vale lo dice en vez de salir vacía. Una sin páginas dice una sola línea.
  - Comprueba: pruebas de componentes y e2e (un PNJ con facción sale en «Miembros»; configurar otra tabla) con axe.
  - Archivos: `apps/web/src/wiki/panel-blocks.tsx` (+ CSS), `apps/web/src/wiki/related-block.tsx` (nuevo),
    `apps/web/src/i18n.ts`, `e2e/tests/plantillas.spec.ts`.

### Punto de control 3

- [ ] En local, Enrique crea un PNJ, le pone su facción y lo ve en «Miembros» al abrir la facción.

## Fase 4: Plantillas de la cuenta

- [x] **9. Plantillas de la cuenta en el servidor** — hecha. Borrar una la aparta (`deleted_at`): `listTemplates` da
  las borradas aparte (`deleted`), para el nombre de las páginas que salieron de ellas. Un campo nuevo sin id recibe uno;
  los enlaces de una plantilla van vacíos. Las tablas de una plantilla pueden nombrarla a ella misma.
  - Acepta:
    - Migración 0036: `page_templates` de la organización (nombre, icono, `basedOn`, linaje, campos, panel y
      esqueleto), en `TRACKED_TABLES`.
    - Crear desde cero o copiando otra (conserva los ids de sus campos y de cuál viene), cambiar y borrar. Todo pasa
      por `operation()` y se deshace. Borrar no toca sus páginas, que dicen «Frente (borrada)», y sus tablas siguen.
    - Las gestiona quien administra la organización. Las usa quien puede crear páginas en sus mundos.
    - Las de la cuenta salen en `listTemplates` y se pueden usar para crear. MCP: `crear_plantilla`,
      `cambiar_plantilla` y `borrar_plantilla` (`delete`).
  - Comprueba: integración (copiar conserva ids y linaje; cambiar y borrar no tocan las páginas; permisos) y MCP en
    cada modo.
  - Archivos: `packages/db/drizzle/0036_*.sql` y `packages/db/src/schema/templates.ts`,
    `packages/db/src/repos/templates.ts`, `packages/contracts/src/templates.ts`,
    `apps/server/src/actions/templates.ts`, `apps/server/src/mcp/tools.ts`.

- [x] **10. La pantalla «Plantillas»** — hecha. `/plantillas/:id` enseña de momento sus campos (su editor, en la 11). La
  marca de una página hecha con una plantilla borrada dice «(borrada)» y no lleva a nada. En las pruebas de la web, el
  tutorial guiado hay que darlo por visto: si no, sale y se lleva el foco.
  - Acepta:
    - «Plantillas» en la barra de Mis mundos y en el menú de la llama del móvil. `/plantillas` con «Tuyas» y «De
      serie» en tarjetas (las de serie con candado y «Copiar»), la vista previa a la izquierda al pasar el ratón y
      «Plantilla nueva» (desde cero o copiando, nombre e icono).
    - El engranaje de cada tarjeta abre su ventana (nombre, icono, zona de peligro para borrar).
    - La plantilla junto al título de una página lleva a la suya.
    - Su tutorial guiado y su paso en el de Mis mundos.
  - Comprueba: pruebas de componentes y e2e (crear una desde cero y otra copiando PNJ) con axe.
  - Archivos: `apps/web/src/routes/templates.tsx` (+ CSS), `apps/web/src/router.tsx`,
    `apps/web/src/components/ribbon.tsx`, `apps/web/src/i18n.ts`, `e2e/tests/plantillas.spec.ts`.

- [x] **11. Editar una plantilla: campos y panel** — hecha. Los bloques del panel de una plantilla se titulan, se
  recolocan con Subir y Bajar y se quitan (sin pintar su contenido: no hay página); las tablas, con sus desplegables.
  La plantilla recién creada entra en la lista al momento (si no, su página volvía a la lista antes de que llegara).
  - Acepta:
    - `/plantillas/:templateId` con la forma de una página: el nombre y el icono arriba, y los campos en el panel.
      Cada campo se añade, se quita, se recoloca y cambia de nombre, tipo, opciones, `targets` o segmentos, como en
      el lienzo.
    - Los bloques del panel de la plantilla, con las mismas piezas que el de una página (también «Tabla de
      páginas»).
    - Las de serie se ven igual, sin poder cambiarlas, con «Copiar».
    - Todo se guarda solo («Guardado»).
  - Comprueba: pruebas de componentes y e2e (añadir un reloj de 8 a «Frente» y crear una página con él).
  - Archivos: `apps/web/src/templates/editor.tsx` (nuevo, + CSS), `apps/web/src/templates/fields.tsx` (nuevo),
    `apps/web/src/wiki/panel-blocks.tsx`, `apps/web/src/i18n.ts`.

- [ ] **12. Editar una plantilla: el esqueleto del texto**
  - Acepta: el texto de la plantilla se escribe con el editor de la wiki sin colaboración y se guarda como Markdown.
    Al crear una página, sale igual que se escribió.
  - Comprueba: ida y vuelta (escribir el esqueleto, crear la página y comparar) y e2e.
  - Archivos: `apps/web/src/templates/skeleton.tsx` (nuevo), `apps/web/src/templates/editor.tsx`,
    `packages/editor/src/markdown/page.ts`.

### Punto de control 4

- [ ] En local, Enrique copia PNJ como «PNJ de Eana» con el campo Frentes, y hace «Frente» desde cero con su reloj
  y la tabla «PNJ del frente».

## Fase 5: Aplicar y cerrar

- [ ] **13. Aplicar una plantilla a una página ya hecha**
  - Acepta:
    - «Aplicar plantilla…» en «⋯» de la página abre el cuadro del lienzo: la lista y lo que añade (campos, bloques y
      apartados, al final del texto), con lo que ya tiene marcado.
    - Aplicar añade lo que falte sin borrar nada (casa por id de campo y, si no, por nombre), cambia la plantilla que
      recuerda la página y su linaje, y es una sola operación.
    - MCP: `editar_pagina` con `plantilla`.
  - Comprueba: integración (aplicar sobre una página con propiedades a mano; deshacer) y e2e.
  - Archivos: `apps/server/src/wiki/templates.ts`, `apps/server/src/actions/page-content.ts`,
    `apps/web/src/wiki/apply-template.tsx` (nuevo), `apps/web/src/wiki/wiki.tsx`.

- [ ] **14. Cierre del módulo**
  - Acepta:
    - Exportar a Markdown lleva `plantilla:` y los tipos nuevos.
    - `@fugas`: un jugador no recibe plantillas ni tablas por ninguna vía.
    - Las instrucciones del MCP y la guía de las herramientas hablan de las plantillas.
    - Los criterios de éxito de la spec, probados en staging.
  - Comprueba: `pnpm e2e` entero, la prueba de MCP con 50 páginas desde plantilla y sus tablas, y la CI en verde.
  - Archivos: `apps/server/src/wiki/export.ts`, `e2e/tests/fugas.spec.ts`, `apps/server/src/mcp/tools.ts`,
    `docs/modulos.md`.

### Punto de control final

- [ ] Enrique repasa en staging los criterios de éxito de `docs/specs/plantillas.md`.
