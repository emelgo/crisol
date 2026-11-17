# Calendarios y líneas temporales: lo que nos llevamos

Módulo de Crisol: 8 · mundo (calendarios y líneas temporales) · Fecha: 2026-11-16 · Fuentes: **Everlore**
(`emelgo/everlore`, commit `abd386a`, 2026-07-22; app anterior de Enrique) y **el Crisol antiguo**
(`~/CrisolVTT/crisol`, commit `3f68f11`, 2026-10-28; solo consulta). Marco: `docs/intent/calendarios.md`.

Las dos fuentes son código de Enrique: se puede aprovechar (en Everlore, nada del kit de Makerkit). Esta nota sigue
siendo prosa propia; las citas son `archivo:línea` para ir a mirar.

## Preguntas

1. ¿Cómo se guarda una fecha de un calendario de fantasía: un día absoluto desde un origen, o año/mes/día?
2. ¿Qué tiene que saber describir un calendario (meses, semana, bisiestos, días intercalados, eras, lunas, estaciones)?
3. ¿Qué es un evento (rango, precisión, repetición, aspecto, página enlazada) y de quién es: del mundo o de una línea?
4. ¿Cómo son las tres vistas de Everlore (lista, meses, calendario) y qué hay que cambiar para un calendario propio?
5. ¿Qué tomamos de cada uno y qué hacemos distinto?

## Everlore

### Fechas: un calendario fijo, pero guardado por partes

- El calendario es **el gregoriano, fijo** (12 meses, eras d. C./a. C., días de 24 h). El comentario de cabecera dice
  que es el primer paso hacia el «sistema de tiempo» configurable de LegendKeeper, y que las fechas se guardan por
  partes **para poder cambiar de calendario sin migrar datos** (`apps/web/src/lib/timelines/calendar.ts:1-6`).
- Una fecha es año (siempre positivo; la era lleva el signo), era, mes, día, minuto opcional y un **nivel de detalle**
  (año, mes, día u hora) que dice con qué precisión se enseña (`calendar.ts:8-27`). No hay año 0
  (`calendar.ts:50-53`).
- **El orden lo da una clave entera derivada**: número de día juliano × 1440 + minuto (`calendar.ts:70-85`,
  `calendar.ts:191-197`). La calcula el servidor al guardar para que no se pueda falsear
  (`apps/web/src/lib/timelines/timelines.functions.ts:43-49`) y la lista se ordena por ella, con las fechas vacías al
  final y después por la posición manual (`timelines.functions.ts:69-72`).
- Antes hubo **fechas de texto libre** («Año 234, Tercera Era»): «los calendarios de fantasía no se analizan», y el
  orden era el del usuario. Se quedó como respaldo de los eventos viejos (`apps/web/supabase/schemas/27-timelines.sql:1-9`,
  `27-timelines.sql:130-132`).
- **La distancia entre eventos** se dice en la unidad natural más grande: «1 año después» si coinciden mes, día y hora,
  agrupando en siglos o milenios si dividen exacto; si no, en días (`calendar.ts:148-189`).
- Los textos de fecha respetan el nivel de detalle y el idioma: «3 d. C.», «enero de 3 d. C.», «1 de enero de 3 d. C.,
  11:38» (`calendar.ts:236-283`).

### Datos

- `timeline_events` cuelga de **una pestaña** (`tab_id`), no del mundo: cada línea temporal tiene sus eventos
  (`27-timelines.sql:121-165`). Título, descripción corta (4.000), icono, inicio y fin estructurados con sus claves de
  orden, estilo, grupo, posición manual y **página enlazada opcional que sobrevive a su borrado** (`on delete set null`,
  `27-timelines.sql:127-128`, `27-timelines.sql:161`).
- **Sincronizar** (de LegendKeeper): con un evento enlazado, cambiar su nombre o icono cambia el de la página y el de
  los demás eventos sincronizados con ella (`27-timelines.sql:142-143`; `timeline-tab-pane.tsx:301-325`).
- **Grupos** (`timeline_groups`, `27-timelines.sql:12-36`): nombre, color, orden, tamaño de presentación y un estilo que
  pisa el de sus eventos. Son los carriles de la vista de meses y una etiqueta dentro de la tarjeta en la lista.
- **Estilo del evento**: color sólido o imagen de los archivos del mundo (rellenar o encajar, con un punto de encuadre
  vertical), más opacidad (`apps/web/src/lib/timelines/event-style.ts:1-17`). Una paleta de 24 tonos y colores propios
  guardados en el aparato.
- **Enlazar página**: una existente o una nueva creada desde el propio cuadro del evento (nombre, dónde y si es oculta)
  (`apps/web/src/components/timelines/link-page-field.tsx:33-36`; se crea al guardar, `timeline-tab-pane.tsx:277-299`).

### Las tres vistas (`apps/web/src/components/timelines/timeline-tab-pane.tsx`)

- **Estado**: una vista de tres (`timeline-tab-pane.tsx:226`), sin recordar entre visitas.
- **Lista** (la de serie): **una sola línea vertical cronológica**. A la izquierda, la fecha corta en negrita y debajo
  la distancia al anterior («3 años después»); en medio, la raya con un **rombo del color del evento** (sin la
  opacidad de la tarjeta); a la derecha, **la tarjeta grande** (`timeline-tab-pane.tsx:1914-1995`). Los grupos no
  parten la línea: van como una píldora dentro de la tarjeta.
- **La tarjeta**: una franja de proporción fija 6:1 (la misma en la lista, la barra de meses y la ficha del
  calendario, para que el recorte de la imagen sea idéntico en todas, `timeline-tab-pane.tsx:130-137`), con color o
  imagen, degradado oscuro abajo, título con icono, fecha, dos líneas de descripción y la página enlazada como chip
  (`timeline-tab-pane.tsx:963-1052`). Doble clic la edita; menú «⋯» con duplicar, recolorear rápido, mover a grupo y
  borrar.
- **Meses** (en la interfaz se llama «Gantt»): **carriles por grupo** (más «Sin grupo», fijo al final) por **columnas
  de tiempo**, con un control de zoom año → mes → día → hora encima de la rejilla (`timeline-tab-pane.tsx:120-129`,
  `timeline-tab-pane.tsx:1349-1390`). Es **infinita** en los dos sentidos: la ventana crece al desplazarse
  (`timeline-tab-pane.tsx:891-926`), se arrastra para moverse y abre una vez sobre el último evento. Los carriles se
  pliegan, se renombran con doble clic y se reordenan arrastrando.
- **Calendario**: el mes del último evento (o el de hoy), con flechas de mes anterior y siguiente, una rejilla de 7
  columnas y los eventos como fichas en su día; **arrastrar una ficha a otro día le cambia la fecha**
  (`timeline-tab-pane.tsx:1054-1229`). Solo cuenta el día de inicio: un evento de varios días no se ve en los demás.
- **La píldora**: abajo en el centro, fija y flotante, «+» y los tres botones de vista (`timeline-tab-pane.tsx:2230-2290`).
  Se recoloca al abrir o cerrar los paneles. Vacía, la pestaña es una sola pieza discontinua «Añadir evento»
  (`timeline-tab-pane.tsx:1897-1910`).
- **El selector de fecha**: un calendario emergente para navegar meses y años, elegir día y era y, si se quiere, la hora
  (`apps/web/src/components/timelines/event-date-picker.tsx:38-40`).

### Compromisos y límites

- Gana una vista muy pulida y casi idéntica a LegendKeeper, con datos ya preparados para otro calendario.
- Pierde lo esencial para nosotros: **no hay calendarios propios** (ni meses, ni semana, ni lunas, ni eras con nombre).
  Los eventos son de una pestaña: lo que pasa en una página no sale en otra línea, y una página con fecha no es un
  evento. Los jugadores no existen como tales (solo `dm_only` en páginas), y no hay MCP de líneas temporales.

## El Crisol antiguo

### El calendario

- Se lee del formato de TTRPG Tools – Time (`*.calendar.json`) y conserva lo que no entiende
  (`packages/core/src/calendar/definition.ts:1-7`). La definición (`definition.ts:79-100`) tiene:
  - **nombre del mundo** («Hoy en Aldoria») y **sufijo de los años** («RC»): «1250 RC» (`definition.ts:82-85`;
    `format.ts:39-41`);
  - **semana**: los nombres de sus días, con qué día empieza el año 0 y si la semana **sigue de un mes a otro o
    empieza de nuevo cada mes** (`definition.ts:86`, `definition.ts:93-96`);
  - **meses** con id, nombre, días, color propio y **festividad**: una semana de fiestas entre dos meses que ocupa su
    sitio en el año pero no se cuenta entre los meses (`definition.ts:16-27`); Eana tiene 12 meses de 28 días y 4
    semanas de festividades de 7 (el fixture `__fixtures__/eana-rc.calendar.json`);
  - **bisiestos** como reglas «cada N años, salvo cada M, pero sí cada K», que alargan un mes (`definition.ts:48-58`);
  - **eras** con nombre, descripción, fecha de inicio y de fin (abierta si no la tiene) (`definition.ts:29-36`); los
    años no se reinician con la era;
  - **lunas** con ciclo (decimal), desfase respecto al día 0, color y nombres de fase (8 por defecto)
    (`definition.ts:38-46`, `definition.ts:107`);
  - **estaciones** por día del año, pudiendo cruzar el fin de año, con color (`definition.ts:60-67`);
  - **el sol** (latitud, solsticio de invierno, inclinación) para salida, puesta y horas de luz (`definition.ts:69-77`);
  - y el **«hoy»** dentro del mismo archivo (`definition.ts:102-105`, `definition.ts:203-213`).
- **La fecha es año/mes/día** con el mes por índice (`definition.ts:9-14`) y **el día absoluto se calcula** (días
  desde el primero del año 0, negativo antes): `toDayNumber` y su inversa (`packages/core/src/calendar/dates.ts:67-87`).
  Los bisiestos se cuentan con múltiplos desde el año 0, también hacia atrás (`dates.ts:33-46`).
- Del día absoluto salen: el **día de la semana** (`dates.ts:106-111`), la **estación** (`dates.ts:113-116`), la **era**
  (la última que empieza antes y no ha terminado, `dates.ts:118-127`) y la **fase de cada luna** con su iluminación
  (`dates.ts:140-152`). `describeDay` lo junta en español para la IA y la cabecera de los jugadores
  (`packages/core/src/calendar/describe.ts:22-45`).
- **Validación** antes de guardar, por secciones y con el índice de lo que falla: nombres vacíos, meses de 1 a 1.000
  días, ids repetidos, bisiestos coherentes, eras que acaban antes de empezar, lunas con ciclo, estaciones dentro del
  año (`packages/core/src/calendar/edit.ts:116-181`).
- **El editor** (`apps/desktop/src/renderer/src/calendario/EditorCalendario.tsx`): secciones General, Semana, Meses,
  Estaciones, Lunas, Eras y Hoy, cada una con su ayuda y sus problemas (`EditorCalendario.tsx:103-138`), y **una vista
  previa del mes a medio editar** con las semanas, los festivos, las lunas nuevas y llenas y los días del año
  (`EditorCalendario.tsx:160-207`). Se crea en blanco (12 × 30, semana de 7) o desde el calendario de un sistema
  (`NuevoCalendarioDialogo.tsx:6-13`; el ejemplo gregoriano en `packages/systems/src/ejemplos/calendarios.ts`).

### Las fechas de las notas y los eventos

- **Un evento es una nota con fecha** en sus propiedades (`fc-date`, y `fc-end` para un periodo) en formato
  «año-mes-día» con el mes desde 1, también por nombre («1250-marzo-18»), y años negativos
  (`packages/core/src/calendar/events.ts:1-5`, `events.ts:18-45`).
- **Precisión**: año, mes o día, deducida de lo que se escribe (`events.ts:11-16`). Una fecha de mes o de año **abarca**
  todo el mes o el año al ordenar y al buscar por intervalo (`events.ts:155-166`).
- El evento lleva categorías, líneas temporales (con jerarquía «campaña/grupo-a»), etiquetas, calendario (sin él, el
  activo), color, imagen, resumen y **repetición anual**, solo para fechas con mes (`events.ts:74-93`, `events.ts:117-120`).
- **Las repeticiones se despliegan al leer**, solo en el intervalo que se pide, recortando el día si ese mes es más
  corto ese año (`events.ts:124-152`).
- **Filtrar** por líneas temporales, etiquetas incluidas o excluidas y calendarios (`events.ts:183-214`).

### Vistas

- Tres: **mes**, **crónica** y **línea** (`apps/desktop/src/renderer/src/calendario/vista.ts:8-9`).
  - **Mes**: la rejilla con tantas columnas como días tenga la semana (`vista.ts:15-28`), los eventos de varios días en
    todos los que abarcan (`vista.ts:43-61`), los de solo mes o año aparte (`vista.ts:63-81`), **iconos de luna nueva y
    llena** (`vista.ts:83-110`; `VistaMes.tsx:144-191`), las festividades con su color y «+N más» si no caben
    (`VistaMes.tsx:16-20`). El día elegido abre su detalle: fecha, estación, era, lunas, clima y eventos
    (`DetalleDia.tsx:11-15`).
  - **Crónica**: lista agrupada por era y año (`vista.ts:204-222`).
  - **Línea**: horizontal, con zoom de milenios a días, marcas del eje según el zoom y **carriles** para que no se monten
    los eventos (`linea.ts:1-5`, `linea.ts:20-37`, `linea.ts:64-121`).
- **Páginas de línea temporal** (`*.linea.json`) y **bloques** en las notas: no guardan eventos, guardan **un filtro**
  (líneas, etiquetas, excluir, calendarios, desde, hasta) y la vista (`lineaPagina.ts:1-20`; `bloques.ts:1-41`).
- Los textos de distancia van contra «hoy» («dentro de 3 días», «hace 2 años», `vista.ts:138-152`).

### MCP

- Cuatro herramientas: `fecha_mundo` (el día descrito), `cambiar_fecha` (avanzar o fijar el «hoy»),
  `listar_eventos` (por intervalo, línea y texto) y `crear_evento` (una nota con su fecha, fin, líneas y «anual»)
  (`apps/core-host/src/mcp/tools/calendario.ts:97-243`). Las instrucciones del servidor piden mirar la fecha antes de
  fechar nada (`apps/core-host/src/mcp/server.ts:25`).

### Compromisos y límites

- Gana un **modelo de calendario completo y probado** (Eana entero cabe), aritmética sin dependencias y una IA que
  sabe fechar. La línea temporal como **filtro** de lo que ya tiene fecha evita duplicar: la nota es el evento.
- Pierde: depende de convenciones de archivos y plugins (`fc-date`, `aat-event-*`), el mes va por **índice** (insertar
  un mes desplaza todas las fechas), los eventos no tienen aspecto propio más allá del color, y las vistas no tienen la
  calidad de Everlore. Las fechas en texto se validan al leer, no al escribir.

## Respuestas

### 1. Cómo se guarda una fecha

| | Día absoluto canónico | Año/mes/día canónico (+ día absoluto calculado) |
|---|---|---|
| Ordenar y buscar por intervalo | Directo, en SQL | Se calcula al leer (o se guarda derivado) |
| Cambiar el calendario (un mes más, otra duración) | Las fechas «se corren»: el 18 de Siega deja de serlo | La fecha escrita se queda; cambia su día absoluto |
| Precisión (solo año, solo mes) | Hay que guardarla aparte | Sale de lo que falta |
| Lo que escribe la gente y la IA | Hay que convertir | Es lo mismo |

Los dos estudiados guardan **año/mes/día** y calculan el orden. Everlore guarda la clave derivada en la fila (vale
porque su calendario no cambia); el Crisol antiguo la calcula al leer. Para nosotros, con calendarios que el máster
edita, **lo canónico es año/mes/día y el día absoluto se calcula al leer**: no hay nada que recalcular ni migrar al
editar un calendario. Una línea temporal tiene como mucho unos miles de fechas; calcularlas es cosa de milisegundos.

Y **el mes, por su id estable**, no por su posición (el fallo del antiguo): insertar, quitar o reordenar meses no toca
ninguna fecha. Quitar un mes que tiene fechas se impide (se dice cuántas). Acortar un mes no reescribe nada: al leer,
el día se recorta al último del mes y el editor avisa de cuántas fechas caen fuera antes de guardar.

### 2. Qué describe un calendario

Lo del Crisol antiguo, sin el «hoy» (es de cada campaña: 8 · campaña) ni el sol (va con el clima). Además:

- **Días fuera de la semana**: el antiguo cuenta las festividades en la semana; hay calendarios (los de la Costa de la
  Espada, por ejemplo) con días de fiesta que no son de ningún día de la semana. Es una marca más en el mes.
- **Eras con su propia cuenta** (opcional): «año 34 de la Era de los Reyes». Por defecto, los años siguen y la era solo
  da nombre; con la marca, la era cuenta desde su inicio y lleva su abreviatura.
- **Años antes del 0**: un sufijo propio para ellos («980 a. R.») o el número negativo si no hay.
- **Eras solo del máster**: una era que empieza en el futuro de la campaña es un destripe.

### 3. Qué es un evento y de quién

- **Everlore**: los eventos son de la pestaña. **Antiguo**: no hay eventos, hay notas con fecha y la línea es un filtro.
- La intención pide **las dos cosas**: eventos propios (fecha o rango, título, color o imagen, página opcional) y que
  **una página con un campo de fecha salga sola**. Así que la pestaña tiene sus eventos (como Everlore) y además
  muestra las páginas con fecha que caen en su alcance (como el antiguo). Lo natural para el alcance es **el subárbol
  de la página** que tiene la pestaña: la línea de «Historia de Eana» en la raíz recoge todo; la de «Casa Valmont», lo
  de esa casa. Con opciones para ampliar a todo el mundo o filtrar por plantilla o etiqueta.
- Precisión año/mes/día (sin horas: ninguno de los dos casos de Enrique las usa), rango con fin opcional, repetición
  anual (fiestas, aniversarios), aspecto de Everlore (color o imagen con encuadre, icono) y página enlazada que
  sobrevive a su borrado.

### 4. Las vistas con un calendario propio

- **Lista**: como Everlore. La distancia «N años después» se calcula con los días absolutos del calendario y su año
  medio (en Eana, 364 días), no con el juliano.
- **Meses**: como Everlore, pero el zoom es **año → mes → día** (sin horas) y las columnas salen del calendario (16
  «meses» por año en Eana, cada uno con su número de días; las festividades, más estrechas o marcadas). Con eventos a
  12.000 años de distancia, la vista de año tiene que poder saltar y la banda superior agrupar por era.
- **Calendario**: como Everlore, pero con **tantas columnas como días tenga la semana**, la semana continua o
  reiniciada, los eventos de varios días en todos sus días (como el antiguo), **las lunas** (icono en los días de luna
  nueva y llena, con su color) y el nombre de la era y la estación del mes. Los días fuera de la semana, en una franja
  aparte sobre la rejilla.

## Qué nos llevamos a Crisol

1. **El modelo de calendario del antiguo** (meses con festividades, bisiestos con excepciones, semana continua o no,
   eras, lunas, estaciones) con tres cambios: el mes por id estable, días fuera de la semana y eras con su cuenta y su
   marca de solo máster. Su aritmética y su validación se portan a `packages/domain` como código propio, con cabecera
   de origen (Crisol antiguo, `3f68f11`), y sus pruebas.
2. **Fechas año/mes/día** (sin lo que falte = precisión menor), con el calendario al que pertenecen; día absoluto
   calculado al leer; formato de texto para la IA como el `fc-date` del antiguo (`1250-03-18`, `1250-Siega-18`,
   `1250-03`, `-980`).
3. **La pestaña y sus vistas, de Everlore**: la línea con el rombo y la tarjeta 6:1, la distancia al anterior, la
   píldora con «+» y las tres vistas (de cristal, por `docs/diseno.md`), el vacío de una sola pieza, el cuadro del
   evento con su estilo y su página (existente o nueva), los grupos como carriles, arrastrar para cambiar la fecha.
4. **Las páginas con fecha como en el antiguo**: un tipo de propiedad «fecha» (también en los campos de plantilla) y la
   pestaña que las recoge de su subárbol.
5. **El editor del antiguo** con su vista previa del mes y sus problemas por sección.
6. **El MCP del antiguo, ampliado**: ver y describir fechas, crear y cambiar calendarios, ver la línea y crear eventos
   en lote.

### Lo que no tomamos

- De Everlore: el texto libre como fecha, «sincronizar» el título con la página (lo resolvemos dejando que un evento
  enlazado sin título propio use el de su página), el tamaño y el estilo que pisa de los grupos, la hora y el zoom de
  horas, los colores propios guardados en el aparato (usamos la paleta del mundo y `#rrggbb`).
- Del antiguo: los formatos heredados (`*.calendar.json`, `fc-date` en archivos, bloques de plugins): **importar no
  entra** (intención). Las páginas de línea temporal sueltas (`*.linea.json`): la línea es una pestaña. El «hoy», el
  sol, el clima y los viajes: 8 · campaña. La conversión entre calendarios: ninguno de los dos la tenía; queda como
  pregunta abierta.
