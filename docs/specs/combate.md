# Spec: combate (módulo 6)

Estado: **spec** (2026-11-07). Cuarta capacidad del módulo 6 (`docs/specs/modulo-6.md`), después de `vision`.
Entrevista: `docs/modulos.md` § «### 6. Mesa» («como en foundry o dndbeyond»). ADR-0018 (punto 10). Estudios:
`research/foundry/escenas-fichas-y-combate.md` (combate, combatientes, iniciativa de dnd5e, caducidad, plantillas),
`research/dndbeyond/mapas.md` (la iniciativa desde la hoja); lo que se porta, `docs/mesa-crisol-actual.md`
(`nucleo/iniciativa.ts`, `nucleo/plantillas.ts`). Diseño: el lienzo «Crisol: la mesa», tablero Combate (y la franja de
turnos de la Pantalla).

## Objetivo

Llevar un combate entero desde la mesa: la iniciativa, los turnos y las rondas, el daño a varias fichas a la vez y el
final, con los estados que caducan solos. **Los turnos los lleva el servidor**: no dependen de ninguna pestaña.

Para quién: el máster; la tele (la franja de turnos); la IA.

## Requisitos

- **Empezar un combate** en la escena abierta: con las fichas elegidas o con todas las de la escena. Un combate por
  campaña a la vez.
- **La iniciativa**: «Tirar» para todas, para las criaturas o para una; la fórmula sale del sistema de la campaña (una
  tirada que el sistema marque como iniciativa; sin ella, se escribe el número). Los jugadores pueden decir la suya: el
  máster la escribe. Las copias de una misma criatura tiran juntas si se quiere (un solo turno para el grupo de
  goblins), como en dnd5e.
- **Turnos y rondas**: el orden por iniciativa (los empates, por el modificador y luego a mano: se arrastran);
  «Siguiente» y «Anterior»; «Ronda N» y «Turno de X»; saltar a quien está fuera de combate (a 0 PG) si se quiere.
  **De quién es el turno** se marca en su ficha (en la mesa y en la tele) y la mesa puede centrarse en ella.
- **La caducidad, en el servidor**: al empezar el turno de alguien, sus estados con rondas pierden una y se van los que
  llegan a cero (con un aviso al máster). Las recargas de una criatura («Recargar 5–6») se tiran solas al empezar su
  turno, y sus acciones legendarias se reponen.
- **El daño a varias**: elegir fichas (o las de dentro de una plantilla) y aplicar un daño o una curación, o una tirada
  del registro con nada, mitad, entero o doble a cada una y sus resistencias (lo de «Aplicar» del módulo 4, desde la
  mesa).
- **Acabar el combate**: confirma y dice qué genéricas se van; quita de juego las genéricas a 0 PG (o todas las
  genéricas, a elegir) y sus fichas, en una operación que se deshace.
- **En la tele**: la franja de turnos abajo con «Ronda N» y «Turno de X»; las criaturas ocultas o fuera de la vista del
  grupo no salen en ella.
- **La IA**: `empezar_combate`, `ver_combate`, `tirar_iniciativa`, `siguiente_turno`, `acabar_combate`; el daño a
  varias con `aplicar_tirada` y `partida_criatura`.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Un combate por campaña**, en la escena abierta; cambiar de escena no lo acaba.
2. **Las copias de una criatura tiran juntas por defecto** (como dnd5e), y se pueden separar.
3. **La caducidad cuenta rondas al empezar el turno de quien lleva el estado** (lo más común en 5e); la regla de «al
   final del turno» o «en el turno de quien lo lanzó», más adelante si hace falta.
4. **Acabar quita las genéricas a 0 PG** por defecto, como pidió Enrique en el módulo 4 («las genéricas se van al
   acabar»); las que siguen en pie se pueden quitar también.

## Pruebas

- **Núcleo**: el orden de iniciativa (empates, grupos, saltar a los derrotados), pasar turno y ronda.
- **Integración**: empezar, tirar con la fórmula del sistema, pasar turnos (la caducidad y las recargas en el servidor),
  aplicar a varias, acabar y deshacer; la tele no ve a las ocultas en la franja; las herramientas MCP.
- **E2E**: el encuentro de los tres goblins y el jefe: tirar iniciativa, pasar dos rondas (un estado de una ronda se va
  solo), dañar a dos goblins de una vez, acabar.

## Fuera

Las plantillas de área en sí (`herramientas-mesa`; aquí solo «las de dentro» para aplicar el daño); el movimiento por
turnos de los jugadores (módulo 7); las acciones preparadas y las reacciones como recurso aparte.
