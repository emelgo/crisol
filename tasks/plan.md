# Plan: Módulo 6 — escenas

Estado: en marcha (2026-11-07). Spec: `docs/specs/escenas.md` · ADR-0018 · Mapa: `docs/specs/modulo-6.md` · Diseño:
lienzo «Crisol: la mesa» (`out/lienzo-mesa/`, en marcha) · Tareas: `tasks/todo.md`. Los planes anteriores, en
`tasks/<capacidad>/`.

## Cómo

- **`packages/tabletop`** (nuevo, TypeScript puro, sin DOM ni PixiJS): la rejilla (cuadrada y hexagonal, por filas o
  por columnas), alinear por dos esquinas, detectar la rejilla en una imagen (sobre un buffer de píxeles, no un
  canvas), las cámaras (encuadrar, seguir, fija) y el troceado en teselas (cuántas, qué niveles, cuáles tocan un
  rectángulo). Portado de `~/CrisolVTT/crisol/packages/mesa/src/nucleo` (`rejilla.ts`, `alineacion.ts`,
  `deteccion.ts`, `estiramiento.ts`, `camara.ts`, `camaraJugadores.ts`) con sus pruebas, identificadores en inglés y
  una cabecera «Portado de … (Crisol actual, 3f68f11)».
- **Base de datos** (migración 0055): `page_tabs.kind` admite `scene`; `scenes` (la pestaña, la imagen: ancho, alto,
  tamaño de tesela, niveles y versión de las teselas, o nada si aún no se ha troceado; el archivo original si lo hay;
  la rejilla y la vista inicial en JSONB; lo traído del UVTT, aparte, para `vision`); `campaign_tables` (la escena
  abierta y la presentada, si la pantalla está oculta, la cámara); `scene_states` (una por campaña y escena, de momento
  solo su existencia y su versión). Todo con `world_id`, en el historial.
- **Teselas**: se guardan con la interfaz de almacenamiento (`scenes/<id>/<versión>/<nivel>/<x>_<y>.webp`), no como
  archivos del mundo. Se suben en tandas a una ruta propia (solo quien lleva la wiki) y se piden por otra que mira la
  vista: el máster, todas; la pantalla, las que deja pasar la proyección (de momento, todas).
- **Contratos y acciones**: `listScenes`, `getScene`, `createScene` (pestaña + escena, con o sin imagen), `updateScene`
  (rejilla, vista inicial, nombre), `setSceneImage` (tras subir las teselas), `getCampaignTable`, `openScene`,
  `presentScene`, `hideScreen`, `setScreenCamera`. Las de la mesa también entran por el WebSocket.
- **La sala** (`apps/server/src/table/`): un registro de salas por campaña; cada conexión dice quién mira («máster» o
  «grupo»); al entrar, el estado de la mesa; después, diferencias. El máster manda comandos (los de arriba) y su
  encuadre en vivo, que con «Seguir» se reenvía a la pantalla sin guardarse. Un jugador, rechazado. Contrato zod en
  `@crisol/contracts` (`table.ts`).
- **Web**: la pestaña «Escena» (elegir la imagen, trocearla en un Web Worker con `OffscreenCanvas` → WebP, subirla con
  su progreso; la rejilla y alinearla; «Abrir en la mesa»); la ruta `campaigns/$id/mesa` con PixiJS 8 (teselas por
  nivel según el zoom, la rejilla, moverse y acercar, el panel «Escenas», «Presentar», «Ocultar», «Pantalla», la
  cámara y el marco de la tele); la ruta `campaigns/$id/pantalla` (la vista del grupo, fundido, oculta, pantalla
  completa, reconectar).
- **UVTT**: el navegador lee el JSON, saca la imagen y la trocea; la rejilla sale de `pixels_per_grid` y `map_origin`;
  muros, portales y luces se guardan en la escena (en píxeles), con las trampas de `research/uvtt/formato.md`.
- **IA**: `ver_escenas`, `ver_escena`, `crear_escena`, `cambiar_escena`, `ver_mesa`, `abrir_escena`,
  `presentar_escena`, `ocultar_pantalla`. Una escena sin teselas se trocea la primera vez que el máster la abre.

## Puntos de control

1. Tras el servidor: en una prueba, el máster abre una escena y la presenta por el WebSocket; la pantalla recibe el
   estado y lo sigue; un jugador no entra ni pide teselas.
2. Tras la web: en local, crear una escena con una imagen, alinear la rejilla, abrirla, presentarla en otra ventana y
   moverla siguiendo al máster.
3. Al final: e2e, fugas, accesibilidad, rendimiento de un mapa grande, revisión.
