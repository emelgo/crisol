# Spec: vision (módulo 6)

Estado: **servidor y web construidos** (2026-11-07; faltan la prueba de fugas e2e con la pantalla y la revisión). Tercera capacidad del módulo 6 (`docs/specs/modulo-6.md`), después de `fichas`.
Entrevista: `docs/modulos.md` § «### 6. Mesa». ADR-0018 (puntos 4 a 7 y 12). Estudios:
`research/foundry/vision-muros-y-niebla.md` (muros, puertas, luces, visión, niebla, rendimiento) y
`research/uvtt/formato.md`; lo que se porta, `docs/mesa-crisol-actual.md` (§ 3: `vision.ts`, `luz.ts`,
`visionJugadores.ts`, `visionAlSoltar.ts`, `niebla.ts`, `movimiento.ts`; § 8, el rendimiento). Diseño: el lienzo
«Crisol: la mesa», tablero Visión.

## Objetivo

Que la pantalla de la tele enseñe **solo lo que ve el grupo**: la niebla se descubre sola con lo que ven las fichas
del grupo (con muros, puertas y luces) y el máster destapa o tapa a mano. **A la pantalla no le llega nada que el grupo
no vea**: lo calcula el servidor.

Para quién: el máster; la tele; la IA.

## Requisitos

### Muros, puertas y luces (de la escena, en el mundo)

- **Muros**, cada tramo con lo que tapa: la vista, la luz y el paso (y el sonido, para el módulo 7), cada uno con
  «nada», «limitado» (el primero deja pasar; el segundo no) o «del todo»; de un solo sentido si se quiere. Tipos ya
  hechos: muro, muro bajo (deja ver por encima), invisible (tapa el paso, no la vista), ventana (deja ver, no pasar),
  objeto (lo que trae un UVTT como «objetos que tapan»).
- **Puertas**: normales, **secretas** (para el grupo son muro hasta que el máster las abre; entonces se ve el hueco,
  nunca que era secreta) y **con llave**; cerradas o abiertas como se dibujaron.
- **Luces**: radio brillante y tenue (en pies), color, intensidad, ángulo (un cono), si las cortan los muros; y la
  **oscuridad** de la escena (de día a noche cerrada) con su luz ambiental. Oscuridad mágica: tapa la vista salvo a la
  vista verdadera o ciega.
- **El editor**, en la mesa del máster (tablero Visión): dibujar muros encadenados (clic a clic; Mayús pega a las
  esquinas de la rejilla), puertas y luces; elegir, mover sus extremos y borrar; cambiar el tipo. Lo que traen un UVTT
  y los mapas que dibuja la IA se pone en juego al abrir la escena (con «Poner los muros del mapa» si ya tenía otros).

### La visión de las fichas

- Cada ficha del grupo (los personajes de la campaña en la escena) ve: lo que alcanza su vista y está en su línea de
  visión (los muros la cortan), lo iluminado dentro de su línea de visión y, con visión en la oscuridad, hasta su
  alcance en penumbra. Los sentidos salen del personaje (su sistema dice dónde: un campo de sentidos o de visión en la
  oscuridad, en pies); sin ellos, vista normal.
- **Lo que ve el grupo** es la unión de lo que ven sus fichas, más lo destapado a mano, menos lo tapado a mano (que
  manda siempre).
- **Se recalcula al soltar una ficha** (también en las casillas de su camino, para explorar el pasillo), al abrir o
  cerrar una puerta, al cambiar una luz o la oscuridad, y al cambiar los muros.

### La niebla

- **Lo explorado** se va llenando solo con lo que ve el grupo y se queda (en gris en la tele). Es de cada campaña en
  cada escena. «Reiniciar la niebla», con aviso.
- **A mano**: destapar o tapar con pincel, rectángulo o lazo. Destapar deja la zona a la vista (con sus fichas no
  ocultas); tapar la vuelve a cubrir aunque las fichas la vean. Se deshacen.
- **Escena «sin visión automática»** (mapas sin muros): solo vale la de a mano. Una escena nueva sin muros nace así.
- **«Ver como el grupo»**: la mesa del máster enseña lo que ve la tele (y una lista de lo que el grupo no ve: fichas
  ocultas por la niebla, puertas secretas).

### Lo que recibe la pantalla (ADR-0018, punto 4)

- Lo explorado y lo que está a la vista (una máscara), las fichas que caen en lo visible y no están ocultas, las luces
  ya recortadas a lo visible, y **solo las teselas del mapa que tocan lo explorado o lo visible**.
- **El ajuste de la campaña** (Enrique, 2026-11-07): las teselas del borde, **enteras** (por defecto: asoma como mucho
  una tesela más allá) o **recortadas** en el servidor con la máscara (para jugar online).
- No le llegan muros, puertas (ni que existen), luces apagadas, fichas fuera de la vista ni el arrastre de una ficha que
  el grupo no ve.

### Las puertas y el paso, en el servidor

- El máster abre y cierra cualquier puerta (con un clic en la mesa). Las reglas para cuando los jugadores muevan su
  ficha (módulo 7), ya en el servidor: solo puertas visibles, no secretas, sin llave; mover a través de un muro se
  rechaza.

### La IA

- `ver_muros` (los de una escena), `cambiar_muros` (añadir, cambiar o quitar muros, puertas y luces), `abrir_puerta`,
  `niebla` (destapar o tapar un rectángulo o unas casillas, reiniciar), `ver_como_grupo` (qué ve el grupo: casillas a la
  vista y fichas que ve), `oscuridad` (la de la escena).

### Rendimiento (ADR-0018, punto 5)

- La visión se calcula en el servidor, en un hilo de trabajo, con un índice espacial de los muros y lo que no depende
  de las fichas (aristas, polígonos de las luces) guardado por campaña y escena. Al importar, se unen los segmentos
  colineales.
- **Presupuesto**: recalcular la vista del grupo (seis fichas, 2.500 segmentos, 20 luces) en menos de 100 ms en el p95,
  medido en `test:rendimiento` con su paso en la CI.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Lo explorado, una rejilla de bits** (unos 10 px por bit, comprimida, fuera del historial); la niebla a mano, una
   lista de operaciones (sí en el historial).
2. **El grupo son los personajes de la campaña en la escena**; las criaturas aliadas, con un ajuste en su ficha
   («Ve con el grupo»), más adelante.
3. **El estado de cada puerta es de la campaña**: abrirla en una no la abre en otra.
4. **Las luces del mapa horneadas** (un UVTT con la luz ya pintada) llegan apagadas y con la escena iluminada.
5. **La máscara viaja como imagen pequeña** (un bit por celda de niebla, comprimida) y la tele la suaviza al pintarla.

## Pruebas

- **Núcleo**: las de la mesa actual portadas (visión, luz, sentidos, niebla, movimiento) y las nuevas del índice
  espacial, la rejilla de bits y la unión de segmentos.
- **Integración**: la proyección de la pantalla con muros, puertas (secreta cerrada y abierta) y luces; lo explorado
  que se queda; destapar y tapar; reiniciar; el ajuste de las teselas (enteras y recortadas); las herramientas MCP.
- **Rendimiento**: el presupuesto de arriba.
- **Fugas** (la prueba que cada módulo amplía): a la pantalla no le llega ni un muro, ni una puerta secreta, ni una
  ficha fuera de la vista, ni una tesela sin explorar.
- **E2E**: una cripta con una puerta secreta: la tele no la ve; el grupo entra por la puerta normal y la sala se
  descubre; el máster abre la secreta y se ve el hueco.

## Construido (2026-11-07) y lo que queda

En la rama `modulo-6/mesa` (`tasks/vision/todo.md`): el servidor (tareas 1 a 4) y la web (tarea 5, abajo).

- **Los sentidos** salen del sistema: `senses` en el formato (`list`, un campo de lista con los sentidos escritos,
  «Visión en la oscuridad 60 pies» o «darkvision 60 ft.»; o `darkvision`, `blindsight`, `truesight`, `tremorsense`,
  campos numéricos), con el alcance en la unidad de la rejilla (`sensesOf` en `@crisol/systems`; validar dice si el
  campo no existe o no es del tipo). El 5e de ejemplo lee «Sentidos» (y lo pide en «Detalles» del creador). El
  servidor los pasa a píxeles con la rejilla (`distanceToPixels`).
- **Base de datos** (migración 0058): `scene_walls` y `scene_lights` (lo del mundo, una fila por tramo o luz, con su
  historial: con miles de tramos, cambiar uno no copia todos al historial, como haría un JSONB en la escena; los de un
  mapa entran de una vez con `insertMany`); en `scenes`, `darkness` y `automatic_vision` (nace en falso: una escena
  nueva no tiene muros); en `scene_states`, `doors` (las puertas que la campaña tiene distinto de como se dibujaron,
  con su historial); `scene_fog` (cada gesto de la niebla a mano, una fila con historial: se deshace); `scene_explored`
  (lo explorado, `FogGrid.encode()` en `bytea`, fuera del historial); en `campaign_tables`, `tile_fit` (`whole` por
  defecto o `cropped`). Quitar la pestaña quita también sus muros, luces y niebla (deshacer los devuelve). Cambiar
  muros o luces sube la versión de la escena: de ella cuelga lo preparado en memoria.
- **Acciones** (`packages/contracts/src/vision.ts`): `getSceneVision` (con `campaignId`, también sus puertas; sin ella,
  solo quien lleva la wiki), `changeWalls` (añadir, cambiar y quitar muros, puertas y luces en una operación, en
  píxeles o en casillas; tipos ya hechos: muro, bajo, invisible, ventana, objeto), `placeImportedWalls` (lo que trae
  el mapa; con `replace`, encima de lo que haya), `updateSceneVision` (oscuridad y visión automática), `setDoor`,
  `changeFog` (pincel, rectángulo, lazo, casillas o un área en casillas), `resetFog` (lo explorado no vuelve; lo de a
  mano se deshace), `setTileFit` y `viewAsParty` (lo que recibiría la pantalla, las casillas a la vista, las fichas que
  ve y las que no, las puertas secretas). Lo del mundo con `page.write`; lo de la campaña con `table.manage`.
- **Lo que trae el mapa** (un UVTT o `dibujar_escena`) se pone en juego al poner la imagen si la escena no tenía muros
  ni luces: los muros y objetos, unidos donde siguen rectos (`joinCollinear`); los portales, puertas (o ventanas); las
  luces, con su alcance pasado a pies (tenue; brillante, la mitad); las horneadas, apagadas y la escena de día; la luz
  ambiental, como oscuridad. La escena pasa a visión automática si trae muros.
- **La vista del grupo** (`apps/server/src/table/vision.ts`): el grupo son los personajes de la campaña con ficha en la
  escena (sin ocultar). Se calcula en un hilo (`vision-worker.ts`, con `prepareVision` guardado por escena, su versión
  y las puertas de la campaña) y la última vista de cada campaña y escena se guarda mientras no cambie nada de lo que
  la decide (la escena, las puertas, las fichas, la niebla a mano). Al soltar una ficha se explora también lo que se ve
  desde cada casilla de su camino (desde donde estaba). Lo explorado se suma y se guarda; lo tapado a mano se quita al
  enseñarlo (si se deshace el tapar, vuelve). **Las fichas del grupo se ven siempre** (su huella), también sin visión
  automática.
- **La pantalla** (`screenView`): `fog` (lo explorado y lo visible en máscaras: `FogGrid.encode()` en base64, y la
  oscuridad), las fichas que el grupo ve sin las ocultas, `lights` (las que alumbran algo de lo visible: lo que alumbran
  de ello y su centro solo si se ve) y el combate sin las criaturas cuya ficha no ve (las que no tienen ficha, sí). No
  le llegan muros, puertas, luces apagadas ni fichas fuera de la vista; la sala filtra el arrastre con lo que ve (la
  ficha y el punto por donde pasa). **El máster** recibe `vision` en `campaignTableView` (la versión de la escena para
  volver a pedir sus muros, el estado de cada puerta, lo explorado, lo visible y las fichas que el grupo no ve).
- **Las teselas de la pantalla**: solo las que tocan lo explorado o lo visible; enteras (con caché del navegador) o,
  con `cropped`, las del borde recortadas en el servidor (lo de fuera, transparente; `private, no-store`; guardadas en
  memoria por su huella). WebP con **`@jsquash/webp` 1.5.0** (libwebp en wasm: Apache-2.0 el paquete, BSD-3-Clause
  libwebp; sin binarios nativos). `sharp` no valía (libvips, LGPL).
- **Las reglas** (`apps/server/src/table/rules.ts`), para cuando muevan los jugadores: mover a través de un muro o de
  una puerta cerrada (la secreta también) se rechaza; un jugador solo abre puertas normales, sin llave y a la vista. Por
  ahora el máster puede con todo.
- **La IA**: `ver_muros`, `cambiar_muros`, `abrir_puerta`, `niebla` (destapar, tapar o reiniciar), `ver_como_grupo` y
  `oscuridad`, con su frase en las instrucciones.
- **Pruebas**: los sentidos (`packages/systems/src/senses.test.ts`); las reglas; `vision.integration.test.ts` (muros,
  puerta normal y secreta, oscuridad y luces, sentidos, lo explorado por el camino y tras reiniciar el servidor,
  destapar, tapar, deshacer y reiniciar, teselas enteras y recortadas, el arrastre que no ve, sin muros, lo del mapa,
  muros en casillas, un jugador que no puede nada y las fugas); y el rendimiento en `test:rendimiento` de
  `apps/server`: soltar una ficha en la mazmorra de 2.496 tramos y 20 luces con seis personajes, desde la petición
  hasta que la pantalla recibe su vista, **p50 68–70 ms y p95 92–99 ms** (2026-11-07, con la máquina cargada: carga
  media 5–7 en 6 núcleos).
- **Lo que hizo falta para el presupuesto**: la escena viaja al hilo solo si aún no la tiene preparada (clonar 2.500
  muros en cada petición costaba unos 20 ms); el núcleo guarda lo que ve cada ficha por lo preparado (al mover una no
  se rehacen las demás: `partyView`, sin cambiar su API); lo vital de cada personaje (su hoja montada con todo el
  contenido del sistema) se guarda por su versión, la de su sistema y la de la campaña (un minuto como mucho para lo
  del compendio del mundo); el camino recorrido se explora en la vista siguiente (la de la sala) en lugar de esperar al
  mover; y lo explorado se guarda sin hacer esperar a la pantalla.

### La web (tarea 5, 2026-11-07)

- **La columna de herramientas**, arriba a la izquierda del mapa (como el lienzo): elegir (V), la niebla (N), muros y
  puertas (M) y luces (L), con su tecla; las de `herramientas-mesa` irán debajo, en su grupo (`TOOLS` en
  `apps/web/src/tabletop/vision.tsx`). Con una herramienta, el botón izquierdo es suyo (las fichas no se mueven) y el
  panel de la derecha es el suyo; moverse (botón central, espacio) y acercar siguen igual. El tutorial guiado de la
  mesa tiene un paso para ella.
- **El editor** (`vision.tsx`, `vision-panel.tsx`; la lógica pura, en `walls.ts`): muros encadenados clic a clic
  (cerca de un extremo pega a él; con Mayús, a las esquinas de la rejilla; Escape, doble clic o volver al primer punto
  acaban; Retroceso quita el último punto); un clic en un extremo empieza otro muro ahí y arrastrarlo lo mueve con los
  muros que se tocan en él; un clic en un muro lo elige (su tipo, el estado de la puerta en la campaña —cerrada,
  abierta, con llave—, lo que frena, el sentido y quitarlo; Supr lo quita). Los tipos: muro, puerta, puerta secreta,
  ventana, invisible, bajo, objeto y de un sentido, cada uno con su color. «Poner los muros del mapa» sale si la escena
  trae los de un UVTT o de la IA y no tiene ni muros ni luces. Las luces: un clic pone una (4 y 8 casillas de radio) y
  la elige; se arrastran; sus radios en la unidad de la rejilla, su color (seis), su ángulo (con hacia dónde mira),
  si la frenan los muros, encendida y oscuridad mágica; sus círculos (o su cono) se dibujan; la oscuridad de la escena,
  un deslizador. Los muros se ven al editarlos y, apagados, viendo como el grupo.
- **Las puertas en juego**: un icono pequeño en cada una (la secreta, morada con el ojo tachado; la de llave, con su
  candado); un clic la abre o la cierra en la campaña (`setDoor`), al momento.
- **La niebla a mano**: destapar o tapar con pincel (su tamaño, de 1 a 8 casillas), rectángulo o lazo, en la barra que
  sale junto a la columna; destapar o tapar todo; «Reiniciar la niebla», con aviso; «Visión automática». En la mesa,
  lo no explorado se ve atenuado y lo explorado que no se ve, algo menos (`fogImage` en `fog-paint.ts`); editando
  muros o luces, sin niebla.
- **«Ver como el grupo»**: la mesa enseña la niebla como la tele, sin las fichas que el grupo no ve (`notSeen`), con
  el aviso arriba y «Volver»; el panel dice quién mira y lo que no ve (oculta o fuera de su vista, y las puertas
  secretas cerradas).
- **Los bordes de la tele** (enteros o recortados), al final del panel de la niebla, con una frase.
- **La tele**: lo no explorado negro (el suavizado entra en lo visible, nunca aclara lo no explorado), lo explorado en
  gris oscuro y lo visible con su luz: la oscuridad lo sombrea donde no llega ninguna luz y cada luz le da un brillo
  cálido que se apaga hacia el borde de lo tenue. La máscara llega en celdas de 10 px y se pinta como una imagen
  pequeña desenfocada y estirada con suavizado (bordes blandos, no casillas). Solo pide las teselas que tocan lo que
  ve o vio; las de a medias, con una huella de lo que dejan ver en la dirección, para que una recortada se vuelva a
  pedir al explorar.
- **El lienzo** (`renderer.ts`): `setFog`, `setGlow` (se suma a lo de debajo) y `setShapes` (lo que dibujan los
  editores, en píxeles de la pantalla, con trazos que siguen a lo largo de toda la línea); las teselas sin dirección
  no se piden.
- **Las frases del historial** (y de lo que pide la IA) de muros, luces, oscuridad, visión automática, puertas, niebla
  y bordes de la tele.
- **Pruebas**: `walls.test.ts` y `fog-paint.test.ts` (lo puro), `vision.test.tsx` (la mesa con la API falsa: las
  herramientas y sus teclas, muros encadenados con Mayús, la puerta secreta con doble clic, mover un extremo, las
  puertas, la niebla con su aviso, las luces, «Ver como el grupo» y la tele con su niebla, su luz y sus teselas) y la
  E2E `e2e/tests/vision.spec.ts` con la cripta del lienzo: la IA dibuja sus muros y puertas con el mapa; el máster
  dibuja en la mesa la puerta secreta; la tele no ve la sala de detrás; abre la puerta de la entrada con un clic y el
  grupo entra; abre la secreta y se ve la cripta; destapa a mano la cueva; con axe; capturas
  `out/capturas/vision-{muros,luces,niebla,grupo,tele}.png`.
- **Distinto del lienzo**: «Luz del día», «Parpadea» y «Da visión a todos» no están (el contrato no los tiene: la luz
  del día es la oscuridad a 0); «Ver como el grupo» enseña lo no explorado en negro, como la tele (el lienzo lo
  atenuaba); hay ocho tipos de muro (también «Objeto») y «Frena el paso»; los bordes de la tele van en el panel de la
  niebla.

**Queda**: la revisión (tarea 6); la prueba de fugas e2e (`e2e/tests/fugas.spec.ts`) con la
pantalla; las criaturas aliadas que ven con el grupo; las luces encendidas o apagadas por campaña (hoy, del mundo).

## Fuera

La visión de cada jugador en su aparato (módulo 7; el cálculo ya es por «quién mira»); el sonido que los muros tapan
(módulo 7); niveles y pisos; la luz animada en la tele más allá de la de la mesa actual.
