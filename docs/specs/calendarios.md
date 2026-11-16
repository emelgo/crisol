# Spec: calendarios (módulo 8 · mundo)

Capacidad `calendarios` del módulo 8 (`docs/specs/modulo-8.md`). Intención: `docs/intent/calendarios.md`. Estudio:
`research/calendarios-y-lineas-temporales.md` (§ El Crisol antiguo, § Respuestas 1 y 2).

## Objetivo

Que un mundo tenga **varios calendarios, uno principal** (el de las fechas por defecto), cada uno con sus meses, su
semana, sus bisiestos, sus eras, sus lunas y sus estaciones, y **un editor** como el del Crisol antiguo, con vista
previa del mes y los problemas por sección. Que la IA los cree y los lea, y sepa describir cualquier fecha (día de la
semana, estación, era, lunas) y sumar días. Es la base de las fechas y de la línea temporal.

## Comportamiento

### La pantalla «Calendarios» (pregunta abierta 1 del módulo)

- Pantalla del mundo (`/mundos/$w/calendarios`), con su icono en la barra de la app dentro del mundo. Solo el máster
  la abre (la jugadora no la ve: los calendarios le llegan con lo que lee).
- Una ficha por calendario: nombre, «Principal» (marca de acento), meses y días del año («16 meses · 364 días»), lunas
  y eras en pequeño. Se reordenan arrastrando. Vacía: una sola pieza en el centro (`docs/diseno.md`) con «Calendario
  nuevo».
- **«Calendario nuevo»** abre un cuadro: nombre y de dónde se parte: «En blanco» (12 meses de 30 días, semana de 7),
  «Como el nuestro» (el gregoriano, de ejemplo, con su luna y sus estaciones) o «Copia de…» uno del mundo. Una línea
  dice que también se puede pedir a la IA. Al crearlo se abre su editor. **El primero del mundo nace principal.**
- El menú de cada ficha: abrir, «Hacer principal», duplicar, borrar. Borrar uno con fechas se impide y dice cuántas
  (eventos y páginas); borrar el principal exige elegir antes otro.

### El editor

Como el del antiguo (`EditorCalendario.tsx:103-207`): secciones con su icono, una línea de ayuda genérica y sus
problemas, y a la derecha **la vista previa de un mes** a medio editar (semanas, festividades con su color, días fuera
de la semana, lunas nuevas y llenas, días del año), con flechas para pasar de mes y de año. Se guarda con «Guardar»
(con «Cancelar»); mientras haya problemas, «Guardar» dice cuántos y lleva al primero. Guardar es una operación del
historial.

- **General**: nombre; sufijo de los años («RC»: «1250 RC»); sufijo de los años antes del 0 (opcional: «980 a. R.»;
  sin él, «-980 RC»); descripción corta (con su cuenta «123 / 500»).
- **Semana**: los días (añadir, renombrar, subir, bajar, quitar); con qué día empieza el año 0; si la semana **sigue de
  un mes a otro** o **empieza cada mes**.
- **Meses**: nombre, días (1 a 1.000), color opcional, **«Festividad»** (ocupa su sitio en el año, pero no cuenta como
  mes al numerarlos: el «mes 3» es el tercero que no es festividad) y **«Fuera de la semana»** (sus días no son de
  ningún día de la semana). Debajo, **los bisiestos**: «en {mes}, {n} día(s) más cada {N} años, salvo cada {M}, pero sí
  cada {K}». El total de días del año, al pie.
- **Estaciones**: nombre, del día del año al día del año (puede cruzar el fin de año), color.
- **Lunas**: nombre, ciclo en días (decimal), desfase en días respecto al día 0, color, nombres de sus fases (8 por
  defecto: Nueva… Menguante; se pueden cambiar el número y los nombres).
- **Eras**: nombre, abreviatura, descripción corta, inicio (fecha del calendario), fin (opcional: abierta), **«Cuenta
  los años desde su inicio»** («año 34 ER») y **«Solo del máster»**.
- **Avisos al guardar**: si quitar un mes deja fechas sin mes, no se puede (dice cuántas y dónde verlas); si un mes se
  acorta y hay fechas en los días que desaparecen, avisa de cuántas antes de guardar (al leerlas se recortan al último
  día). Nada se reescribe.

### Fechas y su texto

- Una fecha del calendario es **año** (entero, puede ser negativo; hay año 0), **mes** (opcional, por su id) y **día**
  (opcional, solo con mes). Lo que falta baja la precisión: «1250 RC», «Siega de 1250 RC», «18 de Siega de 1250 RC».
- **El texto**, en español: «18 de Siega de 1250 RC»; con día de la semana, «Flora, 18 de Siega de 1250 RC»; en una era
  que cuenta desde su inicio, con su abreviatura; antes del 0, con el sufijo de antes si lo hay.
- **El formato para la IA** (como el `fc-date` del antiguo): `"1250-03-18"` (el mes por su número, sin contar
  festividades), `"1250-Siega-18"` (por nombre, sin tildes ni mayúsculas), `"1250-03"`, `"1250"`,
  `"-980-01-01"`. Las festividades se escriben por su nombre (no tienen número). La salida da siempre el texto y la
  forma con nombre de mes (la que no cambia al reordenar).

## Datos

Tabla nueva **`calendars`** (con historial):

| Columna | Tipo | Notas |
|---|---|---|
| `world_id` | uuid | mundo, en cascada |
| `name` | text | 1–60 |
| `position` | text | orden fraccionario, como el árbol |
| `primary` | boolean | índice único parcial `(world_id) where primary`; el servidor mantiene que haya uno si hay calendarios |
| `definition` | jsonb | validado con zod (`calendarDefinition`), abajo |

`calendarDefinition` (contrato en `packages/contracts/src/calendars.ts`):

- `yearSuffix` (≤ 12), `beforeZeroSuffix` (≤ 12, opcional), `description` (≤ 500)
- `weekdays`: 1–20 nombres; `firstWeekday` (índice del día del primer día del año 0); `weekMode`: `continuous` | `reset`
- `months`: 1–100 de `{ id, name, days (1–1000), color?, festival?, outsideWeek? }`; `id` corto y aleatorio, único en el
  calendario, que no se enseña
- `leapRules`: 0–10 de `{ monthId, days (1–10), every, unless?, but? }` (`unless` múltiplo de `every`; `but` de `unless`)
- `seasons`: 0–12 de `{ id, name, startDay, endDay, color? }` (días del año normal, 1–longitud)
- `moons`: 0–10 de `{ id, name, cycleDays (> 0, decimal), offsetDays, color, phases: 2–32 nombres }`
- `eras`: 0–100 de `{ id, name, abbreviation?, description?, start, end?, countsFromStart?, hidden? }` con fechas del
  propio calendario

Validación pura en `packages/domain` (portada de `edit.ts:116-181` del antiguo): devuelve los problemas con su sección
y su índice; el servidor no guarda una definición con problemas (`BAD_CALENDAR`, con la lista).

### Aritmética (`packages/domain/src/calendar/`, sin dependencias)

Portada de `packages/core/src/calendar/{dates,events,format,describe}.ts` del antiguo (cabecera de origen, commit
`3f68f11`), con sus pruebas, y con los cambios: meses por id, días fuera de la semana, eras que cuentan desde su inicio
y sufijo antes del 0.

- `dayNumber(def, date)` / `dateFromDay(def, n)`: días desde el primero del año 0 (negativos antes), con bisiestos.
- `span(def, date)`: el primer y el último día que abarca una fecha según su precisión.
- `weekday`, `season`, `era` (la última que empieza antes y no ha terminado), `moonPhases` (fase, nombre,
  iluminación), `dayOfYear`, `daysInMonth`, `yearLength`, `addDays`, `addMonths`, `monthGrid` (semanas del mes para la
  vista de calendario, con los días fuera de la semana aparte).
- `formatDate` (texto en español), `parseDate` (el formato de la IA, contra el calendario), `describeDay` (todo junto).
- `occurrences(def, event, from, to)`: las repeticiones anuales de una fecha dentro de un intervalo (recortando el día
  si ese mes es más corto ese año).

## Acciones (contratos)

| Acción | Tipo | Entrada | Salida |
|---|---|---|---|
| `listCalendars` | read | `worldId`, `readAs` | `calendars: calendarView[]` (id, nombre, principal, orden, definición; a un jugador, sin las eras ocultas) |
| `getCalendar` | read | `calendarId`, `readAs` | `calendarView` + resumen legible (meses numerados con sus días, longitud del año) |
| `createCalendar` | write | `worldId`, `name`, `from`: `blank` \| `gregorian` \| `{ copyOf }` \| `{ definition }` | `calendarView` |
| `updateCalendar` | write | `calendarId`, `name?`, `primary?: true`, `after?`, `definition?` (entera) | `calendarView`; errores `BAD_CALENDAR`, `CALENDAR_MONTH_IN_USE` |
| `deleteCalendar` | delete | `calendarId` | errores `CALENDAR_IN_USE` (con cuántas fechas), `CALENDAR_IS_PRIMARY` |
| `describeDate` | read | `calendarId?` (sin él, el principal), `date` (texto o `{year, month?, day?}`), `addDays?`, `until?` | texto, forma con nombre de mes, día de la semana, estación, era, lunas, día del año, días hasta `until` |

Contar fechas en uso de un calendario o de un mes: consulta sobre `timeline_events` y sobre `pages.properties` con
contención `jsonb` (índice GIN `pages_properties` ya existe). Tiempo real: `{ type: 'changed', what: 'calendars',
worldId }`.

## IA (MCP)

| Herramienta | Acción | Qué dice su descripción (resumen) |
|---|---|---|
| `listar_calendarios` | `listCalendars` | Los calendarios del mundo y cuál es el principal |
| `ver_calendario` | `getCalendar` | Semana, meses numerados con sus días, festividades, bisiestos, eras, lunas y estaciones |
| `crear_calendario` | `createCalendar` | Crea uno en blanco, como el gregoriano, copia de otro o con su definición entera |
| `cambiar_calendario` | `updateCalendar` | Nombre, hacerlo principal, orden o la definición entera (mira antes `ver_calendario`); no reescribe fechas |
| `borrar_calendario` | `deleteCalendar` | Solo sin fechas; se deshace |
| `describir_fecha` | `describeDate` | Describe una fecha (y, con `sumar_dias`, la de N días después; con `hasta`, cuántos días faltan) en el formato `1250-Siega-18` |

Las instrucciones del servidor añaden: «antes de fechar nada, mira los calendarios (`listar_calendarios`) y escribe
las fechas como `1250-Siega-18`». Lo que no es leer pasa por el modo de la IA (`approvals.ts`).

## Pruebas

- **Unitarias** (`packages/domain`): ida y vuelta fecha → día → fecha en ±100.000 años (gregoriano con sus bisiestos,
  un calendario como el de Eana con festividades, otro con días fuera de la semana y semana que empieza cada mes); día
  de la semana, estación que cruza el año, era abierta y era que cuenta desde su inicio, fases de dos lunas con ciclo
  decimal; recortar al último día; repeticiones anuales en un intervalo; `parseDate` con número, nombre, sin tildes,
  festividades y años negativos; validación (cada problema, en su sección). Rendimiento: 10.000 fechas < 50 ms.
- **Integración** (servidor): crear (en blanco, gregoriano, copia), hacer principal (solo uno), reordenar, borrar con y
  sin fechas, quitar un mes en uso, `describeDate`; un jugador no recibe las eras ocultas (prueba de fugas); el MCP
  (`crear_calendario` con una definición entera, `describir_fecha`).
- **Web**: la pantalla (vacía, con fichas), el cuadro de «Calendario nuevo», el editor (añadir un mes, un bisiesto, una
  luna; un problema bloquea «Guardar» y lleva a él; la vista previa cambia al momento).
- **E2E**: crear un calendario de 16 meses con dos lunas desde la interfaz y verlo en la vista previa; accesibilidad
  de la pantalla y del editor.

## Límites

- Siempre: validar en el servidor; textos por i18n, cortos; nada creado de serie en un mundo.
- Preguntar antes: añadir una dependencia de fechas (no hace falta: la aritmética es propia).
- Nunca: importar `*.calendar.json` u otros formatos; reescribir fechas al editar un calendario; el «hoy», el sol o el
  clima (8 · campaña).

## Criterios de éxito

1. La IA crea el calendario de Eana con una sola llamada a `crear_calendario` y `describir_fecha` de «1250-Siega-18»
   devuelve día de la semana, estación, era y fases correctas (comprobadas a mano contra la definición).
2. En el editor, añadir una festividad de 7 días cambia la vista previa y el total del año (364) sin guardar; quitar
   un mes con fechas se impide y dice cuántas.
3. Ningún jugador recibe una era «Solo del máster» por ninguna vía.
