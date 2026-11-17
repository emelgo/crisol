# Mapas con capas en Obsidian Leaflet (y Campfire)

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-12 · Versión estudiada: Obsidian Leaflet 6.0.5
(marzo de 2024, la última; en mantenimiento) por su README y su registro de cambios; Campfire por su web pública

## Pregunta

Obsidian Leaflet es el complemento de mapas que muchos másteres usan en Obsidian (y que conoce bien Enrique por el
Crisol actual). Queríamos saber cómo resuelve superposiciones y regiones, GeoJSON, la regla de distancia, la escala
sobre una imagen, los tiempos de viaje y las capas; si tiene IA; y qué formato usa. De paso, si el módulo de mapas de
Campfire aporta algo.

**Cómo se leyó.** El README, el registro de cambios, los metadatos del repositorio (javalent/obsidian-leaflet) y
algunas peticiones públicas. No se leyó el código; de la carpeta de dibujo solo se miraron los nombres de los archivos.
Grado de certeza:

- **[README]** y **[cambios]**: documentación del propio repositorio. **[petición]**: incidencias públicas de GitHub.
- **[repo]**: metadatos o nombres de archivos del repositorio. **[web]**: web pública de Campfire.
- **[inferido]**: deducido, sin comprobar.

**Licencia.** El `package.json` declara MIT, pero el repositorio no tiene archivo LICENSE y GitHub no detecta ninguna
[repo]. Si algún día se trae algo de su código, hay que tenerlo en cuenta en `docs/terceros.md`.

## Lo que hacen

### Qué es

- Un bloque de código `leaflet` dentro de una nota, con opciones en YAML: imagen, zum, centro, unidad, escala,
  marcadores… [README]. Usa Leaflet.js por debajo [README].
- **Estado**: en modo mantenimiento desde 2024; se revisan arreglos, no se atienden peticiones nuevas [README, repo].
- Doble origen de datos [README]:
  - lo escrito en el bloque o en el frontmatter de las notas (fijo: no se edita sobre el mapa);
  - lo que se crea sobre el mapa (se guarda con el mapa y se borra a los siete días si el bloque desaparece de todas
    las notas).

### Coordenadas de un mapa de imagen

- El propio autor admite que los mapas de imagen son «un apaño» sobre Leaflet: hay un mapa geográfico invisible debajo
  y la imagen se estira encima, centrada en 0,0. Si se cambia el zum, la imagen parece cambiar de sitio [README].
- El remedio es fijar los **límites** (esquina superior izquierda y la inferior derecha) y así la imagen queda siempre en
  el mismo lugar; si no casan con la proporción de la imagen, se deforma, y lo ya puesto no se recoloca [README].
- Sin límites, la latitud y longitud de un mapa de imagen se dan **en porcentaje desde la esquina superior izquierda**
  [README]. Es decir, coordenadas que no son píxeles ni grados, y que cambian de sentido si se ponen límites [inferido].

### Capas

- **Varias imágenes** en un mapa son capas de fondo intercambiables (una a la vista cada vez) desde un control arriba a
  la derecha, con alias; los marcadores se guardan **por capa** [README].
- **Imágenes superpuestas** entre dos esquinas, que se encienden y apagan desde el mismo control [README].
- Los marcadores pueden tener **zum mínimo y máximo**: desaparecen fuera de ese intervalo (ciudades que solo salen de
  cerca) [README]. Es la única «capa» de marcadores: no hay grupos que se oculten juntos más allá de filtrar por
  etiqueta al crearlos desde notas [README, inferido].

### Regiones, superposiciones y dibujo

- **Superposición**: un círculo con color, centro, radio con unidad (km, mi, ft) y descripción. Se dibuja con
  Mayúsculas y clic derecho, arrastrando el radio, o se escribe en el bloque o en el frontmatter (`mapoverlay`); una
  propiedad de la nota puede dar el radio (por ejemplo «a 50 km») [README]. Se dibujan por orden y uno grande tapa a
  uno pequeño, que deja de poder pulsarse [README].
- **Dibujo libre** desde la 4.0: un control para dibujar y editar formas sobre el mapa, con color por defecto [cambios,
  README]. Por los nombres de los archivos, polígono, polilínea, rectángulo y texto, con edición de vértices [repo]; la
  petición de etiquetas de texto se cerró como hecha [petición]. El README no explica el uso.
- Desde la 5.3, **los dibujos se guardan como GeoJSON**, a petición de usuarios que querían algo reutilizable [cambios,
  petición]. Sigue abierta la de **generar dibujos desde el frontmatter** de las notas (la ruta recorrida, unas líneas
  por nota) [petición].
- **GeoJSON** como archivo: se cargan uno o varios (o una carpeta), con estilo según la especificación SimpleStyle de
  Mapbox (color, grosor, relleno), un enlace a una nota y una etiqueta tomada de `title`, `name` o `description`
  [README]. También rutas GPX, con datos de altura y ritmo [README, cambios].

### Escala, regla y tiempos

- `unit` y `scale`: la distancia calculada se multiplica por la escala y se muestra con la unidad; en mapas reales basta
  la unidad y convierte desde metros [README]. **No hay calibrado** con una raya conocida: el número se pone a mano, y
  hay que averiguar a qué equivale la unidad del mapa invisible [README, inferido].
- **Regla**: Mayúsculas o Alt y clic en dos puntos (o marcadores, a los que se pega); se ve la línea en directo con su
  distancia; desde la 5.5 se encadenan tramos y desde la 5.4 se mide una **polilínea dibujada** [README, cambios]. Un
  recuadro abajo a la izquierda guarda la última medida: al pasar por encima la pinta y al pulsar la encuadra [README].
  En móvil se mide desde el menú de pulsación larga [cambios].
- **Tiempo de viaje**: no existe como tal. Lo más cercano es `distanceMultiplier` (desde la 3.7), que enseña un segundo
  valor multiplicado junto a la distancia [cambios]; con él se puede fingir «días» [inferido]. Ya no figura en el README.
- No hay visibilidad para jugadores: es una herramienta personal dentro del almacén de notas [README, inferido].

### IA y formato

- Ninguna IA [README, por omisión]. La «automatización» es crear marcadores desde las propiedades de las notas
  (carpeta, etiqueta, enlaces, con Dataview) [README].
- Formatos: pares latitud-longitud en YAML para marcadores y círculos, GeoJSON para formas y archivos, GPX para rutas,
  CSV para exportar e importar marcadores [README, cambios].

### Campfire, en dos líneas

Su módulo de mapas (de escritura de novelas) tiene pines enlazados a elementos y a otros mapas, «zonas» que enlazan una
región entera, capas «para ver el mapa desde otra perspectiva», etiquetas, leyenda, rosa de los vientos, escala en
unidades métricas, imperiales o propias y una regla para seguir los viajes [web]. No documenta cómo se dibujan las zonas,
cómo se calibra la escala, tiempos de viaje, visibilidad para lectores ni IA, así que no da para nota propia. Su detalle
útil: enlaza mapas de Inkarnate y se actualizan solos al editarlos allí [web].

## Compromisos y límites

- **Gana en integración con las notas**: un marcador o un círculo sale de una propiedad de la nota, y el mapa se
  rellena solo con las notas de una carpeta o etiqueta. Es lo que hace que funcione en un almacén de Obsidian.
- **Pierde en coherencia**: dos fuentes de verdad (bloque fijo frente a lo dibujado), coordenadas en porcentaje o según
  unos límites, imagen que se desplaza si no se fijan, datos que caducan a los siete días. El propio autor lo llama apaño.
- Escala y regla buenas (tramos, medir una línea dibujada, último resultado a mano), pero con un número de escala que
  hay que adivinar y sin días de viaje.
- Las capas son fondos o imágenes, no conjuntos de trazos ocultables; nada de compartir con jugadores.
- Proyecto parado: la petición de dibujar desde datos de las notas (lo más parecido a «la IA traza») no se hará.

## Qué nos llevamos a Crisol

- **GeoJSON como formato de lo dibujado**, como su 5.3: es un estándar, la IA lo conoce y escribirlo por el MCP es
  natural. Con coordenadas planas sobre la imagen (no grados) y estilo con nombres de SimpleStyle (`stroke`, `fill`,
  `stroke-width`, `fill-opacity`), que evitan inventar otro vocabulario.
- **Un único sistema de coordenadas fijo a la imagen** (de 0 a 1, como nuestros pines, o píxeles de la imagen
  original). Su apaño del mapa invisible es justo lo que hay que evitar: nada que dependa del zum ni de unos límites.
- **Una sola fuente de verdad**: lo que la IA traza y lo que Enrique retoca son el mismo objeto, editable, sin bloques
  fijos aparte.
- **La regla de Leaflet, entera**: medir de punto a punto encadenando tramos, pegarse a pines, medir una ruta dibujada y
  dejar a la vista la última medida. Pero con la escala **calibrada dibujando** y con días a pie, a caballo y en barco,
  que es lo que su `distanceMultiplier` intentaba.
- **Zum mínimo para lo pequeño**: que las etiquetas y rutas menores solo salgan de cerca es una idea barata que despeja
  el mapa del mundo. Puede ser un ajuste de la capa.
- **Capas de fondo intercambiables** (el mapa político y el físico) con lo dibujado en común, quizá más adelante.
- De Campfire, solo confirmar el conjunto mínimo (zonas enlazadas a páginas, capas, escala y regla) y que traer la
  imagen de Inkarnate es un caso real.

## Fuentes

- https://github.com/javalent/obsidian-leaflet (README.md, CHANGELOG.md, package.json, manifest.json y árbol de archivos)
- https://github.com/javalent/obsidian-leaflet/issues/331
- https://github.com/javalent/obsidian-leaflet/issues/337
- https://github.com/javalent/obsidian-leaflet/issues/343
- https://github.com/javalent/obsidian-leaflet/issues/209
- https://www.campfirewriting.com/interactive-maps
- https://campfirewriting.com/worldbuilding-tools (solo en extracto del buscador)
- No se pudo abrir: https://plugins.javalent.com/leaflet (conexión rechazada) ni https://www.campfirewriting.com/maps
  (no existe).
