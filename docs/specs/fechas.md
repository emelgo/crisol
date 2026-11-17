# Spec: fechas (módulo 8 · mundo)

Capacidad `fechas` del módulo 8 (`docs/specs/modulo-8.md`). Intención: `docs/intent/calendarios.md` («una página con
un campo de fecha sale sola en la línea temporal»). Estudio: `research/calendarios-y-lineas-temporales.md` (§ Respuestas
1 y 3). Depende de `calendarios`.

## Objetivo

Un valor **fecha** común a todo Crisol (año/mes/día de un calendario del mundo, con su precisión, un fin opcional y
«cada año») y su uso en las páginas: **un tipo de propiedad «Fecha»** y **un tipo de campo de plantilla «Fecha»**, con
un selector que navega el calendario del mundo. Es lo que luego recoge la línea temporal, y lo que guardará el «hoy» de
cada campaña (8 · campaña).

## Comportamiento

### El valor

- `worldDate` = `{ year, month?, day? }`: año entero (con año 0 y negativos), mes por su **id** en el calendario (opcional)
  y día (opcional, solo con mes). Precisión: año, mes o día, según lo que haya.
- `dateValue` = `{ calendarId, start: worldDate, end?: worldDate, yearly?: true }`: el calendario siempre explícito (al
  crearla, el principal); `end` ≥ `start`, del mismo calendario; `yearly` solo si `start` tiene mes (fiestas,
  aniversarios).
- Si el mes de una fecha ya no existe, no puede pasar: quitar un mes en uso se impide (`calendarios`). Si el día ya no
  cabe en su mes, se lee recortado al último día y se marca «fuera del calendario» en el selector.

### La propiedad «Fecha»

- En «Añadir propiedad» del panel de la página, un tipo más: **«Fecha»**. Se ve como texto («18 de Siega de 1250 RC»;
  con fin, «12 de Siega – 3 de Trilla de 1250 RC», sin repetir lo que comparten; con «cada año», un pequeño icono de
  repetición).
- Pulsarla abre **el selector** (en el móvil, una hoja que sube): el calendario (si hay más de uno; por defecto el
  principal), la precisión (Año · Mes · Día, como el «nivel de detalle» de Everlore), y una rejilla del mes con la
  semana del calendario para elegir el día; flechas de mes y año, y escribir el año a mano (para saltar milenios).
  «Añadir fin» abre el segundo selector; «Cada año», una casilla. «Borrar» la deja vacía.
- Sin ningún calendario en el mundo: el selector dice una línea («Este mundo aún no tiene calendario») con un enlace a
  «Calendarios».
- **Campo «Oculto»** (ADR-0017): como cualquier campo, no le llega a la jugadora.

### El campo de plantilla «Fecha»

- En el editor de campos de una plantilla-modelo (ADR-0024), el tipo «Fecha», con dos opciones: **«Con fin»** (rango) y
  **«Fuera de las líneas temporales»** (para fechas que no son sucesos, como «Última visita»; pregunta abierta 4 del
  módulo). Las páginas creadas desde la plantilla llevan el campo vacío con su `fieldId`.
- Las tablas que se llenan solas (ADR-0009) enseñan la fecha como texto y **ordenan por ella** (por su día absoluto).

### Para la línea temporal

- Una página «tiene fecha» si alguna propiedad `date` tiene valor y no lleva «Fuera de las líneas temporales». Cada una
  de esas propiedades es un elemento de la línea (con el nombre del campo junto al título si hay más de una).
- Buscarlas: `pages.properties @> '[{"type":"date"}]'` (índice GIN `pages_properties`, `jsonb_path_ops`), y el día
  absoluto se calcula al leer con `packages/domain`. No hay tabla derivada que mantener.

## Datos

- `packages/contracts/src/pages.ts`: un miembro más en `pageProperty` y en `propertyInput` (la entrada de `editPage`):
  `{ ...field, type: 'date', value: dateValue | null, range?: true, offTimeline?: true }`. En `propertyInput` el valor
  puede llegar también **como texto** en el formato de la IA (`"1250-Siega-18"`, con `fin`/`end` y `cada_año`), y el
  servidor lo convierte contra el calendario (error `BAD_DATE` con el motivo: mes que no existe, día fuera, fin antes
  del inicio).
- El servidor comprueba siempre que `calendarId` sea del mismo mundo.
- `packages/domain/src/properties.ts`: lo que hoy hace con cada tipo (texto para búsqueda y para las tablas, copia,
  comparación), también con `date`.
- **Búsqueda**: la función SQL `crisol_page_text(title, properties)` no debe romperse con un valor objeto; la fecha no
  entra en el texto buscable (riesgo del módulo: comprobarlo con una prueba de integración).
- Sin migración de datos: las propiedades viven en `pages.properties`. Sí la del tipo de propiedad si la base lo
  comprueba (no lo hace hoy).

## Acciones e IA

- No hay acciones nuevas: `setPageProperties`, `createPages` (`crear_paginas`) y `editPage` (`editar_pagina`) aceptan
  el tipo `date`. La lectura de una página (`readPage`, `leer_pagina`) da la fecha con su texto y su forma
  `1250-Siega-18`; en el YAML de un cuerpo en Markdown, la fecha va en esa forma.
- La descripción de las herramientas que escriben propiedades dice el formato de las fechas y que, sin calendario, se
  usa el principal.

## Pruebas

- **Unitarias**: el esquema (`end` antes que `start`, `yearly` sin mes, día sin mes), la conversión del texto de la IA,
  el texto de un rango sin repetir lo común, ordenar una tabla por fecha.
- **Integración**: poner, cambiar y borrar una fecha por la API y por el MCP con texto; `BAD_DATE`; calendario de otro
  mundo; la búsqueda sigue funcionando con páginas con fecha; un campo «Oculto» de tipo fecha no le llega a un jugador
  (fugas); copiar una página copia sus fechas.
- **Web**: el selector (precisión, rango, cada año, sin calendario, en el móvil como hoja), el campo en el editor de
  plantillas, la fecha en una tabla.
- **E2E**: fechar una página desde el panel y verla en su panel y en una tabla.

## Límites

- Siempre: el calendario explícito en el valor; validar en el servidor; textos por i18n.
- Preguntar antes: cambiar cómo se buscan las propiedades (la función SQL de búsqueda).
- Nunca: horas; fechas de texto libre; leer `fc-date` u otros formatos heredados.

## Criterios de éxito

1. Una plantilla «Personaje» con los campos «Nacimiento» y «Muerte» (Fecha) crea páginas que la IA rellena con
   `editar_pagina` y `"-34-Siega-3"`; el panel las enseña como texto y una tabla de personajes ordena por nacimiento.
2. Un campo «Oculto» de tipo fecha no le llega a la jugadora por ninguna vía.
