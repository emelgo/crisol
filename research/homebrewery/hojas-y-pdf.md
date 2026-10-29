# Hojas con estilo, paginación y PDF en Homebrewery

Módulo de Crisol: 1. Wiki · Fecha: 2026-10-29 · Versión estudiada: Homebrewery 3.24.2 (`naturalcrit/homebrewery`,
commit `5a883a0`, del 2026-10-29) y su intérprete de Markdown `marked-hbfm` 1.0.3 (`naturalcrit/marked-hbfm`, commit
`58dc729`)

Homebrewery es MIT: su código se puede aprovechar más adelante con su atribución. Esta nota es solo prosa propia,
tablas y algún nombre de clase o marca suelto. Sus fuentes e imágenes no entran en Crisol (ver § 3).

## Pregunta

1. **Marcado**: cómo expresa el autor la maquetación (saltos, bloques con clase, statblocks, notas al margen, bloques
   anchos, imágenes, pies, números de página e índice) y cómo pasa del texto al HTML.
2. **Paginación**: ¿páginas de tamaño fijo con saltos a mano o texto que fluye? ¿Cómo hace las columnas? ¿Qué pasa si
   el contenido no cabe?
3. **Temas**: cómo se monta un tema, herencia y variables; qué lleva el 5e y qué el neutro; licencias de fuentes e
   imágenes, y la del código.
4. **PDF e impresión**: ¿impresión del navegador o PDF en el servidor? Tamaño, márgenes, sangrado, columnas y fondos.
5. **Edición**: cómo se inserta un bloque, cómo es la vista previa y cómo se sincronizan texto y vista.
6. **Qué nos llevamos** a un editor de bloques TipTap con una sola forma de guardar y dos vistas, sencilla y hoja.

## Lo que hacen

Grado de certeza: **[código]** leído en el repositorio clonado (sin instalar ni ejecutar nada), **[observado]**
comprobado en la web pública (homebrewery.naturalcrit.com, versión 3.24.2, la misma del código) o en el origen de cada
licencia (npm, Fontsource, repositorio de las fuentes), **[inferido]** deducido sin comprobarlo. Las pruebas están al
final de esta sección.

**En una frase**: un editor de texto con Markdown ampliado a la izquierda y, a la derecha, una vista previa de páginas
de tamaño fijo. El autor pone a mano los saltos de página, cada página es una caja con columnas CSS, el tema es una
cadena de hojas de estilo y el PDF sale del diálogo de imprimir del navegador.

### 1. Marcado

Todo el documento es **un solo texto**, más una pestaña de CSS propio, otra de fragmentos y otra de metadatos.
La maquetación se escribe con marcas dentro del texto:

| Qué | Cómo lo escribe el autor | Qué sale |
|---|---|---|
| Salto de página | Una línea `\page`. En la misma línea admite clases y estilos entre llaves. | Un `div.page` nuevo con esas clases y estilos |
| Salto de columna | Una línea `\column` | Un `div.columnSplit` que fuerza el salto de columna |
| Espacio vertical | Una línea de dos puntos; más dos puntos, más espacio | Divs vacíos de una línea de alto |
| Bloque con clase | `{{clase,#id,propiedad:valor` en una línea, el contenido y `}}` en otra | Un `div.block` con clases, id, estilos y atributos; dentro se sigue escribiendo Markdown |
| Fragmento en línea | `{{clase texto}}` | Un `span.inline-block` |
| Inyección | `{propiedades}` justo detrás de un elemento: en la misma línea si va en línea (una imagen, una cursiva) o en la siguiente si es un bloque (un título) | Las propiedades se añaden al propio elemento. No funciona con tablas. |
| HTML a mano | Se admite. Si es un `div`, se interpreta el Markdown de dentro. | Tal cual, pasado por el saneado |

[código]

**Statblocks y otros marcos** (tema 5e). El statblock es un bloque `{{monster,frame}}`, y `wide` lo hace ancho. Dentro
va Markdown normal, sin datos:

- un título de segundo nivel con el nombre y una línea en cursiva con tamaño, tipo y alineamiento;
- separadores horizontales, que el tema pinta como su raya decorativa;
- listas de definición con doble dos puntos («clase de armadura», «puntos de golpe»…);
- una tabla con las seis características;
- un título «Actions» y párrafos en negrita y cursiva.

El tema da estilo a esos elementos cuando están dentro de `.monster`. Insertarlo genera un monstruo de broma para
editar a mano. Del mismo modo hay `note` (caja con borde), `descriptive` (texto para leer en voz alta), `quote`, tabla
de clase con marco, lista de conjuros, tabla de runas y cuatro tipos de portada (delantera, interior, de parte y
contraportada). Las portadas cambian la página entera con reglas del tipo «la página que contenga una portada»: una
sola columna, sin pie y otro fondo. [código]

**Notas al margen**: no existen. Lo más parecido es el crédito del artista (`artist`), un bloque con posición absoluta,
o cualquier bloque con `position:absolute` y coordenadas. Se colocan respecto a la página, no siguen al texto al que
acompañan. `note` es una caja dentro de la columna, no al margen. [código]

**Bloques a dos columnas**: la clase `wide` (`column-span: all`) en cualquier bloque. En el tema 5e los títulos de
primer nivel ya ocupan las dos. El propio fragmento avisa de que las columnas «se portan raro» alrededor y que puede
hacer falta un salto de columna a mano. [código]

**Imágenes**: Markdown normal con inyección para el ancho y la posición. Además:

- `wrapLeft` y `wrapRight` flotan la imagen y hacen que el texto rodee su silueta (`shape-outside`). Para eso, el
  intérprete copia la dirección de cada imagen a una variable CSS en el propio elemento.
- Posición absoluta en la página (fondos, ilustraciones a sangre).
- Manchas de acuarela y máscaras de acuarela para bordes, esquinas y centro, con máscaras CSS.

[código]

**Pies, números de página e índices**: todo es contenido de cada página, no del documento.

| Qué | Cómo |
|---|---|
| Pie | `{{footnote TEXTO}}` en cada página. Es un rótulo de pie, no una nota al pie. El fragmento lo rellena con el último título de cierto nivel que haya encima del cursor **al insertarlo**: luego no se actualiza. |
| Número de página | `{{pageNumber 3}}` (fijo) o `{{pageNumber,auto}}`, que usa un contador CSS que avanza en cada `.page`. `skipCounting` y `resetCounting` en una página saltan o reinician la cuenta. También hay una variable con el número. Cada página tiene que llevar su marca. |
| Índice de contenidos | El fragmento **lee la vista previa ya pintada** (títulos, número de cada página, saltos de cuenta) y escribe en el texto una lista fija dentro de `{{toc,wide}}`, con puntos guía hasta el número. Si el documento cambia, hay que volver a insertarlo. |
| Qué títulos entran | Del primer al tercer nivel por defecto. Lo decide una propiedad CSS propia por título, con valor «incluir» o «excluir», que el fragmento lee con el estilo calculado. Así el tema excluye portadas y statblocks, y el autor amplía la profundidad envolviendo el texto en un bloque. |
| Índice alfabético | `{{index,wide}}` con una lista anidada escrita a mano: el fragmento es solo un ejemplo. |

[código]

#### Del texto al HTML

1. El texto se trocea en páginas por las líneas de salto **antes** de interpretar el Markdown. Cada página se
   interpreta por separado, así que nada (una lista, una tabla, un bloque) puede cruzar de una página a otra. Las
   variables sí pasan de página a página. [código]
2. Cada página pasa por `marked` con las extensiones de Homebrewery, que desde septiembre de 2026 viven en el paquete
   `marked-hbfm` (versión 1.0.0 en npm el 2026-09-19):
   - bloques, fragmentos e inyección con llaves;
   - espacios verticales y listas de definición;
   - tablas con celdas que ocupan varias filas o columnas;
   - párrafos alineados;
   - superíndices y subíndices;
   - espacios que no se parten;
   - variables;
   - comillas tipográficas;
   - ids en los títulos, únicos en todo el documento;
   - iconos de sus fuentes de iconos con `:nombre:`;
   - diagramas en ASCII.

   Desactivan los enlaces por referencia porque chocan con las variables. Las imágenes salen con carga diferida.
   [código]
3. Al final de cada página añaden un salto de columna invisible. Según su comentario, es para que la primera columna se
   llene antes que la segunda en lugar de repartirse a partes iguales, en versiones de Chrome que no lo hacían solas.
   [código]
4. **Saneado**, solo en el navegador y por lista negra: quita `script`, `noscript` y `noembed`, los atributos que
   empiezan por `on`, los `type=submit` y las direcciones `javascript:`. El CSS del tema y el del autor pasan por el
   mismo filtro dentro de un `style`. [código]
5. La vista previa es un iframe con `sandbox` sin permiso para ejecutar scripts, así que aunque se colara uno no
   correría. [código, observado]
6. Un validador busca `div`, `span` y `a` sin cerrar o mal cerrados. Mientras haya errores, la vista previa se queda con
   lo último que se pintó bien y enseña la lista. [código]
7. El servidor no pinta HTML: guarda el texto y lo sirve. El saneado necesita el `document` del navegador. [código]

### 2. Paginación

- **Páginas de tamaño fijo**: `.page` mide 215,9 × 279,4 mm (US Letter), con un relleno de 1,4 cm arriba, 1,9 cm a los
  lados y 1,7 cm abajo en el tema neutro. En pantalla, 816 × 1056 px. Otros tamaños se consiguen con fragmentos de CSS
  que cambian el ancho y el alto: A3, A4 (210 × 296,8 mm), A5, cuadrado y carta de juego. [código, observado]
- **El texto no fluye**: los saltos los pone el autor. Su FAQ lo explica con que CSS no deja que el contenido pase de
  una caja a otra. [código]
- **Columnas**: cada página es una caja de columnas CSS de alto fijo con dos columnas que se llenan en orden. En el tema
  5e, cada columna mide al menos 8 cm, con 0,9 cm de separación. Para no partir cosas entre columnas:
  - `break-inside: avoid` en citas, tablas, elementos de lista e índice;
  - los bloques con llaves son `inline-block` a todo el ancho, otra forma de que no se partan;
  - los bloques anchos cortan el flujo con `column-span: all`, y el índice ancho y el statblock ancho reparten su
    contenido en dos columnas propias a partes iguales.

  [código]
- **Desbordar**: la página corta lo que sobra (`overflow: clip`, con `contain: strict`). Lo que no cabe se va a columnas
  de más, a la derecha y fuera de la página, y no se ve ni se imprime. **No avisa**: el único aviso de la vista previa
  es que el navegador no sea Chrome. La FAQ aconseja dejar una o dos líneas libres al final de cada columna, porque cada
  navegador mide un poco distinto. [código, observado]
- **Clases por página**: con las llaves del salto o con reglas del tema que miran qué contiene la página (portadas). Hay
  una cuarta versión en marcha, tras un interruptor, que hereda plantillas de página hacia delante. [código]
- **Rendimiento**: `content-visibility: auto` en cada página. Al escribir se vuelve a pintar primero la página del
  cursor y luego solo las que están a tres o menos de la del centro de la vista. [código]
- **Vistas**: una página por fila, dos enfrentadas (con la primera a la derecha, como un libro) o en mosaico; zoom con
  «ajustar al ancho» y «ajustar la página». [código, observado]
- Solo dan soporte a Chrome: en Firefox relajan los `break-inside`, porque allí los saltos de columna fallaban. [código]

### 3. Temas

**Cómo se monta.** Cada tema es una carpeta con su hoja de estilo (Less compilado a CSS), sus fragmentos, sus ajustes y
una imagen para el menú. Un catálogo dice de qué tema hereda cada uno el CSS y de cuál los fragmentos. El servidor
recorre la cadena y devuelve las hojas de estilo del padre más antiguo al hijo; la vista previa añade al final el CSS
del autor. **La herencia es la cascada de CSS**: neutro → 5e PHB → 5e DMG. Un documento etiquetado como tema puede
hacer de tema de otros, con su CSS y sus fragmentos, y heredar a su vez de otro. [código]

**Variables**: propiedades CSS en la raíz con el prefijo `--HB_Color_` (fondo, acento, títulos, subrayado de títulos,
raya horizontal, fondo del statblock, pies de foto, manchas, pies de página). Las direcciones de las imágenes y dos
mezclas (columnas y letra sin remates) son variables y funciones de Less. [código]

| Tema | Qué lleva |
|---|---|
| **Neutro** («Blank») | La base de todos: la caja de página y la impresión, columnas y saltos, bloques, bloques anchos y espacios, listas de definición, numeración con contadores, índices con puntos guía, texto que rodea imágenes, marca de agua, manchas y máscaras de acuarela, tipos de lista ordenada, crédito de Homebrewery. Fondo blanco y la letra por defecto del navegador. Carga todas las fuentes (las del 5e incluidas) para que el menú de fuentes funcione con cualquier tema. |
| **5e PHB** | Fondo de pergamino (imagen), cinco familias de letra del aspecto de los libros, granate, dorado y verde pálido. Primer título a lo ancho con la primera línea en versalitas y capitular dorada. Tablas con filas alternas, nota y caja descriptiva con bordes de imagen, statblock con marco de imagen y pergamino gris, cita, crédito del artista, una franja de imagen al pie de cada página (en espejo en las pares), número y rótulo de pie, código, lista de conjuros, tabla de clase con marco, portadas y tabla de runas. |
| **5e DMG** | Hereda del PHB y cambia colores, fondo, franja de pie y capitular. |
| **Journal** | Letras de mano y fondos de cuaderno. |
| **Unearthed Arcana** | Letras del sistema (Cambria, Georgia) sobre fondo blanco. |

[código]

**Licencia del código**: MIT, «Copyright (c) 2016 Scott Tolksdorf», en `license`. `marked-hbfm` declara MIT en su
`package.json` (autor David Bolack), pero su repositorio no trae archivo de licencia. [código]

**Fuentes** (`themes/fonts/`). El repositorio solo trae licencia de tres; las demás las miramos en su origen:

| Fuente | Dónde | Licencia | ¿Crisol? |
|---|---|---|---|
| Bookinsanity, Scaly Sans (y Caps), Mr Eaves Small Caps, Nodesto Caps (Condensed y Wide), Solbera Imitation | 5e (las importan todos los temas) | **CC BY-SA 4.0**, según el repositorio de origen de las fuentes de Solbera. Son clones de las letras de los libros de 5e. | **No**: CC BY-SA y aspecto de WotC |
| Davek, Iokharic, Rellanic | 5e (tablas de runas) | **Sin licencia** en el repo. Recrean alfabetos de los libros de D&D. | **No** |
| Elderberry Inn (iconos) | iconos | **Sin licencia** en el repo | **No** |
| Game-icons (subconjunto) | iconos | **CC BY 3.0** (licencia en el repo) | **No**: no está en la lista de `CONSTRAINTS.md` |
| Font Awesome Free 6.7.2 | iconos | Iconos CC BY 4.0, fuentes OFL 1.1, código MIT (cabecera en el repo) | No hace falta |
| DiceFont | iconos | Fuente OFL 1.1, CSS MIT, documentación CC BY 3.0 (licencia en el repo) | No: no está en Fontsource |
| TeX Gyre Pagella | neutro (menú de fuentes) | GUST Font License, una variante de la LPPL (comentario en el repo) | No: no está en la lista ni en Fontsource |
| Overpass | 5e (portadas) | OFL 1.1 (Fontsource) | Admisible, aunque no encaja |
| Martel Sans Black | En la carpeta del 5e, pero ningún CSS la carga | OFL 1.1 (Fontsource) | No hace falta |
| Walter Turncoat | 5e, Journal (créditos) | Apache 2.0 (Fontsource) | Admisible, aunque no encaja |
| Reenie Beanie, Fredericka the Great | Journal | OFL 1.1 (Fontsource) | Admisible, aunque no encaja |
| Permanent Marker | Journal | Apache 2.0 (licencia en el repo y en Fontsource) | Admisible, aunque no encaja |

[código, observado]

**Imágenes** (`themes/assets/`). **Ninguna trae licencia ni créditos** en el repo, salvo los cuadros de ejemplo, que
citan autor y año. El `license` MIT habla de «software y documentación», no de arte. Su bienvenida avisa de que, si se
vende lo hecho con Homebrewery, los derechos de imágenes y recursos son cosa de quien vende.

| Imágenes | Origen y licencia | ¿Crisol? |
|---|---|---|
| Pergamino (color y gris), franjas de pie del PHB y del DMG, fondo del DMG, bordes de nota, de caja descriptiva, de statblock, de código y de tabla, raya de triángulos, decoración de tabla de clase, cabeceras de parte, máscara de portada interior, contraportada, banner y raya de portada | **Sin licencia**. Imitan los libros de WotC. | **No** |
| Doce manchas de acuarela y las máscaras de borde, esquina y centro | **Sin licencia**. Según el changelog, un usuario de Reddit cedió las máscaras. | **No** |
| Fondos, bordes y rayas de Journal | **Sin licencia** | **No** |
| Logos de NaturalCrit, taza y gato de ejemplo | **Propias** de Homebrewery, sin licencia | **No** |
| Logos de licencias ajenas (Shadowdark, Forged in the Dark, AGE, Icons…) | Marcas de terceros | **No** |
| Cuadros de ejemplo (Thomas Cole, Cropsey, Fitz Henry Lane, Sarazin de Belmont, L. Prang) | Obras del siglo XIX, de dominio público por antigüedad; la reproducción no trae licencia | No hacen falta |

[código]

### 4. PDF e impresión

- **Impresión del navegador, sin PDF en el servidor**. No hay puppeteer ni nada parecido en las dependencias ni en el
  código. El botón «get PDF», y Ctrl+P en la vista previa, hacen tres cosas:
  1. pasan las imágenes de carga diferida a carga inmediata y esperan a que terminen;
  2. llaman a imprimir en la ventana del iframe;
  3. después fuerzan un repintado, porque al imprimir desaparecían las páginas que no se veían.

  [código]
- **CSS de impresión**:
  - `@page` con margen 0 y **sin tamaño**;
  - `print-color-adjust: exact` en todos los elementos;
  - en `@media print`, la lista de páginas pasa a bloque normal, sin zoom, sin sombras y sin barra de herramientas.

  La hoja de papel es la propia caja `.page`. [código, observado]
- **El tamaño lo elige el usuario en el diálogo**. Sus instrucciones: guardar como PDF, papel Letter, activar los
  gráficos de fondo y, para A4, añadir antes el fragmento de tamaño A4. Si no coinciden, salen bandas blancas (lo dice
  su FAQ). [código]
- **Sangrado**: no hay. Los metadatos guardan sangrado (0,125 pulgadas), margen de seguridad (0,25 pulgadas; 0,5 en el
  lomo), tamaño de corte (8,5 × 11 pulgadas), columnas y medianil. Se guardan y se exportan, pero el renderizador actual
  no los usa. Tampoco hay marcas de corte. [código]
- **Columnas y fondos al imprimir**: las mismas columnas de cada página. Como el margen es 0, el fondo llega al borde
  del papel. Franjas de pie, números y rótulos van en posición absoluta y salen igual. [código, observado]
- Hay un fragmento «Ink Friendly» que pone los fondos en blanco y oculta las imágenes. [código]

Lo que vimos imprimiendo la página de bienvenida con el Chromium sin ventana de Playwright [observado]:

| Prueba | Resultado |
|---|---|
| Papel Letter | 2 `.page` dan 2 páginas de PDF de 612 × 792 pt. Los 30 px que separan las páginas en pantalla se pierden en el salto. |
| Sin «gráficos de fondo» | El PDF pesa exactamente lo mismo, al byte, que con ellos: `print-color-adjust: exact` fuerza los fondos. [observado el tamaño; que el contenido sea igual, inferido] |
| Papel A4 con páginas Letter | Siguen siendo 2 páginas. Por las medidas, se cortan 5,9 mm a la derecha y quedan 17,6 mm en blanco abajo. [inferido de las medidas, sin mirar la imagen] |
| Páginas de 210 × 297 mm en A4 | 2 páginas |
| Páginas de 297,5 mm en A4 | 4 páginas: cada una deja una tira en una hoja en blanco de más. Los 296,8 mm de su fragmento serán un margen contra el redondeo de algún navegador. [inferido] |
| Fuentes | Van incrustadas como subconjuntos. |

### 5. Edición

- **Pantalla partida**: a la izquierda, el texto en CodeMirror 6, con colores para las marcas de Homebrewery y plegado
  por páginas. A la derecha, la vista previa en el iframe. Encima del editor, pestañas para el texto, el CSS, los
  fragmentos, los metadatos y los ajustes del editor. [código, observado]
- **Barra de fragmentos**: grupos que aporta cada tema de la cadena (editor de texto, imágenes, tablas, fuentes,
  licencias, PHB, imprimir, estilo), con subgrupos. Pulsar uno **inserta texto en el cursor**. Algunos generan el texto
  en ese momento: el pie, a partir del último título; el índice, a partir de la vista previa; el monstruo, al azar. El
  autor puede definir los suyos en la pestaña de fragmentos, y un documento que haga de tema aporta también los suyos.
  No hay plantillas de documento aparte de los fragmentos. [código, observado]
- **Vista previa**: se vuelve a pintar con cada cambio, desde el texto entero. Va dentro de un iframe para que un CSS o
  un HTML roto no rompa la aplicación. [código]
- **Sincronización por página, no por bloque**:
  - el editor sabe en qué página está el cursor contando líneas de salto;
  - la vista previa sabe qué página está en el centro con un `IntersectionObserver`;
  - dos flechas saltan del texto a la vista y de la vista al texto;
  - un candado activa el desplazamiento acompasado.

  [código, observado]
- **Guardar**:
  - Se guarda solo, con un temporizador. Se manda un parche de diferencias con la huella y la versión de lo último
    guardado.
  - Si la versión del servidor no coincide, rechaza el guardado (409) y pide copiar el trabajo y recargar.
  - No hay edición a la vez.
  - El historial de versiones vive en el navegador.

  [código]

### Pruebas

En el repositorio, solo lectura: `git clone --depth 1` en `~/rea-workspace/homebrewery` y en
`~/rea-workspace/marked-hbfm`, sin `npm install` ni scripts. Las licencias de fuera del repositorio las miramos en npm,
en la API de Fontsource y en el repositorio de las fuentes de Solbera.

En la web pública, con el Playwright local, sin cuenta y sin guardar nada:

1. Abrimos la página de inicio, que trae el editor con el documento de bienvenida, y leímos la versión (3.24.2), el
   `sandbox` del iframe, el tamaño calculado de `.page`, sus columnas, su `overflow` y su `contain`, y las reglas
   `@page` y `@media print` cargadas.
2. Metimos 60 párrafos en la segunda página, solo en el DOM. La página siguió midiendo 1056 px, el contenido se fue a
   columnas a la derecha (el último párrafo, a 1838 px del borde de una página de 816 px), no se vio ninguno y no salió
   ningún aviso. Antes de meterlos ya había una columna oculta: la del salto invisible del final de página.
3. Copiamos el documento del iframe en una pestaña del mismo origen y sacamos PDFs con Chromium sin ventana: Letter y A4,
   con y sin fondos, y con tamaños de página de 297, 296,8 y 297,5 mm (tabla de § 4). Es el mismo motor que imprime
   Chrome, pero no pasamos por el diálogo de impresión.

## Compromisos y límites

- **Paginar a mano lo da todo y lo pide todo**: el autor controla cada página y el PDF sale como lo ve. Pero cada
  cambio puede empujar texto fuera de la página, lo que sobra se corta sin avisar y un párrafo añadido en la página 3
  no recoloca las siguientes. Es maquetar, no escribir.
- **Un texto con marcas propias**: potente, pero mezcla Markdown, HTML y CSS. Un error de llaves rompe el resto. El
  validador solo mira etiquetas.
- **El statblock es Markdown con estilo**: flexible, pero sin datos. No se puede reutilizar, buscar ni tirar desde él.
- **No hay vista sencilla**: se lee siempre la página de imprenta. En el móvil, hacer zoom sobre una hoja Letter.
- **Imprimir con el navegador** sale gratis y trae fondos y fuentes en Chrome. Pero depende del navegador (solo dan
  soporte a Chrome) y de que el usuario elija bien el papel. No hay sangrado ni marcas de corte para una imprenta, y el
  «PDF» es el diálogo de imprimir, no una descarga.
- **Temas por cascada con CSS libre**: muy flexible, y permite temas hechos por los usuarios. A cambio, no hay una
  interfaz estable entre tema y contenido: cambiar de tema puede descolocar las páginas. Además, aceptar CSS y HTML de
  cualquiera obliga al iframe aislado, y el saneado por lista negra deja pasar CSS que pida recursos de fuera. [inferido]
- **El aspecto 5e es su gancho y su problema**: imita los libros de WotC con fuentes CC BY-SA e imágenes sin licencia, y
  deja los derechos en manos de quien publique.

## Qué nos llevamos a Crisol

### Una forma de guardar, dos vistas

- **El contenido es el mismo cuerpo de TipTap y Yjs** (ADR-0003). «Ver como hoja» ya es un campo de la fila de la
  página; sus ajustes también irían en la fila y no en Yjs, y así tienen historial gratis:
  - el papel (A4 por defecto, Letter);
  - el tema de hoja;
  - si se numeran las páginas y desde qué número;
  - qué nivel de título se repite en el pie.
- **Pocos nodos de hoja, y con intención, no con CSS**: «esto es un statblock», «esto va a lo ancho», «aquí empieza
  página». Nada de estilos por elemento, posiciones en píxeles, HTML ni CSS del autor. Homebrewery necesita un iframe
  aislado y un saneado; nosotros pintamos desde el esquema, y lo que escribe Claude en Markdown pasa por el mismo
  esquema.
- **Vista sencilla** = el editor y la lectura de siempre. Los nodos de hoja se rebajan a algo legible o invisible.
- **Vista hoja** = el mismo contenido en solo lectura, pintado en cajas de página fijas con el tema de hoja. Puede
  pintarse con `@tiptap/static-renderer` (MIT, 3.32.1, comprobado en npm) o con las vistas de nodo del editor en modo
  lectura. Los secretos se piden por la API, que proyecta, como dice el ADR para los incrustados.
- **Se edita en la vista sencilla, con la hoja al lado**, como en Homebrewery, pero **sincronizado por id de bloque**,
  que ya tenemos (`@tiptap/extension-unique-id`). Pulsar en la hoja lleva al bloque en el editor, y mover el cursor
  lleva la hoja al bloque, no solo a la página. Editar directamente sobre la hoja queda para más adelante, si hace
  falta.

### Nodos y atributos, y su forma en Markdown

El dialecto es el de Obsidian (ADR-0003, § Markdown). La spec fija los nombres; esto es una propuesta.

| Bloque de hoja | En TipTap | Vista sencilla | Vista hoja | Markdown de Obsidian |
|---|---|---|---|---|
| Salto de página | Nodo atómico `pageBreak`. Puede llevar cuántas columnas tiene la página siguiente (1 o 2). | Invisible al leer; en el editor, una raya discontinua con su rótulo | Empieza página | Un div vacío con clase, por ejemplo `<div class="salto-pagina"></div>`, con `break-after: page` en línea para que el PDF de Obsidian también salte. Es invisible en Obsidian. [inferido; comprobar en Obsidian] |
| Salto de columna | Nodo atómico `columnBreak` | Invisible; en el editor, otra raya | Empieza columna | `<div class="salto-columna"></div>` |
| Statblock | Contenedor `statblock` con bloques normales dentro (título, párrafos, tabla, separador) y el atributo `wide` | Caja con marco en la columna, legible | Marco del tema, sin partirse; si es ancho, a las dos columnas con dos columnas por dentro | `> [!statblock]` y `> [!statblock\|ancho]`. Los tipos de callout desconocidos se ven en Obsidian como uno normal, y lo de detrás de la barra es su metadato. [inferido; comprobar en Obsidian] |
| Nota lateral | Contenedor `sideNote` con el lado (izquierda o derecha) | Callout dentro del texto | Recuadro estrecho flotando en la columna, con el texto alrededor, como los recuadros de los manuales. En páginas de una columna podría ir de verdad al margen. | `> [!lateral]` y `> [!lateral\|izquierda]` |
| Bloque ancho | Atributo global `wide` en statblock, tabla, imagen, callout y caja; y un contenedor para mezclas de bloques | Sin efecto | `column-span: all` | `\|ancho` en los callouts; el contenedor, `> [!ancho]` con lo de dentro |
| Caja de leer en voz alta, nota | Los callouts y cajas que ya tiene el menú «/» | Como ahora | Con el estilo del tema | Como ahora |
| Imagen colocada | Atributos de la imagen: colocación (en línea, izquierda, derecha, ancho, fondo de página) y ancho | Imagen normal; flota solo si hay sitio | Flota en la columna (si se quiere, con el texto rodeando su silueta, como `wrapLeft`), a lo ancho o de fondo | `![[archivo.png\|300]]` da el ancho; la colocación está por decidir (texto alternativo del incrustado o un callout `figura`) |
| Índice de contenidos | Nodo atómico `tableOfContents`, que se calcula al pintar (`@tiptap/extension-table-of-contents`, MIT, 3.32.1) | Lista de enlaces a los títulos | Con el número de página que da el paginador y puntos guía | `> [!indice]` con la lista generada de `[[#Título]]`. Al leerlo se ignora la lista y se vuelve a generar. |
| Números de página y pie | No son nodos: son ajustes de la página | Nada | Los calcula el paginador en cada página | Propiedades planas en el YAML (por ejemplo, `hoja`, `hoja-papel`, `hoja-tema`), porque Obsidian no edita bien las anidadas [inferido] |

- El statblock del módulo 1 es **un marco con contenido libre**, como el de Homebrewery. El módulo 4 traerá criaturas
  con datos. Su nodo, que nombrará una criatura por su id, se pintará con el mismo marco, así que conviene que el marco
  sea un componente del tema y no del nodo.
- Insertar va por el menú «/» (un grupo «Hoja») y, para «ancho», por el menú de cada bloque. Cada bloque entra con una
  estructura vacía y textos de ayuda, no con texto de ejemplo como sus fragmentos.
- La prueba de ida y vuelta del ADR cubre cada uno de estos nodos.

### Cómo pintar la hoja: paginar solo, con saltos opcionales

Copiar su paginación a mano no nos sirve: una página de la wiki que se pase a hoja sería una sola página desbordada
hasta que alguien pusiera los saltos. Propuesta: **paginar automáticamente por bloques**, usando la misma señal de
desbordamiento que vimos en Homebrewery.

1. Pintar los bloques del cuerpo con el tema de hoja.
2. Llenar una caja de página de alto fijo (dos columnas que se llenan en orden) añadiendo bloques uno a uno. Cuando el
   contenido se sale por la derecha (el ancho del contenido supera el de la caja), ese bloque abre la página siguiente.
3. `pageBreak` y `columnBreak` fuerzan el salto.
4. Statblocks, tablas, callouts e imágenes se mueven enteros. Los párrafos sí se parten entre las dos columnas de una
   página, porque eso lo hace el navegador. Un párrafo que no cabe al final de una página se mueve entero; partirlo por
   líneas, más adelante.
5. Un título no se queda solo al pie de una columna. Viudas y huérfanas, y `hyphens: auto` con `lang="es"`: el
   guionado ayuda mucho en columnas estrechas, y Homebrewery no lo usa.
6. Al cambiar algo, se vuelve a paginar desde esa página hacia delante, con una pausa. Si un bloque no cabe ni en una
   página vacía, la hoja lo avisa en esa página, en lugar de cortarlo en silencio.

Alternativas:

- **Saltos solo a mano**, como Homebrewery: más simple y con todo el control, pero con el problema de arriba. Se podría
  ofrecer como «fijar saltos», congelando los que calcula el paginador.
- **Paged.js**: MIT, pero su última versión estable es la 0.4.3, de 2023, y la beta es de 2024. Las columnas con bloques
  a lo ancho son su punto flojo. [inferido]
- **Vivliostyle**: AGPL, descartado.

### PDF

- **La misma vista hoja, con CSS de impresión**:
  - `@page` con su tamaño (A4) y margen 0, y cada caja de página con la medida exacta del papel. En Chromium, 297 mm
    exactos dan una hoja por página y medio milímetro de más duplica las hojas, así que ni una décima de más.
  - `print-color-adjust: exact`.
  - Fuera la interfaz, y esperar a que carguen las imágenes y las fuentes.
- **Dos salidas de la misma ruta de impresión**:
  - **Imprimir**: el diálogo del navegador. No cuesta nada, pero depende del navegador.
  - **Descargar PDF**: el servidor abre esa ruta con Chromium sin ventana (Playwright, Apache-2.0) y devuelve el
    archivo. Sale igual para todos, con las fuentes dentro y sin opciones que elegir. Cuesta tener Chromium en el
    servidor (hay que pedir permiso a Enrique), memoria y una cola con límite. Pasa por la proyección con la identidad
    de quien lo pide: en el módulo 5, el PDF de un jugador no lleva lo que no ve. El Crisol actual ya usa un Chromium
    sin ventana para la foto de la hoja.

  Propuesta: empezar por imprimir y dejar la ruta lista para que el servidor la pinte; la spec decide si «descargar»
  entra en el módulo 1, porque el «hecho cuando» pide sacar el PDF de una hoja.
- **Papel**: A4 por defecto, Letter como opción. El sangrado tampoco entra al principio (Homebrewery no lo tiene), pero
  conviene dejar sitio en los ajustes para cuando se imprima en imprenta.
- **Secretos y notas ocultas en el PDF**: hay que decidirlo. Propuesta: las notas ocultas nunca se imprimen y los
  secretos solo si el máster lo marca al imprimir, desmarcado por defecto, porque lo normal es imprimir para la mesa.

### Temas

- Un **CSS base de hoja**, nuestro: caja de página, columnas, saltos, impresión y contadores. Encima, cada tema son
  **variables CSS**, como su `--HB_Color_*` pero con nombre propio (`--sheet-…`): fondo, tinta, acento, letras de títulos,
  de texto y de statblock, marcos y textura. La herencia, por capas: base y tema. Sin CSS del autor en el módulo 1.
- Dos temas: **Pergamino**, propio y con el aire de la identidad «Hoja», y **Neutro**, en blanco y que gasta poca tinta.
  El neutro hace las veces de su «Ink Friendly».
- **Fuentes OFL de `@fontsource`**. Candidatas comprobadas como OFL 1.1 en Fontsource: Alegreya, EB Garamond y Cinzel,
  además de la Barlow que ya usa Crisol. Se eligen en la fase de diseño.
- **Textura del pergamino propia**: con CSS y ruido SVG, o una imagen CC0. Nada de sus imágenes.

### Qué código MIT aprovechar, con atribución

Atribución: el aviso «Copyright (c) 2016 Scott Tolksdorf» y el texto de la licencia MIT en las notas de terceros del
repo, y una cabecera en cada archivo derivado con el origen y el commit. Las piezas son pequeñas: lo valioso son las
decisiones (medidas, reglas, trucos), y muchas veces será igual de rápido reescribirlas con nuestro estilo.

| Pieza | Dónde | Para qué |
|---|---|---|
| Base de página e impresión | `themes/V3/Blank/style.less` | Caja de página de tamaño fijo, `@page` sin margen, `print-color-adjust`, salto de columna, `break-inside` en bloques, tablas y listas, `column-span` para lo ancho, numeración con contadores (saltar y reiniciar con `:has()`), texto que rodea la silueta de una imagen, puntos guía del índice, ajustes para Firefox |
| Impresión de la vista previa y vistas de pliego | `client/homebrew/brewRenderer/brewRenderer.less` | Quitar zoom, sombras y huecos al imprimir; páginas enfrentadas con la primera a la derecha, y mosaico |
| Preparar la impresión | `shared/helpers.js` | Pasar las imágenes diferidas a inmediatas, esperarlas y repintar tras imprimir |
| Página visible y página central | `client/homebrew/brewRenderer/brewRenderer.jsx` | `IntersectionObserver` para saber qué páginas se ven y cuál está en el centro; repintar solo las cercanas |
| Zoom de ajustar | `client/homebrew/brewRenderer/toolBar/toolBar.jsx` | Cuentas de «ajustar al ancho» y «ajustar la página» |
| Qué títulos entran en el índice | `themes/V3/Blank/snippets/tableOfContents.gen.js` | La idea de una propiedad CSS que el tema pone a «incluir» o «excluir» y que el índice lee con el estilo calculado, y el mapa de páginas con saltos de cuenta. En Crisol, calculado al pintar, no escrito en el texto. |

**No aprovechar**:

- **Los temas 5e PHB, 5e DMG, Journal y Unearthed Arcana, y los fragmentos del 5e** (statblock, tabla de clase,
  portadas, runas): son código MIT, pero reproducen el aspecto de los libros de WotC y dependen de fuentes CC BY-SA y de
  imágenes sin licencia.
- **`marked-hbfm` y la sintaxis de llaves**: aquí no se escribe Markdown a mano y nuestro dialecto es el de Obsidian.
- **El saneado por lista negra**: pintamos desde el esquema, no desde HTML.
- **Los textos de licencias de sus fragmentos** (OGL y otras): contenido de terceros.
- **Todas las fuentes e imágenes** de las tablas de § 3.

### Preguntas para la spec

- ¿Paginación automática con saltos opcionales (propuesta) o solo a mano?
- ¿«Descargar PDF» en el servidor ya en el módulo 1, o primero solo imprimir?
- ¿Los secretos salen en el PDF del máster? ¿Con qué opción por defecto?
- ¿Cómo va en Markdown la colocación de las imágenes? Nombres definitivos de los callouts y de los divs de salto.
- ¿Entran ya las portadas (una página con su propio diseño) o más adelante?
- ¿Hace falta un índice alfabético o basta con el de contenidos?
