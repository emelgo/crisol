# Spec: herramientas-mesa (módulo 6)

Estado: **servidor construido** (2026-11-07; la web, después). Quinta capacidad del módulo 6
(`docs/specs/modulo-6.md`). Entrevista: `docs/modulos.md` § «### 6. Mesa» (lo que entra de la mesa actual).
ADR-0018. Estudios: `research/foundry/escenas-fichas-y-combate.md` (plantillas y regla de medir),
`research/dndbeyond/mapas.md` (plantillas por tipo de daño); lo que se porta, `docs/mesa-crisol-actual.md`
(`medidas.ts`, `plantillas.ts`, `dibujo.ts`, `laser.ts`, `imagenes.ts`, `chinchetas.ts`, `camaraJugadores.ts`,
`sesion/instantaneas.ts`, los widgets). Diseño: el lienzo «Crisol: la mesa», tablero Herramientas (y la plantilla y
sus objetivos del tablero Combate).

## Objetivo

Las herramientas de la mesa actual que Enrique usa jugando: medir y dejar plantillas de área, dibujar y señalar, los
widgets, las instantáneas y la pantalla del máster.

## Requisitos

- **La columna de herramientas** a la izquierda del lienzo (como el lienzo): elegir, medir, plantilla, dibujar, texto,
  sellos, pin, láser; abajo, la pantalla del máster y las instantáneas. Atajos de teclado para cada una.
- **Medir**: línea con puntos intermedios (clic a clic), círculo, cono y cuadrado; la distancia en la unidad de la
  escena con su regla de diagonales (todas iguales, alternas o real), en cuadrada y hexagonal. Arrastrar una ficha
  enseña lo que recorre. **«La tele ve lo que mides»** (un interruptor): la medida en curso va en vivo a la pantalla.
- **Plantillas de área**: dejar la medida como plantilla (círculo, cono de 53°, línea con anchura, cuadrado), con su
  color o la trama de su tipo de daño; moverla y girarla; **las fichas de dentro** se marcan y se pueden elegir de una
  vez para aplicarles daño (lo de `combate`). Cada una se ve u oculta en la tele.
- **Dibujar** a mano alzada (con goma), **texto** y **sellos** (iconos propios o de Lucide; Kenney, CC0, si se
  quieren objetos) en el mapa; se ven en la tele salvo los marcados del máster.
- **Pines** en la mesa que llevan a páginas (los de los mapas de la wiki, aquí sobre la escena).
- **Puntero láser**: una estela que dura un momento, en vivo en la tele; no se guarda.
- **Imágenes sueltas** en el mapa (un archivo del mundo), con giro y tamaño.
- **Widgets** de la campaña: contador, reloj de progreso (segmentos) y temporizador; cada uno con su ojo para verse o
  no en la tele.
- **Instantáneas**: guardar el estado de la escena en la campaña (fichas, puertas, niebla, plantillas, dibujos) con su
  miniatura, y volver a una (con aviso: se deshace).
- **La pantalla del máster**: un cajón que sube desde abajo del mapa con los statblocks de las criaturas de la escena
  (sus ataques se tiran con un clic) y una nota de una página enlazada.
- **La IA**: medir entre dos casillas, poner y quitar plantillas (y decir qué fichas quedan dentro), widgets,
  instantáneas.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Plantillas, dibujos, textos, sellos, pines e imágenes son de la campaña en la escena** (como las fichas), con
   historial; el láser y la medida en curso solo van en vivo.
2. **Los widgets son de la campaña**, no de la escena: siguen ahí al cambiar de mapa.
3. **Una instantánea guarda solo lo de la campaña en esa escena**, no la escena del mundo ni las criaturas en juego.

## Pruebas

- **Núcleo**: medidas (las tres reglas, hexagonal), las fichas de dentro de cada forma de plantilla.
- **Integración**: plantillas (y sus fichas de dentro), dibujos, widgets e instantáneas con deshacer; lo que la tele
  recibe (lo del máster, no); las herramientas MCP.
- **E2E**: medir un cono, dejarlo como plantilla, elegir las fichas de dentro y dañarlas; un reloj de progreso en la
  tele; guardar una instantánea y volver a ella.

## Fuera

La capa de clima (módulo 8); el sonido posicional (módulo 7); el generador de botín y los paquetes de colección.

## Construido (2026-11-07) y lo que queda

El servidor y el núcleo, en la rama `modulo-6/mesa` (`tasks/herramientas-mesa/todo.md`); la web va después.

- **Núcleo** (`packages/tabletop`, portado de la mesa actual con sus pruebas): `measure.ts` (las casillas entre dos
  puntos con las tres reglas de diagonales y en hexagonal; un camino con puntos de paso, en el que las alternas siguen
  contando de un tramo al otro; el texto en la unidad de la escena o por bandas), `templates.ts` (círculo, cono con su
  apertura, línea con su anchura y cuadrado; las casillas de dentro y **las fichas de dentro**: basta una casilla de su
  huella), `drawing.ts` (trazos, formas, la goma y el trozo de un trazo dentro de una zona), `laser.ts`,
  `map-images.ts` (lo puro de las imágenes sueltas: asas, tamaño sin deformar, giro), `pins.ts` (iconos, la etiqueta
  siguiente, la casilla entera que lleva a la página) y `widgets.ts` (contador con límites, reloj de progreso y su
  cara, temporizador que corre con el reloj de la pared).
- **Base de datos** (migraciones 0059 y 0061): `scene_marks` (las marcas de una campaña en una escena: plantilla,
  dibujo, texto, sello, pin o imagen; su `data`, su orden y si son del máster), `campaign_widgets` (de la campaña, con
  su ojo para la tele) y `scene_snapshots` (lo de la campaña en la escena: fichas, puertas, niebla a mano y marcas, con
  su miniatura en data URL), las tres con historial; `campaign_tables.measure_on_screen` («la tele ve lo que mides»).
- **Acciones** (`apps/server/src/actions/table-tools.ts`, todas con `table.manage`): `listMarks`, `changeMarks`
  (poner, cambiar con `set` o `move` y quitar en una operación: la goma se deshace de una vez; los pines, del máster
  salvo que se diga; la imagen y la página de un pin, del mundo), `placeTemplate` (en casillas y pies, hacia una
  dirección o una casilla; dice qué fichas quedan dentro), `getTemplateTokens`, `measureDistance`,
  `setMeasureOnScreen`, `listWidgets`, `createWidget`, `updateWidget` (valor, `step`, el temporizador en marcha, en
  pausa o reiniciado; cambiar la duración lo reinicia), `deleteWidget`, `listSnapshots`, `saveSnapshot`,
  `restoreSnapshot` (una operación: deshacerla lo devuelve todo; las fichas de quien ya no está se saltan y se dicen) y
  `deleteSnapshot`.
- **En vivo** (el canal de la mesa): `measure` (la medida en curso; a las otras pestañas del máster siempre, a la tele
  solo con «la tele ve lo que mides», si mira la misma escena y la medida cae entera en lo que el grupo ve o vio; si
  deja de valer, se le manda `null`) y `laser` (a la tele, sus puntos en lo que ve o vio el grupo).
- **La proyección**: la mesa del máster trae `marks` (de las plantillas, `tokenIds`), `widgets` y `measureOnScreen`;
  la pantalla, `marks` (sin las del máster; las plantillas, textos, sellos, pines e imágenes cuyo punto cae en lo que
  ve o vio el grupo; de un dibujo, solo sus trozos ahí, sin relleno si se recortó; de un pin, sin su página) y
  `widgets` (los de ojo abierto, mientras la tele no esté a oscuras). `ver_como_grupo` lo enseña igual.
- **La IA**: `medir`, `poner_plantilla`, `fichas_en_plantilla`, `ver_marcas`, `cambiar_marcas`, `ver_widgets`,
  `crear_widget`, `cambiar_widget`, `borrar_widget`, `ver_instantaneas`, `guardar_instantanea`,
  `volver_a_instantanea` (pide aprobación: cambia lo que ven los jugadores) y `borrar_instantanea`.
- **Pruebas**: las del núcleo y `apps/server/src/table/tools.integration.test.ts` (medir con las tres reglas y en
  hexagonal; la plantilla y sus fichas de dentro, moverla y deshacer; las marcas con la goma y lo que no vale; la
  pantalla sin lo del máster ni lo que cae en la niebla; los widgets y la tele; las instantáneas con deshacer; la
  medida y el láser en vivo; el jugador que no puede nada; las herramientas de la IA).

Decisiones tomadas sin Enrique (por confirmar al verlas): las tres de arriba; además, volver a una instantánea no
toca lo explorado (lo visto, visto está) y su niebla a mano sí; la miniatura va en la propia instantánea (una imagen
pequeña, de hasta 200 KB en data URL) en vez de en Archivos; una marca llega a la tele si su punto (el origen de la
plantilla, el centro de lo demás) cae en lo que el grupo ve o vio; «la tele ve lo que mides» se guarda en la mesa de
la campaña.

Lo que queda: **la web** (la columna de herramientas y sus atajos, medir y dejar la plantilla, la trama del tipo de
daño, elegir las fichas de dentro y dañarlas con lo de `combate`, dibujar con goma, texto, sellos de Lucide o propios,
pines, el láser, imágenes sueltas, los widgets en la mesa y en la tele, las instantáneas con su miniatura y su aviso,
la pantalla del máster con los statblocks); la e2e; los sellos de Kenney (CC0, si se quieren); y la fuga de la
pantalla en la prueba e2e de fugas.
