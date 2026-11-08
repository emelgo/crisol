# Normas de diseño de Crisol

Lo que Enrique ha ido decidiendo sobre la interfaz. Vale para toda la app y para las pantallas que vengan. Cada norma
lleva, cuando la hay, su frase. Se añade aquí lo nuevo; no en otros documentos.

## Identidad

- **Mezcla del Crisol antiguo y del nuevo** (2026-10-30). Del antiguo:
  - grises neutros, con el oscuro por defecto;
  - cada nivel de título con su color;
  - enlaces en azul;
  - el rojo solo en lo importante.

  Del nuevo:
  - Barlow para el texto;
  - Barlow Condensed en mayúsculas para los títulos;
  - las esquinas cortadas de los recuadros.
- **La marca es la llama** del Crisol antiguo, de rojo abajo a naranja arriba (`components/brand.tsx`): en la barra,
  en la cabecera, en la pestaña del navegador y **mientras algo carga** (latiendo en el centro). «El icono actual no
  trasmite nada».
- **Las barras de desplazamiento, finas y del color de los bordes**, sin flechas; en una ventana solo se desplaza el
  contenido: «la barra lateral de los popup desentona bastante».
- **Nada de aspecto «de IA»**:
  - ni todo en mayúsculas condensadas;
  - ni filas de botones con borde, todos con el mismo peso;
  - ni textos de ayuda fijos en pantalla.
- **Se dice «IA», no «Claude»**: Crisol se conecta a cualquier IA. El nombre de la app conectada sale solo donde se ve
  qué está conectado.

## Armazón y navegación

- **Con sesión no hay barra arriba**. A la izquierda, una barra con iconos y su nombre debajo. Dentro de un mundo
  cambia y enseña su contenido. **Sin barra de estado abajo**: «la barra que hay abajo sirve de algo? sino quitala».
- **Con sesión, la portada y Entrar llevan directos a Mis mundos**. Una portada que solo enlaza a Mis mundos es redundante.
- **Lo de la barra lateral se abre encima**, como una ventana, sin quitar lo que se está viendo: Historial, Papelera,
  Ajustes, Perfil. «Ajustes y todo lo de la barra lateral debe ser como un popup, para no quitar la vista que se
  tiene en el momento». Se cierra con la X, con Escape o pulsando fuera, y se vuelve a donde se estaba; un enlace
  de dentro la cierra y lleva a su sitio. **Sin enlace de vuelta** arriba («Mis mundos»): en una ventana no tiene
  sentido.
- **Dentro de un mundo, la barra lleva el mundo (su nombre) y Archivos**; nada más (ni Plantillas, ni Campañas, ni
  «Inicio»: el mundo se abre en su portada). Historial y Papelera enseñan los de ese mundo. **Los dados no van en la barra**
  (Enrique, 2026-11-08: «los dados deben estar en un icono con forma de d20 como en dndbeyond que al pulsarlo se abre
  en una esquina, pero no una pagina propia»): un botón flotante con forma de d20, siempre en la misma esquina, que
  abre la ficha de dados junto a él (y la cierra); no es una pantalla ni una sección de la barra. Sustituye a la ficha
  de dados en el sitio del panel de la página (2026-11-04).
- **La campaña se abre en su propia vista, como un mundo** (Enrique, 2026-11-05): al entrar, la barra cambia y enseña
  lo de la campaña (sus personajes, su compendio, los dados…), con la transición de entrar. **El compendio** (el
  contenido del sistema que usa la campaña: clases, conjuros, criaturas, reglas…, con sus ediciones) **se ve ahí**.
- **El mundo se abre en su portada**, como la Home de LegendKeeper: una página más, que se crea sola con un texto de
  bienvenida, va la primera del árbol con su casa, no se borra ni se mete en otra, y lleva «Inicio» junto al título.
  Por detrás, la portada del mundo (su tarjeta al entrar: **esa transición no se toca**).
- **El menú de la cuenta** (la inicial, abajo en la barra): quién eres, Perfil, Ajustes y Cerrar sesión. El tema va en
  Ajustes, no en el menú. Se abre al lado del botón y nunca se corta.
- **Las etiquetas son de toda la cuenta** (ADR-0006): «Etiquetas» va en la barra de Mis mundos, no en la de un mundo;
  dentro, son filtros (al buscar en la wiki, en Archivos). Llevan un color opcional y se ven como un punto de color con
  su nombre. Se eligen o se escriben: una nueva entra sola.
- **El móvil, solo para la jugadora** (Enrique, 2026-11-08: «la vista movil la vamos a descartar por completo excepto
  para la vista del jugador, el master siempre deberá trabajar desde PC»). Lo del máster (el mundo, sus páginas,
  Archivos, Plantillas, Sistemas, la Mesa…) se diseña y se revisa solo en el escritorio; lo de la jugadora (su campaña,
  lo que sabe, su ficha, el compendio, el grupo) sí tiene que ir bien en el móvil. Las normas de móvil de abajo valen
  para lo que ve la jugadora.
- **En el móvil no hay barra: solo la llama, abajo en el centro**, en un círculo. Al tocarla sube el menú con todas
  las secciones de donde se está, en mosaico (fuera de los mundos: Mundos, Archivos, Etiquetas, Historial y Papelera;
  dentro: Mundos para salir, Inicio, Campañas, Wiki, Archivos, Historial y Papelera), la actual marcada, y debajo la
  cuenta. «Me gusta crisol en el centro», pero no la barra con «Más». La guía se salta lo que no se ve y señala la
  llama.
- **En el móvil, las ventanas son hojas que suben desde abajo**, con su asa arriba y la página oscurecida detrás: «los
  popup no parecen popups». Al cerrarse bajan enteras, sin cambiar de forma. Una imagen en grande sigue en el centro.
- **Archivos en el móvil**: en vez del árbol, un selector de carpeta; tocar un archivo o una carpeta sube su hoja
  (vista previa o lo que tiene, «Abrir» y «Ajustes»), que hace de la vista previa al pasar el ratón; lo mismo una
  etiqueta. Para borrar varios, «Elegir» saca las casillas y tocar una fila la elige. En lo táctil nada depende del
  «hover» (un toque lo deja puesto).
- **Cada pantalla tiene su guía, aunque sea básica**: «debemos mantener el patrón siempre».

## Pantallas
- **Los sistemas se hacen con la IA** (Enrique, 2026-11-04: crearlos con el editor «es poco intuitivo»). En «Sistemas»
  no hay editor ni «Probar»: se ven los que hay (de serie y de la cuenta), se suben de un archivo y se bajan, cada uno
  con su contenido, y también un sistema vacío para empezar. La pantalla dice que los nuevos se hacen con la IA; la IA
  los prueba con `probar_formula` y `probar_tirada`. Se hace al acabar `srd-5e`.
- **La wiki se edita en el sitio, como en el Crisol antiguo** (`docs/specs/wiki-edicion.md`): «no me gusta que todo sea
  como con botones, debe ser más ágil, poder cambiar todo en edición, incluso el título». Se abre la página y se
  escribe: el título es el propio encabezado (Intro guarda, Escape deshace) y todo se guarda solo («Guardando…»,
  «Guardado», abajo a la derecha). Sin «Editar», «Guardar», «Cancelar» ni «Renombrar», y sin barra de botones encima
  del texto: los bloques con «/», los enlaces con «@» o «[[», buscar con Ctrl+Alt+F y el menú del bloque con
  Ctrl+Alt+B. La cabecera, en iconos (Marcar, Bloquear, Hoja, «⋯»).
- **El icono va en el propio título**, si se quiere: no hay botón para ponerlo. **La portada**, como en el Crisol antiguo
  y en los mundos: se pone desde «⋯»; puesta, al pasar por encima salen «Ver» y «Cambiar», y se arrastra para
  encuadrarla.
- **Las propiedades, en una ficha a un lado** (a la derecha, con el texto alrededor, como en el Crisol antiguo); en la
  hoja, arriba a todo lo ancho. Solo «+ Propiedad» y «Etiquetas» a mano: «Alias» y «Resumen» sobran. El tipo de una
  propiedad sale junto a su × mientras se edita.
- **Sin sección de subpáginas ni «Anterior / Siguiente»**: se navega desde el árbol; «Nueva subpágina», en «⋯».
- **«Página nueva» (y «Nueva subpágina») abre un cuadro** como el de «Pestaña nueva»: el tipo (texto o mapa; pizarra,
  línea temporal y árbol familiar, «Pronto») y el título; Intro la crea. Sin título, se abre para ponérselo.
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
- **Botón derecho en el árbol**, como en Everlore: crear subpágina, renombrar, duplicar, exportar, mover y ordenar
  (desplegables que se abren al pasar el ratón) y borrar. «⋯» de la página, solo exportar.
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
  página**, como en Archivos bajo el título. La columna no cambia al esconder el panel.
- **Del estilo de Everlore, la forma** (esquinas redondeadas, cabecera pegajosa compacta al bajar) con nuestros
  colores y letras. Sin el mundo en pequeño sobre el título (estaba repetido) y sin migas de pan. La portada de la
  página va por detrás, solo en la columna del centro, fundida con el fondo, con el título encima de su parte de
  abajo. **Una página sin portada se ve como una con portada, pero sin ella**: su hueco se queda, con una textura
  suave (grano, un tejido tenue y dos manchas de color, fundidos con el fondo) para que no se vea plano (el título y
  las fichas, en el mismo sitio en todas) y «Añadir portada» sale arriba a la derecha al pasar por él.
- **Las pestañas de una página** (ADR-0007): siempre bajo el título, «Texto» y las que se añaden, en texto plano con la
  elegida subrayada; «+» al final abre un cuadro con un recuadro por tipo (mapa; pizarra, línea temporal y árbol
  familiar, «Pronto») y el nombre. La elegida lleva su menú (▾): nombre, mover y quitar. El texto y el mapa, en la
  columna del centro.
- **El panel de la derecha se escribe** (ADR-0008, como el de LegendKeeper y el de Everlore): arriba las
  propiedades; después sus bloques, que se añaden con «Añadir bloque» (texto, imagen, barra, círculo, estrellas,
  fichas, subpáginas, páginas con una etiqueta), se titulan encima, se tocan en el sitio (+ y −, pulsar la barra, las
  estrellas o las fichas) y se recolocan arrastrando su asa o desde sus opciones; vacío, dice «Panel vacío» y para qué
  sirve. Arriba del todo, «Mencionado en» (como en Everlore: una lista corta de páginas; las que la nombran sin enlazar, debajo, con «Enlazar» al pasar). Sin índice (está el árbol); las versiones, en «⋯». No se esconde (no hay botón para eso); sin sitio,
  va debajo de la página.
- **Dentro de un mundo, la forma de Everlore (esquinas redondeadas, sin cortes) con nuestros colores y nuestras
  letras.** Las propiedades de una página van en el panel de la derecha, con su título pequeño como lo demás.
- **Los mundos no tienen papel** (máster o jugador): eso es de las campañas.
- **El mapa**: la imagen se arrastra y se acerca con la rueda hacia el cursor (y con dos dedos); las herramientas, una
  columna de iconos arriba a la izquierda; el botón derecho ofrece «Pin aquí» y «Pin con página nueva» (su nombre es
  el de la página, que nace como subpágina). Pulsar un pin abre su panel a la derecha (abajo en el móvil), donde todo
  se guarda al momento; arrastrarlo lo mueve y el doble clic abre su página. Los pines, las ocho formas de Everlore.
- **La hoja es lo que hace única la wiki**, y se escribe ya maquetada (Enrique, 2026-11-03: «verlo directamente como
  se ve en la hoja pero sin las texturas»): con la hoja puesta, el texto cae en sus páginas y sus dos columnas como al
  imprimir (el mismo paginador y la misma letra y tamaño), con su número y su pie, pero con los colores de la app; el
  papel y las texturas del tema, solo al imprimir y en el PDF. En el móvil, una columna seguida. Los bloques de hoja
  (saltos, statblock, nota lateral, a lo ancho, índice) solo salen en «/» en las páginas con hoja.

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
- **Entrar en un mundo es entrar**: la tarjeta pulsada se convierte en la cabecera del mundo mientras Mis mundos se
  acerca y se desvanece, como si se pasara a través; al volver, al revés (transiciones de vista del navegador). Al
  entrar, con un fuego sutil: la tarjeta se pone al rojo mientras crece y sube algo de calor con unas brasas; la
  llama de la barra se aviva y suelta chispas durante unos segundos. Al salir, la cabecera se enfría mientras vuelve
  a ser tarjeta, de ella suben unas volutas finas de humo que se retuercen y se disipan, y la llama de la barra expulsa
  a «Mundos», se apaga a latidos y echa tres bocanadas. Nada de manchas de humo por toda la página: «muy cutre».
  **En secuencia, sin verse las dos vistas a la vez**: lo de antes se va deprisa, la tarjeta que crece hace de puente
  y lo nuevo llega cuando ya no está.
- **Las pestañas de la barra (dentro de una vista) también tienen transición, pero rápida y sin fuego**: lo que había
  se funde en un instante y lo nuevo sube un poco al llegar; se usan a menudo y no deben frenar.
- **El menú de la cuenta sale del avatar** creciendo, con un pequeño rebote, y al cerrarse vuelve a él encogiendo.
- **Las listas, en el orden en que se crearon**: lo nuevo, al final.

- **La colocación de Ajustes es la referencia**: una columna en el centro, con el título y el contenido alineados.
  Nada suelto «en medio sin sentido». **El título no se mueve de una vista a otra**; si hace falta más sitio, se usan
  los lados con **paneles fuera de la columna** («a cada lado puede haber como pestañas extras»): en Archivos, el
  árbol de carpetas a la izquierda y, a la derecha, el archivo o la carpeta **sobre la que está el ratón** (solo
  mientras lo está); en Mis mundos, a la izquierda, el mundo sobre el que está el ratón (portada, descripción,
  campañas y archivos). Archivos de un mundo es la misma pantalla que la de los comunes, con «Comunes» como una carpeta
  más. Con menos sitio (o con zoom) la columna del centro se estrecha; sin sitio, el panel se quita.
- **Crear algo se hace con un botón que abre un cuadro**, no con un formulario suelto en la pantalla. **El de crear es
  prácticamente el de sus ajustes** (para un mundo: portada, nombre, descripción y color), para dejarlo bien hecho
  sin tener que entrar después en ajustes.
- **«Nuevo …» va como un recuadro más de la lista**, con la misma forma (esquinas cortadas), vacío y con el borde
  discontinuo, tras el último (no un botón arriba). Sin ninguno, la pantalla vacía con su botón grande.
- **Las pantallas de cuenta (entrar, crear la cuenta)** van centradas y con aspecto profesional.
- **Archivos, como un explorador**: árbol de carpetas (unas dentro de otras; se les arrastran archivos, y mientras se
  arrastra se marcan las carpetas donde se puede soltar, con «Mover aquí»; la que lo recibe se ilumina; soltado en la
  caja del árbol, fuera de una carpeta, va a lo más alto; un común no va a una carpeta del mundo ni al revés). **Sin
  ruta encima de la lista** («Todos › Carpeta»): el árbol ya dice dónde se está. **Toda la fila o tarjeta abre lo
  suyo**, no solo el nombre. Mover es arrastrar y cambiar un archivo es subir otro y borrar el viejo: su ventana no
  tiene «Carpeta» ni «Reemplazar». **Se eligen varios** con su casilla (al pasar el ratón) y se borran de una vez,
  con aviso. **Borrar una carpeta se lleva lo que tiene dentro** (sus archivos, a la papelera), avisando. Lista
  compacta o tarjetas, **buscador por nombre y filtro por tipo** siempre a la vista. Se suben varios a la vez (no
  carpetas enteras), a la carpeta elegida; cada subida sale con su progreso y una X para cancelarla, y al acabar ya
  es su archivo (sin lista de «Subidas»). **Solo imágenes, PDF, audio, vídeo y texto**: nada que se ejecute.
- **Los archivos comunes de la cuenta** (ADR-0005): fuera de los mundos, «Archivos» en la barra; dentro de cada
  mundo, la carpeta «Comunes» en sus archivos, la misma en todos. Donde se elige un archivo (la portada), «Del mundo»
  y «Comunes» por separado.
- **Todo cuadro o ventana encima lleva la X arriba a la derecha y se cierra al pulsar fuera** (y con Escape).
- **Las acciones de un elemento van en su engranaje**, abajo a la derecha de su tarjeta, siempre a la vista: abre su
  ventana, donde se cambia todo (nombre incluido) y donde irá lo que se añada. Nada de «Renombrar» y «Borrar» sueltos.
- **Los mundos no llevan icono**: «no aportan nada».
- **Las campañas se ven y se crean como los mundos**: tarjeta con portada, descripción y color, engranaje con su
  ventana y zona de peligro, «Nueva campaña» discontinuo al final, y se forjan y arden igual. Su portada, una imagen
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
  se colorea. **El contorno sale siempre**, entero, también alrededor de la portada. Sin imagen, el hueco de la portada lleva un tinte muy oscuro de ese color.
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
- **Cada vista tiene el suyo**: un globo por zona, con «1 de 3», Atrás (desde el segundo) y Siguiente. Ni Saltar ni
  «Lo tengo claro»: «los jugadores tendrán que hacer la guía de todas las vistas la primera vez que entren».
- **Sale solo la primera vez**, hasta acabarlo. Con Escape se cierra sin acabar y vuelve a salir la próxima vez.
- **Lo que se añada a la barra lateral entra en el tutorial de la vista donde sale** (un paso por cada botón de la
  barra, como en Mis mundos y dentro de un mundo), **y además tiene el suyo propio en su vista** (Archivos, por
  ejemplo).
- **Un «?» abajo a la derecha lo vuelve a sacar**: casi transparente, pero que se vea, y con su color al pasar el
  ratón. No hay casilla en Ajustes.
- **Lo relacionado se resalta en el mismo paso**, sin un paso propio: «Mundo en la barra lateral se tiene que resaltar
  en el paso 1, no debe tener un paso propio porque es redundante». Si hace falta, lleva su propia nota corta junto a
  su recuadro (la de «Mundos»: «Dentro de un mundo, esta barra cambiará y mostrará su contenido»).

## IA

- **Las peticiones que esperan aprobación salen como tarjetas flotantes**, estés donde estés, como en el Crisol
  antiguo. Ni en Ajustes ni encima de la página: «ahi en ajustes no aporta nada si tengo que entrar cada vez que
  quiera verlo».
- **Los ajustes de la IA**, solo el conector y el modo.
