# Spec: mapas con capas (módulo 9)

Capacidad `mapas-capas` del módulo 9 (`docs/specs/modulo-9.md`). Intención: `docs/intent/mapas-pizarras.md`. Estudio:
`research/mapas-y-pizarras.md` (LegendKeeper, World Anvil, Kanka, Inkarnate, Obsidian Leaflet, IA que dibuja).

## Objetivo

Que el mapa de una página (Eana, una región, una ciudad) sirva para preparar y para la mesa: regiones, rutas y textos
ordenados en capas, que la IA traza a partir de lo que se le dice y el máster retoca; una escala con la que medir
distancias y días de viaje; y que cada jugador vea solo lo que su campaña sabe. Hoy el mapa solo tiene pines.

## Comportamiento

### Capas

- Un mapa tiene capas con nombre, en orden (arrastrar), y cada región, ruta y texto va en una. Nace con una («General»);
  los pines siguen como están (encima de todo, sin capa).
- Una capa está **a la vista** u **oculta** (solo del máster). Lo de una capa oculta no le llega a ningún jugador ni a
  su IA, aunque se haya revelado algo de ella. Decidido sin él: ocultar una capa vale para todas las campañas (lo de
  cada campaña es revelar cosa a cosa).
- **Apagar una capa en mi pantalla** es otra cosa: solo de la vista, de cada uno (también los jugadores), y se recuerda
  en el aparato.

### Regiones, rutas y textos

- **Región**: un polígono (o varias piezas: islas), con relleno (color, liso o rayado, opacidad), borde (liso,
  discontinuo o punteado) y su nombre, que sale en el centro y cuándo (siempre, al pasar el ratón, nunca). Sin huecos
  de momento (un lago dentro de un reino va en otra región encima).
- **Ruta**: una línea (camino, río, frontera), con su estilo (color, grosor, liso/discontinuo/punteado) y nombre a lo
  largo. Puede empezar y acabar en un pin.
- **Texto**: un rótulo suelto (un mar, una cordillera), con su tamaño, su giro y, si se quiere, en arco.
- Cada una puede **enlazar a una página** (el reino, el río): pulsarla la abre como un pin.
- Estilos en listas cerradas (colores de la app, tres trazos), nada de pinceles ni curvas a mano.

### Dibujar y retocar (el máster)

- En «Editar» del mapa, una barra con: seleccionar, región, ruta, texto (y los pines de siempre). Región y ruta se
  dibujan punto a punto (doble clic o Enter para acabar; Escape cancela).
- Retocar: arrastrar un vértice, añadir uno pinchando en un lado, quitarlo con el botón derecho o Supr; mover la pieza
  entera; los vértices se **pegan** a los de otras regiones y a los pines cercanos (fronteras vecinas sin huecos).
- Un panel lateral, como el de los pines, con nombre, capa, estilo, página enlazada y «Oculta».
- Deshacer (Ctrl+Z) mientras se edita; cada cambio guardado queda en el historial.

### Lo que ven los jugadores

- En una capa a la vista, cada región, ruta o texto se revela por campaña como un pin (el conocimiento, tipo `element`,
  ya existe): sin revelar no sale. Marcar una como «Oculta» la deja solo para el máster.
- Una región enlazada a una página que la campaña no conoce sale sin nombre y sin enlace.
- Lo filtra el servidor: al jugador (y a su IA) no le llega nada que no pueda ver.

### Escala y medir

- **Calibrar**: dibujar una raya sobre algo conocido y decir cuánto mide (km, millas, leguas). Se guarda en el mapa.
- **Velocidades** del mapa (a pie, a caballo, en barco, en km o millas al día), con valores por defecto editables.
  Decidido sin él: en el mapa, no en la campaña (cada mapa tiene su escala y su terreno).
- **La regla**: pulsar de punto a punto (encadena tramos), pegándose a pines y vértices; o elegir una ruta y medirla
  entera o entre dos de sus puntos. Dice la distancia y los días con cada velocidad. La miden también los jugadores
  (sobre lo que ven). No se guarda: es de la vista.

### IA (MCP)

- `ver_mapa` dice ya sus capas, regiones, rutas y textos (con su geometría y estilo) y la escala.
- **`imagen_mapa`** (nueva): devuelve la imagen del mapa (o un recorte) reducida a lo que la IA ve bien (≤ 1568 px de
  lado), con lo dibujado encima y una rejilla de referencia, y dice qué coordenadas tiene esa vista.
- `cambiar_mapa` (o herramientas nuevas, a decidir en el plan) crea, cambia y quita capas, regiones, rutas y textos.
  Las coordenadas, de 0 a 1 sobre la imagen (como los pines) o en píxeles de la vista que se pidió (el servidor las
  convierte). El servidor simplifica los trazos (tope de puntos), pega vértices cercanos y casa una ruta con los pines
  de sus extremos.
- `medir_mapa` (nueva o dentro de `medir`): distancia y días entre puntos, pines o a lo largo de una ruta.

## Datos (propuesta)

- Tabla nueva `map_layers` (mundo, mapa, nombre, posición, `hidden`) con historial.
- `map_elements` (ya existe, sin usar): `layerId`, `position`; `geometry` como JSON propio (`points` o `pieces` de
  puntos 0–1; el texto, su punto, giro y arco); `style` validado con zod.
- `maps`: la escala ya cabe (`scaleLength`, `scaleValue`, `scaleUnit`); velocidades nuevas (`speeds` jsonb).
- El conocimiento de las campañas acepta los elementos (`element`), como los pines.

## Pruebas

- Unitarias (`packages/…` o `apps/web`): simplificar y pegar vértices, medir (tramos, a lo largo de una ruta, días con
  cada velocidad), convertir píxeles de una vista a 0–1, el filtro de lo que ve un jugador.
- Integración (servidor): crear capas y elementos, ocultar una capa, revelar un elemento a una campaña; el jugador y su
  IA no reciben lo oculto (prueba de fugas); el MCP (`imagen_mapa`, crear una región, medir).
- Web: dibujar una región y una ruta, retocar un vértice, el panel, apagar una capa en la vista, la regla.
- E2E: el criterio 1 entero; accesibilidad de la barra, del panel y de la regla.

## Límites

- Siempre: lo de los jugadores lo filtra el servidor; textos por i18n; la Mesa y sus escenas no cambian.
- Preguntar antes: añadir una dependencia de dibujo (se intenta con lo que ya usa el mapa).
- Nunca: pinceles, curvas Bézier, importar de otras apps, viajes de verdad (provisiones, encuentros: revisión de la
  campaña).

## Criterios de éxito

1. Se le pide a la IA «dibuja los reinos de Eana y el camino real» y lo dibuja reconociblemente sobre la imagen; el
   máster arrastra un vértice de una frontera; pone la capa «Secretos» oculta; la jugadora ve el mapa con solo lo
   revelado de las capas a la vista, mide de una ciudad a otra y lee la distancia y los días a pie y a caballo.
2. Un mapa con 50 regiones de 200 puntos se mueve y se acerca sin tirones en un portátil normal.
3. La prueba de fugas: nada de una capa oculta ni de un elemento sin revelar llega a un jugador por la web ni por el MCP.

## Dudas abiertas (decididas sin él; se enseñan en el lienzo)

- Ocultar una capa, para todas las campañas (no por campaña).
- Fronteras vecinas: se pegan los vértices cercanos; no se comparte el borde de verdad.
- Regiones con varias piezas sí; con huecos, no de momento.
- Velocidades en el mapa.
- La imagen para la IA se reduce o se recorta al pedirla; sin teselas de momento.
