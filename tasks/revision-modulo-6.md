# Revisión del módulo 6 (2026-11-07)

Revisión de código de la rama `modulo-6/mesa` frente a `main` (un agente revisor, solo leyendo). Veredicto: **pedir
cambios**. La proyección de la pantalla está bien montada (campo a campo) y los permisos completos, pero hay fugas. Las
1 y 2 se comprobaron ejecutando `computeView`.

## Graves (fugas): arreglar antes del PR

- [ ] 1. **La visión preparada y en caché no tiene en cuenta las puertas de cada campaña, y deshacer reutiliza
  versiones.** `apps/server/src/table/vision.ts:277` (clave `${scene.id}:${scene.version}:${state?.version}`),
  `vision-compute.ts:74` (`preparedFor` no mira `request.doors`), `vision.ts:267` (el `hash` de `results`). Dos campañas
  en la misma escena con su estado en la misma versión comparten lo preparado: la puerta secreta abierta en A se ve en
  la tele de B. Y en una sola: abrir la secreta, deshacer (vuelve la versión), abrir otra puerta: se reutiliza lo de la
  secreta (igual con muros). **Arreglo**: clave por contenido (la escena con `version` y `updatedAt`, y un hash de las
  puertas abiertas ordenadas), también en el `hash` de `results`; prueba con dos campañas en la misma escena y con
  deshacer.
- [ ] 2. **Lo destapado a mano pasa a explorado para siempre.** `packages/tabletop/src/visible-for-party.ts:153`
  (`visible.union(revealed)`) y `vision-compute.ts:121-122` (`explored.union(view.visible)`). Destapar por error y
  deshacer deja la zona explorada. **Arreglo**: `partyView` devuelve aparte lo que ven las fichas; a lo explorado se
  suma solo eso. Prueba: deshacer un destapar.
- [ ] 3. **El camino explorado es una recta que atraviesa muros.** `apps/server/src/table/projection.ts:332-356`
  (`walkedPaths`) y `vision-compute.ts:124-125`. **Arreglo**: cortar el camino en el primer muro que frena el paso o la
  vista (`movement.ts` con el índice), con su prueba. Y un tope de pasos por vista (con 2.200 tramos, 2,7 ms por paso:
  seis fichas por 30 casillas son 480 ms); un caso así en `test:rendimiento`.
- [ ] 4. **Deshacer no avisa a la mesa** de la niebla, las puertas, las marcas, los widgets, los muros, las luces ni la
  escena. `apps/server/src/actions/history.ts:74`. **Arreglo**: `scene_fog`, `scene_states`, `scene_marks`,
  `campaign_widgets`, `scene_snapshots` → `table.changed(campaign_id)`; `scenes`, `scene_walls`, `scene_lights` →
  `table.sceneChanged(scene_id)` y `vision.invalidate`. Prueba con la pantalla conectada tras deshacer.

## Hay que arreglar

- [ ] 5. Borrar la pestaña «Escena» se lleva en cascada, sin historial, fichas, marcas, instantáneas, teselas y lo
  explorado (`packages/db/src/repos/maps.ts:82`); deshacer la devuelve rota. Quitarlas en la operación y conservar las
  teselas mientras el historial pueda devolverla.
- [ ] 6. `setSceneImage` admite un archivo de otro mundo de la organización (`apps/server/src/actions/scenes.ts:108`):
  la regla de `checkImage` (`table-tools.ts:92`).
- [ ] 7. Carrera en la primera apertura (`scenes.ts:207-232`, `ensureSceneState`): `insert … on conflict do nothing
  returning` y poner lo preparado solo si esta llamada creó el estado.
- [ ] 8. Poner en juego y poner la ficha en operaciones distintas (`tokens.ts:177-190`, `placeEncounter`,
  `foundry-scenes.ts:496-532`): una sola operación.
- [ ] 9. Las teselas de la pantalla, cuando la vista no está fresca, lanzan un `visionOf` cada una
  (`routes.ts:180`): una sola petición en curso por campaña y escena.
- [ ] 10. Memoria: `explored` y `pendingWalks` sin tope (`vision.ts:200`); `results` y `geometries` por orden de
  entrada; las teselas de versiones viejas no se borran nunca (recolector).

## Menores

- [ ] Teselas en caché tras pasar de «enteras» a «recortadas» (`routes.ts:105`, `fog-paint.ts:241`): `no-store` si la
  cobertura es parcial, o el ajuste en la URL.
- [ ] Carrera del arrastre (`rooms.ts:171-181`): vaciar `screenTokens`/`screenVisible` al llamar a `changed()`.
- [ ] `peek()` con una vista vieja (`vision.ts:333`): contador de generación por clave.
- [ ] Marcas miradas solo por su punto (`marks.ts:97-98`): pueden asomar en la niebla.
- [ ] El encuadre del máster se reenvía aunque la escena abierta no sea la presentada (`rooms.ts:164-170`).
- [ ] Máster de campaña que no lo es del mundo: no puede usar la mesa (`page.read` en escenas, encuentros, teselas).
- [ ] Restricción única en `scene_tokens` por (campaña, escena, personaje o criatura).
- [ ] `catch` solo con comentario (`vision-compute.ts:108`, `charactersContext(...).catch(() => null)`): al registro.
- [ ] `svgProblem` es una lista negra (`<svg:script>`); lo frena el CSP `sandbox`, pero mejor una lista blanca.
- [ ] La sala: una cola para todas las campañas y sin agrupar cambios seguidos (`rooms.ts:89`).

## Bien (comprobado)

El WebSocket (origen, sesión, `table.manage` al entrar y cada 60 s; lo en vivo solo del máster, con topes); la
proyección de la pantalla campo a campo (sin muros, puertas, página, PG ni iniciativa de criaturas; fichas, combate,
luces y marcas filtradas); las rutas de teselas; los permisos de cada acción y de lo que nombra; las licencias de
`pixi.js` (MIT) y `@jsquash/webp` (Apache-2.0).
