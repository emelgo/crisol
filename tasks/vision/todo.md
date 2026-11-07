# Tareas: vision

Spec: `docs/specs/vision.md` · ADR-0018 (puntos 4 a 7 y 12) · Diseño: lienzo «Crisol: la mesa», tablero Visión.

- [x] 1. El núcleo en `packages/tabletop` (muros y puertas, índice espacial, polígono de visión, luz, visión del grupo con sentidos, niebla a mano, rejilla de bits con RLE, paso entre muros, `visibleForParty`); rendimiento: p95 de 31–49 ms con 6 fichas, 20 luces y ~2.500 tramos (`test:rendimiento`)
- [x] 2. La base de datos y los contratos: muros, puertas y luces de la escena; el estado de las puertas, lo explorado (bits) y la niebla a mano de cada campaña; la oscuridad; «sin visión automática»; el ajuste de las teselas (enteras o recortadas)
- [x] 3. El servidor: el editor (acciones), poner en juego lo traído de un UVTT o de la IA (uniendo colineales), los sentidos del personaje, la vista del grupo en un hilo de trabajo con su caché por campaña y escena, recalcular al soltar (y en el camino), al abrir una puerta y al cambiar la luz; la proyección de la pantalla (máscara, fichas vistas, luces recortadas, teselas permitidas, recortadas si toca); las reglas de las puertas y del paso
- [x] 4. La IA: `ver_muros`, `cambiar_muros`, `abrir_puerta`, `niebla`, `ver_como_grupo`, `oscuridad`
- [ ] 5. La web: el editor de muros, puertas y luces; la niebla a mano; «Ver como el grupo»; abrir puertas con un clic; la pantalla con la niebla (lo explorado en gris, suavizado)
- [ ] 6. Fugas, rendimiento en el servidor, E2E y revisión (hechas la de fugas y la de rendimiento del servidor, en
  `apps/server/src/table/vision.integration.test.ts`; faltan la E2E, la de fugas e2e con la pantalla y la revisión)
