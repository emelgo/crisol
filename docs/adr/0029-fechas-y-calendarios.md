# ADR-0029: Fechas año/mes/día con el mes por su id, día absoluto al leer y correspondencia entre calendarios

Estado: aceptada (módulo 8, capacidad `calendarios`; decisiones de Enrique tras el lienzo del 2026-11-16, en
`docs/specs/modulo-8.md`) · Estudio: `research/calendarios-y-lineas-temporales.md` (§ Respuestas 1 y 2).

## Contexto

Un mundo tiene uno o varios calendarios propios (meses, festividades, días fuera de la semana, bisiestos, eras, lunas,
estaciones), uno de ellos principal, y el máster los edita cuando quiere. Las fechas que vendrán (las de las páginas,
los eventos de las cronologías y el «hoy» de cada campaña) tienen que sobrevivir a esos cambios, ordenarse, describirse
(día de la semana, era, lunas) y, tras la decisión 10 de Enrique, **convertirse entre calendarios** del mismo mundo.

El Crisol antiguo guardaba año/mes/día con el mes por su posición (insertar un mes corría todas las fechas); Everlore,
una clave de orden derivada en la fila (vale porque su calendario no cambia).

## Decisión

1. **La fecha canónica es `{ year, month?, day? }`**: año entero (hay año 0 y años negativos), el **mes por su id
   estable** (corto y aleatorio, no se enseña) y el día desde 1. Lo que falta baja la precisión (año, mes o día). Cada
   fecha va con su calendario (`calendarId`), siempre explícito.
2. **El día absoluto (días desde el primero del año 0, negativo antes) se calcula al leer**, con la aritmética de
   `packages/domain/src/calendar/` (sin dependencias), y nunca se guarda. Ordenar, buscar por intervalo y medir
   distancias salen de él.
3. **Editar un calendario no reescribe ninguna fecha.** Insertar, renombrar o reordenar meses no toca nada (van por
   id). Quitar un mes con fechas se impide (`CALENDAR_MONTH_IN_USE`, dice cuántas) y borrar un calendario con fechas
   también (`CALENDAR_IN_USE`). Acortar un mes no reescribe: al leer, el día se recorta al último del mes. Quien
   cuenta las fechas en uso es una lista de fuentes (`apps/server/src/actions/calendar-dates.ts`) a la que `fechas`
   (las propiedades de las páginas) y `cronologias` (los eventos) añaden la suya.
4. **Correspondencia con el principal.** Un calendario que no es el principal puede llevar
   `correspondence: { calendarId, date }`: «el 1 del primer mes del año 0 de este calendario cae el `date` de
   `calendarId`» (al crearla, el principal). De ahí sale el desfase de cada calendario respecto al principal
   (siguiendo la cadena, con tope y sin ciclos), y convertir es pasar por el día absoluto del principal. Sin
   correspondencia, no se convierte (y lo que no se puede convertir se dice, no se adivina). Al **hacer principal** a
   uno que tenía correspondencia con el anterior, el anterior recibe la inversa: lo convertido sigue cuadrando.
5. **La definición es un `jsonb` validado** (zod en `packages/contracts/src/calendars.ts`, problemas por sección en
   `packages/domain`): el servidor no guarda una con problemas (`BAD_CALENDAR`, con la lista). Uno por mundo es el
   principal (índice único parcial); el servidor mantiene que haya uno si hay calendarios (el primero nace principal;
   el principal no se borra mientras haya otros).
6. **Cómo se cuentan los años**: seguidos, con el sufijo del calendario («1250 RC»), con año 0 y, antes del 0, el
   sufijo propio si lo hay («980 a. R.») o el número negativo («-980 RC»). Una era que **cuenta desde su inicio** numera
   sus años desde 1 (el año en que empieza es su año 1) con su abreviatura («34 ER»). Una era **solo del máster** no le
   llega a ningún jugador por la API, el tiempo real ni el MCP.

## Consecuencias

- No hay tabla derivada ni migración de datos al cambiar un calendario; calcular unos miles de fechas al leer cuesta
  milisegundos (prueba: 10.000 en menos de 50 ms).
- La IA escribe las fechas como `1250-Siega-18` (o `1250-03-18`, el mes por su número sin contar festividades); el
  servidor las lee contra el calendario y devuelve siempre la forma con el nombre del mes, que no cambia al reordenar.
- La correspondencia guarda a qué calendario se refiere, no solo «el principal»: cambiar de principal no la deja
  apuntando a otro sitio.
- Convertir una fecha de mes o de año da el día en que empieza (y, si abarca más, en el que acaba): un mes de un
  calendario no es un mes del otro.
