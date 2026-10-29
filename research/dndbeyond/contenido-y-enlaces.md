# Contenido y enlaces en D&D Beyond

Módulo de Crisol: 1. Wiki · Fecha: 2026-10-29 · Versión estudiada: web de dndbeyond.com consultada el 2026-10-29
(Chromium 153, con la sesión de Enrique) y su centro de ayuda oficial

## Pregunta

Cómo enlaza y presenta D&D Beyond su contenido, para la spec de la wiki (`docs/specs/wiki.md`):

1. Enlaces dentro del texto: a conjuros, objetos, criaturas, condiciones y reglas; la vista previa al pasar el ratón;
   enlaces a una sección.
2. El lector de libros: índice, anclas, cuadros, tablas, statblocks, imágenes, anterior y siguiente, impresión, móvil.
3. Los statblocks: dentro de un capítulo y en su página propia.
4. El buscador general.
5. El contenido propio (homebrew), las notas de campaña y lo que se parezca a secretos del máster.
6. Qué nos llevamos y qué haremos distinto.

Grado de certeza de cada afirmación:

- **[observado]**: visto en vivo, en pestañas propias abiertas por CDP en el Chromium de Enrique.
- **[código]**: leído en el marcado, el CSS o las peticiones de red de la página. Solo la forma, nunca el contenido.
- **[inferido]**: deducido sin comprobarlo.
- **[O]**: centro de ayuda oficial (leído por su API pública).

El texto de reglas estudiado es el gratuito: las reglas básicas de 2024 (índice y los capítulos de cómo se juega,
clases, statblocks de criaturas y hojas de seguimiento). Además se miró la presentación de un capítulo de una aventura
que Enrique ya tiene, sin apuntar nada de su contenido.

## Lo que hacen

### 1. Enlaces dentro del contenido

**Cómo se marca un enlace.** El texto de los libros llega como HTML ya maquetado y con los enlaces puestos a mano.
Cada enlace con vista previa lleva dos cosas [código]:

- **su tipo**, en una clase: conjuro, criatura, objeto, objeto mágico, condición, regla, acción, habilidad, sentido,
  propiedad de arma o lore;
- **dos destinos**: el `href` adonde va el clic y otra URL aparte, la de la vista previa, que apunta al registro de esa
  entidad.

**Adónde lleva el clic**, según el tipo [código, observado]:

| Tipo | El clic lleva a | La vista previa sale de |
|---|---|---|
| Conjuro, criatura, objeto, objeto mágico | Su página propia, `/<tipo>/<id>-<nombre>` | El registro de la entidad |
| Regla, condición, acción, sentido | El ancla de su entrada en el glosario del libro | El registro del glosario |
| Habilidad, propiedad de arma | El ancla de su sección en el capítulo que la explica | Su registro |
| Lore | El ancla de su sección en otro libro (aquí, la guía del máster, que es de pago) | Su registro |
| Referencia a un capítulo, una sección o una tabla | La página o el ancla | No tiene vista previa |

- Las referencias cruzadas normales («véase tal capítulo», «la tabla tal») son enlaces azules corrientes. **Solo las
  entidades tienen vista previa; una sección de un libro, no.** [observado]
- **Cada tipo tiene su color en el texto**: conjuros en morado y cursiva negrita, objetos en marrón, condiciones y
  habilidades en dos verdes, reglas en dorado y negrita, sentidos en magenta. Las referencias cruzadas van
  en azul. El código de color se repite en la etiqueta de tipo de la vista previa. [observado]
- **La URL de una entidad exige el id y el nombre exactos.** El id solo, o el id con otro nombre, da 404. El nombre
  solo redirige a la versión más antigua de esa entidad (la de 2014, no la de 2024). Renombrar rompería los enlaces.
  [observado]
- Hay alias de ruta: la dirección «reglas gratuitas» redirige a la de las reglas básicas. [observado]

**En el contenido de los usuarios** (foros, homebrew), los tooltips se ponen con etiquetas del estilo
`[tipo]nombre[/tipo]`, con nueve tipos [O].

- Van por **nombre**, no por id, así que no distinguen entre la versión de 2014 y la de 2024 (inferido).
- No funcionan en la hoja de personaje [O].
- El editor de homebrew deja poner enlaces, pero se rechaza cualquier homebrew público que los lleve [O].

#### La vista previa al pasar el ratón

Medido en varios tipos de enlace [observado]:

| Paso | Qué pasa |
|---|---|
| Entrar en el enlace | **Sin retardo a propósito**: la petición sale a los 50–90 ms (290 ms la primera vez de la página) y aparece al momento una cajita de carga. |
| Llega la respuesta | El contenido se ve a los **200–500 ms**. |
| Mover el ratón | La caja, de unos 680 px de ancho fijo, **sigue al cursor**: se coloca por encima y a un lado, y tapa el texto. |
| Salir del enlace | Se cierra en el acto. **No se puede entrar en la caja**, así que los enlaces de dentro (que los tiene) no se alcanzan. |
| Volver a pasar | Instantáneo y sin petición: guarda en memoria lo ya visto mientras dura la página. No hay caché entre páginas. |

- **Técnica**: una sola caja flotante por página, que se reutiliza. Cada vista previa es una petición JSONP a un
  recurso de tooltip por entidad, que devuelve un fragmento de HTML. [código]
- **Qué enseña**: una banda de cabecera con icono, nombre, libro de origen y una etiqueta de tipo en color. Debajo,
  según el tipo [observado]:
  - conjuro: una rejilla con sus ocho propiedades y la descripción;
  - condición: la descripción y, separada, la definición de la edición anterior;
  - arma: la descripción y su propiedad de maestría;
  - criatura: **un statblock resumido** (características, CA, iniciativa, PG, velocidad, VD, habilidades, sentidos e
    idiomas), sin rasgos ni acciones;
  - regla, habilidad u objeto mágico: un párrafo.
- **Teclado y accesibilidad**: con el foco del teclado no aparece nada. Ni el enlace ni la caja llevan atributos ARIA.
  [observado]
- **En el móvil** (390 px con toque emulado): tocar un conjuro **va directo a su página**, sin vista previa. No hay
  forma de echar un vistazo sin salir del capítulo. [observado]

#### Enlaces a una sección

- **Cada encabezado tiene un id sacado de su texto**, sin espacios ni signos: un encabezado «Hola, mundo?» daría
  `#Holamundo`. Una URL con ese ancla baja hasta el encabezado y el índice lateral marca la sección. [observado]
- Al pasar por un encabezado aparece un icono de enlace en el margen izquierdo. Pulsarlo pone el ancla en la URL; no
  hay botón de «copiar enlace». [observado]
- **Las tablas también se enlazan**: su título va en un encabezado con id dentro del `caption`. Pasa lo mismo con cada
  criatura de un capítulo de statblocks. [código]
- Además, **cada bloque del texto lleva un UUID estable** en un atributo: párrafos, encabezados, elementos de lista,
  tablas y statblocks. [código] No sale en las URLs ni en la búsqueda; debe de servir para seguir los bloques entre
  ediciones o erratas [inferido].
- Como el ancla visible sale del texto, renombrar un encabezado rompe los enlaces que lo apuntan [inferido].

### 2. El lector de libros

**El índice del libro** es una portada con cuatro columnas, una por parte (jugadores, máster, criaturas, glosario). En
cada una salen los capítulos y debajo sus secciones, enlazadas por ancla. [observado]

**Un capítulo** [observado, código]:

| Elemento | Cómo lo presentan |
|---|---|
| Índice del capítulo | Columna izquierda **fija al desplazar**. Es un árbol con flechas para desplegar: arriba las secciones grandes y dentro las de nivel 3 y 4. **Sigue la lectura**: despliega y resalta la sección que está en pantalla. Algunos encabezados se marcan para que no salgan en él. |
| Anterior y siguiente | Dos veces: encima del índice lateral y en una barra sobre el título («capítulo anterior · índice · siguiente», con el título del siguiente). En el primer capítulo, «anterior» sale apagado. |
| Volver arriba | Un botón redondo flotante abajo a la derecha. |
| Encabezados | Subrayados con una línea fina dorada, y con el icono de ancla al pasar. Algunos llevan otro nivel visual que el de su etiqueta HTML. |
| Cuadros laterales | **Dentro del texto y a todo el ancho, no al margen**: fondo de color, extremos decorados como un pergamino, un título y el texto. En las aventuras hay otro tipo, el cuadro para leer en voz alta: fondo pálido con borde y remates. **No hay notas al margen.** |
| Tablas | Título enlazable, filas alternas y un envoltorio con desplazamiento horizontal. Algunas **se ordenan al pulsar la cabecera**, pero nada lo indica (ni el cursor ni `aria-sort`). |
| Statblocks | Caja con marco y dos columnas internas en escritorio (ver punto 3). |
| Imágenes | Figura con pie. Al pulsarla se abre en una caja de luz que agrupa las imágenes del capítulo. En los mapas de aventura, el pie lleva un segundo enlace, «versión para jugadores», que abre la otra variante del mapa en la misma caja. |
| Descargas | Solo de recursos sueltos: la hoja de personaje en PDF y las hojas de seguimiento del máster en PDF y ZIP. |

- **Dos plantillas para lo mismo**. Los capítulos son HTML maquetado a mano. Las páginas de entidad se generan a partir
  de datos, con otro componente. La misma criatura se ve distinta en cada sitio: títulos en mayúsculas rojas o en
  versalitas, enlaces de colores o subrayados. [observado, código]
- **Sin compra**, de un libro solo se ve el índice [O]. Un resultado de búsqueda con candado lleva a la ficha del
  producto en la tienda [observado].
- Las páginas de entidad terminan con un **hilo de comentarios** de la comunidad, con su propio editor [observado].

**Descargar e imprimir**:

- No hay botón de imprimir ni PDF de los libros [observado]. La ayuda aclara que el libro digital no es un PDF [O].
- En la web no se lee sin conexión; en la app móvil, sí, tras descargar el libro [O].
- La página trae al menos sesenta reglas CSS de impresión [código]. Impreso desde el navegador (A4), un capítulo de
  reglas básicas sale en **34 páginas a una columna**. Quita el índice lateral, pero deja los iconos de la cabecera y la
  barra de capítulos, y **parte los cuadros laterales entre dos páginas**. [observado]

**En el móvil** (390 px) [observado]:

- El índice lateral desaparece. En su lugar, un desplegable nativo «Ir a…» con las secciones, bajo la barra de
  anterior y siguiente, que recorta el título.
- Los cuadros ocupan todo el ancho y los statblocks pasan a una columna.
- Las tablas de ese capítulo caben, pero la página se desborda unos 10 px a lo ancho.

### 3. Statblocks

**Dentro de un capítulo** es HTML escrito a mano, con piezas fijas en este orden [código, observado]:

1. el nombre, que es un encabezado con ancla y enlace (con vista previa) a la página de la criatura;
2. la línea de tamaño, tipo y alineamiento, en cursiva;
3. las líneas de CA e iniciativa, PG y velocidad;
4. dos tablas pequeñas, una con las características físicas y otra con las mentales, cada una con su modificador y su
   salvación;
5. las líneas de habilidades, inmunidades, sentidos, idiomas y VD;
6. los títulos de sección (rasgos, acciones, acciones legendarias), subrayados en rojo, y debajo párrafos que empiezan
   con el nombre en negrita y cursiva.

Todo va en una caja con marco y fondo crema, con dos columnas en escritorio y una en el móvil. Las condiciones,
habilidades, sentidos y conjuros de dentro son enlaces con vista previa y con su color.

**En su página propia** [observado]:

- El statblock lo genera un componente a partir de datos: a la izquierda en escritorio, con la ilustración a la derecha
  (que abre la caja de luz).
- Debajo, el texto de ambientación con sus tablas; luego etiquetas de hábitat y de tesoro, y el libro de origen **con
  el número de página impresa**.
- Al final, los comentarios. Arriba, accesos a las reglas de criaturas, a crear una criatura propia y al homebrew.

**Qué se pliega o se enlaza**: no hay nada plegable, ni en el capítulo ni en la página propia [observado]. Se enlaza el
nombre (ancla y página), y cada término de dentro tiene su vista previa. La vista previa de la criatura es el statblock
resumido del punto 1.

**El formulario de criatura propia** confirma el modelo: la criatura son **datos estructurados más secciones de texto
rico**. Lleva [observado]:

- el tipo de statblock (edición 2014 o 2024);
- desplegables y campos para tipo, tamaño, alineamiento, VD, CA, PG, características, salvaciones, daños, condiciones,
  entornos, etiquetas y tesoro;
- **ocho editores** de texto, uno por sección: rasgos, acciones, acciones adicionales, reacciones, características,
  legendarias, míticas y guarida;
- dos imágenes.

### 4. Búsqueda

**Dos entradas** [observado]:

- **La lupa de la cabecera** abre una barra con selector de edición, el campo y un botón de filtros. Al escribir espera
  a que se pare: siete letras seguidas dieron una sola llamada, unos 400 ms después de la última. Sugiere cinco nombres,
  con lo coincidente en negrita, y «Buscar todo». **Tolera erratas**: una palabra a falta de una letra encontró el
  conjuro.
- **La página de resultados** viene ya pintada del servidor; no hay una API de búsqueda en el cliente para ella
  [código]. Las sugerencias sí piden una API propia de consulta rápida, que devuelve recuentos, títulos con su
  categoría y los fragmentos resaltados [código].

**Filtros**:

- edición (2024 o 2014);
- editor (todos, oficial, asociados);
- categoría: todo, personaje (clase, dote, trasfondo, especie), criatura, objeto (mágico y equipo), conjuro, y
  biblioteca (regla y lore);
- en un panel lateral, además, el libro de origen y un interruptor de «solo lo mío y lo compartido conmigo».

**Resultados** [observado]:

- **Como mucho 30, sin paginación.**
- Cada tarjeta lleva el título (a veces con el tipo entre corchetes), una pastilla de categoría, el libro de origen
  (con candado si no se tiene), las primeras líneas y un icono de color por categoría.
- A la derecha, un «resultado principal» con un extracto más largo y dos botones: ir al glosario y ver la página.

**Qué encuentra** [observado]:

- entidades: conjuros, criaturas, objetos, dotes…;
- **secciones de libros con la granularidad del encabezado**: la categoría «biblioteca», que enlaza al ancla de la
  sección;
- y páginas de la propia web, como la de los dados del usuario.

Repite resultados: la misma dote sale como entidad y como sección del libro. Ante una sección que está en el libro de
pago y en las reglas gratuitas, primero sale el de pago.

**Idioma**:

- Todo está en inglés. Aun así, una consulta en español encontró el conjuro correcto en primer lugar [observado]. Eso
  apunta a búsqueda semántica o a sinónimos [inferido].
- La ayuda reconoce, para la búsqueda de imágenes de su mesa virtual, que usan búsqueda difusa y que prefieren
  devolver de más [O].

**Dentro de un libro**: el lector no tiene buscador propio. Lo único que acota a un libro es el filtro de libro de
origen del panel [observado]; dentro de la página queda el buscar del navegador [inferido].

### 5. Contenido propio y notas de campaña

**Homebrew** [observado, O]:

- **Siete tipos, todos entidades con formulario**: trasfondo, dote, objeto mágico, criatura, especie, conjuro y
  subclase. No hay clases propias [O], ni páginas, documentos o libros propios: **no hay nada parecido a una wiki**.
- **Primer paso**: partir de una entidad oficial como plantilla, o «desde cero». Desde cero es un formulario vacío. Lo
  abrimos sin escribir ni guardar.
- **El formulario** mezcla campos estructurados con editores de texto rico (de los antiguos, tipo WYSIWYG).
  - La barra lleva negrita, listas, «spoiler», enlace, imagen, vídeo, bloque de código, tirador de dados y conversión
    automática de dados en tiradas.
  - **Cada editor deja elegir el formato de entrada**: texto plano, BBCode, WYSIWYG, Creole o HTML a pelo.
  - Hay un campo de versión.
- Un aviso al entrar explica el flujo:
  1. se guarda lo básico, en privado;
  2. después se completan los metadatos;
  3. publicar es enviarlo a moderación (hace falta suscripción [O]).
- **Estados**: privado, publicado y borrado; moderación: nuevo, en revisión, aprobado y rechazado. La lista de
  creaciones muestra nombre, tipo, fecha, visitas, veces añadido y versión.
- **Compartir sin publicar**: lo privado lo usan los miembros de una campaña que lo tenga [O].

**Notas de campaña** [observado]: la página de la campaña acaba con **dos cajas**, «notas del máster (privadas)» y
«notas del máster (públicas)», cada una con un botón de editar. No se abrieron. Eso es todo: un texto por caja, sin
páginas ni estructura. Las públicas las verán los jugadores de la campaña [inferido por la etiqueta].

**Diarios de la mesa virtual** [O]:

- hay un diario del máster, solo para él, y otro del grupo, en el que escriben todos;
- si el máster quiere que los jugadores vean algo, lo pasa al del grupo;
- el máster ya puede editar sus entradas; editar las del grupo llegará más adelante;
- solo existen dentro de la mesa virtual;
- tienen previsto añadir búsqueda y metadatos (quién estaba en la sesión, en qué mapa).

**Lo más parecido a secretos del máster**:

- notas privadas o públicas, y diario del máster o del grupo: dos cajas por visibilidad, nunca un bloque concreto;
- la versión para jugadores de los mapas, como segunda imagen en el pie;
- el «spoiler» del editor, que oculta hasta pulsar pero no es un permiso [inferido].

Dentro de un libro no hay nada por rol. Al compartir contenido con la campaña se comparte todo lo desbloqueado [O], así
que un jugador puede leer la aventura entera [inferido].

## Compromisos y límites

**Lo que ganan**:

- un texto muy enlazado y legible, donde el tipo de cada enlace se reconoce por el color;
- vistas previas rápidas y ricas: el statblock resumido evita salir del capítulo;
- anclas en cada sección y cada tabla;
- una navegación coherente: índice que sigue la lectura, anterior y siguiente, volver arriba;
- una búsqueda que encuentra a la vez entidades y secciones, y tolera erratas.

**Lo que pierden**:

- **Vista previa solo con ratón**: no funciona con teclado ni en pantallas táctiles, no tiene ARIA, sigue al cursor
  tapando el texto y no deja entrar, así que sus enlaces internos no sirven.
- **Pide en cada paso del ratón**, sin retardo de intención: barrer un párrafo dispara peticiones.
- **Identidades frágiles**:
  - anclas sacadas del texto;
  - URLs que exigen el nombre exacto;
  - el nombre solo resuelve a la versión vieja;
  - el contenido de usuarios enlaza por nombre.

  Renombrar rompe enlaces.
- **Dos maneras de pintar un statblock**, con aspecto distinto.
- **Ni imprimir ni PDF**: imprimir desde el navegador da algo pobre, con cuadros partidos.
- **Búsqueda**: tope de 30 sin paginar, repetidos, preferencia por lo de pago y nada para buscar dentro de un libro.
- **Notas de campaña**: dos cajas de texto. Lo demás vive en otra herramienta (los diarios de la mesa virtual).
- **Secretos gruesos**: o todo el libro o nada; ni bloques ocultos ni notas al margen.
- Detalles de accesibilidad: tablas ordenables sin indicarlo y anclas de encabezado ocultas a los lectores de pantalla.

## Qué nos llevamos a Crisol

### Wiki de páginas con subpáginas

- **El lector de una página**:
  - índice del documento fijo al lado, que despliega y resalta la sección en pantalla;
  - **anterior y siguiente entre páginas hermanas**, por el orden del árbol, arriba y al final;
  - migas de pan;
  - volver arriba.

  En el móvil, el índice baja a una hoja o un desplegable «Ir a…», como hacen ellos, pero sin desbordar a lo ancho.
- Los callouts y cuadros, a todo el ancho y con su título. Un tipo propio de **«leer en voz alta»** para el máster.
- Las tablas con título, que es el destino de su ancla. Si alguna se ordena, que se vea en la cabecera y lleve
  `aria-sort`.
- Las imágenes con pie y caja de luz. La idea de la **variante para jugadores** de un mapa encaja con los secretos del
  módulo 5 y con los mapas del 9; se apunta para entonces.

### Enlaces por id con vista previa

- Ya está decidido que los enlaces van por id de página y los bloques tienen id estable (ADR-0003). D&D Beyond tiene
  justo eso en sus bloques, el UUID, pero no lo usa en las URLs. **Nosotros, sí**:
  - el enlace a una sección apunta al **id de bloque del encabezado**, que sobrevive al renombrarlo;
  - en la URL va un nombre legible solo como adorno: si no coincide, se redirige al canónico, nunca un 404.
- **El tipo de destino a la vista**: cada enlace lleva un icono discreto según el tipo de página (PNJ, lugar,
  criatura…). El color puede acompañar, pero nunca va solo.
- **La vista previa, mejor que la suya**:
  - abre tras una **intención** de unos 300 ms y precarga al pasar;
  - **se ancla al enlace, sin seguir al cursor**, y deja un margen para **entrar en ella**, con lo que sus enlaces y su
    botón «Abrir» funcionan;
  - abre también con el foco del teclado, se cierra con Escape y es un popover accesible;
  - **en el móvil**, un toque abre la vista previa en una hoja inferior con «Abrir página»; no salta de página como en
    D&D Beyond;
  - se guarda en caché durante la sesión y se invalida con el aviso de cambios de `/api/realtime`.
- **Qué muestra**: título, tipo, ruta en el árbol, portada pequeña y el primer párrafo o la propiedad de resumen. Si el
  destino es una criatura, su **statblock resumido**. Si el enlace va a una **sección**, la vista previa es esa
  sección, cosa que ellos no tienen. Nunca un secreto: sale de la API que proyecta (ADR-0003).
- Los enlaces rotos (a una página borrada o en la papelera) se ven como tales, con la opción de crear la página.
- Lo que les pasa por enlazar por nombre es el aviso para el MCP. Claude escribe `[[Título#sección]]`, el servidor lo
  resuelve a ids y, si hay dudas, devuelve las candidatas (ya en el ADR-0003).

### Vista sencilla y hoja con estilo

- La **vista sencilla** se parece a su lector: una columna, buena tipografía e índice al lado.
- La **hoja con estilo** hace lo que ellos no: paginada, a dos columnas, con notas al margen y PDF. Lo que su impresión
  enseña a evitar:
  - que un cuadro, un statblock o una tabla se partan entre páginas;
  - que un título quede suelto al pie de una página;
  - que salgan en el papel los controles de la interfaz, las barras o los iconos.
- **El statblock, un solo componente para las dos vistas** (ellos tienen dos):
  - un bloque con datos estructurados más secciones de texto rico, como su formulario de criatura propia;
  - se edita con un formulario y se pinta igual en la sencilla, en la hoja, en la vista previa (en resumido) y en el
    PDF;
  - su nombre es un encabezado con ancla;
  - a dos columnas en lo ancho y a una en el móvil;
  - en la vista sencilla, plegar sus secciones puede ser útil; ellos no lo tienen y lo decide la spec.
  - Su Markdown se fija en la spec, tras el REA de Homebrewery.
- La fuente con página impresa que ellos muestran no aplica, salvo que la hoja numere páginas: entonces «p. N» puede
  salir en las referencias del PDF.

### Búsqueda en español

- **Una sola búsqueda para páginas y secciones**: ellos indexan por encabezado y enlazan al ancla, y lo copiamos en la
  idea. Hace falta agrupar la página y sus secciones en un resultado, para no repetir como ellos.
- Postgres con la configuración española, sin acentos (`unaccent`) y con trigramas (`pg_trgm`) para las erratas. Las
  búsquedas por sinónimos o semánticas pueden llegar más tarde; su acierto con una consulta en español muestra que se
  agradece.
- **Sugerencias al escribir** en el selector rápido (Ctrl+K, ya en el inventario):
  - con espera de unos 250 ms y de 5 a 8 resultados;
  - lo coincidente resaltado;
  - y «Ver todos».
- **La página de resultados**:
  - filtros por tipo de página, etiqueta y **subárbol** (eso es «buscar dentro de un libro», que ellos no tienen);
  - **paginación**, sin tope fijo;
  - extracto con lo coincidente resaltado.
- **Buscar dentro de la página abierta**, resaltando en el texto, para no depender del navegador.
- Fuera del índice queda lo que no se ve: en el módulo 5, nada de secretos para un jugador. El índice va por documento,
  como dice el ADR-0003.

### Contenido propio, notas y secretos

- Lo que en D&D Beyond son siete formularios cerrados y dos cajas de notas, en Crisol es la wiki entera. Sus diarios
  del máster y del grupo confirman la necesidad de **dos niveles: la página y el bloque**:
  - por página, quién la ve (módulo 5);
  - por bloque, los secretos y las notas ocultas, que ya se guardan aparte (ADR-0003).
- Su diario del grupo, donde escriben todos, es una idea para el diario de sesión de módulos posteriores.
- Nada de cinco formatos de entrada por editor: un solo editor de bloques y Markdown solo para exportar y para Claude.

### Qué haremos distinto

| Tema | D&D Beyond | Crisol |
|---|---|---|
| Identidad de un enlace | Ancla sacada del texto, URL con nombre exacto, homebrew por nombre | Id de página y de bloque; el nombre de la URL solo adorna y redirige |
| Vista previa | Solo ratón, sigue al cursor, sin entrar, sin teclado ni móvil | Intención, anclada, se puede entrar, teclado, hoja inferior en el móvil |
| Vista previa de secciones | No hay | Sí, con el bloque del encabezado y lo que sigue |
| Statblock | Dos plantillas distintas | Un componente de datos + texto para todas las vistas |
| Impresión | Navegador, una columna, cuadros partidos | Hoja paginada con PDF y control de saltos |
| Búsqueda | Inglés, 30 sin paginar, repetidos, sin buscar en un libro | Español, paginada, agrupada por página, filtro por subárbol |
| Notas | Dos cajas por campaña, diarios aparte | Wiki completa con secretos por bloque |
| Secretos | Libro entero o nada; mapa para jugadores en el pie | Proyección por documento desde el módulo 1 |

## Lo que se vio en vivo y lo que no

**En vivo**:

- índice y cuatro capítulos de las reglas básicas gratuitas;
- vistas previas de nueve tipos, con tiempos;
- anclas, en escritorio y en el móvil;
- la página de una criatura y la de un conjuro;
- la búsqueda (cabecera, resultados, filtros);
- impresión del navegador;
- los formularios vacíos de conjuro y criatura propios;
- la página de una campaña, sin abrir nada;
- la presentación de un capítulo de una aventura que Enrique tiene.

**No se vio**:

- las notas de campaña por dentro, porque habría que pulsar «editar»;
- los diarios de la mesa virtual;
- el paso de metadatos del homebrew, porque exige guardar;
- los filtros de búsqueda aplicados: se abrieron, no se aplicaron;
- un libro sin comprar por dentro;
- la app móvil;
- un móvil real: el toque se emuló.

**Cómo se hizo**: pestañas propias abiertas por CDP y cerradas al acabar. No se leyeron cookies ni tokens. Las capturas
están fuera del repo y las de contenido de pago se borraron. No se cambió nada de la cuenta: el recuento de creaciones
propias siguió en cero antes y después de abrir los formularios.

## Fuentes

Centro de ayuda oficial (leído por su API pública):

- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193242900-Tooltips
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7741328232084-Homebrew-and-Hyperlinks
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747210455828-Sharing-and-Publishing-Homebrew-Content
- https://dndbeyond-support.wizards.com/hc/en-us/articles/14175512652308-No-Homebrew-Classes
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209667476-Digital-Sourcebooks
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209515028-Digital-Source-Books-Offline
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193137684-D-D-Beyond-Mobile-App
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747210355604-Campaign-Content-Sharing-and-You
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49482930455572-What-are-Journals
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49482792019092-Will-DMs-have-the-options-to-make-certain-things-public
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49482857597716-Can-I-edit-or-delete-my-entries-once-they-are-made
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49482708273044-Are-Journals-accessible-anywhere-outside-of-Maps-like-the-Campaign-Page
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49482868108308-What-other-functionality-is-planned-for-Journals
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46363530954900-I-m-using-search-but-it-s-returning-a-lot-of-stuff-that-doesn-t-seem-relevant

Páginas observadas en dndbeyond.com (con la sesión de Enrique):

- reglas básicas de 2024: índice y los capítulos de cómo se juega, clases, statblocks de criaturas y hojas de
  seguimiento;
- una página de criatura y una de conjuro de esas reglas;
- la búsqueda, con consultas de prueba;
- los formularios vacíos de conjuro y de criatura propios, y la lista de creaciones propias;
- la lista de campañas y la página de una campaña;
- un capítulo de una aventura que Enrique tiene (solo la presentación).
