# Mapas con capas en LegendKeeper

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-12 · Versión estudiada: web pública a fecha de hoy
(herramienta de mapas nueva de la 0.18.0.0, del 10-01-2026; changelog hasta la 0.21.0, del 27-10-2026; API v3.0.0)

## Pregunta

Cómo es el editor de mapas de LegendKeeper (su antiguo «Atlas», rehecho en enero de 2026), para la spec del módulo 9
(`docs/intent/mapas-pizarras.md`): regiones, rutas y textos en capas, que la IA dibuja y el máster retoca, con capas
y elementos que se revelan por separado, y una regla que mide con escala calibrada y da días de viaje. En concreto:

1. Qué elementos hay (pines, regiones, rutas, textos) y cómo se dibujan y se retocan (herramientas, vértices, ajuste).
2. Qué estilos admiten y cómo se ordenan y agrupan en capas. Mapas anidados.
3. Cómo se esconde a los jugadores (capa entera, elemento a elemento) y cómo se revela en partida.
4. Escala y regla: calibrar, medir de punto a punto y por ruta, tiempos de viaje, y si miden los jugadores.
5. Si hay IA que dibuje y en qué formato guardan la geometría.

**Cómo se leyó.** Solo la web pública: los ocho artículos de mapas del centro de ayuda (unas pocas líneas cada uno), el
changelog de la 0.4 a la 0.21, el anuncio del nuevo mapa y un tutorial de su blog, la página de funciones, la guía de la
API y su especificación OpenAPI, y la ficha de un MCP de terceros. En Reddit y YouTube el buscador no sacó nada útil.
Ni cuenta ni código. Grado de certeza:

- **[ayuda]**: centro de ayuda oficial (actualizado en octubre de 2026).
- **[blog]**: changelog y blog oficiales (se da la versión o la fecha).
- **[API]**: guía y especificación de la API v3 (2026), que describen los datos tal como se guardan.
- **[extracto]**: páginas de terceros.
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### El modelo, en breve

Un mapa es una pestaña de una página: se sube una imagen (hasta 14.000 píxeles y 100 MB) y encima se ponen
**elementos** de cinco tipos: pin, rótulo, región, ruta y carpeta [ayuda, API]. Todo vive en una lista única de
elementos por mapa, cada uno con su tipo, su nombre, su enlace opcional a una página, su madre (una carpeta) y su orden
entre hermanas [API]. Las «capas» de LegendKeeper son esas carpetas: no hay un objeto capa aparte [API, inferido]. La
imagen se sirve en teselas que se cortan al vuelo desde 2024, sin esperar a procesarla [blog 2024].

Hasta 2026 el mapa solo tenía pines. La 0.18 lo rehízo entero: regiones, rutas, rótulos, medir, navegación, cursores
de otros usuarios, deshacer y un motor de dibujo nuevo sobre WebGL [blog 0.18.0.0]. Su autor dice que la navegación
no estaba prevista y ha sido lo más celebrado de la actualización [blog, enero de 2026].

### 1. Herramientas de dibujo

- **Barra de herramientas** con pin, texto, región, ruta y regla, atajos de teclado (la regla es la M) y un menú
  radial con el botón derecho para llegar rápido a las cuatro primeras [blog 0.18.0.0, ayuda].
- **Región**: clic en cada vértice y se cierra pinchando en el primero. **Ruta**: clic en cada punto y se acaba con
  doble clic o Intro. En las dos, el botón derecho quita el último punto puesto [ayuda, blog febrero de 2026, 0.18.0.2].
- **Rótulo**: clic donde va y se escribe. **Pin**: clic, o arrastrar una página al mapa [ayuda].
- **Modo bloqueo**: la herramienta se queda puesta para soltar muchos pines o trazar varias rutas seguidas
  [blog 0.18.0.0].
- **Ajuste con Ctrl**: al dibujar una ruta, o al soltar un pin, los puntos se pegan a rutas y regiones cercanas
  [blog 0.18.0.0].
- **«Tomar prestada» la frontera**: con Ctrl, una región nueva se pega al borde de otra, y si se cierra siguiendo ese
  borde, lo copia entero. Es su respuesta a no tener que repasar dos veces la frontera de dos reinos vecinos
  [blog 0.18.0.0, enero de 2026]. No consta que la frontera quede compartida después: parece una copia de puntos, y
  mover luego un vértice de un reino no movería el del vecino [inferido].
- **Retocar**: se habla de «modos de edición» de región y de ruta [blog 0.18.0.2], pero **no se encontró** en ninguna
  fuente cómo se mueven, añaden o borran vértices de una forma ya hecha.
- **Selección múltiple** con Mayús (recuadro) para mover, borrar o cambiar el estilo de muchos a la vez; duplicar con
  Ctrl+D; deshacer y rehacer casi todo con Ctrl+Z [blog 0.18.0.0].
- Los pines hay que seleccionarlos antes de arrastrarlos, para no moverlos sin querer al desplazar el mapa
  [blog 0.18.0.0].
- **Estilo antes de dibujar**: en la barra lateral se elige el estilo que tendrá lo próximo que se suelte
  [blog 0.18.0.0].

### 2. Estilos

Pocos y cerrados, todos como listas de valores, no como CSS libre [API]:

| Elemento | Qué se puede cambiar |
|---|---|
| Región | Color (relleno y borde, el mismo), opacidad del relleno, relleno liso, rayado, punteado o ninguno, borde liso, discontinuo, punteado o ninguno, grosor |
| Ruta | Color, grosor, opacidad, trazo liso, discontinuo, punteado o ninguno |
| Rótulo, y el nombre de regiones y rutas | Color del texto, tamaño (siete pasos), tres fuentes, contorno de 3 px o caja detrás al 50 %, y su color |
| Pin | Icono (de FontAwesome), forma de fondo (ocho, o ninguna), color, dos tamaños, o una imagen propia |

- **Cuándo sale el nombre**: siempre, al pasar el ratón o nunca, en pines, regiones y rutas [blog 0.18.0.0, API].
- **Rango de zoom** en cada elemento: entre qué niveles de zoom se dibuja, guardado de 0 a 1. Sirve para mapas que
  enseñan reinos de lejos y ciudades de cerca [blog 0.18.0.0, API].
- **Nombres de ruta dinámicos**: el nombre de una ruta aparece según el zoom, «como Google Maps» [blog 0.18.0.0].
- El área y el perímetro de una región y el largo de una ruta salen al lado si el mapa está calibrado [blog 0.18.0.0].

### 3. Orden, agrupación y mapas anidados

- **Carpetas anidadas** en la barra lateral del mapa. Las carpetas se pliegan, y con el botón derecho una carpeta se
  esconde o se queda sola en pantalla («solo») [blog 0.18.0.0]. No queda claro si eso es solo de la vista del editor o
  cambia lo que ven los jugadores [inferido: parece de la vista].
- Los pines tienden a agruparse en racimos siguiendo las carpetas cuando se aleja el zoom [blog 0.18.0.0].
- Un buscador en la barra filtra los elementos por nombre y etiquetas [blog 0.18.0.0].
- El orden entre hermanas es un índice fraccionario, como el de las páginas [API]. No se dice si ese orden decide qué
  región se pinta encima de otra [inferido: probablemente sí].
- **Mapas anidados**: un pin enlaza con una página o directamente con una pestaña de mapa, y así se baja de mundo a
  región, ciudad y mazmorra [funciones, API]. En 2020 había un modo (con Mayús) que dejaba solo los pines que llevan a
  otro mapa y saltaba a él con un clic [blog 0.7.11]; no consta si sigue en el mapa nuevo.
- **Mapa incrustado** en una página o en su columna lateral, que se centra solo en el pin que apunta a esa página
  [blog 0.18.0.0, API].

### 4. Esconder y revelar

- **Cada elemento tiene su «oculto»** (pines, rótulos, regiones, rutas y carpetas): lo oculto solo lo ven los
  administradores [API]. Por la API, a un miembro la lista no le trae los ocultos y pedir uno responde «no encontrado»
  [API].
- **Carpeta oculta, contenido oculto**: hasta enero de 2026 el oculto de un pin no pasaba a sus descendientes, y se
  corrigió [blog 0.18.0.1]. Así que esconder una carpeta esconde lo de dentro [inferido].
- **Revelar** es quitar el oculto desde el menú del elemento, y les aparece al momento a los conectados [blog 0.4.2,
  2019]. No hay aviso, ni lista de lo revelado, ni destinatarios: se revela a todos los miembros [ver la nota
  `visibilidad.md`].
- El administrador ve lo oculto semitransparente, y el propio autor dijo que se pierde en mapas con mucho color
  [blog 0.6.1, 2020]. No consta si el mapa nuevo lo marca de otra forma.
- **No hay niebla de guerra**: estaba en los planes desde 2020 y en enero de 2026 cerraron un acceso a una versión a
  medio hacer [funciones, blog 0.18.0.1].
- La pestaña de mapa entera también se puede ocultar, y la página que la tiene [ayuda].

### 5. Escala, regla y viaje

- **Calibrar**: con la regla, dos puntos cuya distancia se conoce, se escribe esa distancia (en millas o kilómetros) y
  se pulsa calibrar. Desde entonces el mapa enseña una barra de escala abajo a la izquierda que cambia con el zoom
  [ayuda, blog 0.18.0.0].
- **Medir**: después, dos puntos cualesquiera dan la distancia [ayuda]. No se dice si la regla admite varios tramos.
- **Navegación**: con el modo navegación (un botón de brújula desde la 0.20) se pincha un origen y un destino, y calcula
  el camino por las rutas dibujadas, con indicaciones que nombran las rutas y los pines que se cruzan, la distancia y,
  con una velocidad de viaje propia, el tiempo [ayuda, blog 0.18.0.0, 0.20.0]. Es decir, trata las rutas como una red
  y busca el camino más corto [inferido]. El ajuste con Ctrl es lo que une rutas y pines en esa red [inferido].
- **Una sola velocidad**: los textos hablan siempre de «una velocidad de viaje» personalizada, no de varias (a pie, a
  caballo) [blog]. No se encontró dónde se guarda ni si es por mapa o por usuario.
- **Los jugadores miden**: una semana después de estrenar el mapa activaron la regla y la navegación en el modo de
  solo lectura, y desde la 0.20 los mapas publicados también conservan la regla, la selección y la navegación
  [blog 0.18.0.2, 0.20.0].
- La calibración y la velocidad **no salen en la API**: el mapa solo expone su imagen, su marco de coordenadas y sus
  elementos [API].

### 6. IA y formato de la geometría

- **No hay IA**, ni para dibujar ni para escribir. Su autor tiene una postura crítica con la IA generativa (notas de
  2024 y 2025 en un artículo de 2022) y presume de «hecho a mano» [blog].
- **La API escribe en el mapa** desde octubre de 2026 (planes de pago): crear, cambiar y borrar elementos uno a uno,
  con identificador elegido por el cliente para poder sincronizar [API, blog 0.20.0]. Un MCP de terceros ya expone
  crear, cambiar y borrar elementos del mapa, en coordenadas del mapa o en píxeles de la imagen [extracto].
- **Coordenadas**: pares `[lat, lng]` de Leaflet en un marco plano derivado de la imagen. La esquina de arriba a la
  izquierda es (0, 0), la latitud baja hacia abajo, y un píxel (x, y) está en (−y / 2^z, x / 2^z), con z el zoom en
  que la imagen cabe en teselas de 256 px. La API documenta la conversión y su SDK la trae hecha [API].
- **Formas**: un pin o un rótulo tienen un punto; una región, una lista de vértices o varias listas (hasta 100
  polígonos de hasta 10.000 vértices; no se habla de huecos); una ruta, una lista de puntos [API].
- **Al cambiar la imagen** por otra de otro tamaño, los elementos conservan sus coordenadas y quedan sobre otro sitio
  de la imagen [API]: el marco depende del tamaño en píxeles.
- Desde octubre de 2026 el servidor guarda versiones de cada pestaña, también de los mapas, y se puede restaurar solo
  una pestaña [blog 0.21.0].

## Compromisos y límites

Ganan un editor sencillo y rápido, con pocas herramientas bien resueltas (ajuste, frontera prestada, modo bloqueo,
deshacer), estilos cerrados que caben en un menú, y una navegación por rutas que gusta mucho. El precio:

- **La visibilidad es de un solo nivel**: oculto o visible para todos los miembros. Ni grupos, ni campañas, ni aviso.
- **La capa no es un objeto**: es una carpeta de elementos. No hay opacidad ni estilo por capa, ni consta un
  «ocultar a los jugadores» distinto del «esconder en mi vista».
- **Una sola velocidad** de viaje, y la calibración no es accesible por la API.
- **Retocar vértices** no está documentado. La frontera prestada parece copiar puntos, no compartirlos.
- **Coordenadas atadas al tamaño de la imagen**: cambiar la imagen por otra de distinta resolución descoloca todo.
- **Siete años sin regiones ni rutas**, y la niebla de guerra sigue sin llegar.
- Lo oculto se semitransparenta para el máster, que su autor ya vio que se confunde con el mapa.

## Qué nos llevamos a Crisol

- **La capa como carpeta de elementos**, con su oculto, que cubre lo que pidió Enrique: capa oculta, todo oculto;
  capa visible, cada región o ruta según «lo que sabe» la campaña. Lo distinto: separar el «ocultar a los jugadores»
  (servidor) del «apagar en mi pantalla» (vista), que en LegendKeeper no queda claro. Los jugadores también pueden
  apagar capas en su vista.
- **Lo oculto no se manda**, como su API (lista sin ocultos, «no encontrado»). En Crisol es norma: el servidor filtra
  también para la IA del jugador.
- **Estilos como listas cerradas** (relleno liso, rayado, punteado; borde liso, discontinuo, punteado; opacidad; color
  hexadecimal; nombre siempre, al pasar o nunca; contorno o caja tras el texto). Es poco para el máster y muy fácil de
  rellenar para la IA por el MCP, que no debe inventar CSS.
- **Rango de zoom** por elemento o por capa, para que los rótulos de ciudades no tapen el mapa de Eana de lejos.
- **Ajuste y frontera prestada**, pero mejor: si la IA dibuja los reinos de Eana, las fronteras vecinas deben
  coincidir. Propuesta: que el servidor ajuste los vértices cercanos a los de la región vecina al guardar lo que manda
  la IA, y que el editor ajuste al arrastrar. Compartir aristas de verdad (topología) es más caro; se decide en la spec.
- **Retocar vértices** con arrastre, clic en una arista para añadir y botón derecho para quitar: es lo que Enrique hará
  más (mover puntos), y LegendKeeper no lo documenta. Pocas herramientas: polígono, línea, texto, como ellos.
- **Calibrar con dos puntos y una distancia**, barra de escala, área y largo cuando hay escala. Igual que ellos.
- **Medir siguiendo una ruta**: su navegación por la red de rutas es lo más celebrado. Para Crisol basta, de entrada,
  con medir a lo largo de una ruta elegida entre dos puntos suyos; la red con camino más corto puede venir después.
- **Varias velocidades** (a pie, a caballo, en barco) en los ajustes del mapa, que ellos no tienen, y que la calibración
  y las velocidades se lean y escriban por el MCP (en su API no están).
- **Los jugadores miden desde el principio**: ellos tuvieron que activarlo a la semana.
- **Coordenadas normalizadas de 0 a 1** sobre la imagen, como nuestros pines, mejor que su marco de Leaflet atado a los
  píxeles: cambiar la imagen por otra mayor del mismo mapa no descoloca nada. La conversión a Leaflet (si se usa) queda
  en el cliente.
- **Un formato por tipo**: punto para pin y texto, lista de puntos para ruta, lista de anillos para región (con varios
  trozos, como sus islas), con un límite de vértices. Pensar si hacen falta huecos (un lago dentro de un reino).
- **Lo oculto se distingue con un borde o un icono**, no con transparencia, por lo que su autor mismo reconoció.
- **Versiones del mapa** en el servidor, porque la IA puede redibujar una capa entera y hay que poder volver.

## Fuentes

Centro de ayuda:

- https://www.legendkeeper.com/help/maps/
- https://www.legendkeeper.com/help/how-to-create-a-map-from-an-image-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-add-pins-to-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-draw-roads-and-routes-on-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-draw-regions-on-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-add-labels-to-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-measure-distances-on-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-plan-a-route-on-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-preview-a-page-from-a-map-in-legendkeeper/

Changelog y blog:

- https://www.legendkeeper.com/changelog/legendkeeper-0-18-0-0/ (10-01-2026: el mapa nuevo)
- https://www.legendkeeper.com/the-new-legendkeeper-map-tool-is-here/ (13-01-2026)
- https://www.legendkeeper.com/changelog/legendkeeper-0-18-0-1/
- https://www.legendkeeper.com/changelog/legendkeeper-0-18-0-2/ (regla y navegación en solo lectura)
- https://www.legendkeeper.com/changelog/legendkeeper-0-19-0-0-2/
- https://www.legendkeeper.com/changelog/legendkeeper-0-19-0-1/
- https://www.legendkeeper.com/changelog/legendkeeper-0-20-0-1/ (API; brújula de navegación)
- https://www.legendkeeper.com/changelog/legendkeeper-0-21-0/ (versiones en el servidor)
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-11-hidden-tabs-map-navigation-mode/ (2020)
- https://www.legendkeeper.com/changelog/legendkeeper-0-4-2-pin-permissions/ (2019)
- https://www.legendkeeper.com/changelog/legendkeeper-0-6-1-hide-articles-tag-filtering-map-pins/ (2020)
- https://www.legendkeeper.com/detailed-rpg-maps/ (febrero de 2026: tutorial de regiones, rutas y rótulos)
- https://www.legendkeeper.com/dev-update-map-chop/ (2024: teselas al vuelo)
- https://www.legendkeeper.com/foundations-vol-3/ y https://www.legendkeeper.com/foundations-vol-4/
- https://www.legendkeeper.com/worldbuilding-with-ai/ (2022, con notas de 2024 y 2025)
- https://www.legendkeeper.com/features/ y https://www.legendkeeper.com/features-maps/

Desarrolladores:

- https://www.legendkeeper.com/developers/guide/
- https://www.legendkeeper.com/api/v3/openapi.json (esquemas Feature, FeatureCreateParams, MapImage, MapViewport)

Terceros:

- https://market.lobehub.com/s/plugins/chase-roohms-legendkeeper-mcp (MCP con herramientas de elementos del mapa)
