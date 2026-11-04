# Plan: Módulo 2 — Tipos de página y plantillas

Spec: `docs/specs/plantillas.md` (aprobada) · ADR: 0003, 0006, 0008 y 0009 · Diseño: lienzo «Crisol: plantillas»
(aprobado; fuentes en `out/lienzo-plantillas/`) · Tareas con detalle: `tasks/plantillas/todo.md` · Fecha: 2026-11-03. Los planes
de los módulos 0 y 1 están en `tasks/fundacion/` y `tasks/wiki/`.

## Resumen

Se construye en cinco fases, que siguen el mapa de capacidades de la spec: campos, plantillas de serie y crear desde
ellas, tablas, plantillas de la cuenta, y aplicar y cerrar. Cada tarea es una porción vertical: datos, servicio, API,
interfaz, herramientas MCP y pruebas. Se comprueba en local y se junta con otras: la CI (cuota mensual) se pasa una vez por tanda grande, y entonces se fusiona y se despliega en staging.

Lo más arriesgado va pronto:
- la identidad de los campos y los tipos nuevos (tarea 1), porque todo lo demás se apoya en ellos;
- la consulta de las tablas con 5.000 páginas (tarea 7), con su prueba de ritmo antes de hacer la interfaz.

Las plantillas de serie llegan antes que las de la cuenta. Así el primer criterio de éxito (un PNJ que sale solo en
«Miembros») funciona en la fase 3, y las de la cuenta reutilizan todo lo hecho.

## Decisiones de construcción

- **Rutas de la web**: `/plantillas` y `/plantillas/:templateId`, fuera de los mundos, como `/etiquetas`. «Plantillas»
  va en la barra de Mis mundos, debajo de «Etiquetas».
- **Ids**:
  - de una plantilla: el legible de las de serie (`pnj`, `lugar`, `faccion`, `objeto`, `mision`, `sesion`) o el uuid
    de una propia;
  - de un campo: legible en las de serie (`faccion`) y corto y aleatorio en las propias, con la misma forma que el id
    de un bloque del panel.
- **Las propiedades** (`PageProperty`):
  - todas ganan un `field` opcional, el id del campo de la plantilla;
  - dos tipos nuevos: `choice` (valor y opciones) y `clock` (valor y segmentos, de 2 a 12);
  - el enlace a una sola página es `pages` con `single`, y `pages` gana `targets` opcional. Así la búsqueda (que no mira
    los enlaces) y las tablas tratan igual los dos, sin tocar la función de búsqueda de la base de datos.

  Lo que ya hay guardado sigue valiendo tal cual.
- **El Markdown** (frontmatter):
  - `choice` se escribe como texto, un enlace `single` como `"[[Título]]"` y `clock` como `"3/8"`;
  - la plantilla va en `plantilla: <nombre>`.

  Al leer con plantilla, cada propiedad que se llame como un campo toma su id y su forma. Se compara sin mayúsculas ni
  tildes, para que «Faccion» case con «Facción».
- **Un solo camino para crear**: `instantiateTemplate` en el servidor. Lo usan `createPage` (web), `createPages` (MCP)
  y crear desde un enlace sin resolver. Saca las propiedades con su valor inicial, el panel y el cuerpo desde el
  esqueleto en Markdown, por el mismo camino que el Markdown de la IA. Todo va en una sola operación.
- **Migraciones**:
  - 0035: `pages.template` y `pages.template_line`, con sus índices GIN (`template_line` y `properties` con
    `jsonb_path_ops`);
  - 0036: `page_templates`.
- **Las tablas**: el bloque `related` del panel guarda `template`, `field`, hasta tres `columns` y `sort`. Se calculan
  con `getPageTables(pageId)`, que la web pide junto a la página y `leer_pagina` incluye. Se refrescan con
  `changed pages`, así que una facción abierta ve llegar a su PNJ.
- **El editor del esqueleto**: el esquema de la wiki en TipTap, sin colaboración. Guarda Markdown con `cambiar_plantilla`
  y se convierte al crear la página.
- **Textos**: por i18n. Las plantillas de serie son contenido, no interfaz: van en español en `packages/domain`, con
  las opciones de Estado sin género (`docs/diseno.md`).

## Tareas

| # | Tarea | Fase | Depende de | Tamaño |
|---|---|---|---|---|
| 1 | Campos con id y tipos nuevos (riesgo) | Campos | — | L |
| 2 | Los controles de los campos en el panel | Campos | 1 | M |
| 3 | Plantillas de serie: los datos y verlas | Crear | 1 | M |
| 4 | Crear desde plantilla en el servidor y por el MCP | Crear | 3 | L |
| 5 | «Desde plantilla» en «Página nueva» | Crear | 4, 2 | M |
| 6 | Crear desde un enlace sin resolver, con plantilla | Crear | 5 | S |
| 7 | La consulta de las tablas (riesgo) | Tablas | 4 | L |
| 8 | «Tabla de páginas» en el panel | Tablas | 7 | M |
| 9 | Plantillas de la cuenta en el servidor | Cuenta | 4, 7 | L |
| 10 | La pantalla «Plantillas» | Cuenta | 9 | M |
| 11 | Editar una plantilla: campos y panel | Cuenta | 10, 8 | M |
| 12 | Editar una plantilla: el esqueleto del texto | Cuenta | 11 | M |
| 13 | Aplicar una plantilla a una página ya hecha | Cierre | 9, 5 | M |
| 14 | Cierre del módulo | Cierre | todas | M |

Los puntos de control con Enrique, en el servidor de desarrollo local (en staging, tras la tanda que se fusione):
- **1**, tras la 2: los campos nuevos en el panel de una página.
- **2**, tras la 6: crear un PNJ desde plantilla, a mano y desde claude.ai.
- **3**, tras la 8: el PNJ sale solo en «Miembros» de su facción. Es el primer criterio de éxito.
- **4**, tras la 12: «PNJ de Eana» copiada de PNJ, y «Frente» desde cero con su tabla.
- **Final**, tras la 14: los criterios de éxito de la spec.

## Riesgos

| Riesgo | Impacto | Qué se hace |
|---|---|---|
| La consulta de las tablas es lenta con 5.000 páginas (`jsonb` con enlaces sueltos y en lista) | Alto | Tarea 7 con su prueba de ritmo antes de la interfaz. Si no llega a 150 ms, una tabla auxiliar de enlaces de campos que se rehace al guardar las propiedades (la alternativa del ADR-0009), sin cambiar el contrato |
| Las propiedades viejas y las nuevas conviven mal: un `pages` sin `field`, nombres repetidos | Medio | Tarea 1: todo lo de antes sigue valiendo; pruebas de ida y vuelta del Markdown con los dos |
| La IA escribe los campos con otro nombre o sin tildes | Medio | Casar sin mayúsculas ni tildes, y devolver en el error los campos de la plantilla cuando una propiedad no encaja de tipo |
| El editor del esqueleto sin colaboración se desvía del de la wiki | Medio | Mismo esquema (`packages/editor`) y misma conversión a Markdown; la prueba de ida y vuelta lo cubre |
| El panel de 300 px se llena con campos, bloques y tablas | Bajo | Columnas de las tablas limitadas a tres; se mira en el punto de control 3 |
| Cuota mensual de la CI | Medio | Todo en verde en local; la CI una sola vez por tanda grande, nunca en cada PR |

## Preguntas abiertas

Ninguna. Las de la spec se decidieron al aprobarla, y el diseño está aprobado.
