# Normas de diseño de Crisol

Lo que Enrique ha ido decidiendo sobre la interfaz. Vale para toda la app y para las pantallas que vengan. Cada norma
lleva, cuando la hay, su frase. Se añade aquí lo nuevo; no en otros documentos.

## Identidad

- **Mezcla del Crisol antiguo y del nuevo** (2026-10-30). Del antiguo:
  - grises neutros, **solo en oscuro** (Enrique, 2026-11-11: «el modo blanco no me convence»; el claro se quita del
    todo y, si un día hace falta, se hará entero; la hoja impresa y el PDF siguen con sus papeles);
  - cada nivel de título con su color;
  - enlaces en azul;
  - el rojo solo en lo importante.

  Del nuevo:
  - Barlow para el texto;
  - Barlow Condensed en mayúsculas para los títulos;
  - ~~las esquinas cortadas de los recuadros~~: **las formas del cristal** (Enrique, 2026-11-13: «ahora que tenemos el
    estilo cristal y en la mesa no se usa, … retirarlo y optar por las formas que estamos usando ahora»). Marcos,
    tarjetas, «Nuevo…» y recuadros, con las esquinas redondeadas de la Mesa (`--radius-frame`, 10 px); los botones,
    `--radius-button` (6 px). Ningún `clip-path` de esquinas cortadas en la app.
- **La marca es la llama** del Crisol antiguo, de rojo abajo a naranja arriba (`components/brand.tsx`): en la barra,
  en la cabecera, en la pestaña del navegador y **mientras algo carga** (latiendo en el centro). «El icono actual no
  trasmite nada».
- **Los desplegables nativos, con la lista en oscuro** (Enrique, 2026-11-16: «salen con las opciones en claro»): sus
  opciones, opacas y con los colores de la app.
- **Las barras de desplazamiento, finas y del color de los bordes**, sin flechas; en una ventana solo se desplaza el
  contenido: «la barra lateral de los popup desentona bastante».
- **Nada de aspecto «de IA»**:
  - ni todo en mayúsculas condensadas;
  - ni filas de botones con borde, todos con el mismo peso;
  - ni textos de ayuda fijos en pantalla.
- **Se dice «IA», no «Claude»**: Crisol se conecta a cualquier IA. El nombre de la app conectada sale solo donde se ve
  qué está conectado.
- **Las imágenes de la app, con prompt** (Enrique, 2026-11-11, revisión de la app): donde convenga una imagen de la
  app (los fondos de Entrar, la portada pública, el ambiente de Inicio, las pantallas vacías), Claude escribe el prompt
  y Enrique la genera a mano con ChatGPT, todas en un mismo estilo que elige él, **al estilo de Foundry VTT, Roliando o
  LegendKeeper** (fantasía épica pintada). Las portadas de mundos, campañas, sistemas y libros son del usuario: la app
  no trae ninguna. Prompts y guía de estilo en `docs/imagenes.md`.
- **Los fondos de Crisol van cambiando, sin marear** (Enrique, 2026-11-13: «quiero que nuestros fondos vayan variando
  cada x tiempo, sin llegar a marear, tanto aquí como en Inicio o cualquier vista que use un fondo con imagen»): el fondo
  de ambiente de siempre (la de ambiente y los de `public/fondos/`) se turna cada 45 s con un fundido lento de 3 s, en
  orden al azar en cada visita y solo con la pestaña a la vista. Una portada pedida (pararse en un mundo o una campaña
  en Inicio, un sistema) manda mientras se ve; al llegar y al irse, el mismo fundido suave. **Dentro de un mundo, sin su
  portada detrás**: los fondos de Crisol («no hace falta tener la portada de fondo»).
- **Sin idioma del contenido** (Enrique, 2026-11-13: «haremos una versión en inglés de la app PERO los sistemas y
  libros los sube el usuario en el idioma que quiera»): ni la campaña ni el editor de sistemas eligen idioma; cada
  sistema viene en el que lo subió su dueño. La app sí se traducirá entera (i18n). Al traer un zip de Foundry, el
  idioma de sus textos solo se pregunta si trae español e inglés (va el español); con uno, ese, sin preguntar.

## Armazón y navegación

- **Con sesión no hay barra arriba**. A la izquierda, una barra con iconos y su nombre debajo. Dentro de un mundo
  cambia y enseña su contenido. **Sin barra de estado abajo**: «la barra que hay abajo sirve de algo? sino quitala».
- **Fuera de un mundo, la barra va en este orden** (Enrique, 2026-11-11): Mundos, Plantillas, Etiquetas, Sistemas y
  **Archivos el último**. El tutorial de Inicio sigue el mismo orden.
- **Con sesión, la portada y Entrar llevan directos a Mis mundos**. Una portada que solo enlaza a Mis mundos es redundante.
- **Lo de la barra lateral se abre encima**, como una ventana, sin quitar lo que se está viendo: Historial, Papelera,
  Ajustes, Perfil. «Ajustes y todo lo de la barra lateral debe ser como un popup, para no quitar la vista que se
  tiene en el momento». Se cierra con la X, con Escape o pulsando fuera, y se vuelve a donde se estaba; un enlace
  de dentro la cierra y lleva a su sitio. **Sin enlace de vuelta** arriba («Mis mundos»): en una ventana no tiene
  sentido.
- **El armazón de siempre, con la barra de la app a la izquierda** (Enrique, 2026-11-16: «volvamos a la versión
  anterior donde la barra estaba a la izquierda y mantenemos lo que hemos hecho en el texto, los mapas y la pizarra»;
  «la de antes del todo»; ADR-0028): ~~el mundo del máster a pantalla completa, con cabecera fina y barra de pestañas
  (2026-11-13, ADR-0027)~~. Dentro de un mundo, la barra de la app con lo del mundo; a la izquierda, la ficha del árbol
  (su buscador, el árbol, las pestañas abiertas en pequeño y los marcadores); las pestañas abiertas, encima de la
  página; **Archivos del mundo, pantalla aparte**. **Un solo buscador**, el de la ficha del árbol (Enrique,
  2026-11-16): filtra al escribir y con Intro busca en el texto de todas; **Ctrl+K lo enfoca** (en lo estrecho, abre
  su cajón); sin selector rápido. En el centro, **la página con el mismo esqueleto en todas sus pestañas** (Enrique,
  2026-11-13: «cada vista, texto, pizarra o mapa son diferentes, deben mantener el esqueleto»), **como la página de
  Everlore** (Enrique, 2026-11-16, lienzo «Página del mundo, la mezcla»: «me gusta»; se queda al volver el armazón):
  la columna del centro es **una sola pieza de cristal que se lee, con las esquinas redondeadas del cristal y su raya
  fina**, algo más translúcida que la hoja (Enrique, 2026-11-16: «pon el estilo del cuadro de texto a los demás,
  redondea las esquinas y dale como un poco más de cristal»; `--surface-page`, el texto a más de 4,5:1), **la misma en
  el texto, el mapa y la pizarra** (el lienzo, recortado por sus esquinas). **La ficha del árbol y el panel, alineados
  con ella** (Enrique, 2026-11-16: «que esté alineada con las columnas y llegue hasta donde la columna»): empiezan a su
  altura, bajo las pestañas abiertas, y llegan hasta abajo con el mismo margen, con sus mismas esquinas y su mismo
  cristal. Dentro, **la
  portada detrás del título en las tres pestañas** (Enrique, 2026-11-16: «tenemos poco espacio de trabajo»; eligió
  «Portada detrás del título»; antes, la portada de 176 px encima del título): una franja baja (de 5,5 a 7,5 rem según
  el alto de la ventana, esquinas redondeadas; sin portada, su textura) con **el título grande encima de su parte de
  abajo**, sobre un degradado oscuro que lo deja leer, y **a la derecha, en la misma franja, sus botones**, «⋯» y
  **el botón del panel**, sobre una portada **en una pastilla de cristal oscuro** que los deja ver con cualquier imagen,
  también una clara (Enrique, 2026-11-19: «las opciones de una página no se ven según las condiciones de la imagen»;
  iconos a 3:1 o más); justo debajo, **las pestañas subrayadas** y a su derecha las herramientas de la abierta
  («Guardado» del texto; «Página…» y el ojo de la pizarra). **El desplazamiento, el del navegador**: nada baja solo ni
  se ajusta con la rueda (Enrique, 2026-11-16: «no me gusta la solución de hacer scroll para centrar»). **En el texto**,
  al bajar, cuando la cabecera llega arriba, se queda una **barra pequeña de cristal pegada** con el título en pequeño,
  las pestañas (se cambia de pestaña sin subir) y los botones; la franja se funde y el título, las pestañas y los
  botones pasan a la barra con movimiento, sin que lo de debajo se mueva. **El texto, sin caja** (Enrique: «quiero que
  la caja del texto esté integrada y no tenga fin»): va sobre la superficie de la página, hasta 72 rem y centrado. **Nunca
  diminuto** (Enrique, 2026-11-16): la hoja no encoge su letra por debajo de la suya; en una columna más estrecha que su
  texto, va seguido, sin páginas. **El título largo se lee entero** en la franja: baja de línea y, si no cabe, encoge lo
  justo (en la barra pegada, con «…»).
  **El mapa y la pizarra, a sangre y sin desplazar**: la cabecera arriba y, debajo, el lienzo de lado a lado de la
  columna y **hasta el final de la ventana; todo cabe** (la columna no se desplaza y la rueda sobre el lienzo es del
  lienzo), **sin fondo propio** (se ve el de la página) y **sus herramientas en una píldora de cristal abajo en el
  centro**; el zoom, abajo a la derecha. A la derecha, el panel de la página, **que se pliega** (sustituye a «no se esconde») **desde su botón en la
  cabecera de la página** (Enrique, 2026-11-16): su columna se cierra mientras el centro se ensancha, y se recuerda;
  **junto a un mapa o una pizarra, si no tiene nada (ni enlaces, ni propiedades, ni bloques), se pliega solo**
  (Enrique, 2026-11-14) y su botón lo abre igual. Las plantillas y las ventanas de páginas de la Mesa, con la página de
  siempre.
- **Dentro de un mundo, la barra lleva «Páginas», «Calendarios» y «Archivos»** (Enrique, 2026-11-16; antes, el nombre
  del mundo con su icono de montaña, 2026-11-12); nada más (ni Plantillas, ni Campañas, ni
  «Inicio»: el mundo se abre en su portada). Historial y Papelera enseñan los de ese mundo. **Los dados no van en la barra**
  (Enrique, 2026-11-08: «los dados deben estar en un icono con forma de d20 como en dndbeyond que al pulsarlo se abre
  en una esquina, pero no una pagina propia»): un botón flotante con forma de d20, siempre en la misma esquina, que
  abre la ficha de dados junto a él (y la cierra); no es una pantalla ni una sección de la barra. Sustituye a la ficha
  de dados en el sitio del panel de la página (2026-11-04). **La ficha no se recuerda abierta** al volver a entrar, y en
  el móvil se cierra al cambiar de pantalla (2026-11-08, segunda revisión). **Tirar, como en D&D Beyond** (Enrique,
  2026-11-10: «es poco intuitivo lo de tirar dados, mira como se hace en dndbeyond»; lienzo «Tirar dados», «me
  gusta»): el d20 abre una columna de dados encima (pulsar suma uno; el botón derecho o mantener el dedo, quita uno) y,
  a su lado, la bandeja con lo juntado, el modificador, Ventaja/Desventaja, quién la ve (se recuerda) y «Tirar»; al
  tirar se vacía y se cierra. El resultado sale sobre el d20 cuando paran los dados; el historial, en una ventana de la
  Mesa (fuera, en una ficha junto al d20). Sin pestaña Tiradas. El d20 y el «?» no se mueven; el «?» se aparta
  mientras los dados están abiertos. **Los dados 3D se cargan al ir a tirar** (al acercarse al d20, al tirar o al
  llegar la tirada de otro), no en cada página (Enrique, 2026-11-14: que pesen menos).
- **En la barra de la campaña, ella con su nombre (su Inicio) y solo lo suyo** (Enrique, 2026-11-10: «páginas no lo
  queremos en la campaña … solo gestionamos las cosas de la campaña»): Mesa, Libros, Compendio y Aventuras; las páginas
  del mundo, en la Mesa. **No se dice «tele»** («muchas veces no usaré la tele para enseñarlo»): es la **pantalla de los
  jugadores** («Pantalla»; su menú, «Cámara»), y se abre desde dentro de la Mesa, que tiene que estar activa.
- **La campaña se abre en la misma pestaña; la Mesa, en otra** (Enrique, 2026-11-10: «al entrar en una campaña no se
  abre una nueva pestaña, eso ocurre al entrar en mesa»; «personajes y mesa podemos unirlo dentro de la campaña»): la
  sección **Mesa** de la campaña tiene «Abrir la Mesa» (otra pestaña, a pantalla completa y sin barra), quién está en
  ella ahora (activo o en otra pestaña, desde cuándo) y cómo va la partida, y debajo los personajes. Sustituye a «las
  campañas se abren en otra pestaña» (2026-11-09) y a «la Mesa con la barra de la izquierda» del ADR-0021.
- **La campaña vuelve a tener su propio espacio, como el mundo** (Enrique, 2026-11-10: «al abrir una campaña volvemos a
  abrir una vista como la del mundo y ahí tendremos los libros, compendio, aventuras etc y además la mesa»): una barra
  con sus secciones (Inicio con el resumen y los jugadores, Libros, Compendio, Aventuras, Personajes, Páginas, Ajustes)
  y la **Mesa** como una sección más, a pantalla completa al entrar en ella, con su barra de la derecha. Sustituye a lo
  de abajo (la campaña abría directamente en la Mesa y sin barra lateral); pendiente de lienzo y de ADR.
- **El sistema también tiene su propio espacio, como el mundo y la campaña** (Enrique, 2026-11-11, revisión de la
  app): al entrar, la barra cambia y enseña lo suyo (su Inicio con la portada y los libros, Compendio y Reglas; los
  ajustes, en una ventana) y la llama vuelve a Sistemas, con la transición de salir. **Entrar y salir, uno el espejo del
  otro, con chispas y humo** (Enrique, 2026-11-13): al entrar, su icono y su nombre viajan al título y suben las
  brasas; al salir por la llama, vuelven a su tarjeta y sale el humo. **Reglas sigue el esqueleto**: el título sobre la
  columna del centro y los pasos y la revisión en las fichas de los lados, como el compendio y los libros. Un libro se abre dentro, con el
  esqueleto de tres columnas (su árbol, la entrada y sus datos) y «← {sistema}» en la cabecera. Sin el icono fijo ni
  la palabra «Sistema».
- **La campaña se abre en la Mesa, como en Foundry VTT** (Enrique, 2026-11-08: «la mesa debería ser lo que se ve al
  abrir la campaña como en foundryvtt»; «dentro de la mesa es donde deberíamos tener el compendio»; ADR-0019,
  construida el 2026-11-09):
  el máster entra a la Mesa a pantalla completa con una barra de pestañas a la derecha (Tiradas, Combate, Escenas,
  Personajes, Compendio, Páginas y Ajustes de la campaña con miembros e invitar); En juego, Grupo y Biblioteca dejan
  de ser vistas sueltas. **Las páginas del mundo se abren en ventanas sobre la Mesa** (como los diarios de Foundry:
  se mueven, cambian de tamaño, varias a la vez), sin cambiar de vista. **La jugadora abre la campaña en su ficha**
  (la Mesa, a un clic). **El inventario del grupo va en la ficha**, como en D&D Beyond: una sección «Del grupo»
  compartida en la pestaña de equipo, sin «Grupo» en la barra. **Las campañas se abren en otra pestaña del navegador**,
  como la partida en D&D Beyond (Enrique, 2026-11-09). **Varias campañas por mundo, y lo que se comparte va a la
  campaña desde la que se hace** (Enrique, 2026-11-09, para no liarse compartiendo con grupos distintos): «Enseñar» desde
  la Mesa de una campaña solo llega a ella (se ve siempre en cuál se está); ~~desde la wiki del mundo, «quién la conoce»
  enseña cada campaña con su casilla~~; con una sola campaña no se pregunta a quién. Lo de abajo sobre la portada y la
  barra de la campaña ya no vale (la sustituye esto). **Revelar, solo dentro de una campaña** (Enrique, 2026-11-19): en
  las páginas del mundo no hay «Quién la conoce», «Revelar la página», «Revelar a…» del árbol ni el ojo de sus filas
  (allí se crea el mundo, no se juega); se revela desde la Mesa de la campaña, en las ventanas de sus páginas. Vale
  también para los secretos, las pestañas, los pines y lo dibujado en el mapa.
- **La sala, arriba en la Mesa; sin pestaña «Campaña»** (Enrique, 2026-11-10: «si tenemos esto podemos quitarlo de la
  barra lateral»): los retratos de quien está y la pausa van en un recuadro junto al de la escena, **de su misma
  altura**; al pulsarlos, el panel de la sala (quién está, pausa, cómo mueven, echar e invitación). Los ajustes de la
  campaña, encima desde su barra. **Borrar una campaña, solo desde Mis mundos** (su engranaje), nunca desde dentro de
  ella.
- **Los encuentros, en Actores** (Enrique, 2026-11-10: «no me pegan» en Escenas): son grupos de criaturas con su
  formación y van con ellas; en Escenas, solo lo de cada escena. Actores tiene un buscador para todo y carpetas.
- **Cristal en lo que flota sobre el mapa de la Mesa** (Enrique, 2026-11-10: «me parece una pasada»; lienzo «La Mesa,
  con cristal», `out/lienzo-cristal/`): translúcido y con el mapa desenfocado detrás (tokens `--glass-*`) solo en piezas
  pequeñas que flotan: la barra de la escena, las herramientas, el zoom, las tiradas sobre el d20, la tira de turnos de la
  tele, las ventanas minimizadas y la cabecera de las ventanas. Lo que se lee (el cuerpo de páginas, hojas y compendio)
  va casi opaco, y la barra de la derecha, de cristal pero que se lee (`--glass-panel`). **El brillo, solo en lo vivo** y en el rojo de la marca
  (`--glow-live`): «En la tele» (en rojo, como «Enseñando»), la ventana que se enseña y un crítico. Al pasar por los
  botones de las barras, suben un poco. Sin desenfoque en el navegador, el mismo tinte más tapado.
- **El cristal, en toda la app** (Enrique, 2026-11-11, revisión de la app), no solo en la Mesa. Fuera de ella hace
  falta algo detrás, **un fondo de ambiente**: en Entrar, las imágenes; en Inicio, una de ambiente o la portada del
  mundo sobre el que está el ratón; en un mundo o un sistema, su portada, muy difuminada y tenue. De cristal, lo que
  enmarca (la barra, las fichas de los lados, cabeceras, tarjetas, cuadros); lo que se lee o se escribe, casi opaco.
  «Sin desenfoque» en Ajustes. **Que se vea** (Enrique, 2026-11-12: «¿no has puesto efecto cristal a nada aún?»;
  «el tono cristal no se aplica a los popup»): el fondo de ambiente (`components/ambient.tsx`) va fijo detrás de todo,
  una copia suave de la imagen ya mezclada con el color de fondo (opaca: al cambiar de imagen se funden sin destello) y
  **con tope de luz** (con una portada clara, más tenue). Se reconoce en los márgenes. En Inicio cambia al pararse en un
  mundo, no al pasar por encima. **En las transiciones de vista viaja solo el contenido** (`main[data-contenido]`): el
  fondo y la barra se quedan quietos, sin parpadear; si el fondo cambia (entrar en un mundo o salir), se funde dentro de
  la transición. Al entrar en un mundo, la imagen de su tarjeta se convierte en la portada; **al salir, también, al
  revés: una el espejo de la otra** (Enrique, 2026-11-19; sustituye a «al salir, no», que salía estirada y borrosa): la
  portada se encoge y viaja a su tarjeta, nunca crece ni se estira («no haciéndola grande sin sentido»), mientras lo
  demás se aleja. Viaja **solo la imagen, del tamaño en que se ve** (la franja de la portada, la imagen de la tarjeta),
  no la tarjeta con su texto (ver «Transiciones: el estándar»). **Sin salto al final**: nada se vuelve a montar ni
  se quita mientras dura (se entra con la portada ya pedida) y el desenfoque del cristal, que se apaga durante la
  transición, vuelve fundiéndose. Lo que enmarca (la barra, las fichas de los lados, las tarjetas,
  los recuadros con título) es **cristal de verdad**: translúcido (`--surface-glass`), con lo de detrás desenfocado
  (`--frame-blur`) y un brillo arriba (`--frame-sheen`). Las rayas, blancas translúcidas (`--line-frame`, `--line-soft`).
  **Lo que flota encima** (cuadros, ventanas, menús, el menú del botón derecho, el selector de iconos), cristal más
  tapado (`--popup-glass`, `--popup-blur`) sobre la pantalla oscurecida; lo de dentro, translúcido sin desenfocar otra
  vez. Los visores de imagen a pantalla completa (`data-full`), sin él. **Los campos** (buscadores, cajas de texto,
  desplegables), de cristal oscuro (`--field-fill`); **el botón principal**, de cristal rojo (`--accent-glass`). **La
  página es una hoja casi opaca** (`--surface-read`): la portada y el texto, una sola pieza; **en un mundo, la hoja es
  toda la columna del centro**, sin caja, de cristal algo más translúcido y con las esquinas redondeadas (Enrique,
  2026-11-16). Los marcos pintan su raya en
  una capa aparte (`::before`), para que su relleno pueda ser de cristal; la zona de peligro, igual, en rojo. **«Sin efecto cristal»** (Ajustes, «Aspecto»; se guarda en el navegador): sin fondo de ambiente ni
  desenfoque en ninguna parte, también en la Mesa; todo opaco, como antes. Sin desenfoque en el navegador, todo más
  tapado. **También en el compendio y en los libros** (Enrique, 2026-11-19: «en plantilla hay cosas sin efecto
  cristal»): la ficha de la izquierda y la de los datos, de cristal como la del árbol; la columna que se lee, la de la
  página (`--surface-page`); sus rayas y botones, con las rayas blancas translúcidas, y sus campos, de cristal oscuro.
- **Un solo conmutador** (Enrique, 2026-11-19, del «Por tipo | Por libro» del compendio: «esto tampoco me gusta»): el
  de Semana · Mes · Año del calendario (`components/segmented.module.css`): opciones que reparten el ancho, centradas,
  en un recuadro con el borde y el relleno de los campos, y la elegida en relieve y en negrita. En el compendio, «Todo ·
  Del sistema · Del mundo» y «Por tipo · Por libro», a lo ancho de la ficha como el buscador y con aire debajo de él;
  también «Todos · En la campaña» de Libros y cómo mueven los jugadores en la sala.
- **La portada pública** (tanda 5): la imagen a toda pantalla (la barra de arriba, transparente encima), en el centro la
  llama, el nombre, la frase, «Entrar» y «Tengo una invitación» (que pide el enlace y lleva a la campaña); debajo, tres
  estampas de lo que hay dentro (el mundo, la mesa, la ficha), capturas de la app.
- **Las pantallas vacías, una sola pieza en el centro** (Enrique, 2026-11-12: «una pieza central»): el bodegón pintado
  (public/vacios/), una frase corta y debajo el botón de crear; nada suelto alrededor. **Con contenido, el bodegón es el
  emblema** de la pantalla: pequeño, a la derecha del título (no en el hueco de la vista previa: «no me gusta el icono
  ahí a la izquierda»).
- **Los iconos: un emoji o uno de rol** (game-icons.net, «gi:<id>»), en páginas, carpetas, plantillas y sistemas; el
  buscador de iconos flota y se recorre con una parada del tabulador y las flechas. **Un solo selector, con nuestros
  iconos** (Enrique, 2026-11-19: «que aparezcan nuestros iconos, no los por defecto»): el buscador de los de rol y
  «Quitar el icono», sin fila de emojis ni «Otro»; en un formulario (una carpeta, un sistema), un botón con el de ahora
  que lo abre debajo. Un emoji, solo escribiéndolo delante del título. **Todos los del paquete** (Enrique, 2026-11-19:
  «necesitamos más iconos»; 4180): el buscador arriba (en español, por su nombre, sus palabras o su grupo, y en
  inglés), los grupos a la izquierda (Destacados, la selección de antes, y luego por temas; estrecho, en una fila
  encima) y la rejilla, que solo pinta lo que se ve. Su lista se pide aparte, al abrirlo o al nombrar un icono.
- **El espacio del sistema** (tanda 6): en la barra, su nombre con su icono, Compendio y Reglas; abajo, Ajustes. Su
  portada, arriba en su Inicio y detrás en todo su espacio. **Un libro se abre por dentro**: su tapa y su nombre arriba,
  su índice por tipos (con cuántos trae cada uno) y, al pulsar uno, su lista; «← {sistema}» para volver. **Sus
  capítulos se leen como en D&D Beyond** (ADR-0025, tanda 7): «Capítulos · Entradas» bajo su título; a la izquierda los
  capítulos y, dentro del abierto, sus secciones, que siguen la lectura; anterior y siguiente al final; en el móvil, «Ir
  a…». Quien juega los lee desde el compendio de su campaña («Leer · N capítulos»), sin los secretos. Reglas, hasta
  el editor a mano (tanda 8: pasos con preguntas de mesa, la ficha de ejemplo y la revisión a la vista, se guarda solo); uno de serie, para leer y bajar. **«Sistema nuevo», tres caminos que se eligen**: con
  tu IA (la frase para pedírselo), con el esqueleto (bajarlo y subirlo) y a mano (su nombre, y se abre su editor).
- **La campaña se abre en su propia vista, como un mundo** (Enrique, 2026-11-05): al entrar, la barra cambia y enseña
  lo de la campaña (sus personajes, su compendio, los dados…), con la transición de entrar. **El compendio** (el
  contenido del sistema que usa la campaña: clases, conjuros, criaturas, reglas…, con sus ediciones) **se ve ahí**.
- **El mundo se abre en su portada**, como la Home de LegendKeeper: una página más, que se crea sola con un texto de
  bienvenida, va la primera del árbol con su casa, no se borra ni se mete en otra, y lleva «Inicio» junto al título.
  Por detrás, la portada del mundo (su tarjeta al entrar: **esa transición no se toca**).
- **El menú de la cuenta** (la inicial, abajo en la barra): quién eres, Perfil, Ajustes y Cerrar sesión. Sin elegir
  tema (solo hay oscuro). Se abre al lado del botón y nunca se corta (2026-11-13: el desenfoque de la barra lo
  recortaba; va en una capa detrás de ella).
- **Ajustes: la IA, Jugabilidad y Aspecto** (Enrique, 2026-11-13: «los dados en el perfil no encajan»). **Jugabilidad**
  lleva lo del juego (el color de tus dados, ver caer los de los demás y lo que venga), y se guarda al momento; el
  Perfil, solo tus datos y la contraseña. **Aspecto** («¿qué es este aparato sin desenfoque?»): «Sin efecto cristal (más
  fluido en ordenadores lentos)», guardado en el navegador.
- **Las etiquetas son de toda la cuenta** (ADR-0006): «Etiquetas» va en la barra de Mis mundos, no en la de un mundo;
  dentro, son filtros (al buscar en la wiki, en Archivos). Llevan un color opcional y se ven como un punto de color con
  su nombre. Se eligen o se escriben: una nueva entra sola. **Una puede ir dentro de otra** (Enrique, 2026-11-08: «al crearla que te
  deje poner donde debe ir y luego poder arrastrarlas»): al crearla se elige «Dentro de» (sin escribir «/»); en la lista
  se arrastran como las páginas del mundo (Enrique, 2026-11-12: «nada de arriba del todo, debe funcionar como las hojas
  de un mundo»): una raya delante o detrás de una fila para ordenarlas a mano, la fila resaltada si va dentro, y
  llevada a la izquierda sale de su madre; también desde su ventana («Dentro de»). Se llevan sus hijas. **Como las
  carpetas de Archivos** (Enrique, 2026-11-12): las que tienen hijas llevan su flecha para plegarlas (o derecha e
  izquierda con el teclado), y pulsar la fila (o Intro) abre su ventana.
- **El móvil, solo para la jugadora** (Enrique, 2026-11-08: «la vista movil la vamos a descartar por completo excepto
  para la vista del jugador, el master siempre deberá trabajar desde PC»). Lo del máster (el mundo, sus páginas,
  Archivos, Plantillas, Sistemas, la Mesa…) se diseña y se revisa solo en el escritorio; lo de la jugadora (su campaña,
  lo que sabe, su ficha, el compendio, el grupo) sí tiene que ir bien en el móvil. Las normas de móvil de abajo valen
  para lo que ve la jugadora.
- **En el móvil no hay barra: solo la llama, abajo en el centro**, en un círculo. Al tocarla sube el menú con todas
  las secciones de donde se está, en mosaico (fuera de los mundos: Mundos, Archivos, Etiquetas, Historial y Papelera;
  dentro: Mundos para salir, Inicio, Campañas, Wiki, Archivos, Historial y Papelera), la actual marcada, y debajo la
  cuenta. «Me gusta crisol en el centro», pero no la barra con «Más». La guía se salta lo que no se ve y señala la
  llama. **Abajo solo van la llama (en el centro) y el d20 (en la esquina)**; el «?» del tutorial, arriba a la derecha
  (2026-11-08, para que no se junten los tres).
- **En el móvil, las ventanas son hojas que suben desde abajo**, con su asa arriba y la página oscurecida detrás: «los
  popup no parecen popups». Al cerrarse bajan enteras, sin cambiar de forma. Una imagen en grande sigue en el centro.
- **Archivos en el móvil**: en vez del árbol, un selector de carpeta; tocar un archivo o una carpeta sube su hoja
  (vista previa o lo que tiene, «Abrir» y «Ajustes»), que hace de la vista previa al pasar el ratón; lo mismo una
  etiqueta. Para borrar varios, «Elegir» saca las casillas y tocar una fila la elige. En lo táctil nada depende del
  «hover» (un toque lo deja puesto).
- **Cada pantalla tiene su guía, aunque sea básica**: «debemos mantener el patrón siempre».

## Pantallas
- **Un sistema se crea de tres maneras** (Enrique, 2026-11-11, revisión de la app: vuelve el editor a mano): **con la
  IA** (por el conector; la IA lo prueba con `probar_formula` y `probar_tirada`), **con el esqueleto** (bajarlo,
  rellenarlo y subirlo; la comprobación dice qué falta, dónde y con un ejemplo; también un zip de Foundry) o **a
  mano**, con un editor por pasos y en palabras de mesa («¿Qué tiene un personaje?», «¿Cómo se tira?»), sin
  tecnicismos: cada campo con su «?» y un ejemplo real, a un lado la ficha que va saliendo y «Probar», y la revisión
  siempre a la vista. Las fórmulas y lo avanzado («Avanzado»), al fondo. **Lo de la IA, solo mencionado** (Enrique,
  2026-11-13: «rollo pídeselo a la IA por el MCP, pero no debe dar más opciones»): en «Sistema nuevo» y en «Libro
  nuevo» los caminos son los de la app (el esqueleto y a mano; vacío o desde un archivo) y una línea dice que también se
  le puede pedir a la IA por el MCP, sin elegir PDF ni copiar frases. Sustituye a «los sistemas se hacen con la IA»
  (2026-11-04: el editor de entonces «es poco intuitivo»).
- **Un calendario, al pulsarlo, se ve en grande** (Enrique, 2026-11-19, tras probar el módulo 8: «¿cómo creo eventos
  en el calendario?»), con el esqueleto de las pantallas: el título sobre la columna y «Editar calendario» a su
  derecha. **Sin fichas fijas** (Enrique, 2026-11-19, tras probarlo: «en el calendario no necesitamos ese resumen, ya
  lo tenemos cuando le doy a editar»; «la columna izquierda no me interesa»): ni el año en pequeño ni los datos del
  calendario. **Se navega desde el centro, con vistas Mes, Semana y Año** («debemos navegar desde la vista central y
  tener diferentes vistas, mensual, semanal y anual»): arriba, el conmutador en el centro y «Hoy de…» a la derecha si
  alguna campaña tiene fecha; debajo, la vista con sus flechas. **El título de la vista lleva a otra fecha** (Enrique,
  2026-11-20; sustituye a la barra «Ir a»): con una flecha pequeña, abre un recuadro con lo que tiene sentido en esa
  vista (Semana: año, mes y día; Mes: año y mes; Año: el año); Intro aplica, Esc o pulsar fuera lo cierran. Mes: el mes grande (la franja de una festividad, las
  lunas, la estación, lo que cae en él); Semana: sus días en columnas con lo que cae en cada uno; Año: los meses en
  pequeño (las festividades en su color), y cada uno lleva a su mes. **La ficha del día, a la derecha, solo cuando hace
  falta** («se muestra al pasar el ratón por una fecha y se fija si hago click en un día, si le doy a Esc la
  deselecciono»): aparece en su hueco sin mover la columna; su título lleva la era («día 1 de enero de 2014 de la era
  X»), y debajo la estación, las lunas, lo que pasa, **«Nuevo evento»** (un evento suelto del mundo, que sale en las
  cronologías que lo incluyan) y «Página con esta fecha». **Su editor va por fases, cada una en su vista** (General,
  Semana, Meses, Días señalados, Días de más, Estaciones, Lunas, Eras y Correspondencia), como Reglas: las fases con sus
  avisos a la izquierda, la elegida en el centro (en la dirección, con la anterior y la siguiente al pie) y el año en
  cifras (el resumen del calendario) y los problemas a la derecha; sin vista previa; «Guardar» abajo cuando hay
  cambios, y salir sin guardar pregunta. **Los campos, en palabras de mesa**: cada mes es «Mes» o «Festividad» (días
  entre meses, que no se numeran; solo ella puede tener «Sus días no cuentan en la semana»); los días con nombre propio
  son «Días señalados» y una línea dice que no son los de la semana; la semana se elige por «La semana empieza en» y
  por la frase «El 1 de {mes} del año {N} fue {día}»; las columnas cortas de las tablas, centradas. **Días de más, sin
  preajuste humano** (Enrique: «los bisiestos es una peculiaridad de nuestro sistema solar, pero nuestra herramienta de
  calendarios no debe obligar, sino dar las herramientas»; «no poner bisiesto directamente»): la fase da reglas («Cada
  N años, {mes} tiene D días más, salvo cada M pero sí cada K»), ninguna de serie y sin atajo «Como el gregoriano»; en
  los textos no sale «bisiesto». Sustituye al editor a pantalla entera con todas las secciones seguidas y la vista
  previa (lienzo del módulo 8).
- **Los años de un calendario tienen tope** (Enrique, 2026-11-19: en «Ir a» se podía escribir «-2345656»): en General,
  «Años: desde … hasta …», opcional; sin él, de -99.999 a 99.999. Si tiene eras y «desde» está vacío, se propone el
  inicio de la primera (se ve como pista y con un botón; no se impone). «Como el nuestro» lo deja vacío. Es un problema
  que «desde» vaya después de «hasta» o que una era empiece fuera. La vista grande y los campos de fecha (páginas,
  eventos, el «hoy») se paran en el borde: las flechas se desactivan y el año escrito se queda en el extremo; el campo
  del año no admite más de seis cifras. La IA no puede fechar fuera (lo dice con un motivo claro).
- **Las plantillas son páginas guardadas como modelo, y no hay plantillas de serie** (Enrique, 2026-11-11, revisión de
  la app; ADR-0024): cada cuenta hace las suyas. Una plantilla lleva lo mismo que una página (portada, icono, campos,
  panel, texto y sus pestañas) y se edita como una página; crear desde ella es duplicarla. Se ordenan en carpetas.
  **Su lista es como Archivos** (prototipo aprobado, 2026-11-12): el árbol con carpetas de color e icono, arrastre y
  teclado, la vista previa a la izquierda y «Plantilla nueva» y «Nueva carpeta» fijos. **«Plantilla nueva» abre el
  mismo cuadro que «Página nueva»** (Enrique, 2026-11-12): el tipo (texto o un mapa) y el nombre; sin nombre, «Plantilla
  sin título», que se abre para escribirlo. **Abierta, es su página** con «‹ Plantillas» arriba a la izquierda, la marca
  «Plantilla», a la izquierda **el árbol de las demás** (carpetas que se pliegan, «Nueva carpeta» y «Plantilla nueva»
  arriba y, con el botón derecho: de una plantilla, renombrarla, duplicarla, moverla a una carpeta y borrarla; de una
  carpeta, crear dentro, sus ajustes y borrarla) y en el panel sus campos y bloques, que se definen; su icono, en su
  título, como el de una página. **Una plantilla no tiene cuadro de ajustes** (Enrique, 2026-11-19: «la carpeta e icono
  no tiene sentido ahí»): lo suyo va en **el menú del botón derecho, como en el árbol de páginas**, también en la lista
  de Plantillas (con la tecla de menú o Mayús+F10, y con su «⋯» en la fila). **Sin «⋯»** (Enrique: «las plantillas no
  necesitan imprimirse o descargarse»; «no quiero tener solo versiones en los 3 puntos»): **«Versiones», un botón de
  icono (el reloj) en su cabecera**, con el aspecto del candado de las páginas (también en la pastilla sobre la
  portada), que abre su lista; duplicarla, solo con el botón derecho. **Sin candado** (Enrique, 2026-11-19: «el block
  en las plantillas no tiene sentido»): una plantilla no se pone en lectura (solo una que ya lo estaba lo enseña, para
  quitarlo). **Duplicarla, como duplicar una página** (Enrique, 2026-11-19: «que funcione como en las páginas que te
  redirige a la página»): abre la copia, sin su título en edición; mientras llega, la de antes se queda (sin hueco). **Abierta, el mismo esqueleto que una página del mundo, en
  el mismo sitio** (2026-11-19: «las columnas no están bien situadas como en las páginas de la wiki»): la portada
  detrás del título, las pestañas debajo y el panel que se pliega desde su botón; la ficha de la izquierda, la columna y
  el panel, con la misma posición, anchos y alto que en una página (medido a 1440 y a 1920 px), «‹ Plantillas» en el
  hueco de las pestañas abiertas y el nombre de la ficha, el rótulo pequeño y gris del de un mundo.
  **«Desde plantilla» va la última y centrada, tras una raya con «o»**, en «Página nueva» y en «Plantilla nueva» (allí,
  partir de otra): cambia el cuadro a la lista de plantillas («‹ Otro tipo» vuelve). **No en «Pestaña nueva»**: la
  plantilla, solo al crear una página (Enrique, 2026-11-12: «me choca lo de usar una plantilla en una pestaña»). Ya no
  hay «Aplicar plantilla» en «⋯». **«Pestaña nueva» ya no ofrece «Tabla» ni «Escena»** (Enrique, 2026-11-13: las
  tablas son del compendio y las escenas, sueltas); las que ya hay se siguen viendo. Tras la crítica (Enrique,
  2026-11-12): **los campos y bloques del panel de una plantilla van plegados** (nombre y tipo; al pulsarlos, sus
  opciones) **y se recolocan con sus seis puntos**, arrastrando o con Alt y las flechas, como los de una página.
  **Su panel, el de una página** (Enrique, 2026-11-19: unificarlo): sin lista aparte «Campos» ni «+ Campo» ni rótulo
  «En el panel»; los campos son sus propiedades y **se añaden con «Añadir bloque › Propiedad» (o «› Etiquetas», una
  sola vez)**, el mismo menú que en una página; salen en su sitio, arriba (tras la imagen si el panel empieza por una),
  plegados, y el recién añadido se abre con su nombre elegido para escribirlo. En sus opciones, todo lo de antes (tipo,
  opciones, a qué plantillas apunta, papel y nombre al revés, reloj, fecha) y **«Oculto a los jugadores»** (un ojo
  tachado junto a su nombre). Sin campos ni bloques, «Panel vacío» como en una página. Las de antes conservan sus
  campos, en su orden (sin migración); **la
  marca «Plantilla» lleva el color de acento**, para no confundirse con la píldora que lleva a una plantilla; **bajo
  cada plantilla, sus primeros campos** (en la lista y al elegir una), no sus pestañas.
- **Las tiradas no se escriben en las páginas** (Enrique, 2026-11-11, revisión de la app): los dados salen del texto y
  van a las entradas del compendio, que se tiran con su botón y se enlazan o se incrustan en una página.
- **La wiki se edita en el sitio, como en el Crisol antiguo** (`docs/specs/wiki-edicion.md`): «no me gusta que todo sea
  como con botones, debe ser más ágil, poder cambiar todo en edición, incluso el título». Se abre la página y se
  escribe: el título es el propio encabezado (Intro guarda, Escape deshace) y todo se guarda solo («Guardando…»,
  «Guardado», abajo a la derecha). Sin «Editar», «Guardar», «Cancelar» ni «Renombrar», y sin barra de botones encima
  del texto: los bloques con «/», los enlaces con «@» o «[[», buscar con Ctrl+Alt+F y el menú del bloque con
  Ctrl+Alt+B. La cabecera, en iconos (Marcar, Bloquear, Hoja, «⋯»).
- **El icono va en el propio título**: **delante del título siempre hay un icono que se pulsa** (Enrique, 2026-11-19:
  «haz que el icono del título de una hoja sea pulsable»); sin icono, el de su tipo (el mismo que en el árbol; en una
  plantilla, el de plantilla), en gris, y pulsarlo («Cambiar el icono», también con Intro o Espacio) abre el selector de
  nuestros iconos. Con la página bloqueada, solo se ve el suyo (sin icono, nada). Un emoji delante del título pasa a ser
  su icono, y **«:» al principio propone los iconos de la app por su nombre** (Enrique, 2026-11-19: «el icono dijimos
  que se ponía escribiendo en el título»; como «/» y «@» en el texto): las flechas eligen, Intro lo pone y Escape lo
  deja. Puesto, pulsarlo abre el selector de nuestros iconos, con «Quitar el icono». Igual en páginas y plantillas. **La portada**, como en el Crisol antiguo
  y en los mundos: se pone desde «⋯»; puesta, al pasar por encima salen «Ver» y «Cambiar», y se arrastra para
  encuadrarla.
- **Las columnas de los lados de una página, fijas y del mismo alto** (Enrique, 2026-11-11): pulsar el mundo en la
  barra no recoge el árbol (lleva a su portada); la derecha mide lo que la izquierda (lo que cabe en la ventana) y lo que
  no cabe se desplaza dentro. En la ventana de una página de la Mesa, cada columna con su desplazamiento.
- **La hoja llena el ancho** de la columna del centro hasta un tope de letra (20 px) y, si sobra, va centrada (en un
  mundo, sin caja y hasta 72 rem, Enrique, 2026-11-16); **las
  rayas de salto de página van de lado a lado y dicen la página que se cierra** («Página 1»). **La nota lateral va a su
  lado** (izquierdo o derecho) con el texto alrededor, igual al imprimir.
- **Imprimir o descargar pregunta cómo**: con colores, en blanco y negro o en pergamino (con una muestra de cada uno),
  el papel, la numeración, el pie y los secretos. El aspecto va con cada impresión (la página se sigue escribiendo
  igual) y se recuerda para la próxima; el papel, la numeración y el pie se guardan en la página.
- **El menú común** (`components/menu.tsx`): flota junto a su botón sin que lo recorte nada; Escape o pulsar fuera lo
  cierran y el foco vuelve al botón; lo que se despliega dentro lleva su flecha (como «Exportar» o «Versiones»).
- **Las propiedades, en una ficha a un lado** (a la derecha, con el texto alrededor, como en el Crisol antiguo); en la
  hoja, arriba a todo lo ancho. Solo «+ Propiedad» y «Etiquetas» a mano: «Alias» y «Resumen» sobran. El tipo de una
  propiedad sale junto a su × mientras se edita.
- **Sin sección de subpáginas ni «Anterior / Siguiente»**: se navega desde el árbol; «Nueva subpágina», en «⋯».
- **«Página nueva» (y «Nueva subpágina») abre un cuadro** como el de «Pestaña nueva»: el tipo (texto, mapa, pizarra,
  cronología, árbol genealógico u organigrama) y el título; Intro la crea. Sin título, se abre para ponérselo.
- **Cambiar de página no deja huecos**: la de antes se queda hasta que llega la nueva, que entra con un fundido corto
  (al pasar por el árbol ya se pide); el texto no se enseña vacío mientras llega.
- **Escribiendo, el texto no lleva recuadro** (se confundía con una caja); las cajas, sí: marco fino y redondeado. **El asa de los bloques**, como en Everlore:
  pequeña y gris en el margen izquierdo; una sola a la vez. Su menú agrupa «Convertir en» en desplegables (Texto,
  Títulos —del 1 al 6—, Listas, Recuadros, Hoja, Del máster) y tiene «Insertar debajo». **Bajo lo último escrito hay
  siempre una línea de más**, con sus seis puntos: se escribe en ella sin pulsar Intro y aparece la siguiente (no se
  guarda hasta escribir).
- **«Guardado»**, pequeño y gris a la derecha de las pestañas de la página; nada flotando en las esquinas.
- **El menú «/» y «Convertir en», por desplegables** (Texto, Títulos, Listas, Páginas, Recuadros —con los secretos y
  las notas ocultas—, Hoja); al escribir, una lista plana. Sin explicaciones ni «?»: los nombres bastan. Nada de
  «máster» en el worldbuilding.
- **Botón derecho en el árbol**, como en Everlore: crear subpágina, renombrar, duplicar, mover y ordenar
  (desplegables que se abren al pasar el ratón) y borrar. **Exportar, solo en el «⋯» de la página** (Enrique,
  2026-11-19: «exportar ya lo tenemos en los 3 puntos»). **Las rayas de un menú, solo entre dos grupos**: ninguna al
  principio, al final (en Inicio, sin «Borrar», no queda la de encima) ni dos seguidas, en todos los menús del botón
  derecho (páginas, plantillas y carpetas). **Renombrar no abre un
  cuadro** (Enrique, 2026-11-19: «el renombrar solo pone en edición la propia página, no abre un cuadro»): abre la
  página si no lo está y pone su título en edición, con todo elegido para escribir encima (Intro guarda, Escape lo
  deja). Igual en el árbol de las plantillas y en la lista de Plantillas.
- **Las pestañas abiertas se recolocan** arrastrándolas (o Alt + flechas). Cerrar la última lleva a la portada del
  mundo sin rehacer la pantalla.
- **Las fichas de los lados de la página empiezan donde las de Archivos** (a la misma altura, haya portada o no) y
  llegan hasta abajo de la ventana.
- **Los bloques del panel, con sus seis puntos**: se arrastran para moverlos y, al pulsarlos, sus opciones (sin «⋯»).
  Las etiquetas y las propiedades se añaden también desde «Añadir bloque» («De la página»). Las versiones, en «⋯» de
  la página, no en el panel. En los menús, pasar el ratón por una opción la elige.
- **Propiedades y etiquetas, como los bloques del panel**: el nombre pequeño en mayúsculas encima y el valor debajo; el
  tipo y la ×, al acercarse. «Exportar todas las páginas», un icono en la esquina de la ficha del árbol.
- **Los desplegables flotan y no mueven nada** (como «Marcar»: «Guardar en», los grupos de un clic y un campo para uno
  nuevo); nada de formularios que empujan la página.
- **Alrededor de la página, nada pesa** («la UI es rara»): los paneles de los lados sin recuadros, con títulos
  pequeños y grises; «Página nueva», «Exportar» y «Nueva subpágina», discretos; un vacío dice una sola línea.
- **La página sigue el esqueleto de Archivos** (Enrique, 2026-11-02: «el título en la misma posición y las columnas
  igual»): la columna del centro (todo el hueco entre las fichas, de hasta 20rem) con las pestañas abiertas arriba, el título, las pestañas de la página y el
  texto; a los lados, fuera de ella, la ficha del árbol (con su buscador fijo, por nombre o #etiqueta, y los
  marcadores debajo) y la ficha del panel, hacia los bordes. **Las dos fichas empiezan a la misma altura, la de las pestañas de la
  página**, como en Archivos bajo el título. **Al plegar el panel, la columna del centro se ensancha, suave** (Enrique,
  2026-11-19; sustituye a «la columna no cambia al esconder el panel»).
- **Del estilo de Everlore, la forma** (esquinas redondeadas, cabecera pegajosa compacta al bajar) con nuestros
  colores y letras. Sin el mundo en pequeño sobre el título (estaba repetido) y sin migas de pan. La portada de la
  página va por detrás, solo en la columna del centro, fundida con el fondo, con el título encima de su parte de
  abajo (en un mundo, **una franja baja detrás del título**, Enrique, 2026-11-16). **Una página sin portada se ve como una con portada, pero sin ella**: su hueco se queda, con una textura
  suave (grano, un tejido tenue y dos manchas de color, fundidos con el fondo) para que no se vea plano (el título y
  las fichas, en el mismo sitio en todas) y «Añadir portada» sale arriba a la derecha al pasar por él.
- **Las pestañas de una página** (ADR-0007): siempre bajo el título, «Texto» y las que se añaden, en texto plano con la
  elegida subrayada; «+» al final abre un cuadro con un recuadro por tipo (texto, mapa, pizarra, cronología, árbol
  genealógico y organigrama) y el nombre. La elegida lleva su menú (▾): nombre, mover y quitar. El texto y el mapa, en
  la columna del centro. **Sin pestaña «Relaciones»** (Enrique, 2026-11-19): su familia y su organigrama, en la pestaña
  de árbol; sus enlaces, en la ventana del grafo.
- **La cronología, una pestaña de la página, como en LegendKeeper** (Enrique, 2026-11-19, ADR-0031; sustituye a «el
  tiempo vive en Calendarios», 2026-11-16): con el esqueleto de la página y a sangre como el mapa; a la derecha de las
  pestañas, su calendario, «Hoy de…», «Ir a…» y sus ajustes; abajo en el centro, la píldora con «+» y sus vistas (Lista
  · Meses · Calendario). Calendarios se queda con las reglas del tiempo (los calendarios y su vista grande). Los
  eventos son líneas de la cronología, del mundo, que se pueden convertir en página.
- **El árbol genealógico (o el organigrama), una pestaña que se edita desde el árbol** (Enrique, 2026-11-19: «se hace a
  partir de páginas y se edita desde el árbol; algunos nodos pueden no tener página todavía»): las tarjetas de Familia
  y Organigrama, a sangre; pulsar una abre su ficha arriba a la derecha con lo que se añade junto a ella (padre o
  madre, pareja, hijo o hija; miembro o quien lo dirige) como texto con su +, sus líneas (con su × al acercarse),
  «Abrir» o «Crear página», «Nota» o «Nombre» y «Quitar». Añadir es un buscador: una página del mundo, alguien que ya
  está en el árbol o solo un nombre (su tarjeta, con la raya discontinua hasta que tenga página). Vacío, una sola pieza
  en el centro con «Añadir a alguien» y, si la página tiene campos con papel, «Empezar desde los campos». El panel de
  la página va plegado, para que las tarjetas tengan el ancho.
- **El grafo de relaciones, en una ventana** (Enrique, 2026-11-19; sustituye a «a pantalla entera, desde la cabecera
  del árbol»): como Ajustes, encima de la página y sin cambiar de vista, casi del tamaño de la pantalla; el de todo el
  mundo, desde el icono de la cabecera del árbol de páginas, y el de una página, desde el de «Mencionado en», también
  para la jugadora. Va en la dirección (`?grafo=`): Escape, su X, pulsar fuera o Atrás la cierran. **Sin controles
  abstractos** (Enrique, 2026-11-19: «lo de alcance sigue sin entenderse, hay que simplificar»): el de una página enseña
  sus relaciones directas, campos y menciones del texto (estas, discontinuas, como dice la leyenda; sin interruptor), y
  para ir más allá se pulsa otra página y «Sus relaciones» en su ficha las añade al grafo. El del mundo, **sin filtro
  por plantilla** («no le veo la utilidad»): relaciones, etiquetas y páginas sueltas; cada página, del color de su
  plantilla. Los filtros se ocultan con **un botón de icono de panel**, a la izquierda de su cabecera, como el del panel
  de la página («Ocultar filtros» / «Mostrar filtros»; nada de «‹‹ Plegar»).
- **El panel de la derecha se escribe** (ADR-0008, como el de LegendKeeper y el de Everlore): arriba las
  propiedades; después sus bloques, que se añaden con «Añadir bloque» (texto, imagen, barra, círculo, estrellas,
  fichas, subpáginas, páginas con una etiqueta), se titulan encima, se tocan en el sitio (+ y −, pulsar la barra, las
  estrellas o las fichas) y se recolocan arrastrando su asa o desde sus opciones; vacío, dice «Panel vacío» y para qué
  sirve. Arriba del todo, «Mencionado en» (como en Everlore: una lista corta de páginas; las que la nombran sin enlazar, debajo, con «Enlazar» al pasar). Sin índice (está el árbol); las versiones, en «⋯». No se esconde (no hay botón para eso); sin sitio,
  va debajo de la página. **Se pliega** (Enrique, 2026-11-13): en un mundo, para que el mapa o la pizarra lo tengan todo, y se recuerda plegado o no; **su botón va en la cabecera de la página, tras «⋯»** (también
  en la barra pegada al bajar) y el panel se desliza entero fuera (Enrique, 2026-11-16; antes, su botón arriba dentro
  de él lo dejaba en una tira). **Suave** (Enrique, 2026-11-19): se va entero, de su ancho y sin estrujarse (lo de dentro
  no se recoloca), fundiéndose mientras la columna del centro se ensancha con él; al volver, entra igual y ya trae lo suyo
  (nunca un panel vacío que luego se llena).
- **Dentro de un mundo, la forma de Everlore (esquinas redondeadas, sin cortes) con nuestros colores y nuestras
  letras.** Las propiedades de una página van en el panel de la derecha, con su título pequeño como lo demás.
- **Los mundos no tienen papel** (máster o jugador): eso es de las campañas.
- **La tele, siempre oscura**: es una pantalla para el grupo, sobre el mapa
  (2026-11-08).
- **El mapa y la pizarra, con todo el sitio, como en LegendKeeper** (Enrique, 2026-11-13: «no debe verse por abajo cómo
  termina el cuadrado»): abiertos en una página, cruzan la hoja de lado a lado y llegan justo al final de la ventana;
  la hoja no acaba (sin su borde de abajo). En un mundo, **a sangre bajo las pestañas, hasta el final
  de la ventana y sin desplazar la página, sin fondo propio**, como en Everlore (Enrique, 2026-11-16). **Supr borra lo elegido** (lo dibujado o un pin) **y Escape deja la
  herramienta** con el foco en cualquier sitio del mapa, no solo en él; **también en la pizarra y con el foco donde sea**
  (Enrique, 2026-11-16: «que borre»): en el panel (una casilla, un color), en la cabecera de la página, en la píldora o
  en ningún sitio; solo no donde se escribe. El aro del foco del lienzo, solo si se llega con el tabulador («que el foco
  del lienzo no pinte ese borde al pulsar una tecla»).
- **La pizarra** (tras la crítica del 2026-11-13): Excalidraw con lo de Crisol y nada de lo suyo de fuera (ni su
  biblioteca pública, ni su ayuda con sus redes, ni sus textos de ayuda fijos, ni su menú de serie a quien solo mira);
  los estilos de la app no se le cuelan (marcos, títulos, radios). Su barra **no salta**: «Oculto para los jugadores»
  es un ojo tachado siempre en su sitio (apagado sin nada elegido) y «Página…» un desplegable que flota con las páginas
  que contienen lo escrito. Dice «Guardado»; vacía, una línea en el centro con cómo empezar. Lo oculto, además de
  apagado, con raya discontinua y el ojo tachado en su tarjeta. Lo que dibuja la IA, con la misma tinta que lo hecho a
  mano y sus flechas de borde a borde. **Pulsar una tarjeta abre su página** (a quien juega, en su campaña); en el
  editor, con su ↗ (pulsarla la elige). **La jugadora en el móvil** ve la pizarra en palabras (sus páginas, sus notas
  y quién va con quién) y el lienzo, al ampliar; al abrirla nunca más lejos que el 60 %. **En un mundo, con nuestra
  propia píldora** (Enrique, 2026-11-16, como el mapa): abajo en el centro, de cristal, las
  herramientas de Excalidraw (elegir, mover el lienzo, rectángulo, rombo, elipse, flecha, línea, dibujar, texto,
  imagen y borrar; la elegida marcada y su atajo al pasar el ratón) y «⋯» (guardar como imagen, vaciarla); el zoom,
  abajo a la derecha, y deshacer y rehacer, abajo a la izquierda. Sin su barra de formas, su menú ni su pie; su panel
  de propiedades sí (en un lienzo bajo o estrecho, donde Excalidraw pasa a su modo de móvil, lo de lo elegido sale en
  una isla encima de nuestra píldora). **Sin «Ampliar»** (ya va a sangre, como en Everlore); la jugadora lo conserva.
- **El mapa**: la imagen se arrastra y se acerca con la rueda hacia el cursor (y con dos dedos); las herramientas, una
  columna de iconos arriba a la izquierda (**en un mundo, una fila en una píldora de cristal abajo
  en el centro, el zoom abajo a la derecha y la escala abajo a la izquierda**, Enrique, 2026-11-16); el botón derecho ofrece «Pin aquí» y «Pin con página nueva» (su nombre es
  el de la página, que nace como subpágina). Pulsar un pin abre su panel a la derecha (abajo en el móvil), donde todo
  se guarda al momento; arrastrarlo lo mueve y el doble clic abre su página. Los pines, las ocho formas de Everlore,
  **todas del mismo tamaño y clavadas por el mismo sitio**, abajo en el centro (Enrique, 2026-11-16). **Su icono, de los
  de rol del paquete** («no emojis sueltos») y elegido antes que «Solo el icono». **Lo oculto, con un ojo como el del
  árbol** («"Revelar…" no se entiende»): «Lo conoce / No lo conoce» de cada campaña, que se cambia al pulsarlo (con
  varias, su lista). **La página de un pin o una región, con un desplegable propio** que flota, como «Página…» de la
  pizarra. **Cerrar una región: pulsar su primer punto** (se resalta al acercarse) o doble clic, sin punto de más.
  **La herramienta Texto dibuja una caja** donde irá el texto; **un texto se elige al pulsarlo**, doble clic lo edita y
  Supr lo quita. **Medir, arriba a la izquierda** (no tapa la píldora). **La pizarra, nítida mientras se acerca o se
  aleja** («al alejar se difumina … dientes de sierra»).
- **La hoja es lo que hace única la wiki, y toda página es una hoja** (Enrique, 2026-11-03: «verlo directamente como
  se ve en la hoja pero sin las texturas»; aprobada la prueba «toda página es una hoja», «está quedando genial»): el
  texto se escribe seguido y cae en sus páginas como al imprimir (el mismo paginador y la misma letra y tamaño), con una
  raya fina y «Página N» de la que acaba (desde el 2026-11-12; antes, de la que empezaba), y con los colores de la app; el papel y las texturas del tema, solo al
  imprimir y en el PDF. Una columna por defecto; «Columnas» (1 o 2 desde ese punto) y los demás bloques de maquetación
  (saltos, statblock, nota lateral, a lo ancho, índice) están en «/» → Maquetación en todas las páginas. En el móvil,
  una columna seguida. Los títulos del texto, igual con hoja y sin ella (en su letra, sin mayúsculas, cada nivel en su
  color), también en lo que lee un jugador.

- **Los cambios no son bruscos y se notan**: un elemento nuevo entra animado (sube y crece, con el contorno
  iluminado un momento) cuando el cuadro que lo creó ya se ha ido, y uno borrado baja, encoge y se desvanece antes de
  irse; los cuadros y las ventanas se abren y se cierran animados, y el menú de la cuenta se despliega. Lo que se
  abre no enseña un momento de carga: sus datos se piden antes (al pasar el ratón) y entran con un fundido.
- **Las animaciones, siempre completas y para todos**, aunque el sistema pida menos movimiento, para que todos los
  clientes vean el detalle. Sin opción en Ajustes: «Quítalo» (2026-10-30).
- **Las animaciones, con temática de crisol**: lo nuevo se forja (sale al rojo y se enfría); lo borrado, **distinto y
  sin fuego**: se apaga a gris carbón, suelta ceniza que cae y se deshace de arriba abajo («la de borrar debería ser
  diferente»). **Forja y ceniza son solo de los mundos (y las campañas)**: los archivos aparecen y se van con una
  animación suave, sin fuego. **Crear y borrar, como entrar y salir**: con
  transiciones de vista, la ventana de crear se encoge al rojo en la tarjeta nueva (que sale ya con su portada) y la
  borrada arde en su sitio; las demás se recolocan deslizándose, sin saltos. Al entrar en un mundo, «Mundos» sube a la llama de la
  barra y se funde con ella, que se aviva soltando chispas: «como que el mundo se está cocinando». Dentro, la llama es
  la vuelta; al volver, «Mundos» sale de la llama, sin fuego. Los iconos del mundo (todos, también los que vengan)
  salen del crisol uno tras otro al entrar y suben a él al volver, antes de que salga «Mundos».
- ~~Entrar y salir del mundo a pantalla completa (ADR-0027)~~: con el armazón de siempre vuelven **las transiciones de
  siempre** (las de abajo; Enrique, 2026-11-16, ADR-0028).
- **Entrar en un mundo es entrar**: la tarjeta pulsada se convierte en la cabecera del mundo mientras Mis mundos se
  acerca y se desvanece, como si se pasara a través; al volver, al revés (transiciones de vista del navegador). Al
  entrar, con un fuego sutil: la tarjeta se pone al rojo mientras crece y sube algo de calor con unas brasas; la
  llama de la barra se aviva y suelta chispas durante unos segundos. Al salir, la cabecera se enfría mientras vuelve
  a ser tarjeta, de ella suben unas volutas finas de humo que se retuercen y se disipan, y la llama de la barra expulsa
  a «Mundos», se apaga a latidos y echa tres bocanadas. Nada de manchas de humo por toda la página: «muy cutre».
  **En secuencia, sin verse las dos vistas a la vez**: lo de antes se va deprisa, la tarjeta que crece hace de puente
  y lo nuevo llega cuando ya no está.
- **Entrar en una plantilla desde su tarjeta también es entrar**, sin fuego: su icono y su nombre viajan al título de
  la plantilla abierta mientras lo demás se funde (Enrique, 2026-11-08: «falta transición al entrar en una
  plantilla»). De una plantilla a otra, rápido, como entre pestañas.
- **Las pestañas de la barra (dentro de una vista) también tienen transición, pero rápida y sin fuego**: lo que había
  se funde en un instante y lo nuevo sube un poco al llegar; se usan a menudo y no deben frenar. **Ninguna transición
  bloquea** (Enrique, 2026-11-13: «al cambiar entre vistas no se puede hacer rápido»): un clic mientras dura la acaba al
  momento y llega a lo de debajo.
- **Transiciones: el estándar** (Enrique, 2026-11-19: «haz un estándar: transiciones para cambio de páginas dentro de
  una misma vista, cambios de vista, etc.»). Tres tipos y nada más; sus duraciones y curvas son tokens (`tokens.css`,
  `--motion-*` y `--ease-*`), y el tipo lo pone `components/world-transition.ts`:

  | Qué | Cómo | Duración |
  |---|---|---|
  | Dentro de una vista (pestañas de la barra, de un libro, de una plantilla a otra; una página nueva de la wiki entra con su fundido) | Lo de antes se funde y lo nuevo sube un poco; sin fuego | 140 ms + 260 ms |
  | Entrar y salir de un espacio (un mundo, una campaña) | En espejo: la imagen de la tarjeta viaja a la portada y vuelve; lo de antes se va (al entrar se acerca, al salir se aleja) y lo nuevo llega detrás. Al entrar, al rojo y brasas; al salir, se enfría y humo. Sin imagen, nada viaja: solo el fundido | 720 ms |
  | Entrar en un elemento (una plantilla, un sistema) | Como el anterior, pero viajan su icono y su nombre al título; sin fuego (el humo, al salir de un sistema) | 460 ms |
  | Abrir y cerrar cuadros, ventanas y hojas | Al abrir suben y crecen frenando; al cerrar bajan y encogen, más deprisa | 360 ms / 260 ms |

  Lo que llega frena, lo que se va acelera y lo que viaja se posa. Lo propio de crear y borrar (la forja y la ceniza)
  y el menú de la cuenta llevan los suyos. Con «menos movimiento» en el sistema, igual (las animaciones, para todos).
- **El menú de la cuenta sale del avatar** creciendo, con un pequeño rebote, y al cerrarse vuelve a él encogiendo.
- **Las listas, en el orden en que se crearon**: lo nuevo, al final.

- **La colocación de Ajustes es la referencia**: una columna en el centro, con el título y el contenido alineados.
  Nada suelto «en medio sin sentido». **El título no se mueve de una vista a otra**; si hace falta más sitio, se usan
  los lados con **paneles fuera de la columna** («a cada lado puede haber como pestañas extras»): en Archivos y en
  Etiquetas, a la izquierda, el archivo, la carpeta o la etiqueta **sobre la que está el ratón** (solo mientras lo
  está; Enrique, 2026-11-11, antes a la derecha); en Mis mundos, a la izquierda, el mundo sobre el que está el ratón (portada, descripción,
  campañas y archivos). Archivos de un mundo es la misma pantalla que la de los comunes, con «Comunes» como una carpeta
  más. Con menos sitio (o con zoom) la columna del centro se estrecha; sin sitio, el panel se quita.
- **Crear algo se hace con un botón que abre un cuadro**, no con un formulario suelto en la pantalla. **El de crear es
  prácticamente el de sus ajustes** (para un mundo: portada, nombre, descripción y color), para dejarlo bien hecho
  sin tener que entrar después en ajustes.
- **«Nuevo …» va como un recuadro más de la lista**, con la misma forma (esquinas redondeadas), vacío y con el borde de
  **línea continua** (Enrique, 2026-11-11; antes, discontinuo), **la misma que la de las tarjetas** (2026-11-12: el
  recuadro vacío no debe pesar más que lo que hay), que se aviva al pasar el ratón; tras el último (no un botón
  arriba). El mismo recuadro en todas las listas: mundos, campañas, plantillas, etiquetas, sistemas y libros. Sin ninguno, la pantalla vacía con
  su botón grande.
- **Las pantallas de cuenta (entrar, crear la cuenta)** van centradas y con aspecto profesional. **De fondo, imágenes de fantasía que van pasando, como en LegendKeeper**
  (Enrique, 2026-11-08): a toda la pantalla, cada una unos 8 segundos acercándose despacio, con un fundido entre una y
  otra, un degradado teñido de su color y su autor abajo a la derecha (enlaza a su origen). En orden al azar en cada
  visita. Solo arte (nada de fotos reales): digital de fantasía de Pixabay y cuadros de dominio público, elegidos por
  Enrique; la lista en `apps/web/src/account/backdrops.ts` y su origen en `docs/terceros.md`. **Se cambiarán por
  imágenes propias** en el estilo que elija Enrique (2026-11-11, `docs/imagenes.md`), con el centro tranquilo para el
  recuadro.
- **Los Archivos de fuera se llaman «Archivos»** (no «comunes»: llevan dentro las carpetas de los mundos).
- **Cada mundo, una carpeta en los Archivos de fuera** (Enrique, 2026-11-13: «al crear un mundo se crea su carpeta en
  archivos y esta no se puede borrar; se borra sola al eliminar el mundo»): como «Comunes» dentro de un mundo, pero al
  revés; con el color del mundo, sin engranaje ni casilla, y lo que se sube o se crea en ella es del mundo.
- **Archivos, sin árbol a la izquierda: la lista del centro es el árbol** (Enrique, 2026-11-11: «el árbol de la
  izquierda no tiene sentido, ya tenemos la visión del árbol en el centro»): pulsar una carpeta la despliega ahí mismo,
  con lo de dentro sangrado (no se entra en ella), y al arrastrar un archivo y mantenerlo sobre una carpeta cerrada, se
  despliega sola. La vista previa, a la izquierda. **Solo en lista** (Enrique, 2026-11-12: fuera las tarjetas). **«Subir
  archivos» y «Nueva carpeta» no cambian de nombre** (un nombre de carpeta largo los rompería) y suben y crean en lo
  más alto; **cada carpeta, al pasar el ratón, lleva sus botones «Subir aquí» y «Carpeta dentro»** en el sitio de lo
  que tiene (Enrique, 2026-11-12: «al subir un archivo también debe permitir dónde se sube»). **Al buscar, por nombre o #etiqueta** (como en las páginas; sin
  filtro aparte), lo encontrado sale dentro de sus carpetas, desplegadas: el árbol hasta él. Se construye en la tanda 2 de la
  revisión (lienzo «Archivos sin árbol», aprobado); sustituye a lo del árbol y de las tarjetas de la norma de abajo.
- **Archivos, como un explorador**: carpetas unas dentro de otras, en la lista (ver la norma de arriba, «sin árbol a la
  izquierda»). Se arrastran archivos y carpetas como las páginas del mundo: raya encima o debajo de una fila (a qué
  nivel va) o la carpeta resaltada si va dentro; lo movido se ilumina; un común no va a una carpeta del mundo ni al
  revés (mientras se arrastra, sale apagado). Carpetas primero y luego archivos, **en el orden que se quiera** (se
  recolocan arrastrando); sin ordenar, por nombre. **Sin ruta encima de la lista** («Todos › Carpeta»): la lista ya dice dónde está cada cosa.
  **Toda la fila abre lo suyo**, no solo el nombre. **La miniatura de una imagen, entera, centrada y sin fondo** (Enrique,
  2026-11-19); el fondo, solo en el icono de lo que no es imagen. **Igual la de una plantilla con portada** (Enrique,
  2026-11-19: «si una plantilla tiene imagen sale como antes en Archivos, como con un fondo, no debería»), en la lista
  de Plantillas, su vista previa y «Desde plantilla» (la imagen sola, sin su icono encima), y en el selector de
  archivos. Mover es arrastrar o, desde su ventana, **«Carpeta»** (Enrique,
  2026-11-12: como «Dentro de» en las etiquetas; «Ninguna», lo más alto); cambiar un archivo es subir otro y borrar el
  viejo: sin «Reemplazar». **Las carpetas llevan color e icono** (Enrique, 2026-11-12), desde su ventana: el color,
  como el de un mundo o una etiqueta; el icono, uno de los nuestros, con el mismo selector que el de una página. El color tiñe el dibujo de la carpeta o,
  con icono, su fondo; se ve en la lista, en la vista previa y en el selector de archivos. **Se eligen varios** con su casilla (al pasar el ratón; en su columna, a la izquierda de las filas y sin tapar la miniatura; con Mayúsculas, el tramo), y lo elegido se lleva a una carpeta («Mover a…»), se etiqueta («Etiquetar») o se borra de una vez (Enrique, 2026-11-12); mientras se elige, su barra ocupa el sitio de la de herramientas y la lista no se mueve. **Con el teclado, como Etiquetas**: una parada del tabulador, flechas para recorrer, abrir y cerrar, Intro abre, Espacio elige y Alt + flechas recolocan; con el foco en una fila sale su vista previa y se
  borran de una vez, con aviso. **Borrar una carpeta se lleva lo que tiene dentro** (sus archivos, a la papelera),
  avisando. **Buscador (por nombre o #etiqueta) y filtro por tipo** siempre a la vista. Se suben varios a la vez (no carpetas enteras), a la carpeta elegida; cada subida sale
  con su progreso y una X para cancelarla, y al acabar ya es su archivo (sin lista de «Subidas»). **Solo imágenes,
  PDF, audio, vídeo y texto**: nada que se ejecute.
- **Los archivos comunes de la cuenta** (ADR-0005): fuera de los mundos, «Archivos» en la barra; dentro de cada
  mundo, la carpeta «Comunes» en sus archivos, la misma en todos.
- **Donde se elige un archivo, el selector de archivos**: la lista de Archivos en una ventana (las carpetas se despliegan
  al pulsarlas), solo con el tipo que se pide y con su buscador por nombre o #etiqueta; en un mundo, los comunes dentro
  de «Comunes». **La portada** (de un mundo, una campaña o una página, el mismo cuadro) se pone con dos botones con su
  texto debajo: «Subir imagen» y «Elegir de tus archivos»; sin miniaturas sueltas. Sin imagen, el hueco de la vista
  previa sube una al pulsarlo y admite soltar una del escritorio (Enrique, 2026-11-12).
- **Las ventanas de ajustes, compactas** (Enrique, 2026-11-12: «son tan grandes… que no cabe y hay que hacer
  scroll»): letra algo menor que la de la página, campos de una línea más bajos, poco aire entre ellos y casillas de
  color e icono pequeñas; han de caber enteras en la pantalla de un portátil siempre que se pueda.
- **Todo cuadro o ventana encima lleva la X arriba a la derecha y se cierra al pulsar fuera** (y con Escape). **Las X
  de cerrar, al pasar el ratón, un círculo suave alrededor del icono** (Enrique, 2026-11-11: «la x se ve mal al pasar
  el ratón por encima»; antes, un cuadrado que tapaba la esquina), en todas.
- **Todos los cuadros con la misma cabecera y los mismos botones** (Enrique, 2026-11-08: «la x se ve por encima, el
  titulo muy pegado»): el título rojo con su raya, con aire arriba (haya portada o no) y a la altura de la X, que nunca
  queda encima de la raya ni del título. La acción principal (Crear, Guardar, Borrar) a la izquierda y la primera,
  de su tamaño (no a todo lo ancho); «Cancelar», a su lado. Los campos que no son de una cuenta (el nombre de un mundo,
  de una plantilla) no sacan el icono de los gestores de contraseñas.
- **Las acciones de un elemento van en su engranaje**, abajo a la derecha de su tarjeta, siempre a la vista: abre su
  ventana, donde se cambia todo (nombre incluido) y donde irá lo que se añada. Nada de «Renombrar» y «Borrar» sueltos.
  **Dentro de un mundo, su engranaje va a la derecha de su nombre**, en la cabecera de la ficha del árbol (Enrique,
  2026-11-19), no encima de su portada.
- **Los mundos no llevan icono**: «no aportan nada».
- **Una campaña nueva no sabe nada** (Enrique, 2026-11-13: «no se conoce nada y ya está, el máster es el que va
  revelando todo»): sin «Al empezar, los jugadores conocen…» al crearla ni «Parte de lo que sabe el mundo» en sus
  ajustes. Al elegir su sistema, **solo los sistemas**, sin «Tuyos» ni «De serie».
- **Las campañas se ven y se crean como los mundos**: tarjeta con portada, descripción y color, engranaje con su
  ventana y zona de peligro, «Nueva campaña» al final, y se forjan y arden igual. Su portada, una imagen
  de su mundo o común. **Viven en Mis mundos**, bajo los mundos, cada una con su mundo debajo del nombre; «Nueva
  campaña» pide el mundo. No están en la barra.
- **La barra de la izquierda, estrecha y de iconos** (Enrique prefirió esta a una ancha al estilo Everlore). Dentro de
  un mundo: el mundo (abre y cierra la ficha del árbol) y Archivos. El árbol, como el de las carpetas de Archivos.
- **No se dice «wiki» en la interfaz**: quien solo hace worldbuilding no piensa en una wiki. Se habla del mundo y de sus
  páginas («Páginas de Eana», «Buscar en las páginas»). «Compendio» se guarda para las reglas.
- **Con una ventana abierta encima (los ajustes de un mundo), la vista previa de al lado se quita**, y no vuelve hasta
  que el ratón entra otra vez en la tarjeta.
- **El color de un mundo**: sin color, uno de los fijos o uno propio con el selector de color; los propios se
  recuerdan para usarlos otra vez. **Solo tiñe, sutil, el contorno de su tarjeta** (y el de su ventana); la portada no
  se colorea. **Al pasar el ratón, su nombre se resalta con ese color** (Enrique, 2026-11-11: «si selecciono color
  verde, debe resaltarse el color, no de rojo siempre»), aclarado para que se lea; sin color, en blanco, nunca en rojo (Enrique, 2026-11-13). **El contorno sale siempre**, entero, también alrededor de la portada. Sin imagen, el hueco de la portada lleva un tinte muy oscuro de ese color.
- **La tarjeta de un mundo o una campaña no cambia de alto con la descripción** (Enrique, 2026-11-13: «cortamos la
  descripción y listo, ya la mostramos en el popup»): una línea, cortada con «…»; entera, en la vista previa.
- **La vista previa de la izquierda, también de las campañas** (Enrique, 2026-11-13), como la de los mundos: su
  portada, su mundo, su descripción, su sistema, sus jugadores y tu papel. **Solo mientras el ratón está en la
  tarjeta**: al ver su portada (o abrir sus ajustes) se quita, y el fondo con ella, hasta que el ratón vuelve.
- **Toda la tarjeta es clicable** y lleva al elemento, no solo su nombre (salvo sus botones).
- **«Guardar» y «Cancelar» solo salen si hay cambios**, a la izquierda (Guardar primero), y se abren y se cierran
  suavemente al aparecer y al irse, sin saltos (`components/changes.tsx`); «Cancelar» los deshace.
- **Un cuadro dentro de otro** (ver la portada desde la ventana del mundo): al cerrarlo se vuelve al de fuera, no a la
  pantalla.
- **Borrar algo importante va en una zona de peligro** rojiza, al final de su ventana, y se confirma en otro cuadro
  escribiendo su nombre, que sale en el mensaje para poder copiarlo.
- **Las portadas, al pasar el ratón, se acercan un poco y dejan verlas**, como las de las hojas del Crisol antiguo.
  **Cambiarlas, solo en la ventana del elemento**, que la enseña arriba con lo que se va eligiendo (icono, color) antes
  de guardar. Cambiarla: las imágenes del mundo en miniatura, subir otra, quitarla, encuadrarla arrastrando y
  acercarla o alejarla (deslizador, rueda del ratón o + y -).

## Cuentas

- **Nombre de usuario**: es el apodo con el que se te ve en la app, y es único (sin distinguir mayúsculas). Nombre y
  apellido(s) van aparte, en dos recuadros: «Nombre por un lado y Apellido(s) en otro recuadro, así es más facil».
- **La contraseña**: con su medidor de seguridad y repetida. No se admite una fácil de adivinar.
- **Sin organización visible** al registrarse: cada cuenta tiene su espacio (ADR-0004).

## Formularios

- **Los errores, con mensajes propios** bajo cada campo, nunca con el globo del navegador («ese popup tan cutre»). El
  foco va al primer campo que falla.
- **Un texto con límite dice cuánto se lleva** («123 / 280», abajo a la derecha) mientras se escribe en él (Enrique,
  2026-11-11, la descripción de mundos y campañas); el de varias líneas crece con lo escrito.

## Textos

- **Cortos y sin sobreexplicar**: «No hay que sobreexplicar las cosas».
- **Las explicaciones, genéricas**: para qué sirve cada zona a grandes rasgos, sin enumerar lo que hay dentro, que
  cambiará. Por ejemplo, «Desde aquí podrás administrar la aplicación».
- **Nada de mensajes aclarativos** tras una acción («Volverán a salir»). Mejor una opción que se marca y se ve marcada.

- **Sin género en lo que se escribe sobre nombres que pone el máster** (2026-11-03, con las plantillas): «Página nueva ·
  Frente», nunca «Nuevo Frente»; y las opciones de serie, neutras («Vive», «Ha muerto», «En paradero desconocido»).

- **Las medidas, en las de D&D, también en español** (2026-11-06: «lo quiero todo en el sistema de dnd, no hace falta
  pasarlo»): pies, millas, libras, pulgadas y galones, nunca metros ni kilos. El SRD en español viene en métrico: al
  sacarlo se devuelve a las de D&D (`scripts/srd/unidades.ts`).

## Tutorial guiado de cada vista

- **Se llama «tutorial guiado de la vista»**, no «recorrido».
- **El globo nunca queda debajo de la barra de la izquierda ni encima de ella** (Enrique, 2026-11-13, en los libros):
  se pinta por encima de todo y, si apunta a algo de la página, se aparta de la barra.
- **El globo nunca se corta ni tapa lo que señala** (2026-11-19, repaso de todos los tutoriales): junto a algo alto
  (una ficha a un lado), si no cabe ni encima ni debajo, va al lado; un paso cuyo elemento no se ve o no mide nada (una
  lista vacía) se salta. Es de cristal, como lo que flota, y su «Siguiente», el botón rojo de cristal de la app.
- **Cada vista tiene el suyo**: un globo por zona, con «1 de 3», Atrás (desde el segundo) y Siguiente. Ni Saltar ni
  «Lo tengo claro»: «los jugadores tendrán que hacer la guía de todas las vistas la primera vez que entren».
- **Sale solo la primera vez**, hasta acabarlo. Con Escape se cierra sin acabar y vuelve a salir la próxima vez.
- **Lo que se añada a la barra lateral entra en el tutorial de la vista donde sale** (un paso por cada botón de la
  barra, como en Mis mundos y dentro de un mundo), **y además tiene el suyo propio en su vista** (Archivos, por
  ejemplo).
- **Un «?» abajo a la derecha lo vuelve a sacar** (en el móvil, arriba a la derecha): casi transparente, pero que se
  vea, y con su color al pasar el ratón. No hay casilla en Ajustes. **Un solo tutorial a la vez y un solo «?»**: con
  varios en pantalla (el del mundo y el de un mapa, el de la campaña y el de los dados), salen uno tras otro y el «?» es
  el del más concreto. El del mundo sale en cualquiera de sus páginas, no solo en la portada.
- **Lo relacionado se resalta en el mismo paso**, sin un paso propio: «Mundo en la barra lateral se tiene que resaltar
  en el paso 1, no debe tener un paso propio porque es redundante». Si hace falta, lleva su propia nota corta junto a
  su recuadro (la de «Mundos»: «Dentro de un mundo, esta barra cambiará y mostrará su contenido»).

## IA

- **Las peticiones que esperan aprobación salen como tarjetas flotantes**, estés donde estés, como en el Crisol
  antiguo. Ni en Ajustes ni encima de la página: «ahi en ajustes no aporta nada si tengo que entrar cada vez que
  quiera verlo». Abajo a la derecha, encima del d20; **con la ficha de dados abierta, a su izquierda** (no
  tapan la tirada), y en la Mesa, a la izquierda de su panel (2026-11-08).
- **Los ajustes de la IA**: la dirección de Mundos (quien crea mundos), el modo (quien dirige algo) y **tus conexiones**
  (Enrique, 2026-11-19, ADR-0030): a qué conector, qué app y cuándo se usó, con «Quitar». Nada más.
- **Dos tipos de conector** (Enrique, 2026-11-19, ADR-0030): «Crisol · Mundos» para crear mundos y uno por campaña,
  donde la IA solo ve esa campaña con lo que puede hacer en ella quien la conecta. **El de cada campaña, en su Inicio**
  («Conecta tu IA a esta campaña», con su dirección), para el máster y para quien juega; la pantalla de permiso dice a
  qué campaña se conecta.
