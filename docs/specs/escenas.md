# Spec: escenas (módulo 6)

Estado: **spec** (2026-11-07). Primera capacidad del módulo 6 (`docs/specs/modulo-6.md`). Entrevista: `docs/modulos.md`
§ «### 6. Mesa». ADR-0018 (la mesa en el servidor) y ADR-0007 (pestañas de página). Estudios:
`research/foundry/escenas-fichas-y-combate.md` (la escena y la rejilla), `research/dndbeyond/mapas.md` (la vista de
espectador), `research/uvtt/formato.md`; lo que se porta, `docs/mesa-crisol-actual.md` (§ 3, § 5 y § 7).

## Objetivo

Que el máster **ponga un mapa en la tele**: prepara la escena en la página del lugar (su imagen y su rejilla), la abre
en la mesa de su campaña y la presenta en una segunda ventana que enseña lo que ve el grupo, servida por el servidor.
Es la base del módulo: el núcleo compartido, la sala por campaña con su canal, la proyección y las teselas.

Para quién: el máster, que prepara y dirige; la pantalla de la tele; la IA.

## Requisitos

### La escena, en el mundo

- **Una pestaña «Escena»** en cualquier página («+» → «Escena»), como el mapa. Al crearla se elige la imagen: un
  archivo del mundo, uno que se sube en ese momento o un UVTT (`.dd2vtt`, `.uvtt`, `.df2vtt`).
- **La imagen, en teselas**: el navegador del máster la trocea en teselas WebP de 512 px, con niveles a media escala
  hasta que cabe en 1.024 px, y una miniatura; las sube y la escena guarda sus medidas. No salen en «Archivos» (son
  parte de la escena); el original, si era un archivo del mundo, sigue allí.
- **La rejilla**: cuadrada, hexagonal (por filas o por columnas, con las pares o las impares desplazadas) o sin
  rejilla; el tamaño de la casilla en píxeles y su desplazamiento; la distancia y la unidad de una casilla (las del
  sistema de la campaña si las dice; si no, 1,5 m); la regla de diagonales (la del sistema; si no, todas iguales);
  si se ve, su color y su opacidad.
- **Alinear la rejilla con el mapa**: «Buscarla» la detecta sola en la imagen; si no encaja, se marcan dos esquinas de
  una casilla (o se escribe el tamaño). Lo que ya hace la mesa actual (`nucleo/deteccion.ts`, `nucleo/alineacion.ts`).
- **Un UVTT** trae su imagen y su rejilla (píxeles por casilla y origen). Sus muros, puertas y luces se guardan con la
  escena para `vision`, que los pondrá en juego; el archivo no se sube entero (la imagen va en teselas).
- **La vista inicial**: el encuadre con el que se abre.
- **En la wiki**, la pestaña enseña la escena al máster con «Abrir en la mesa» (y la campaña, si el mundo tiene más de
  una). Se cambian la imagen y la rejilla desde ahí. Todo va al historial y se deshace; borrar la pestaña la manda a la
  papelera.

### La mesa, en la campaña

- **«Mesa»** en la barra de la campaña (del máster): el lienzo a toda la pantalla, el panel de la mesa a un lado y la
  barra de herramientas.
- **Abrir una escena**: desde «Escenas» en el panel (las pestañas «Escena» del mundo, con su miniatura y un buscador) o
  desde la pestaña de la página. La primera vez que una campaña abre una escena se crea su estado (vacío).
- **Moverse**: arrastrar con el botón central o con espacio y el ratón, la rueda acerca hacia el cursor, pellizcar en
  una pantalla táctil, «Encuadrar todo». El encuadre del máster es de su navegador.
- **La escena abierta y la presentada**, por campaña: el máster puede mirar o preparar otra mientras la tele sigue con
  la suya.

### La pantalla de la tele

- **«Pantalla»** abre la segunda ventana: una ruta de la web solo con el mapa, sin barras, con su botón de pantalla
  completa. Se lleva a la tele. Si se recarga, vuelve sola a lo que estaba enseñando.
- **Presentar y ocultar**: «Presentar» manda a la tele la escena abierta, con un fundido; «Ocultar» la deja a oscuras
  (con el nombre de la campaña). Abrir una escena no la presenta.
- **Cámaras**: «Seguir» (la tele enseña lo que encuadra el máster) o «Fija» (el máster deja un encuadre). En la mesa,
  un marco enseña lo que se ve en la tele, y se puede arrastrar. «Encuadrar al grupo» llega con `fichas`.
- **Lo que recibe**: la vista del grupo, proyectada en el servidor (ADR-0018). Hasta que llegue `vision` no hay niebla
  y se ve la escena entera, pero la tele ya pide al servidor qué teselas puede cargar.

### El servidor

- `packages/tabletop`, el núcleo compartido: el modelo de la escena y del estado, los comandos, la rejilla cuadrada y
  hexagonal, alinear y detectar. Portado de la mesa actual (cabecera de origen, nombres en inglés).
- **La sala por campaña** y su WebSocket: se conecta el máster («máster») o la pantalla («grupo»); recibe el estado de
  la mesa y después las diferencias; el máster manda los comandos (abrir, presentar, ocultar, cámara). Un jugador no se
  conecta a la mesa en este módulo (la sala de jugadores, módulo 7): se le rechaza.
- **Las teselas**, por la API, con permiso: el máster, todas; la pantalla, las que su vista permite.
- Tablas nuevas, con `world_id` y en `operation()`: la escena (la pestaña, la imagen y sus teselas, la rejilla, la
  vista inicial, lo traído del UVTT), el estado de cada campaña en cada escena y la mesa de cada campaña (abierta,
  presentada, oculta, cámara).

### La IA

- `ver_escenas` (las del mundo), `ver_escena` (una: imagen, medidas en casillas, rejilla), `crear_escena` (una pestaña
  «Escena» en una página, con una imagen del mundo y su rejilla), `cambiar_escena` (la rejilla y la vista inicial),
  `ver_mesa` (qué tiene abierto y presentado la campaña), `abrir_escena`, `presentar_escena` y `ocultar_pantalla`.
  Funcionan sin nadie conectado.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **La pestaña «Escena» es solo del máster en la wiki**: un jugador nunca ve la escena entera; la ve en la mesa,
   proyectada. Aunque conozca la página, la pestaña no le llega.
2. **Trocea el navegador del máster**, como saca hoy las imágenes de un zip de Foundry: un mapa de 90 MB no pasa por
   la memoria del servidor (1 GB). Una escena que crea la IA con una imagen del mundo se trocea la primera vez que el
   máster la abre en la mesa («Preparando el mapa…»).
3. **Sin niebla en esta capacidad**: la tele enseña la escena entera hasta `vision`. El camino (la proyección y las
   teselas con permiso) ya está, para que la niebla solo cambie qué se deja pasar.
4. **La distancia y la regla de diagonales**, del sistema: un campo opcional nuevo en su formato (`table.grid`), con
   1,5 m y «todas iguales» si no lo dice; se cambian por escena.

## Pruebas

- **Núcleo**: las pruebas portadas de la rejilla, alinear y detectar, más las de los comandos de esta capacidad.
- **Integración**: la sala (abrir, presentar, ocultar, la cámara; dos pestañas del máster a la vez; reconectar), los
  permisos de las teselas (un jugador o alguien de otra campaña no las recibe), el UVTT (con las trampas de su nota) y
  las herramientas MCP.
- **E2E**: crear una escena desde una página con una imagen, alinear la rejilla, abrirla en la mesa, abrir la pantalla,
  presentar, mover la cámara y ver que la pantalla la sigue; ocultar.
- **Fugas**: un jugador no recibe por la API ni por el WebSocket nada de una escena (ni la pestaña, ni sus teselas, ni
  la mesa).
- **Accesibilidad**: los mandos de la mesa, el panel y la pestaña, con axe; el lienzo con su nombre y atajos de
  teclado para moverse.

## Fuera

Las fichas (`fichas`); los muros, las puertas, las luces y la niebla (`vision`); el combate; medir y las demás
herramientas (`herramientas-mesa`); las escenas de Foundry (`escenas-foundry`); los jugadores conectados a la mesa
(módulo 7).
