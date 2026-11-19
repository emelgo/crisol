# Spec: la línea temporal (módulo 8 · mundo)

Capacidad `linea-temporal` del módulo 8 (`docs/specs/modulo-8.md`). Intención: `docs/intent/calendarios.md`. Estudio:
`research/calendarios-y-lineas-temporales.md` (§ Everlore, § Respuestas 3 y 4). ADR-0007, fase 3. Depende de
`calendarios` y `fechas`.

> **Cambia (Enrique, 2026-11-16, tras el lienzo):** no hay pestaña en las páginas. Esto pasa a ser **las cronologías**
> de la pantalla «Calendarios» (varias por mundo, con su calendario y su filtro), a pantalla entera como el mapa; los
> eventos sueltos son del mundo (no de una pestaña) y se pueden enlazar o convertir en página; las fechas de otros
> calendarios se convierten si tienen correspondencia. Ver `docs/specs/modulo-8.md` § Decisiones. Las vistas (lista,
> meses, calendario), la tarjeta, el cuadro del evento y lo que ve la jugadora siguen como abajo.

## Objetivo

La pestaña **«Línea temporal»** de una página (la «Pronto» de «Pestaña nueva»), con **las tres vistas de Everlore**:
**lista** (la línea vertical con las tarjetas), **meses** (rejilla por años, meses o días, con carriles) y
**calendario** (el mes día a día, con las lunas). Enseña **sus eventos** (fecha o rango, título, color o imagen y, si se
quiere, una página enlazada) y **las páginas con fecha de su alcance**, que salen solas. La forma, casi idéntica a la de
Everlore, dentro del esqueleto de la página de Crisol (`docs/diseno.md`, ADR-0028).

## Comportamiento

### La pestaña

- Se añade como «Mapa» o «Pizarra» (el «+» de las pestañas, y en «Página nueva»): tipo `timeline`, nombre por defecto
  «Línea temporal». Nace con **el calendario principal** del mundo; sin calendarios, la pestaña dice una línea con un
  enlace a «Calendarios» y no deja añadir eventos.
- **Sus ajustes** (el menú ▾ de la pestaña, «Ajustes de la línea»): el calendario (solo se puede cambiar si aún no
  tiene eventos), **qué páginas con fecha salen** («Esta página y sus subpáginas», por defecto; «Todo el mundo»;
  «Ninguna»), y filtros opcionales por plantilla y por etiqueta. Si hay fechas de otros calendarios en su alcance, una
  línea discreta dice cuántas quedan fuera.
- **Dónde va**: bajo la cabecera de la página y sus pestañas subrayadas, como el texto, el mapa y la pizarra. **La
  lista** se desplaza con el navegador, como el texto (la barra pequeña pegada sigue valiendo). **Meses y calendario
  caben en la ventana**, a sangre, como el mapa y la pizarra.
- **La píldora** (de Everlore, `timeline-tab-pane.tsx:2230-2290`, con el cristal de Crisol): abajo en el centro, «+»
  (evento nuevo) y las tres vistas (Lista · Meses · Calendario). En la vista de meses, el zoom (Años · Meses · Días)
  va abajo a la derecha, como el zoom del mapa. La vista elegida se recuerda por pestaña en el aparato.
- **Vacía**: una sola pieza discontinua «Añadir evento» en el centro (`docs/diseno.md`: pantallas vacías).

### Lista

- **Una sola línea vertical cronológica** (`timeline-tab-pane.tsx:1914-1995`). A la izquierda, la fecha corta («18 Sie
  1250»; con rango, «12 Sie – 3 Tri 1250») y debajo, pequeña, **la distancia al anterior** («3 años después», «2 siglos
  después», «12 días después»), calculada con los días del calendario. En medio, la raya y **un rombo del color del
  evento**. A la derecha, **la tarjeta**.
- **La tarjeta** (`timeline-tab-pane.tsx:963-1052`): franja de proporción fija 6:1 con el color o la imagen (con su
  encuadre), degradado oscuro abajo, título con icono, la fecha, dos líneas de descripción, la página enlazada como
  chip y el grupo como píldora arriba a la izquierda. Una página con fecha sale igual, con su portada como imagen, su
  icono, el nombre del campo si tiene más de una fecha y una marca pequeña de página; pulsarla abre la página.
- **Ordenar**: por el primer día que abarca (una fecha de solo año va al principio de su año), y a igualdad, por título.
  Las repeticiones anuales salen una vez, en su primera fecha, con el icono de repetición (en meses y calendario, en
  cada año).
- **Acciones del máster**: doble clic en un evento lo edita; su «⋯» trae editar, duplicar, color rápido, mover a grupo,
  **«Quién lo conoce»** (revelar, como un pin) y borrar. En una página con fecha, «⋯» trae «Cambiar la fecha» (abre el
  selector de `fechas`) y «Abrir la página».
- Muchas fechas: la lista se pinta por tramos (`content-visibility` o ventana virtual) para que 7.000 elementos se
  desplacen sin tirones.

### Meses

- Como el «Gantt» de Everlore (`timeline-tab-pane.tsx:1292-1390`): **carriles por grupo** (y «Sin grupo», fijo al
  final; las páginas con fecha, en su propio carril «Páginas») por **columnas de tiempo** del calendario: en
  **Años**, una columna por año con la banda de la era encima; en **Meses**, una por mes con el año encima (las
  festividades, más estrechas y con su color); en **Días**, una por día con el mes encima.
- Un evento de un día es un punto con su título; un rango, una barra de su color o su imagen que abarca sus columnas.
  Una fecha de solo mes o solo año abarca su mes o su año.
- **Infinita** en los dos sentidos (la ventana crece al desplazarse, `timeline-tab-pane.tsx:891-926`); se arrastra para
  moverse; abre sobre el último evento. **«Ir a…»** (una fecha o un evento) salta, para eventos separados por milenios.
- Los carriles se pliegan; con doble clic se renombra un grupo; se reordenan arrastrando su nombre; «+» junto a los
  carriles crea un grupo. Arrastrar una barra la mueve en el tiempo (el máster).

### Calendario

- El mes del último evento, con **tantas columnas como días tenga la semana** del calendario y la semana continua o
  reiniciada. Cabecera: «Siega del año 1250 RC», la era y la estación del mes; flechas de mes anterior y siguiente y «Ir
  a…».
- Cada día: su número; **las lunas** (el icono de luna nueva y de luna llena de cada luna, con su color; al pasar o al
  elegir el día, la fase de cada una); los eventos como fichas de su color (los de varios días, en todos sus días; «+N
  más» si no caben). Los días **fuera de la semana**, en una franja sobre la rejilla. Las fechas de solo mes, en una
  fila «Todo el mes» arriba.
- **Elegir un día** abre su detalle encima del mes (como `DetalleDia.tsx` del antiguo, sin clima ni «hoy»): la fecha
  larga con el día de la semana, la estación, la era, las lunas y sus eventos. El máster, con un día vacío elegido,
  «+» crea el evento en ese día; **arrastrar una ficha a otro día le cambia la fecha** (Everlore,
  `timeline-tab-pane.tsx:1054-1229`).
- Con el teclado: la rejilla se recorre con las flechas, Intro abre el día, Re Pág/Av Pág cambian de mes.

### El cuadro del evento

- Título (opcional si tiene página enlazada: sin él, el de la página), **fechas** con el selector de `fechas`
  (inicio, «Añadir fin», precisión, «Cada año»), **estilo** (color de la paleta del mundo o `#rrggbb`, o una imagen de
  los archivos del mundo con su encuadre), icono, descripción (hasta 1.000, con su cuenta), **página enlazada**
  (buscar una existente o crear una nueva con nombre y dónde, como `link-page-field.tsx` de Everlore), grupo y
  **«Oculto para los jugadores»**.
- Se guarda con «Crear evento» / «Guardar»; es una operación del historial.

### Lo que ve la jugadora

- La pestaña, si ve la página y la pestaña no está oculta (o se le reveló).
- Los eventos de la pestaña salvo los ocultos o los que su campaña no conoce (tipo `event` del conocimiento; sin fila,
  sigue a la pestaña). Uno enlazado a una página que no conoce sale sin enlace y, si no tiene título propio, no sale.
- Las páginas con fecha del alcance que ve, y solo las fechas que no son de un campo «Oculto».
- Las eras «Solo del máster» no salen ni en la banda de la vista de meses ni en el detalle del día.
- Solo lectura: sin «+», sin «⋯», sin arrastrar. **En el móvil**: la lista en una columna (la fecha encima de la
  tarjeta), el calendario compacto (un punto por día con eventos; tocar un día sube su hoja con el detalle) y la vista
  de meses solo desde 640 px.

## Datos

Tablas nuevas, todas con `world_id` y columnas de historial:

- **`timelines`** (una por pestaña): `tab_id` (único, en cascada), `calendar_id` (no nulo; borrar un calendario en uso
  se impide), `scope` (`subtree` | `world` | `none`), `templates` (plantillas, opcional), `tags` (nombres de etiqueta, opcional).
- **`timeline_groups`**: `timeline_id`, `name` (1–60), `color`, `position` (orden fraccionario). Hasta 30 por línea.
- **`timeline_events`**: `timeline_id`, `group_id` (`set null`), `title` (0–200), `start` (jsonb `worldDate`), `end`
  (jsonb, nulo), `yearly` (bool), `color` (paleta del mundo o `#rrggbb`), `image` (jsonb `{ fileId, x, y }`, nulo; el
  archivo, del mundo), `icon` (como el de las páginas), `description` (0–1.000), `page_id` (`set null`), `hidden`
  (bool). Hasta 2.000 por línea. Sus fechas, del calendario de su línea.
- `page_tabs.kind` admite `timeline` (y su `check`); `PAGE_TAB_KINDS` y `TAB_KINDS` (`ready: true`).
- `knowledge.kind` admite `event` (y su `check`); el motor de `packages/domain/src/knowledge.ts` trata los eventos como
  los pines (siguen a su pestaña salvo marca propia; `hidden` es la marca del mundo).
- `packages/db/src/repos/copy.ts`: copiar una pestaña de línea temporal copia su fila, sus grupos y sus eventos (con
  los grupos nuevos).
- Una migración (`0082_lineas_temporales.sql` o la siguiente libre), aplicada en local al crearla.

## Acciones (contratos, `packages/contracts/src/timelines.ts`)

| Acción | Tipo | Entrada | Salida |
|---|---|---|---|
| `getTimeline` | read | `tabId`, `from?`, `to?` (fechas), `text?`, `readAs` | ajustes, calendario, grupos, eventos (con su texto de fecha y su día absoluto), páginas con fecha (página, título, icono, portada, campo, fechas), cuántas fechas de otros calendarios quedan fuera |
| `updateTimeline` | write | `tabId`, `calendarId?`, `scope?`, `templates?`, `tags?`, `groups?` (la lista entera: con id, se cambia; sin id, se crea; la que falta, se quita y sus eventos pasan a «Sin grupo») | ajustes y grupos; error `TIMELINE_HAS_EVENTS` al cambiar de calendario |
| `createTimelineEvents` | write | `tabId`, `events` (1–100: título, `start`, `end?`, `yearly?`, color, imagen, icono, descripción, `pageId?` o `newPage?: { title, parentId? }`, `groupId?`, `hidden?`); las fechas, en objeto o en el texto de la IA | los eventos creados; error `BAD_DATE` con el índice |
| `updateTimelineEvent` | write | `eventId` y lo que cambie | el evento |
| `deleteTimelineEvent` | delete | `eventId` | — |

- Revelar un evento: las acciones de marcas que ya existen (`listMarks`, `changeMarks`, `reveal`) aceptan `event`.
- Tiempo real: `{ type: 'changed', what: 'timeline', worldId, tabId }`; a un jugador solo le llega si ve la pestaña, y
  sin títulos. Revelar un evento, el aviso `revealed` con `kind: 'event'`.

## IA (MCP)

| Herramienta | Acción | Qué dice su descripción (resumen) |
|---|---|---|
| `crear_pestana` (existe) | `createPageTab` | Con `kind: 'timeline'`, añade una línea temporal (con el calendario principal) |
| `ver_linea_temporal` | `getTimeline` | Los eventos y las páginas con fecha de una línea, en orden, con sus fechas en texto y en forma `1250-Siega-18`; con `desde`/`hasta` y `texto`, solo esos |
| `cambiar_linea_temporal` | `updateTimeline` | Su calendario, qué páginas con fecha salen y sus grupos |
| `crear_eventos` | `createTimelineEvents` | Hasta 100 de una vez (para pasar una cronología entera), con su página enlazada o una nueva; se deshace |
| `cambiar_evento` | `updateTimelineEvent` | Cambia un evento |
| `borrar_evento` | `deleteTimelineEvent` | Lo quita; se deshace |
| `cambiar_marcas` / `revelar` (existen) | — | Aceptan eventos, como los pines |

La IA de la jugadora usa las mismas lecturas y ve lo que ella ve.

## Pruebas

- **Unitarias** (`apps/web` y `packages/domain`): orden de la lista con fechas de distinta precisión y repeticiones;
  la distancia al anterior en la unidad natural con los días del calendario; columnas de la vista de meses en cada
  zoom (festividades incluidas); fichas de un rango en la rejilla del mes; días de luna nueva y llena; el filtro de lo
  que ve un jugador (eventos, páginas, campos ocultos, eras ocultas).
- **Integración** (servidor): crear la pestaña, eventos en lote (con página nueva), cambiar de calendario con eventos
  (`TIMELINE_HAS_EVENTS`), grupos (quitar uno deja sus eventos sin grupo), alcance subárbol/mundo/ninguno con plantilla
  y etiqueta, copiar la página, deshacer; **fugas**: evento oculto, sin revelar, enlazado a página desconocida, página
  que no ve, campo oculto y era oculta, por la API, el tiempo real y el MCP; rendimiento de `getTimeline` con 2.000
  eventos y 5.000 páginas (< 300 ms en local).
- **Web**: la pestaña vacía, la píldora, cada vista, el cuadro del evento, arrastrar en el calendario, «Quién lo
  conoce», la jugadora en el móvil (375 px).
- **E2E**: los criterios 2 y 3 del módulo; accesibilidad (axe) de las tres vistas, del cuadro y de la rejilla con el
  teclado.

## Límites

- Siempre: lo de los jugadores lo filtra el servidor; textos por i18n; el esqueleto de la página y el cristal de
  `docs/diseno.md`; revisión con impeccable (critique y audit) de la pestaña antes de cerrar.
- Preguntar antes: una dependencia para la lista virtual o para las vistas (se intenta sin ninguna).
- Nunca: el «hoy», el clima o los viajes; horas; importar cronologías de otras apps; componentes del kit de Makerkit.

## Criterios de éxito

1. Los criterios 2, 3 y 4 del módulo (`docs/specs/modulo-8.md`).
2. La IA pasa una cronología de 80 sucesos con `crear_eventos` en una llamada y `ver_linea_temporal` la devuelve en el
   mismo orden que la lista.
3. Una línea de 2.000 eventos se desplaza en la lista y en la vista de meses sin tirones en un portátil normal.
