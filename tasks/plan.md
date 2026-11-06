# Plan: Módulo 4 — criaturas

Estado: en marcha (2026-11-06). Spec: `docs/specs/criaturas.md` · Mapa del módulo: `docs/specs/modulo-4.md` · Diseño:
lienzo «Crisol: compendio y criaturas» (tableros Criatura, En juego, Wiki y Móvil; fuentes en `out/lienzo-compendio/`)
· Tareas: `tasks/todo.md`. El plan anterior, en `tasks/compendio-mundo/`.

## Cómo

- **Una criatura en juego es una fila de la campaña** (`campaign_creatures`): la clave de su entrada del compendio
  (del sistema o del mundo, por las capas de `compendio-mundo`), su nombre, su número de copia, si es única y lo de la
  partida (`play`, la misma forma que la de un personaje). Su hoja es la entrada calculada con eso encima: si el máster
  cambia la entrada, las copias lo notan salvo en lo que ya tocaron.
- **El mismo motor que la hoja de personaje**: `creatureView` en `@crisol/systems` monta el documento de la entrada
  (sus datos, su mecánica y lo que lleva), le pone lo de la partida (`withPlay`), lo calcula (`evaluate`, `actionsOf`)
  y devuelve la misma forma que `characterView` (sin el creador). Así la web pinta la criatura con los bloques de la
  hoja y el servidor tira con `tryRoll` y `tryAction`, y aplica daño y descansos con `changeResource`, `spend` y `rest`.
- **Lo que el formato aún no dice** (ampliación pequeña de ADR-0011, en la spec de `sistemas`): la hoja de cada tipo de
  actor (`types[t].sheet`; la del sistema sigue siendo la del personaje), cómo se tiran los PG de una criatura
  (`roll` en un campo recurso: `@dados_golpe`) y qué campos son sus resistencias, inmunidades y vulnerabilidades
  (`damage` en el tipo), para aplicar daño.
- **Hasta el módulo 5, solo el máster**: las criaturas en juego, sus avisos en tiempo real y sus tiradas (ocultas por
  defecto). La prueba de fugas lo comprueba.

## Riesgos

- `characterView` está pensada para personajes (pasos del creador, nivel): separar lo común sin romper la hoja.
- Aplicar daño a personajes desde el registro toca `playCharacter`: los permisos (el máster sí; un jugador, solo a los
  suyos) y el tiempo real.
- El enlace desde la wiki (`[[@…]]`) toca el editor, el Markdown y la resolución de enlaces: va al final y puede ir
  en una tanda aparte.

## Puntos de control

1. Tras la tarea 4: poner en juego por la API tres goblins y un jefe, dañarlos y tirar por ellos.
2. Tras la 6: el flujo en la web (poner en juego, «En juego», la hoja, aplicar desde el registro).
3. Tras la 9: e2e, fugas, la IA y `tasks/probar.md`.
