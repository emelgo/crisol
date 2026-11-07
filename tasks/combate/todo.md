# Tareas: combate

Spec: `docs/specs/combate.md` · ADR-0018 (punto 10) · Diseño: lienzo «Crisol: la mesa», tablero Combate y la franja
de turnos de la Pantalla. El servidor va antes que la web.

- [x] 1. El núcleo: el orden de iniciativa (empates por el modificador y a mano), los grupos, saltar a los de 0, pasar turno y ronda (y volver), quitar a quien tiene el turno (`packages/tabletop/src/initiative.ts`)
- [x] 2. El sistema: su tirada de iniciativa (`initiative`, el 5e de ejemplo) y empezar un turno (`startTurn`: estados, recargas, legendarias; la recarga gastada en lo de la partida)
- [x] 3. La base de datos (migración 0057: `combats`, `combatants`) y los contratos (empezar, meter y sacar, tirar y escribir la iniciativa, el orden, los grupos, siguiente y anterior, acabar; el combate en la mesa y la franja en la pantalla)
- [x] 4. El servidor: las acciones, la caducidad y las recargas en la misma operación que pasa el turno, acabar con deshacer, la proyección (la pantalla sin ocultas ni números), refrescar la mesa al deshacer
- [x] 5. La IA: `empezar_combate`, `ver_combate`, `meter_en_combate`, `sacar_de_combate`, `tirar_iniciativa`, `escribir_iniciativa`, `siguiente_turno`, `turno_anterior`, `acabar_combate`
- [x] 6. La web: el tablero Combate en la mesa (empezar, tirar, escribir, arrastrar los empates, siguiente y anterior, acabar), la marca del turno en la ficha y centrar en ella, el aviso de lo que caducó
- [x] 7. La web: la franja de turnos en la pantalla
- [ ] 8. E2E (los tres goblins y el jefe: tirar, dos rondas, dañar a dos, acabar), fugas, documentación y revisión
