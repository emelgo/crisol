# ADR-0031: Las cronologías, pestañas de una página (enmienda la decisión 4 del ADR-0029)

Estado: aceptada (Enrique, 2026-11-19, ajustes tras los módulos 8, 9 y 10: «cronologías como pestaña de página, como en
LegendKeeper»; su decisión 2, enmendada por el ADR-0032: cada evento es de una cronología) · Enmienda: la decisión 4 de Enrique en `docs/specs/modulo-8.md` («sin pestaña Línea temporal; el
tiempo vive en Calendarios») y lo que el ADR-0029 daba por hecho sobre dónde viven las cronologías. El resto del
ADR-0029 (la fecha canónica, el día absoluto al leer, la correspondencia) sigue igual.

## Contexto

En el módulo 8 las cronologías vivían en «Calendarios», a pantalla entera, con su propia marca de conocimiento
(`chronology`) para enseñárselas a una campaña. Al probarlas, Enrique pidió tenerlas como en LegendKeeper: una pestaña
más de una página (la «Historia del reino», la página de una campaña), con el esqueleto de la página. Calendarios se
queda como el sitio de las reglas del tiempo (los calendarios y su vista grande). Y los eventos siguen siendo del
mundo: una línea de una cronología, que se puede convertir en página.

## Decisión

1. **Una cronología es una pestaña de tipo `chronology`** de una página, como un mapa: `chronologies.tab_id` es único y
   se va con su pestaña (`on delete cascade`, y `deleteTab` la quita en la misma operación para que deshacer la
   devuelva). Su nombre es el de su pestaña (en las listas, «Página · Pestaña» si la pestaña no se llama
   «Cronología») y su sitio, el de su pestaña: `chronologies` pierde `name` y `position` (migración 0091).
2. **Los eventos sueltos siguen siendo del mundo** (`timeline_events`), sin pestaña: cada cronología los junta según
   su filtro, igual que las páginas con fecha. «Convertir en página» sigue creando la página y enlazándola.
3. **Quién la ve es quién ve su pestaña** (ADR-0017): su página y, si la pestaña está oculta, su marca. La marca
   `chronology` deja de usarse; la migración 0090 pasó la de cada campaña a la página nueva de su cronología (y, sin
   ninguna, la página nació oculta, como la cronología, que sin marca no la veía nadie). El tipo queda en la columna
   por las marcas antiguas del historial.
4. **Migración (0090)**: cada cronología que había pasa a una página nueva al final del primer nivel de su mundo, con
   su nombre, y una pestaña «Cronología».
5. **Las acciones**: `createChronology` crea una página con su pestaña o, con `pageId`, añade la pestaña a una que ya
   hay; «Pestaña nueva» de tipo cronología la crea con el calendario principal y todo el mundo; `getChronology` la lee
   también por el id de su pestaña; `updateChronology` cambia el nombre de su pestaña (sin `after`: el orden es el de
   las pestañas); `deleteChronology` quita su pestaña. Las herramientas MCP siguen con sus nombres.
6. **En la interfaz**: la pestaña con el esqueleto de la página (a sangre, como el mapa; sus herramientas a la derecha
   de las pestañas). Fuera la sección de Calendarios y la pantalla `/mundos/$w/calendarios/cronologias/$id`, que ahora
   lleva a su pestaña. La jugadora la ve en las páginas de su campaña; su lista de cronologías lleva a cada pestaña.

## Consecuencias

- Una cronología hereda lo de las pestañas: se recoloca, se colorea, se oculta y se revela como ellas, y se copia con
  su página (con su calendario y su filtro; a una plantilla, sin el calendario ni los grupos, que son del mundo).
- Una cronología es tan visible como su página: revelar la página «Historia» enseña también su cronología (salvo que
  la pestaña esté oculta).
- Deshacer una operación de cronologías de antes de la migración puede fallar (sus filas no tenían pestaña ni la
  piden): se acepta, porque solo había cronologías de prueba.
- Calendarios ya no lista cronologías: la vista grande de un calendario enseña los eventos de las cronologías que lo
  usan (bloque C de los mismos ajustes).
