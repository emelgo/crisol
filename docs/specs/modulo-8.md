# Módulo 8 · mundo: calendarios y líneas temporales

Intención: `docs/intent/calendarios.md` (Enrique, 2026-11-16). Estudio: `research/calendarios-y-lineas-temporales.md`
(Everlore y el Crisol antiguo). Inventario § 7. ADR-0007, fase 3 («línea temporal y calendarios del mundo»).

## Objetivo

Que un mundo tenga **su tiempo**: uno o varios calendarios propios (meses, semana, eras, lunas, estaciones), con uno
principal; **eventos** con fecha o rango, título, color o imagen y página opcional; **páginas con fecha** que salen
solas; y **la línea temporal como pestaña de una página**, con las tres vistas de Everlore (lista, meses y calendario).
Lo prepara el máster en el PC, a mano o con la IA por el MCP; la jugadora lo lee (también en el móvil) con solo lo que
su campaña sabe.

**Usuarios**: el máster, siempre en PC (`docs/diseno.md`: el móvil, solo para la jugadora); la jugadora, en PC y en
móvil, en solo lectura; la IA del máster (crea calendarios, fecha páginas, rellena líneas) y la de la jugadora (lee lo
que ella ve).

## Capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `calendarios` | Los calendarios del mundo (varios, uno principal), su editor con vista previa y validación, la aritmética de fechas (`packages/domain`) y su MCP (`listar_calendarios`, `ver_calendario`, `crear_calendario`, `cambiar_calendario`, `borrar_calendario`, `describir_fecha`) | mundos e historial (módulo 0) |
| `fechas` | El valor «fecha» (año/mes/día de un calendario, con precisión y rango), el tipo de propiedad y de campo de plantilla «Fecha», su selector y su lectura y escritura por el MCP | `calendarios`, propiedades y plantillas (módulos 1 y 2) |
| `linea-temporal` | La pestaña «Línea temporal»: sus eventos y grupos, las páginas con fecha de su alcance, las vistas lista, meses y calendario, lo que ve la jugadora y su MCP (`ver_linea_temporal`, `cambiar_linea_temporal`, `crear_eventos`, `cambiar_evento`, `borrar_evento`) | `calendarios`, `fechas`, pestañas (ADR-0007), conocimiento (ADR-0017) |

Orden: `calendarios` → `fechas` → `linea-temporal`. Cada una se puede probar sola: un calendario se crea, se edita y
describe fechas sin líneas; una página se fecha y se ve en su panel sin pestaña; la pestaña junta las dos.

Specs: `docs/specs/calendarios.md`, `docs/specs/fechas.md` y `docs/specs/linea-temporal.md`.

## Alcance

- **Dentro**: lo de las tres capacidades; la pestaña en «Pestaña nueva» y «Página nueva» (deja de ser «Pronto»);
  copiar una página copia su línea temporal (`packages/db/src/repos/copy.ts`); todo pasa por `operation()` y se
  deshace desde el historial; la prueba de fugas se amplía; tutorial guiado de la pantalla de calendarios y de la
  pestaña.
- **Fuera** (intención y decisiones previas):
  - el **«hoy» de cada campaña**, el **clima** (y el sol: salida, puesta, horas de luz), los **viajes** y lo que cuenta
    contra «hoy» («dentro de 3 días»): **8 · campaña**, con la revisión de la campaña. El modelo lo deja preparado
    (una fecha de un calendario es lo que guardará el «hoy»);
  - **importar** de otros formatos (`*.calendar.json`, Fantasy Calendar, `fc-date`…), ni en la interfaz ni como
    objetivo: se crean a mano o con la IA;
  - horas y minutos en las fechas; repeticiones que no sean anuales;
  - un bloque de línea temporal dentro del texto de una página; los eventos en la búsqueda de la wiki;
  - convertir fechas entre calendarios (pregunta abierta 9).

## Modelo de datos (resumen)

Detalle en cada spec. Todo con `world_id`, columnas de historial (`trackedColumns`) y en `operation()`.

| Tabla | Qué guarda | Spec |
|---|---|---|
| `calendars` (nueva) | Nombre, orden, `primary` (uno por mundo), la definición en `jsonb` validada con zod (semana, meses con id estable, bisiestos, eras, lunas, estaciones, sufijos de los años) | `calendarios` |
| `pages.properties` (existe) | Un tipo nuevo de propiedad, `date`: `{ calendarId, start, end?, yearly? }`, con `start`/`end` = `{ year, month?, day? }` (el mes, por su id) | `fechas` |
| `timelines` (nueva) | La pestaña de línea temporal: su calendario y su alcance (subárbol, todo el mundo o ninguno; plantillas y etiquetas) | `linea-temporal` |
| `timeline_groups` (nueva) | Los grupos (carriles) de una línea: nombre, color, orden | `linea-temporal` |
| `timeline_events` (nueva) | Los eventos: título, fechas, cada año, color, imagen, icono, descripción, grupo, página enlazada, oculto | `linea-temporal` |
| `knowledge` (existe) | Un tipo nuevo, `event`, para revelar un evento a una campaña como un pin | `linea-temporal` |
| `page_tabs.kind` (existe) | El tipo `timeline` | `linea-temporal` |

**Decisión central** (del estudio): **la fecha canónica es año/mes/día, con el mes por su id estable**; el día absoluto
(días desde el primero del año 0) se **calcula al leer** con la aritmética de `packages/domain`, nunca se guarda.
Editar un calendario no reescribe ninguna fecha. Se apunta en un ADR nuevo (ADR-0029) al construir `calendarios`.

## Lo que ve la jugadora (ADR-0017)

- **Calendarios**: los lee todos (sin ellos no se entiende una fecha), salvo **las eras marcadas «Solo del máster»**,
  que no le llegan ni a ella ni a su IA (una era futura destripa).
- **La pestaña** sigue a su página y su marca de oculta, como cualquier pestaña.
- **Un evento** sigue a su pestaña, salvo que esté oculto o tenga su marca en la campaña (tipo `event`, se revela como
  un pin). Enlazado a una página que no conoce: sale sin enlace (y con su propio título).
- **Una página con fecha** sale solo si la ve, y la propiedad solo si no es un campo «Oculto».
- Lo filtra el servidor: lo que no ve no le llega por la API, el tiempo real ni el MCP.

## Comandos

```
pnpm dev                    # servicios (Docker) y desarrollo
pnpm db:migrate             # aplicar la migración nueva enseguida en local (Enrique prueba en localhost)
pnpm test                   # unitarias e integración de todos los paquetes
pnpm lint && pnpm typecheck
pnpm e2e                    # e2e, fugas y accesibilidad (al final, antes de subir)
```

## Dónde va

- `packages/domain/src/calendar/`: la aritmética y el formato (portados del Crisol antiguo, código propio de Enrique,
  con cabecera de origen) y sus pruebas.
- `packages/contracts/src/calendars.ts` y `timelines.ts`: acciones y esquemas; la propiedad `date` en `pages.ts`.
- `packages/db/src/schema/calendars.ts` y `timelines.ts`; la migración `0082_calendarios.sql` (o la siguiente libre).
- `apps/server/src/actions/calendars.ts` y `timelines.ts`; herramientas en `apps/server/src/mcp/tools.ts`.
- `apps/web/src/calendars/` (pantalla y editor) y `apps/web/src/wiki/tabs/timeline/` (la pestaña).

## Criterios de aceptación del módulo

1. **Con la IA**: «crea el calendario de Eana» (12 meses de 28 días y 4 semanas de fiestas, semana de 7 días, dos
   lunas de 28 y 91 días, cinco eras) queda creado y principal; `describir_fecha` de «1250-Siega-18» dice su día de la
   semana, su estación, su era y la fase de cada luna, y coincide con la vista de calendario.
2. **El máster**: en la página «Historia» añade una «Línea temporal»; crea tres eventos (uno de un día, uno de un rango
   que cruza dos meses y una fiesta «cada año»); una subpágina con el campo «Fundación: 12 de Siega de -980» sale sola;
   las tres vistas los enseñan y arrastrar un evento en el calendario le cambia la fecha.
3. **La jugadora**, en el móvil: ve la pestaña revelada con solo los eventos y páginas que su campaña conoce, sin la
   era oculta; la lista y el calendario se leen sin desplazamiento horizontal a 375 px.
4. **Fugas**: ningún evento oculto o sin revelar, página que no ve, campo oculto ni era oculta le llega a un jugador por
   la API, el tiempo real o el MCP (la prueba de fugas lo comprueba).
5. **Deshacer**: crear o borrar un calendario, un evento o la pestaña se deshace desde el historial; copiar la página
   copia la línea con sus eventos y grupos.
6. **Rendimiento**: una línea con 2.000 eventos y 5.000 páginas con fecha en su alcance responde en menos de 300 ms en
   local y la lista se desplaza sin tirones; la aritmética calcula 10.000 fechas en menos de 50 ms.
7. **Accesibilidad**: axe sin fallos críticos ni graves en la pantalla de calendarios, el editor y las tres vistas; la
   rejilla del calendario se recorre con las flechas.

## Riesgos

- **La búsqueda de la wiki** indexa las propiedades con `crisol_page_text(title, properties)` (`packages/db/src/schema/pages.ts:29-32`):
  hay que comprobar que una propiedad con valor objeto no la rompe (y decidir si la fecha entra como texto).
- **Aritmética con años negativos y bisiestos** (Eana empieza en el -12000): pruebas de ida y vuelta (fecha → día →
  fecha) en ±100.000 años con calendarios con y sin bisiestos, festividades y días fuera de la semana.
- **La vista de meses con milenios de distancia**: ventana infinita como Everlore, con zoom de años y salto al evento;
  medir antes de pulir.
- **Tamaño**: tres capacidades y un editor grande; se construye en porciones verticales y cada capacidad se cierra con
  su revisión de interfaz (impeccable) antes de la siguiente.
- **El código de Everlore** es de Enrique, pero va sobre Makerkit: se toma su lógica y su forma, nunca los componentes
  del kit; en Crisol, los componentes propios y el cristal.

## Preguntas abiertas (con recomendación; no son respuestas de Enrique)

1. **Dónde viven los calendarios en la interfaz.** Recomendación: una pantalla del mundo, **«Calendarios»**
   (`/mundos/$w/calendarios`), con su icono en la barra de la app dentro del mundo, como Archivos o Etiquetas; el editor
   se abre desde ella. Alternativa: dentro de los ajustes del mundo.
2. **Con qué se empieza un calendario nuevo.** Recomendación: «En blanco» (12 meses de 30 días, semana de 7), «Como
   el nuestro» (el gregoriano, de ejemplo) y «Copia de…» uno del mundo; y la IA. Nada creado de serie en un mundo
   (ADR-0015).
3. **Qué páginas con fecha salen en una pestaña.** Recomendación: por defecto, **la página y su subárbol**; en sus
   ajustes, «Todo el mundo» o «Ninguna», y filtrar por plantilla y etiqueta.
4. **Una página con varias fechas** (nacimiento y muerte). Recomendación: sale una vez por fecha, con el nombre del
   campo junto al título; un campo puede marcarse «Fuera de las líneas temporales».
5. **Horas.** Recomendación: no de momento (ni Eana ni Fateforge las usan en sus líneas); el valor admite añadirlas
   después sin migrar.
6. **Cómo se cuentan los años.** Recomendación: años seguidos con el sufijo del calendario («1250 RC»), con año 0, y un
   sufijo opcional para los anteriores al 0 («980 a. R.»; sin él, «-980 RC»); una era puede **contar desde su inicio**
   con su abreviatura.
7. **Días fuera de la semana** (fiestas que no son de ningún día). Recomendación: sí, una marca del mes; en la vista de
   calendario salen en una franja sobre la rejilla.
8. **Editar un calendario con fechas.** Recomendación: no se reescribe ninguna; quitar un mes con fechas se impide
   (dice cuántas); acortar un mes avisa de cuántas fechas caen fuera y al leerlas se recortan al último día.
9. **Convertir entre calendarios.** Recomendación: no en este módulo. Una línea usa un calendario; lo de otros no sale
   (la pestaña dice cuántas fechas deja fuera). Si hace falta, un «ancla» opcional («el día 1 del año 0 de este
   calendario es tal fecha del principal») lo permitiría después sin tocar datos.
10. **Grupos de Everlore.** Recomendación: sí, sencillos (nombre, color, orden): son los carriles de la vista de meses y
    la etiqueta de la tarjeta. Sin el tamaño ni el estilo que pisa el de sus eventos.
11. **Título de un evento enlazado.** Recomendación: en lugar de «sincronizar» (Everlore), el título es opcional si
    hay página enlazada: sin título propio, se usa el de la página (vivo).
12. **La jugadora en el móvil.** Recomendación: lista y calendario (tocar un día sube su hoja con los eventos); la
    vista de meses, solo desde 640 px de ancho.
13. **Eventos sin fecha** (el texto libre de Everlore). Recomendación: no; todo evento tiene al menos un año.
