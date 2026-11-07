# Tareas: fichas

Spec: `docs/specs/fichas.md` · ADR-0018 · Diseño: lienzo «Crisol: la mesa», tableros Mesa, Pantalla y Combate (poner un
encuentro). El servidor se hizo a la vez que la web de `escenas`; la web de las fichas va después.

- [x] 1. Los estados con caducidad en lo de la partida (`play.conditions`, `addCondition`, `removeCondition`, `tickConditions`) y `condition` en `playCreature` y `playCharacter`
- [x] 2. La base de datos (migración 0056: `scene_tokens`, `encounters`) y los contratos (`placeTokens`, `moveTokens`, `updateToken`, `removeTokens`, encuentros; las fichas en la mesa y en la pantalla; el arrastre en vivo; la cámara «grupo»)
- [x] 3. El servidor: las acciones (en píxeles o en casillas), la proyección (lo vital leído del personaje o la criatura; la pantalla sin las ocultas ni números), el arrastre en vivo, refrescar la mesa cuando cambian criaturas o personajes, quitar las fichas al quitar las criaturas de juego (con deshacer)
- [x] 4. La IA: `poner_fichas`, `mover_fichas`, `cambiar_ficha`, `quitar_fichas`, los encuentros; los estados por `partida_criatura` y `partida_personaje`
- [x] 5. La web: las fichas en la mesa (pintarlas, arrastrarlas en vivo, Mayús pega, varias, flechas, Ctrl+Z), su tarjeta (vida, dañar y curar, estados, «Abrir hoja»), el panel (Personajes, Criaturas, En juego, Encuentros), «Guardar como encuentro», el creador de fichas (el encuadre redondo)
- [x] 6. La web: las fichas en la pantalla (estado en palabras, estados, el arrastre en vivo) y «Encuadrar al grupo»
- [ ] 7. E2E, fugas, documentación y revisión
