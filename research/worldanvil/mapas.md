# Mapas con capas en World Anvil

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-12 · Versión estudiada: web pública a fecha de hoy
(mapas «v1.5» de febrero de 2024, novedades hasta el boletín de noviembre de 2026; API pública 2.0.0 «Boromir»)

## Pregunta

Las mismas que la nota de LegendKeeper (`research/legendkeeper/mapas.md`), para la spec del módulo 9
(`docs/intent/mapas-pizarras.md`): qué elementos se dibujan sobre un mapa (marcadores, regiones, rutas, rótulos) y
cómo; estilos; capas y grupos; mapas anidados; cómo se esconde una capa o un marcador a los jugadores y cómo se
revela; escala, regla y tiempos de viaje; y si hay IA que dibuje y en qué formato se guarda la geometría.

**Cómo se leyó.** Como en la nota de visibilidad, la web principal de World Anvil (guías «Learn», Codex, foro de
sugerencias, página de funciones) responde con una comprobación antibots, y el archivo de Internet devolvió «demasiadas
peticiones». Se leyeron enteros siete artículos de su blog sobre mapas (2018 a 2024), los boletines de 2025 y 2026 y la
especificación pública de su API (esquemas de mapa, capa, grupo de marcadores, marcador y tipo de marcador). Las guías
y las sugerencias se conocen solo por los extractos del buscador. Ni cuenta ni código. Grado de certeza:

- **[blog]**: blog oficial, leído entero (se da el año).
- **[API]**: especificación pública de la API (Boromir), que describe los campos tal como se guardan.
- **[extracto]**: páginas oficiales (guías, Codex, sugerencias) vistas solo en los extractos del buscador.
- **[inferido]**: deducido, sin comprobar.

Muchas funciones de mapa dependen del plan de pago, y se indica cuando consta.

## Lo que hacen

### El modelo, en breve

Un mapa es un objeto propio del mundo (no una pestaña de un artículo): una imagen subida, con título, descripción,
leyenda, brújula opcional, zoom inicial, mínimo y máximo, centro inicial y un enlace opcional a un artículo de lugar o
de organización [API, blog 2018]. World Anvil insiste en que **no es un programa para hacer mapas**: la imagen se hace
fuera y se sube [blog 2021, extracto]. Sobre ella hay tres piezas [API, blog 2018]:

| Pieza | Qué es |
|---|---|
| Marcador | Todo lo que se pone encima: pin, rótulo, polígono, círculo, línea o zona invisible |
| Grupo de marcadores | Un conjunto con nombre de marcadores, que el lector enciende y apaga |
| Capa | **Otra imagen** que se superpone o sustituye a la base (política, física, subterránea), a la que se puede atar un grupo de marcadores |

Es decir, las regiones y las rutas son **marcadores** con forma, y lo que en LegendKeeper sería una capa aquí es un
grupo de marcadores. La «capa» de World Anvil es una imagen [API, extracto].

### 1. Elementos y cómo se dibujan

- **Tipos**: pin (con icono temático o diseñado en su «Studio»), rótulo de texto que se comporta como un pin, polígono,
  círculo, línea y marcador invisible, una zona activa que no se ve hasta pasar el ratón [blog 2018, extracto].
- **Polígono**: se elige la herramienta, clic en cada vértice y se cierra pinchando en el primero. Después sale un panel
  con el color del borde, el del relleno, la opacidad de cada uno, el grosor y el tamaño del discontinuo [extracto].
- **Línea**: como el polígono, sin cerrar. La guía la propone para rutas y para seguir el viaje de un personaje
  [extracto]. **Círculo**: centro y radio [API].
- **En vivo desde 2024**: antes había que pasar por formularios y recargar. Desde los mapas «v1.5» los puntos aparecen
  en el mapa según se ponen, hay un selector de color y los pines y rótulos se arrastran en el modo de edición
  [blog 2024].
- **Crear un pin** con el botón derecho en el modo de presentación, y crear o enlazar su artículo en el mismo formulario
  [blog 2020, 2021].
- **Retocar vértices**: **no se encontró** cómo se mueven los puntos de un polígono o de una línea ya hechos. Hay una
  sugerencia de los usuarios titulada «editar rápido los puntos del mapa» [extracto], lo que hace pensar que no es
  cómodo [inferido].
- No consta ajuste a otros elementos, ni fronteras compartidas, ni deshacer.

### 2. Estilos

- **Formas**: color y opacidad del borde y del relleno por separado, grosor, discontinuo (un número), y la opacidad como
  entero (de 0 a 100) [API, extracto].
- **Pines**: icono de FontAwesome (los de RPG Awesome se prometieron en 2022), un tipo de marcador reutilizable con
  tamaño, sombra y anclajes, y una etiqueta con seis estilos fijos [API, blog 2022].
- **CSS**: cada marcador admite una clase CSS propia, y el mapa entero se puede estilar con CSS del mundo
  (los planes de pago) [blog 2018, API]. Desde 2024 también una imagen de fondo detrás del mapa [blog 2024].
- No consta que el nombre de un polígono o una línea se dibuje sobre él, ni rango de zoom por elemento.

### 3. Capas, grupos y mapas anidados

- **Capas**: se suben desde la pantalla de edición del mapa, se eligen con un botón «Capas» y pueden ser
  semitransparentes para superponerse a la base. Los usos que proponen: mapa político, físico, de temperaturas, o
  superficie y subsuelo [extracto, blog 2024]. En octubre de 2026 su boletín enseñaba a combinar una capa transparente
  con un grupo de marcadores para añadir información encima [blog 2026].
- **Grupos de marcadores** (desde el plan Master): reúnen pines por tipo (ciudades, mazmorras, caminos) y el lector los
  enciende y apaga en un menú arriba a la derecha. Un grupo puede salir encendido al abrir el mapa. **Un marcador solo
  está en un grupo** [blog 2018, 2021, API, extracto].
- **Grupo atado a una capa** (Grandmaster en 2018): los pines del grupo salen solo con esa capa; un pin de la capa base
  sale con todas, como la entrada de una cueva que se ve arriba y abajo [blog 2018].
- **Orden**: capas, grupos y marcadores tienen una posición numérica [API]. No se dice qué decide qué forma se pinta
  encima.
- **Sin grupos anidados**: hay una sugerencia para agrupar pines dentro de otros grupos [extracto].
- **Mapas anidados**: un pin con «enlace directo» abre otro mapa (o un lugar, o una organización) en vez de su ventana
  [blog 2018, extracto]. Para hacer clicable una región entera, los usuarios ponen un polígono invisible que lleva al
  mapa hijo, y así cuantos niveles quieran [extracto]. Un mapa no se puede incrustar en la descripción de un marcador
  [extracto].
- **Incrustar** un mapa en un artículo con un código, centrado en unas coordenadas y un zoom. Lo que no se puede es
  elegir qué capas y grupos salen encendidos al incrustarlo: es una sugerencia aceptada, sin fecha [blog 2020,
  extracto].
- **Crónicas** (2022): una línea temporal unida a un mapa, cuyos sucesos se atan a marcadores; con varios mapas se
  enseña cómo cambia el mundo por épocas [blog 2022].

### 4. Esconder y revelar

- **Todo tiene estado y grupos de suscriptores**: el mapa, cada capa, cada grupo de marcadores y cada marcador es
  público o privado, y si es privado se abre a unos grupos de suscriptores [API, extracto]. La guía pone de ejemplo un
  grupo «solo el máster» o «solo los elfos» [extracto].
- **Tres niveles en que esconder**: el mapa entero (también con el ojo de visibilidad del artículo que lo incrusta, desde
  2020), una capa o un grupo (todo lo suyo a la vez), y un marcador suelto [blog 2020, API, extracto].
- **Semillas del narrador** en cada marcador: notas que solo ve el autor [API].
- **Revelar** es cambiar el estado o los grupos del marcador, del grupo o de la capa [API, inferido]. No se encontró
  aviso a los jugadores, ni cambio en vivo para quien ya tiene el mapa abierto, ni lista de lo revelado.
- **El máster no ve el mapa como un grupo**: una sugerencia pide filtrar la vista por grupo de suscriptores para
  enseñarlo en la mesa, porque el autor lo ve todo [extracto].
- **Encender un grupo no es lo mismo que verlo**: el lector solo puede encender los grupos a los que tiene acceso
  [extracto, inferido].
- **Pines que arrastran los jugadores**: un marcador puede marcarse como arrastrable [API], y la página de funciones
  habla de «pines que tus jugadores pueden mover» [extracto]. No se dice si el cambio se guarda para todos.
- No se encontró niebla de guerra en el mapa del mundo.

### 5. Escala, regla y viaje

**No hay**. No se encontró regla, escala calibrada ni tiempos de viaje en ningún texto oficial. En su foro hay una
sugerencia de «herramienta para medir distancias en los mapas», sin respuesta visible [extracto], y los usuarios
publican tablas de distancias entre lugares como artículos [extracto]. Lo único cercano es fijar el zoom mínimo y
máximo [blog 2018].

### 6. IA y formato de la geometría

- **No hay IA** que dibuje ni escriba. El equipo rechazó sugerencias de funciones con IA por estar «fuera del
  alcance» de World Anvil, y en Reddit se cuenta que defiende una postura neutral [extracto].
- **La API escribe** mapas, capas, grupos y marcadores [API]. No consta un MCP oficial.
- **Coordenadas en píxeles de la imagen**: un marcador lleva su punto como dos enteros no negativos (x, y), más una
  tercera que suele ir vacía [API, inferido]. El polígono y la línea guardan sus puntos como **un texto** de pares «x,y»
  separados por espacios, y el círculo un radio entero [API].
- **Leaflet**: los anclajes de icono y de ventana, el tamaño de la sombra y los zooms negativos del mapa son los de
  Leaflet con un sistema de coordenadas plano [inferido]. Un usuario contó en 2020 que los pines se desplazaban entre
  el ordenador y el iPad [blog 2020, comentario].

## Compromisos y límites

Ganan en visibilidad: es el único de los dos con grupos de suscriptores en cada capa, grupo y marcador, lo que
resuelve varias campañas en un mismo mapa. Los grupos encendibles y las capas como imágenes alternativas dan mapas
muy ricos. El precio:

- **No es un editor**: las formas se dibujan clic a clic, sin ajuste, sin fronteras compartidas, sin deshacer
  documentado y sin forma clara de retocar puntos.
- **Sin escala ni regla** después de ocho años de mapas, pese a pedirse.
- **Dos ideas de «capa»**: la imagen (capa) y el conjunto de marcadores (grupo), que el usuario tiene que combinar.
- **Un marcador, un grupo**: no se puede tener un pin en «ciudades» y en «secretos» a la vez, ni grupos anidados.
- **El máster no previsualiza por grupo**, y los incrustados no eligen capas.
- **Estilo por CSS** para lo fino: potente para quien sabe, opaco para los demás y para una IA.
- **Puntos como texto** en píxeles enteros: cambiar la imagen por otra de distinta resolución descoloca todo, y el
  texto hay que analizarlo para validarlo.
- Las funciones de forma (polígonos, círculos, grupos) dependen del plan, y las fuentes no coinciden en cuál.

## Qué nos llevamos a Crisol

- **Visibilidad en dos niveles, como pidió Enrique**: la capa (aquí, su grupo de marcadores) y el elemento. Su modelo
  de grupos de suscriptores es el antecedente de nuestro «lo que sabe» cada campaña: en Crisol la capa y cada región o
  ruta se revelan por campaña o por personaje, con el mismo mecanismo que los pines.
- **Capa visible ≠ capa encendida**: el jugador puede apagar en su vista una capa que conoce (sus grupos encendibles),
  y una capa puede salir encendida o apagada al abrir el mapa (su «activo al cargar»). Lo oculto, en cambio, no llega.
- **Un elemento en una sola capa** está bien para empezar (como ellos), pero que no impida etiquetar.
- **Ver como una campaña** en el mapa, que ellos no tienen y se les pide: el máster enseña el mapa en la mesa tal como
  lo ve el grupo.
- **Semillas del narrador**: una nota solo del máster en cada región o ruta, que nunca llega al jugador ni a su IA.
- **La capa como imagen** (política, física) queda fuera del módulo 9, pero el modelo no debería impedirla: una capa
  podría llevar más adelante una imagen superpuesta con opacidad.
- **Zona invisible que lleva a otro mapa**: las regiones de Crisol pueden enlazar a una página (y con ella a su mapa),
  que es el anidado que buscan sus usuarios con un truco.
- **La regla es nuestra ventaja**: no la tienen y se la piden. Calibrar, medir y días de viaje con varias velocidades.
- **Pines que mueven los jugadores**: para «situar a los jugadores» en el mapa de Eana podría bastar un pin del grupo
  que mueve el máster. Que lo muevan los jugadores queda fuera salvo que Enrique lo pida.
- **Formato estructurado, no texto**: listas de puntos en JSON y coordenadas normalizadas de 0 a 1 (como nuestros
  pines), no cadenas «x,y» en píxeles. Estilos como valores cerrados, no clases CSS, para que la IA los rellene bien.
- **Aviso al revelar** y cambio en vivo para quien tiene el mapa abierto, que no consta en ninguno de los dos.

## Fuentes

Blog oficial:

- https://blog.worldanvil.com/worldanvil/dev-news/new-feature-major-upgrade-maps/ (2018: mapas 2.0, capas, grupos)
- https://blog.worldanvil.com/worldanvil/dev-news/new-feature-maps-blue-goat/ (2018: modo simple, grupos secretos)
- https://blog.worldanvil.com/worldanvil/focus-your-maps-where-you-want-them-and-other-map-upgrades/ (2020)
- https://blog.worldanvil.com/worldanvil/dev-news/introducing-the-visibility-toggle-show-to-your-players-only-what-you-want-them-to-see/
  (2020)
- https://blog.worldanvil.com/worldanvil/tutorials/how-to-create-your-world-by-setting-up-your-map/ (2021)
- https://blog.worldanvil.com/worldanvil/dev-news/map-your-worlds-history-through-time-place/ (2022: crónicas)
- https://blog.worldanvil.com/worldanvil/dev-news/chronicles-roadmap-see-whats-coming-next/ (2022)
- https://blog.worldanvil.com/worldanvil/dev-news/interactive-maps-upgrades/ (2024: mapas «v1.5»)
- https://blog.worldanvil.com/newsletter/world-anvil-news-september-2026/ (marcadores en la búsqueda)
- https://blog.worldanvil.com/newsletter/world-anvil-news-october-2026/ (capas transparentes con grupos)

API:

- https://www.worldanvil.com/api/external/boromir/documentation
- https://wa-cdn.nyc3.cdn.digitaloceanspaces.com/assets/prod/boromir-documentation/swagger/openapi.yml y sus partes
  `parts/map/*.yml`, `parts/map/schemas/{map,layer,markergroup,marker}.*.yml`, `parts/markertype/schemas/*.yml`

Páginas oficiales vistas solo en extractos del buscador:

- https://www.worldanvil.com/learn/map-making/maps
- https://www.worldanvil.com/learn/map-making/create-polygon-marker
- https://www.worldanvil.com/learn/map-making/create-circle-marker
- https://www.worldanvil.com/learn/map-making/create-map-line
- https://www.worldanvil.com/learn/beginner-tutorials/get-started-maps
- https://www.worldanvil.com/w/WorldAnvilCodex/a/maps
- https://www.worldanvil.com/w/WorldAnvilCodex/a/gamemaster-workflow
- https://www.worldanvil.com/features/maps
- https://www.worldanvil.com/community/voting/suggestion/844bb4e7-0d68-4fa3-b426-8ac785e41946/view (medir distancias)
- https://www.worldanvil.com/community/voting/suggestion/d5df4544-21ad-46a5-97fd-5aaa00cb7495/view (editar puntos)
- https://www.worldanvil.com/community/voting/suggestion/7d791b3f-bf99-43a7-9e87-e4e86e62e6b2/view (vista por grupo)
- https://www.worldanvil.com/community/voting/suggestion/33d900c7-917d-4818-b033-d26115c5aa3f/view (incrustar capas)
- https://www.worldanvil.com/community/voting/suggestion/d80f6fa7-a637-437e-8f8f-0efa4c62394c/view (grupos anidados)
- https://www.worldanvil.com/community/voting/suggestion/182ee13a-ceb8-4bb8-b53d-904bfb2a326e/view (IA rechazada)

Terceros:

- https://www.worldanvil.com/w/dierde-id8tionist/a/distances-between-locations-article (tabla de distancias de un
  usuario)
- Hilo de r/WorldAnvil de septiembre de 2024 sobre contenido hecho con IA (visto en un espejo, por extracto)
