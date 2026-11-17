# Mapas con capas en Kanka

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-12 · Versión estudiada: web pública a fecha de hoy
(documentación «latest» con el explorador nuevo, blog hasta la 3.17 y el diario de desarrollo n.º 12 de julio de 2026)

## Pregunta

Cómo organiza Kanka un mapa del mundo: capas, grupos y tipos de marcador (polígono, círculo, texto, línea); cómo se
dibuja y se retoca; estilos y orden; qué ve cada uno y cómo se revela; escala y regla; mapas dentro de mapas; formato de
las coordenadas; y si hay IA que dibuje.

**Cómo se leyó.** Solo la web pública: docs.kanka.io, el blog (notas de versión y diarios de desarrollo) y la
documentación de su API. Sin cuenta y sin abrir su código, que es copyleft. Grado de certeza:

- **[doc]**: documentación oficial actual. **[API]**: documentación pública de la API 1.0.
- **[blog]**: notas de versión o diario de desarrollo. **[extracto]**: solo visto en el resumen del buscador.
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### Qué es un mapa

- Un mapa es una entrada más del mundo: tiene su imagen, puede ir unido a un lugar (sale en la ficha del lugar) y puede
  tener un **mapa padre**, pensado para el nivel 3 de una mazmorra dentro del mapa de la mazmorra entera [doc].
- Está hecho para mapas del mundo, no tácticos: nada de mover fichas en directo ni niebla [doc].
- Se apoya en **Leaflet** desde 2020 [blog 0.39]. La API guarda alto y ancho de la imagen, zum mínimo, máximo e inicial
  (con valores negativos) y un centro como «latitud y longitud» [API]. Todo apunta a un plano sin proyección sobre los
  píxeles de la imagen (lo que en Leaflet es `CRS.Simple`), pero no lo dicen [inferido].
- Las imágenes grandes se trocean solas en teselas en segundo plano para que cargue y haga zum rápido; mientras tanto
  el mapa no está disponible [doc]. Su plan para «Maps v4» hablaba de mapas de hasta 100 MB [blog, diario 12].
- También puede usar OpenStreetMap en vez de una imagen, y agrupar marcadores cercanos hasta acercarse [doc].

### Tipos de marcador y cómo se dibujan

Desde el explorador nuevo (2026) todo se crea sobre el lienzo, con una barra de herramientas abajo, solo para quien
edita [doc]:

| Tipo | Cómo se dibuja | Cómo se retoca |
|---|---|---|
| Pin | Un clic | Se arrastra si se marca «arrastrable» |
| Texto | Un clic; muestra el nombre del marcador (reinos, regiones) | Se recoloca |
| Círculo | Clic y arrastrar | Se mueve y se cambia de tamaño |
| Área (antes «polígono») | Clic por vértice, doble clic para cerrar | Se arrastran vértices y lados |
| Camino | Clic por punto, doble clic para acabar; para ríos, caminos, murallas, fronteras | Igual que el área |

[doc]

- Un modo «rápido» deja la herramienta activa tras guardar, para poner varios seguidos; Escape cancela; no hay modo de
  edición aparte [doc]. Los cambios se ven en directo para los demás (ya en 2020 los pines arrastrados) [blog 0.39,
  diario 12]. No se documenta deshacer [doc].
- **Antes era peor**: el polígono se creaba con unas coordenadas de relleno escritas a mano («0,0 100,0 0,100»), se
  guardaba y luego, al editarlo, se añadían puntos con clics. La propia documentación lo llamaba un proceso engorroso
  [extracto]. El camino como tipo nuevo y el cambio de nombre a «área» son de Maps v4 [blog, diario 12].
- No hay escritura de coordenadas en el editor actual, ni ajuste a otros trazos (snap), ni curvas: son vértices rectos
  [doc, inferido por omisión].
- Cada marcador lleva **un nombre, una entrada enlazada o las dos**; al seleccionarlo se ve su descripción y la vista
  previa de la entrada [doc]. Se puede duplicar y centrar el mapa en él [doc].

### Estilos

- Color y opacidad para todos; en el área, el color es el relleno y aparte van color, grosor y opacidad del borde; en
  el camino, color, grosor y opacidad de la línea [doc]. Clase CSS propia como escape [doc, API].
- La API (aún con el modelo anterior) añade un tamaño de 1 a 6 con «personalizado» para el radio del círculo, color de
  la letra para las etiquetas y la opción de no abrir la burbuja al pasar el ratón [API].
- Iconos de pin propios (Font Awesome, RPG Awesome o un SVG) solo en campañas de pago [doc].
- No se documentan fuente ni tamaño del texto, trazos discontinuos, ni texto que siga una curva [doc, por omisión].

### Capas y grupos: dos cosas distintas

- **Una capa es una imagen**, no un conjunto de marcadores. Tres tipos: imagen alternativa (mazmorra con y sin trampas),
  superpuesta opcional y superpuesta siempre visible (fronteras políticas, una cuadrícula) [doc]. Se estiran al tamaño
  del mapa. El explorador nuevo solo enseña las «siempre visibles», todas a la vez, y ha perdido el selector de capas
  del visor antiguo [doc]. No se explica el orden de apilado [doc].
- **Las capas no gobiernan marcadores**: no se puede colgar un marcador de una capa para ocultarlo con ella [doc].
- **Los grupos sí agrupan marcadores**: nombre, color, grupo padre (se anidan), posición entre hermanos y visibilidad.
  Salen en la leyenda, con buscador [doc]. La opción «mostrar los marcadores del grupo» solo valía en el visor antiguo;
  en el nuevo no se documenta cómo apagar un grupo [doc].
- Límites: una capa y un grupo por mapa en la versión gratuita, veinte en la de pago, y nunca más de veinte [doc].

### Visibilidad y cómo se revela

- Capa, grupo y marcador usan el mismo desplegable de cinco niveles: todos, solo yo, administradores, yo y
  administradores, miembros [doc, API]. El mapa entero es una entrada, con su casilla de privada y sus permisos por
  papel y por miembro [doc, API].
- Un marcador que lleva a una entrada que el jugador no puede ver tampoco se ve (encadenamiento de permisos) [doc].
- **Revelar es cambiar ese desplegable**, uno a uno; no hay «revelar» con aviso ni algo por grupo de jugadores [doc,
  inferido]. No consta si un grupo oculto esconde sus marcadores visibles [doc, por omisión].

### Escala y medir

- En los ajustes: una **etiqueta de unidad** (km, millas) y una **medida de distancia**, un factor que convierte la
  distancia del mapa a esa unidad. Con las dos, aparece la regla [doc]. No dicen respecto a qué es el factor; en el
  blog, un usuario lo describe como factor de escala y otro avisa de errores con valores muy pequeños (0,0041), lo que
  sugiere unidades por píxel [blog 1.34, inferido]. **No hay calibrado** dibujando una raya de longitud conocida [doc].
- La regla: clic por punto, enseña la distancia entre puntos; Escape acaba el trazado y otro Escape apaga la regla
  [doc]. Los caminos y las áreas pueden mostrar su distancia en el panel de detalle «donde esté configurado» [doc].
- Historia accidentada: la regla de la 1.32 era un complemento de terceros y se quitó porque medía mal; volvió en la
  1.34 [blog].
- No hay tiempos de viaje, velocidades ni días [doc, por omisión]. No consta si los jugadores pueden usar la regla; nada
  la limita a quien edita [inferido]. Hay además una cuadrícula opcional, sin unidad documentada [doc].

### IA y pizarras

- Ninguna IA dentro: el autor dice que nunca les ha atraído meterla [blog, oct. 2026]. Su MCP es de solo lectura, así
  que una IA no puede dibujar en sus mapas por esa vía [blog]. La API REST sí crea marcadores con su forma [API].
- Formato de geometría en la API: latitud y longitud del punto; para el polígono, una cadena con pares de coordenadas;
  radio para el círculo; un estilo de trazo aparte [API]. No es GeoJSON. El camino aún no aparece en la API documentada.
- Kanka tiene **pizarras** desde la 3.5 (noviembre de 2025): formas, dibujo, texto y enlaces a entradas e imágenes, en
  una primera fase sin colaboración ni móvil [extracto].

## Compromisos y límites

- **Gana en sencillez de uso**: cinco herramientas, todo sobre el lienzo, retocar arrastrando, estilo básico. Es justo
  el nivel de «pocas herramientas» que pide Enrique, y les costó llegar: el polígono a base de coordenadas era odiado.
- **Las capas no sirven para lo que Enrique llama capa.** En Kanka una capa es una imagen superpuesta; lo que agrupa y
  oculta marcadores es el grupo. Y el explorador nuevo ha perdido incluso el interruptor de capas.
- **Visibilidad por elemento, sin grupos de jugadores**: cinco niveles fijos, revelar a mano, sin aviso, sin «lo que
  sabe» cada campaña.
- **Escala como número opaco**: un factor que hay que adivinar, con errores de precisión, y sin días de viaje.
- Formato propio de coordenadas sobre los píxeles: fácil de pintar con Leaflet, difícil de llevar a otra parte.

## Qué nos llevamos a Crisol

- **Las cinco herramientas del explorador** (pin, texto, círculo, área y camino), clic por vértice y doble clic para
  cerrar, arrastrar vértices y lados para retocar, Escape para cancelar, y un modo «seguir dibujando». Es la medida de
  Enrique; el círculo quizá sobre.
- **Nuestra capa agrupa trazos, no imágenes**: regiones, rutas y textos dentro de capas que se ocultan enteras, con
  orden de dibujo claro. Lo que en Kanka son dos conceptos (capa y grupo) en Crisol es uno; una imagen superpuesta, si
  hace falta, sería un tipo de elemento más dentro de una capa.
- **Visibilidad en dos niveles, como pide Enrique**: la capa oculta o a la vista, y dentro, cada región o ruta se revela
  por campaña como los pines. Mejor que sus cinco niveles por elemento.
- **El encadenamiento**, igual que en Kanka: una región enlazada a una página que la campaña no conoce no se ve, o se
  ve sin nombre (decidirlo en la spec).
- **Calibrar dibujando, no con un factor**: «esta raya son 100 km» guarda unidades por píxel de imagen, sin decimales
  imposibles. Y la regla también sobre una ruta dibujada, con días a pie, a caballo y en barco, que Kanka no tiene.
- **Coordenadas en píxeles de la imagen** (o de 0 a 1, como nuestros pines), en un formato estándar (GeoJSON con
  coordenadas planas) para que la IA lo escriba bien por el MCP. Kanka demuestra que la API sola no basta: su MCP no
  escribe.
- **Teselas para imágenes grandes**, en segundo plano, como ellos; el mapa de Eana lo agradecerá.
- La pizarra de Kanka confirma el alcance de la nuestra: formas, dibujo, texto y tarjetas de páginas e imágenes.

## Fuentes

- https://docs.kanka.io/en/latest/entries/maps.html
- https://docs.kanka.io/en/latest/entries/maps/setup.html (y su fuente `_sources/entries/maps/setup.md.txt`)
- https://docs.kanka.io/en/latest/entries/maps/markers.html (y `_sources/entries/maps/markers.md.txt`)
- https://docs.kanka.io/en/latest/entries/maps/layers.html
- https://docs.kanka.io/en/latest/entries/maps/groups.html
- https://docs.kanka.io/en/latest/entries/maps/explore.html
- https://app.kanka.io/api-docs/1.0/maps
- https://app.kanka.io/api-docs/1.0/map_markers
- https://blog.kanka.io/ (portada, con la 3.15, la 3.17 y la entrada del MCP)
- https://blog.kanka.io/2026/07/10/developer-log-12/
- https://blog.kanka.io/category/dev-blogs/
- https://blog.kanka.io/2020/07/22/release-0-39-new-maps-module/
- https://blog.kanka.io/2021/03/18/kanka-v1-5-improved-markers-map-copy-icon-attributes-ability-note-parsing-and-more
- https://blog.kanka.io/2022/10/10/1-34-two-factor-authentication-tests-and-theme-fonts-on-the-marketplace/
- Solo en extractos del buscador: https://blog.kanka.io/2022/08/01/1-32-foundations-everywhere/,
  https://blog.kanka.io/2025/11/13/version-3-5-whiteboards-and-higher-limits/ y el texto antiguo de la página de
  marcadores sobre el polígono.
- La nota de visibilidad de Kanka de este mismo directorio (`research/kanka/visibilidad.md`).
