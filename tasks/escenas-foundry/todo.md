# Tareas: escenas-foundry

Spec: `docs/specs/escenas-foundry.md` · ADR-0014 y ADR-0018 · Estudio: `research/foundry/escenas-fichas-y-combate.md` § 6.

- [x] 1. El núcleo (`packages/systems/src/foundry/scene.ts`): una escena de la v9 a la v14 a lo de Crisol, sin el
  margen ni el desplazamiento del fondo; las cuatro hexagonales a las dos nuestras con su desplazamiento (y las de
  antes de la v10); muros con sus restricciones y su sentido, puertas (normal, secreta, con llave, abierta), luces
  (oscuridad, cono, encendido según la oscuridad), oscuridad y luz global, fichas (centro, tamaño, oculta, bando, la
  única) y notas; una escena por planta (v14); las aventuras; el origen de un actor
- [x] 2. Leer el zip a más profundidad (`apps/server/src/foundry/read.ts`): lo de dentro a dos y tres niveles, el delta
  como pieza única, y los paquetes de escenas y aventuras
- [x] 3. La base de datos (migración 0060): las criaturas preparadas y los pines de la escena; de dónde salió lo traído
- [x] 4. Los contratos y el servidor: `inspectFoundryScenes` e `importFoundryScenes` (páginas con su pestaña «Escena»,
  los diarios de una aventura, reimportar sin duplicar); al abrir la escena una campaña por primera vez, sus criaturas
  preparadas en juego y en el mapa y sus pines como marcas del máster; `ver_escena` dice sus preparadas. Prueba:
  `apps/server/src/actions/foundry-scenes.integration.test.ts`
- [x] 5. La web: en «Sistema nuevo», las escenas y aventuras del zip con su miniatura, el mundo y la página donde van;
  cada mapa sacado del zip y troceado a las medidas de la escena (liso si no viene); lo traído. E2E
  `e2e/tests/escenas-foundry.spec.ts`; capturas `out/capturas/foundry-*.png`
- [ ] 6. Los actores de una aventura al compendio del mundo, si el máster lo pide (convertirlos a los tipos del
  sistema del mundo)
- [ ] 7. Los zips de un mundo (`world.json`) y leer el zip por partes (las aventuras de más de un giga)
- [ ] 8. El delta de las fichas (sus PG y sus efectos de partida) y las fichas sin criatura, como marcadores con su
  imagen
- [ ] 9. Los pines de la escena, también en su pestaña de la wiki
- [ ] 10. Revisión (accesibilidad del cuadro con axe, un zip grande de verdad)
