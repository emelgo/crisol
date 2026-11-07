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

## Construido (2026-11-07) y lo que queda

El servidor, en la rama `modulo-6/mesa` (`tasks/combate/todo.md`); la web va después.

- **Núcleo** (`packages/tabletop/src/initiative.ts`, portado de la mesa actual): el orden (iniciativa, modificador, a
  mano y, a igualdad de todo, el nombre), los grupos (un turno), pasar turno y ronda hacia delante y hacia atrás,
  saltar a quien está a 0 y de quién es el turno al sacar a alguien.
- **El sistema marca su tirada de iniciativa** con `initiative` (su clave en `rolls`; el 5e de ejemplo, `iniciativa`).
  Si no marca ninguna, vale la que se llame `iniciativa` o `initiative`; sin ella, se escribe a mano. Validar dice si
  la marcada no existe o va «por cada uno».
- **Al empezar un turno** (`startTurn` en `@crisol/systems`): los estados con rondas pierden una y se van los de cero;
  cada acción con recarga gastada tira su d6 y vuelve con lo que pide; lo que gastan las acciones legendarias
  (`activation: legendary`, su `uses`) se repone. A los personajes, solo los estados. Todo en la misma operación que
  pasa el turno: deshacerlo lo devuelve.
- **La recarga gastada** va con lo gastado de quien la lleva, con su marca (`uses[''][recarga:aliento]`). Tirar una
  parte de una acción con recarga la deja gastada; `playCreature` con `spend` (by 1 o −1) la gasta o la recarga a mano.
- **Base de datos** (migración 0057): `combats` (uno por campaña: escena, ronda, turno, saltar a los de 0) y
  `combatants` (el personaje o la criatura, su iniciativa, su modificador, su grupo, su orden a mano), con historial.
  Quitar criaturas de juego o borrar un personaje los saca también del combate (y de sus fichas), en su operación.
- **Acciones**: `getCombat`, `startCombat` (unas fichas o todas las de la escena abierta; las copias, en grupo),
  `addCombatants`, `removeCombatants`, `rollInitiative` (todos, las criaturas, los que no la tienen o unos; un grupo
  tira una vez; al registro, ocultas las de las criaturas), `setInitiative`, `orderCombatants`, `groupCombatants`,
  `updateCombat`, `nextTurn` (dice qué caducó, qué se recargó y qué se repuso), `previousTurn` y `endCombat` (las
  copias a 0, todas o ninguna, con sus fichas, en una operación que se deshace). Todo con `table.manage`.
- **La proyección**: el combate en la mesa del máster (`combat` en `campaignTableView`) y la franja en la pantalla
  (`combat` en `screenView`: la ronda, el orden y de quién es el turno, sin los ocultos, sin vida y sin la iniciativa de
  las criaturas; nada si la pantalla está oculta). Deshacer refresca la mesa de la campaña.
- **La IA**: `empezar_combate`, `ver_combate`, `meter_en_combate`, `sacar_de_combate`, `tirar_iniciativa`,
  `escribir_iniciativa`, `siguiente_turno`, `turno_anterior` y `acabar_combate`.
- **Pruebas**: el núcleo, `startTurn` y la tirada del sistema; `apps/server/src/table/combat.integration.test.ts` (el
  encuentro de goblins con la tirada del sistema y dos rondas, deshacer el paso de turno, saltar a los de 0 y acabar
  con deshacer, las recargas y las legendarias, la pantalla, el sistema sin tirada, el jugador que no puede nada).

Decisiones tomadas sin Enrique (por confirmar al verlas): la ronda 0 es «antes de empezar» (se tira y el primer
«Siguiente» empieza la 1, como en Foundry); escribir la iniciativa de uno de un grupo la escribe a todo el grupo, y
juntar en grupo les da la del primero; la tirada del d6 de la recarga no va al registro (lo dice `nextTurn`); un
personaje a medio crear (sin vida máxima) no cuenta como fuera de combate.

**La web (2026-11-07)**, en `apps/web/src/tabletop/` (y su e2e, `e2e/tests/combate.spec.ts`):

- **Empezar**: «Combate» en la barra de arriba de la mesa, con las fichas elegidas o, sin ninguna, con todas las de la
  escena. Mientras dura, el panel de la mesa es el del combate (con un botón para ir al de siempre y volver).
- **El panel del combate** (`combat-panel.tsx`, como el tablero Combate): la ronda («Sin empezar» en la 0), «Anterior»
  y «Siguiente turno» («Primer turno» en la 0), el dado de la iniciativa (de todos, de las criaturas o de los que
  faltan), el orden con la iniciativa de cada uno escrita en su casilla, su vida y sus estados; los empates se
  arrastran (o Alt y las flechas en su casilla); juntar las fichas elegidas en un grupo o separar a uno; sacar a
  alguien y meter las elegidas que faltan; «Saltar derrotados»; «Acabar combate», que confirma y dice qué copias se van
  (las de 0 PG, todas o ninguna).
- **El aviso del turno**: al pasar, una línea breve con de quién es, qué caducó, qué se recargó y qué se repuso, que se
  va sola.
- **El turno en la ficha**: un aro dorado en la mesa y en la tele; la mesa se centra en ella si no se ve, y elegir a
  alguien en la lista la centra siempre.
- **El daño a varias** (`group-damage.tsx`): con varias fichas elegidas, una barra abajo con una cantidad (daño o
  curación) para todas o una tirada del registro (`applyRoll`) con nada, mitad, entero o doble para cada una.
- **La franja de la tele**: abajo, «Ronda N», los discos en su orden (el del turno, más grande y dorado; los
  derrotados, apagados) y «Turno de X».
- **`campaignTableView.combat`**, obligatorio en el contrato (con su prueba).

Decisiones tomadas al construirla (por confirmar al verlas): «Combate» va en la barra de arriba (la columna de
herramientas aún no existe); con varias fichas elegidas, la barra del daño sustituye a la tarjeta; la mesa solo se
centra sola en el turno si su ficha no se ve.

Queda:
- con `vision`, que la franja quite también las criaturas que el grupo no ve (hoy, solo las ocultas);
- el daño a varias desde la mesa (las de dentro de una plantilla, con `herramientas-mesa`; `applyRoll` ya lo hace);
- E2E y la prueba de fugas (la franja no lleva ocultas, vida ni iniciativa de criaturas);
- en la IA, juntar o separar grupos, el orden a mano y saltar a los de 0 (están en la API).
