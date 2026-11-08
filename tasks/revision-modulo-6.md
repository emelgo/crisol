# Revisión del módulo 6 (2026-11-07)

Revisión de código de la rama `modulo-6/mesa` frente a `main` (un agente revisor, solo leyendo). Veredicto: **pedir
cambios**. La proyección de la pantalla está bien montada (campo a campo) y los permisos completos, pero hay fugas. Las
1 y 2 se comprobaron ejecutando `computeView`.

## Graves (fugas): arreglar antes del PR

- [x] 1. **La visión preparada y en caché no tiene en cuenta las puertas de cada campaña, y deshacer reutiliza
  versiones.** `apps/server/src/table/vision.ts:277` (clave `${scene.id}:${scene.version}:${state?.version}`),
  `vision-compute.ts:74` (`preparedFor` no mira `request.doors`), `vision.ts:267` (el `hash` de `results`). Dos campañas
  en la misma escena con su estado en la misma versión comparten lo preparado: la puerta secreta abierta en A se ve en
  la tele de B. Y en una sola: abrir la secreta, deshacer (vuelve la versión), abrir otra puerta: se reutiliza lo de la
  secreta (igual con muros). **Arreglo**: clave por contenido (la escena con `version` y `updatedAt`, y un hash de las
  puertas abiertas ordenadas), también en el `hash` de `results`; prueba con dos campañas en la misma escena y con
  deshacer.
  **Hecho** (c76e123): clave por contenido (`version` + `updatedAt` de la escena y las puertas abiertas de la campaña, en sha1) en lo preparado, en el `hash` de `results` y en `geometries`. Pruebas en `vision.integration.test.ts`: dos campañas, abrir-deshacer-abrir y poner-deshacer-poner muro (mirando o no entre medias).
- [x] 2. **Lo destapado a mano pasa a explorado para siempre.** `packages/tabletop/src/visible-for-party.ts:153`
  (`visible.union(revealed)`) y `vision-compute.ts:121-122` (`explored.union(view.visible)`). Destapar por error y
  deshacer deja la zona explorada. **Arreglo**: `partyView` devuelve aparte lo que ven las fichas; a lo explorado se
  suma solo eso. Prueba: deshacer un destapar.
  **Hecho** (381a395): `partyView` devuelve `sighted`; a lo explorado solo va eso (y los caminos). Pruebas: `visible-for-party.test.ts` y «lo destapado a mano no pasa a explorado» en `vision.integration.test.ts`.
- [x] 3. **El camino explorado es una recta que atraviesa muros.** `apps/server/src/table/projection.ts:332-356`
  (`walkedPaths`) y `vision-compute.ts:124-125`. **Arreglo**: cortar el camino en el primer muro que frena el paso o la
  vista (`movement.ts` con el índice), con su prueba. Y un tope de pasos por vista (con 2.200 tramos, 2,7 ms por paso:
  seis fichas por 30 casillas son 480 ms); un caso así en `test:rendimiento`.
  **Hecho** (2de6bdf): el hilo recibe los caminos y los corta con `firstWallOnPath` (núcleo) en el primer muro que frena el paso o la vista; como mucho 16 puntos por vista, repartidos (`MAX_WALK_STEPS`). Pruebas: `movement.test.ts`, `vision-compute.test.ts`, «una ficha que salta…» y, en `test:rendimiento`, seis fichas por 30 casillas (con la máquina cargada salió p50 66–82 ms y p95 108–158 ms, igual que el caso de una ficha, que también pasa de 100 con esa carga: casi todo es `moveTokens` de seis fichas, 45–85 ms; la visión, 15–25 ms tras calentar). Hay que medirlo con la máquina libre.
- [x] 4. **Deshacer no avisa a la mesa** de la niebla, las puertas, las marcas, los widgets, los muros, las luces ni la
  escena. `apps/server/src/actions/history.ts:74`. **Arreglo**: `scene_fog`, `scene_states`, `scene_marks`,
  `campaign_widgets`, `scene_snapshots` → `table.changed(campaign_id)`; `scenes`, `scene_walls`, `scene_lights` →
  `table.sceneChanged(scene_id)` y `vision.invalidate`. Prueba con la pantalla conectada tras deshacer.
  **Hecho** (b509624): `tellTables` en `history.ts` (campaña → `table.changed`; escena, muros, luces → `table.sceneChanged`, que invalida la visión). Prueba: «deshacer avisa a la mesa» en `tools.integration.test.ts`, con la pantalla y el máster conectados.

## Hay que arreglar

- [x] 5. Borrar la pestaña «Escena» se lleva en cascada, sin historial, fichas, marcas, instantáneas, teselas y lo
  explorado (`packages/db/src/repos/maps.ts:82`); deshacer la devuelve rota. Quitarlas en la operación y conservar las
  teselas mientras el historial pueda devolverla.
  **Hecho** (d4fc261): fichas, marcas e instantáneas al historial (y el combate se queda sin escena con historial); teselas y lo explorado sin clave ajena a la escena (migración 0062) y la purga diaria los recoge cuando el historial ya no puede devolverla. Pruebas: «quitar la pestaña…» en `vision.integration.test.ts` y la purga en `trash.test.ts`.
- [x] 6. `setSceneImage` admite un archivo de otro mundo de la organización (`apps/server/src/actions/scenes.ts:108`):
  la regla de `checkImage` (`table-tools.ts:92`).
  **Hecho** (a3820b4). Prueba en `table.integration.test.ts`.
- [x] 7. Carrera en la primera apertura (`scenes.ts:207-232`, `ensureSceneState`): `insert … on conflict do nothing
  returning` y poner lo preparado solo si esta llamada creó el estado.
  **Hecho** (67a87bf): `ensureSceneState` con cerrojo por campaña y escena y `created`; lo preparado solo si lo creó esta llamada. Prueba en `foundry-scenes.integration.test.ts` (abrir y presentar a la vez).
- [x] 8. Poner en juego y poner la ficha en operaciones distintas (`tokens.ts:177-190`, `placeEncounter`,
  `foundry-scenes.ts:496-532`): una sola operación.
  **Hecho** (1e39e31): `Newcomers` + `tokensRepo.placeTokens` (una operación: criaturas, fichas nuevas y movidas) en `placeTokens`, `placeEncounter` y `placePrepared`. Prueba en `tokens.integration.test.ts`.
- [x] 9. Las teselas de la pantalla, cuando la vista no está fresca, lanzan un `visionOf` cada una
  (`routes.ts:180`): una sola petición en curso por campaña y escena.
  **Hecho** (13d47ad). Prueba: `screen-tiles.integration.test.ts`.
- [x] 10. Memoria: `explored` y `pendingWalks` sin tope (`vision.ts:200`); `results` y `geometries` por orden de
  entrada; las teselas de versiones viejas no se borran nunca (recolector).
  **Hecho** (4b4a528 y d4fc261): `Lru` con tope por uso para la vista, lo explorado, los caminos y las escenas (prueba en `vision-memory.integration.test.ts` y `lru.test.ts`); el recolector de teselas viejas va en la purga diaria (prueba en `trash.test.ts`).

## Menores

- [x] Teselas en caché tras pasar de «enteras» a «recortadas» (`routes.ts:105`, `fog-paint.ts:241`): `no-store` si la
  cobertura es parcial, o el ajuste en la URL.
  **Hecho** (1f59d7e): la del borde que va entera sale con `no-store` (`edge`). Pruebas en `tiles.test.ts` y `vision.integration.test.ts`.
- [x] Carrera del arrastre (`rooms.ts:171-181`): vaciar `screenTokens`/`screenVisible` al llamar a `changed()`.
  **Hecho** (4fcc8e5). Prueba en `rooms.test.ts`.
- [x] `peek()` con una vista vieja (`vision.ts:333`): contador de generación por clave.
  **Hecho** (2d66e7e): contadores de cambios por campaña y escena; `visionOf` los toma antes de leer las fichas. Prueba en `vision-memory.integration.test.ts`.
- [x] Marcas miradas solo por su punto (`marks.ts:97-98`): pueden asomar en la niebla.
  **Hecho** (e788f0c): se mira su huella entera. Pruebas en `marks.test.ts` y `tools.integration.test.ts`.
- [x] El encuadre del máster se reenvía aunque la escena abierta no sea la presentada (`rooms.ts:164-170`).
  **Hecho** (4fcc8e5). Prueba en `rooms.test.ts`. La web enseña «Siguiendo» aunque la abierta no sea la presentada (`mesa.tsx`): conviene que lo mire.
- [x] Máster de campaña que no lo es del mundo: no puede usar la mesa (`page.read` en escenas, encuentros, teselas).
  **No hace falta**: Enrique decidió (2026-11-08) que el máster de una campaña es siempre máster de su mundo, y ya se
  cumple (solo el máster del mundo crea campañas y queda como su máster).
- [x] Restricción única en `scene_tokens` por (campaña, escena, personaje o criatura).
  **Ya estaba**: `unique()` en (campaña, escena, personaje) y (campaña, escena, criatura) en el esquema; además `store` no pide dos veces la misma.
- [ ] `catch` solo con comentario (`vision-compute.ts:108`, `charactersContext(...).catch(() => null)`): al registro.
  **Sin hacer**: el `ActionContext` no tiene registro donde mandarlo (haría falta un `ctx.log`); el de `vision-compute` es lo explorado dañado (se empieza de cero, a propósito). Apuntado.
- [x] `svgProblem` es una lista negra (`<svg:script>`); lo frena el CSP `sandbox`, pero mejor una lista blanca.
  **Hecho** (31cb7fd): lista blanca de etiquetas además de lo prohibido. Prueba en `svg.test.ts`.
- [x] La sala: una cola para todas las campañas y sin agrupar cambios seguidos (`rooms.ts:89`).
  **Hecho**: una cola por campaña y los cambios seguidos se juntan en una vuelta. Prueba en `rooms.test.ts`.

## Añadido después

- [x] Volver a una instantánea creaba las fichas con ids nuevos (`restoreSnapshot`): el combate y lo elegido se quedaban
  colgando. **Hecho** (bc6fa4c): la que sigue se cambia y la que se quitó vuelve con su id. Prueba en
  `tools.integration.test.ts`.

## Bien (comprobado)

El WebSocket (origen, sesión, `table.manage` al entrar y cada 60 s; lo en vivo solo del máster, con topes); la
proyección de la pantalla campo a campo (sin muros, puertas, página, PG ni iniciativa de criaturas; fichas, combate,
luces y marcas filtradas); las rutas de teselas; los permisos de cada acción y de lo que nombra; las licencias de
`pixi.js` (MIT) y `@jsquash/webp` (Apache-2.0).
