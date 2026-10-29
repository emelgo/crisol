# El diario (Journal) de Foundry VTT como wiki

Módulo de Crisol: 1. Wiki · Fecha: 2026-10-29 · Versión estudiada: 14.369 (con el sistema dnd5e 6.0.6)

## Pregunta

Cómo resuelve Foundry su wiki, para escribir la spec del módulo 1:

1. **Modelo**: entradas, páginas y sus tipos, carpetas y anidamiento (¿hay subpáginas?), orden, niveles e índice.
2. **Editor**: qué editor, qué formato guarda, qué bloques ofrece, y qué hay de nuevo en la edición simultánea y el
   autoguardado.
3. **Enlaces**: cómo se escriben y se resuelven, qué pasa al renombrar, mover o borrar, entrantes, incrustados, vista
   previa y anclas.
4. **Permisos** por entrada y por página, «limitado», «mostrar a los jugadores» y, sobre todo, **los secretos**: cómo
   se marcan y se revelan, y qué recibe el jugador.
5. **Búsqueda** en el directorio y dentro de una entrada.
6. **Presentación**: modos de la hoja, navegación y mostrar a los jugadores.
7. Qué nos llevamos y qué haremos distinto, frente al ADR-0003.

## Lo que hacen

Grado de certeza: **[código]** leído en el código instalado, **[observado]** comprobado contra la instancia de
estudio, **[inferido]** deducido sin comprobarlo. Las pruebas están al final de esta sección. Lo general de la red y
los permisos ya está en `sincronizacion-e-historial.md` y `usuarios-y-permisos.md`; aquí solo va lo propio del diario.

### 1. Modelo

| Pieza | Qué es | Detalles |
|---|---|---|
| Carpeta | Contenedor del directorio, una por tipo de documento | Nombre, color, descripción y orden alfabético o manual. Anida hasta **4 niveles**: el quinto lo rechaza el servidor [observado]. No guarda permisos (ver la nota de permisos) |
| Entrada | Documento principal del diario | Nombre, una carpeta, orden, permisos, sus páginas y sus categorías. **Una entrada no puede contener otra entrada** [código] |
| Página | Documento incrustado en la entrada | Nombre, tipo, orden, categoría, título (mostrarlo o no y un nivel), permisos propios y el contenido de su tipo [código] |
| Categoría | Grupo de páginas dentro de una entrada | Nombre y orden. Un solo nivel [código, observado] |

**Tipos de página** [código, observado en la lista de tipos registrados]:

- **Texto**: HTML (ver el apartado 2).
- **Imagen**: una ruta a un archivo y un pie.
- **PDF**: una ruta. Se ve con un visor integrado que no carga el archivo hasta que se pulsa un botón, y antes enseña
  su tamaño.
- **Vídeo**: una ruta o un enlace de YouTube, con controles, bucle, reproducción automática, volumen, segundo de
  inicio y tamaño.
- El sistema de juego y los módulos añaden tipos con sus propios datos. dnd5e trae clase, subclase, lista de
  conjuros, regla y lugar del mapa.

**¿Subpáginas? No.** La jerarquía es carpetas (hasta 4) → entrada → lista plana de páginas [código, observado]. Dos
cosas lo imitan, solo en el índice:

- El **nivel del título** de la página (1 a 3 en la interfaz; el modelo admite hasta 6) solo sangra la página en el
  índice. Una página de nivel 2 no tiene padre, y moverla no arrastra nada.
- Las **categorías** agrupan páginas bajo un rótulo.

**Orden**: un entero por contenedor, espaciado para poder insertar entre dos al arrastrar. Dentro de la entrada se
ordenan las categorías, luego las páginas de cada una, y al final las que no tienen categoría [código, observado].

**Índice de la entrada** [código, observado]:

- La barra lateral lista las páginas numeradas. Bajo cada página de texto salen sus encabezados, sacados en el
  cliente del HTML ya pintado.
- Solo entran dos niveles, contando desde el encabezado más alto de la página. Un encabezado puede marcarse para que
  no salga.
- Al máster le pone un icono con el permiso por defecto de cada página que no hereda.
- Dos rarezas: los encabezados de una página **incrustada** entran en el índice de la que la incrusta, y una
  categoría cuyas páginas no ve el jugador sale igual, vacía, con su nombre (vimos «Máster» en el índice de la
  jugadora).

### 2. Editor de texto

- **ProseMirror con un esquema propio pensado para conservar HTML** [código]. Además de los bloques de siempre trae:
  - nodos para muchas etiquetas de HTML: figuras, listas de definiciones, desplegables, audio, vídeo, marcos y
    secciones genéricas;
  - un mecanismo que guarda las clases, estilos y atributos que no entiende.

  Es más un editor visual de HTML que un editor de bloques: no hay ids de bloque.
- **Formato guardado: HTML**, en un campo de la página. Se elige por página cambiando su «hoja» [observado: tres hojas
  registradas para el texto]:
  - visual (ProseMirror), la de defecto;
  - Markdown, con un editor de código;
  - HTML en crudo, también con editor de código.

  Con Markdown se guarda la fuente y además el HTML: lo convierte el servidor y lo limpia (vimos que quita un
  `script`). Al pintar siempre se usa el HTML [observado]. Si se abre en Markdown una página escrita en HTML, el
  cliente convierte el HTML a Markdown, con pérdida [código]. El editor visual tiene además un botón para ver y tocar
  el HTML fuente.
- **Bloques**: hay barra de herramientas y no hay menú «/» [observado]:
  - un desplegable de formato con títulos del 1 al 6, párrafo, cita, bloque de código, **secreto**, las marcas en
    línea (negrita, cursiva, código, subrayado, tachado, superíndice, subíndice) y la alineación;
  - tablas: insertar, borrar, filas, columnas, unir y dividir celdas;
  - fuente y tamaño, color, listas con viñetas o números;
  - insertar regla, imagen y enlace;
  - limpiar formato, ver el HTML y guardar.

  El sistema puede añadir sus propias inserciones (dnd5e añade un grupo). Hay atajos al escribir, al estilo de
  Markdown: almohadillas para títulos, cita, listas, bloque de código, regla, raya y puntos suspensivos [código]. No
  hay casillas, callouts ni columnas. Los incrustados son texto dentro del editor y solo se ven al leer.
- **Leer y editar van en ventanas distintas**: la hoja de la entrada solo enseña. Cada página tiene un lápiz que abre
  su editor en otra ventana, con nombre, categoría, nivel, «mostrar título» y un botón de guardar [observado].
- **Edición simultánea**. Lo nuevo respecto a la nota de sincronización:
  - El modelo es el clásico de ProseMirror con autoridad central [código]:
    - el servidor guarda en memoria el documento de cada campo abierto;
    - cada cliente manda sus pasos con la versión de la que parte;
    - el servidor solo los acepta si esa versión es la última;
    - el que se queda atrás aplica lo ajeno y vuelve a mandar lo suyo.
  - Cada aviso de pasos nuevos reenvía **la ventana entera de pasos retenidos** (hasta 256) a todos los que editan: el
    segundo aviso de la prueba ya llevaba los dos pasos [observado]. Si un cliente se queda más de 256 pasos atrás, el
    servidor le manda resincronizar: el cliente copia su texto al portapapeles, avisa y se reabre [código].
  - **Presencia**: solo una lista de quién está editando, con una marca en la barra. No se ven los cursores ajenos
    [observado].
  - **Guardar** tiene tres vías:
    - autoguardado del servidor cada N segundos (ajuste del mundo, de 30 a 300; 60 por defecto), que escribe por
      fuera (el riesgo ya descrito);
    - el botón de guardar;
    - **cerrar el editor**, que manda el HTML entero como una edición normal de ese cliente. Esa vía sí pasa por los
      permisos y apunta al autor [observado: tras cerrar la jugadora, el último autor era ella].

    Cuando sale el último editor, el servidor tira la sesión sin guardar por su cuenta. Los pasos no se guardan en
    ningún sitio [código].
  - Si alguien está tocando el HTML fuente y llegan pasos ajenos, ese editor se bloquea con un aviso [código].

### 3. Enlaces

**Sintaxis, como idea**: una marca de texto plano dentro del HTML [código, observado]. Lleva:

- un prefijo que dice «enlace a documento»;
- el identificador completo: la entrada o, para una página, la entrada más la página;
- si se quiere, un ancla tras una almohadilla;
- si se quiere, una etiqueta propia.

Hay una forma relativa para las páginas hermanas [observado], que se resuelve desde la página que enlaza; parece
pensada para que el enlace siga valiendo en una copia de la entrada [inferido]. Formas antiguas, aún
admitidas, aceptan el tipo más el id **o el nombre**: esas se resuelven por nombre y se rompen al renombrar [código].
El enlace se crea arrastrando un documento o un encabezado del índice al editor; con el encabezado se añaden el ancla
y su texto como etiqueta [código].

**Resolución**: al pintar, en el cliente, buscando en la copia en memoria del mundo (que ya lo tiene todo). Las
referencias a compendios se piden antes por lotes. El servidor no sabe nada de los enlaces: no los guarda como
relación [código].

Qué pasa al tocar el destino [observado salvo donde se dice]:

| Acción sobre el destino | Qué pasa con el enlace |
|---|---|
| Renombrar | Sin etiqueta, enseña el nombre nuevo; con etiqueta, conserva la suya. El HTML guardado no cambia: sigue el id |
| Mover de carpeta | Sigue funcionando: la carpeta no forma parte del identificador |
| Mover una página a otra entrada | No existe mover: arrastrarla crea una copia en la otra entrada y deja la original. Los enlaces siguen a la original [código] |
| Borrar | Enlace roto: icono de enlace tachado y la etiqueta, o «desconocido» si no tenía. Nadie avisa al borrar ni lo limpia, y no hay papelera |
| Cambiar el texto de un encabezado | El ancla deja de existir. El enlace abre la página por arriba, sin avisar |

- **Entrantes**: no hay. Ni lista ni aviso al borrar [código].
- **Sugerencia de enlaces**: con un ajuste del mundo (activo por defecto), al seleccionar texto en el editor sale un
  globo con los documentos cuyo nombre coincide, para convertirlo en enlace. Usa un índice de nombres por palabras y
  solo ofrece lo que el usuario ve como observador. Es lo más parecido a las menciones sin enlazar, pero bajo demanda
  [código].
- **Incrustados**: otra marca de texto, con el identificador y opciones [código, observado]:
  - en línea con el texto, o como figura con pie y una cita que enlaza al origen;
  - clases para colocarlo, y una etiqueta.

  Una página de texto incrusta su HTML, ya procesado y de forma recursiva hasta 5 niveles; más allá se ignora con un
  aviso en la consola. Una de imagen incrusta la imagen; los demás tipos, si su sistema lo programa. **Siempre la
  página entera**: no se puede incrustar una sección ni desde un encabezado.
- **Los incrustados no miran permisos.** La jugadora, leyendo una página pública, vio el texto de una página solo del
  máster de la misma entrada y el de una página de una entrada solo del máster [observado]. Los secretos de la página
  incrustada solo se ocultan si quien lee no es su propietario [código, observado].
- **Vista previa al pasar el ratón**: no hay en el núcleo. El globo solo dice el tipo de documento [observado].
- **Anclas**: a un encabezado, sí. El ancla es una versión simplificada del texto del encabezado (minúsculas, guiones,
  64 caracteres como mucho y un sufijo si se repite), así que depende de ese texto. A un bloque, no: los secretos
  llevan id, pero solo sirve para revelarlos [código, observado].
- **Enlace a algo que no ves**: se pinta con su nombre real (la jugadora vio «Plan del villano»). Al pulsarlo se abre
  la hoja de esa entrada vacía, con su título: el nombre de lo oculto sale en pantalla, no solo por la red
  [observado].

### 4. Permisos por entrada y por página

Los niveles (ninguno, limitado, observador, propietario), el «por defecto + por usuario» y las carpetas que copian en
vez de heredar están en `usuarios-y-permisos.md`. Lo propio del diario:

- **Entrada**: sale en el directorio solo con observador o más, no con limitado [código, observado].
- **Página**: nace en «heredar», que usa el nivel de la entrada para cada usuario. Puede fijar el suyo, por defecto y
  por usuario, **más estricto o más abierto que la entrada**. Se ve con observador y se edita con propietario. Crear
  una página exige ser propietario de la entrada [código, observado].

Combinaciones probadas con la jugadora [observado]:

| Entrada | Página | Lo que ve |
|---|---|---|
| Observador | Heredar | La página |
| Observador | Ninguno | Nada de la página. Su categoría sale vacía en el índice |
| Observador | Ninguno, pero observador para ella | Solo ella la ve |
| Ninguno | Observador | La entrada no sale en el directorio. Si llega por un enlace o porque se la muestran, ve esa página: más abierta que su entrada, pero sin camino para llegar |
| Limitado | Heredar | No sale en el directorio; su enlace abre una hoja vacía con el título |

**«Limitado» en el diario no da casi nada** [código; directorio y enlace observados]:

- no aparece en el directorio;
- en el mapa, la nota de la entrada se ve (icono y nombre), pero no se abre;
- la excepción: si la página de la nota es de imagen y el nivel es exactamente limitado, se abre solo la imagen;
- en un compendio, limitado cuenta como observador.

**«Mostrar a los jugadores»**, con una entrada o una página [código, observado]:

- Un diálogo elige todos o algunos jugadores.
- A la vez se puede cambiar la propiedad, y ese cambio queda.
- Con una página de imagen, se puede mandar solo la imagen, con o sin título y pie.
- Si no se cambia la propiedad, el cliente que lo recibe **se sube a observador en su propia memoria** hasta recargar.
  Es la prueba de que el contenido ya estaba allí: por la red solo viaja el identificador y un indicador de
  «forzar». Compartir una imagen manda la ruta, el título y el pie.
- Dos fallos que vimos:
  - **Mostrar sin forzar** (solo a quien tenga permiso) abrió a la jugadora una entrada solo del máster, con su texto.
    El cliente que lo recibe se sube a observador antes de mirar si debería verla [observado, código].
  - **El servidor no comprueba quién lo pide**. La jugadora mandó «mostrar» de una entrada solo del máster a todos;
    el servidor lo aceptó y al máster se le abrió [observado]. Por el fallo anterior, a los demás jugadores les
    llegaría con el contenido [inferido].

**Secretos dentro de una página de texto**:

| Aspecto | Cómo es |
|---|---|
| Cómo se marca | Un bloque (una sección del HTML) con la clase de secreto y un id aleatorio, que contiene otros bloques. Se crea desde el desplegable de formato [código, observado] |
| Quién lo ve | Los propietarios de la página siempre, con un botón de revelar u ocultar. Los demás, solo si está revelado. Los no revelados los quita el cliente al pintar [código, observado] |
| Cómo se revela | El botón cambia una clase de esa sección en el HTML guardado y guarda la página. **Es para todos** los que ven la página a la vez: no hay revelado por jugador [código, observado] |
| Qué recibe el jugador | **Todo**. En la carga inicial, la jugadora recibió el HTML de la página con el secreto sin revelar. En cada edición, también al revelar, el cambio trae el campo HTML entero, con todos los secretos [observado] |

Además se escapa **por la interfaz**, no solo por la red [observado]:

- la búsqueda de texto dentro de la entrada encuentra palabras que solo están en un secreto sin revelar y señala la
  página;
- un incrustado enseña la página entera aunque no tengas permiso; solo esconde sus secretos.

**Archivos**: las imágenes, PDF y vídeos son rutas a archivos del servidor, y esos archivos se sirven sin sesión:
bajamos un archivo de la carpeta de datos sin haber entrado [observado]. La ruta viaja en los datos que reciben todos,
así que el PDF de una página solo del máster lo puede bajar cualquiera que tenga la dirección [inferido].

### 5. Búsqueda

- **Directorio**: dos modos, por nombre o «texto completo» [código, observado]:
  - en el diario, el modo de texto completo **solo mira el nombre de la entrada**, porque las páginas no están entre
    sus campos de búsqueda: ni una palabra del texto ni el nombre de una página encuentran la entrada;
  - se busca en el cliente, en la copia en memoria, como subcadena sin distinguir mayúsculas;
  - si coincide una carpeta, sale con todo lo que contiene.
- **Dentro de una entrada**: un campo en el índice con los mismos dos modos [código, observado]:
  - por nombre de página;
  - o por el nombre y el texto plano del HTML, sin procesar: las marcas de enlace salen tal cual, los incrustados no
    cuentan y los secretos sin revelar sí.

  Filtra el índice. No resalta lo encontrado en el texto.
- No hay búsqueda de texto entre entradas.

### 6. Presentación

- **Hoja de la entrada**: una ventana con el índice a la izquierda (plegable) y las páginas a la derecha. El título
  de la ventana lleva delante el nombre de la carpeta [observado].
- **Dos modos de lectura**: una página o todas seguidas. El modo por defecto se guarda en la entrada; el que elige
  cada uno es solo de su ventana [código, observado].
- **Navegación** [código, observado]:
  - pulsando en el índice, sobre una página o un encabezado;
  - con los botones de anterior y siguiente;
  - en el modo seguido, el índice marca la página que se ve al desplazarse;
  - los enlaces abren la entrada en esa página y en su ancla.
- **Ver o editar**: no hay modo de edición en la hoja; cada página se edita en su ventana. El **candado** de la
  entrada impide reordenar el índice, no editar [código, observado].
- Cada página puede **ocultar su título**; el nivel la sangra en el índice.
- La hoja se puede **sacar a otra ventana** del navegador [observado: el control está en la cabecera].
- **Mostrar a los jugadores**: ver el apartado 4. La imagen compartida sale en una ventana emergente con su título y
  su pie [observado].
- Una entrada o una página se puede **clavar en una escena** como nota del mapa, y desde el directorio se salta a esa
  nota [código].

### Pruebas

Con dos scripts propios, fuera del repo, contra el mundo `crisol-rea`:

- uno de Node con el cliente de socket.io de la instalación (MIT), que entra como la jugadora de prueba y apunta la
  carga y todo lo que llega;
- otro de Playwright con Chromium 153, que maneja a la vez la sesión del máster y la de la jugadora.

1. El máster crea carpetas anidadas: la quinta se rechaza.
2. Crea entradas con permisos distintos:
   - pública;
   - limitada;
   - solo del máster;
   - solo del máster con una página pública.
3. En la entrada pública mete páginas de texto e imagen, dos categorías, una página de nivel 2, una solo del máster y
   otra solo para la jugadora. La página principal lleva:
   - encabezados;
   - un secreto revelado y otro sin revelar;
   - enlaces con y sin etiqueta, a un encabezado, relativos, rotos y a lo oculto;
   - tres incrustados.
4. La jugadora entra por socket: recibe los siete textos de control, incluidos los de los secretos y las páginas
   ocultas.
5. La jugadora, en el navegador:
   - ve el directorio, la entrada en los dos modos, los enlaces y los incrustados (con el texto oculto);
   - pulsa los enlaces a lo oculto y a lo limitado, y pasa el ratón por un enlace;
   - busca dentro de la entrada y en el directorio.
6. Con la jugadora escuchando, el máster:
   - revela un secreto: llega el HTML entero;
   - renombra y mueve una entrada enlazada;
   - cambia un encabezado enlazado;
   - borra una entrada enlazada.

   Luego la jugadora vuelve a pintar la página.
7. El máster muestra a la jugadora:
   - sin forzar: se le abre lo que no debía;
   - forzando una página: se le abre y se sube el permiso en su memoria;
   - una imagen sola.

   La jugadora manda «mostrar» de algo ajeno: el servidor lo acepta.
8. El máster pasa una página a Markdown: el servidor guarda la fuente y el HTML convertido, sin el `script`.
9. El máster y la jugadora (propietaria de su página) la editan a la vez:
   - el texto de ella llega al máster;
   - la marca de presencia aparece;
   - al cerrar ella, queda guardado a su nombre.
10. Un archivo de la carpeta de datos se descarga sin sesión.

## Compromisos y límites

- **HTML libre**:
  - A favor: no pierde nada, deja maquetar a mano y cada sistema mete sus plantillas.
  - En contra: el modelo no sabe qué es un bloque. Sin ids de bloque no hay enlaces a bloque ni cambios por bloque
    fiables; la búsqueda trabaja sobre texto plano, y Markdown es una conversión con pérdida.
- **Enlaces como texto dentro del HTML**:
  - A favor: van por id, aguantan renombrar y mover, y viajan con el contenido.
  - En contra: el servidor no los conoce. No hay entrantes, ni aviso al borrar, ni lista de rotos, y el ancla depende
    del texto del encabezado.
- **Jerarquía plana**: carpetas (4 niveles), entrada y páginas, y los niveles y las categorías solo decoran el
  índice. Obliga a decidir qué es carpeta, qué es entrada y qué es página, y no deja crecer una página con subpáginas.
- **Permiso por página**: la idea es buena (una entrada visible con páginas del máster), pero solo se aplica al pintar
  la lista y la página. Los incrustados, la búsqueda, los enlaces y «mostrar» se lo saltan, y una página puede quedar
  más abierta que su entrada sin forma de llegar a ella.
- **Secretos dentro del mismo HTML**: lo más sencillo de escribir y de revelar, pero el texto viaja siempre, se busca
  y se incrusta. Además, el revelado es de todos o de nadie.
- **Edición simultánea en memoria**: poco código, pero los pasos no se guardan, cada aviso reenvía la ventana entera,
  quedarse atrás acaba en «te lo copio al portapapeles», no se ven los cursores y el autoguardado escribe por fuera de
  los permisos.
- **Búsqueda pobre**: en el directorio, solo nombres de entradas; dentro, sin resaltado; nada entre entradas.
- **Archivos públicos**: lo que se sube se sirve sin sesión.
- **Lo mejor**: los dos modos de lectura (una página o todas seguidas), el índice por encabezados, el visor de PDF
  que carga bajo demanda, la sugerencia de enlaces al seleccionar texto y «mostrar» a jugadores concretos, también
  solo la imagen.

## Qué nos llevamos a Crisol

Frente al ADR-0003:

- **Secretos en documentos aparte: confirmado.** Foundry enseña las tres formas de fallar si el secreto vive en el
  mismo contenido: viaja por la red, sale en la búsqueda y sale al incrustar. Lo que el ADR ya fija lo cubre todo: el
  secreto es su propio documento de Yjs, y la búsqueda, los enlaces, las versiones y la exportación van por documento.
  Lo que añadiría:
  - **Revelar a un jugador (módulo 5) es cambiar el permiso del documento del secreto**, no tocar el cuerpo. No hay
    que reescribir el texto ni sacar una versión nueva de la página, y se puede revelar a unos sí y a otros no.
  - La **prueba de fugas** comprueba también la búsqueda, los incrustados, la vista previa y los títulos de enlaces,
    no solo lo que llega por la red.
- **Enlaces por id, como ellos, pero con la relación en el servidor.** Cada guardado rehace la tabla de enlaces
  (ADR-0003), y con ella salen gratis:
  - los entrantes;
  - el aviso al mandar a la papelera («la enlazan N páginas»);
  - la lista de enlaces rotos.

  Al pintar se usa el título actual, con etiqueta propia opcional, como ellos. Lo que no copiamos:
  - las formas que resuelven por nombre (cuando Claude escribe por nombre, el servidor lo pasa a id, como dice el ADR);
  - pintar el nombre de lo que no ves: el título del destino también pasa por la proyección. En el módulo 1 todo es
    del máster; el 5 decide cómo se ve un enlace a algo oculto.
- **Anclas por id estable**, a un encabezado o a un bloque (los ids de `unique-id` que ya fija el ADR), no por el texto
  del encabezado: cambiar un encabezado no rompe nada. Al exportar salen como `#sección` y `^id`.
- **Subpáginas de verdad**: un árbol de páginas con padre y orden (ADR-0003), sin el reparto carpeta / entrada /
  página y sin el tope de 4 niveles (como mucho, un límite técnico alto). Sin categorías: las subpáginas bastan. De
  ellos nos llevamos:
  - leer una página **con sus subpáginas seguidas**, útil para un capítulo entero y para sacar el PDF de una hoja;
  - el índice por encabezados, pero sin los de los incrustados, que pertenecen a otra página;
  - que la estructura no delate lo oculto: ni rótulos vacíos ni títulos de lo que no se ve.
- **La página es siempre de bloques**: imagen, PDF y vídeo son bloques del editor y recursos, no tipos de página. Si
  hacen falta tipos (lugar, PNJ…), salen de las propiedades y las plantillas (módulo 2). Del visor de PDF nos llevamos
  cargarlo bajo demanda y enseñar antes el tamaño.
- **Esquema cerrado con Markdown de ida y vuelta** (ADR-0003), no HTML libre. Perdemos la maquetación a mano; la
  cubren los bloques de hoja.
- **Editor**:
  - menú «/» y atajos de Markdown al escribir, como sus atajos;
  - la **sugerencia de enlaces al seleccionar texto** es barata y útil;
  - las **menciones sin enlazar** del inventario la completan en el panel de entrantes.
- **Edición simultánea con Yjs y Hocuspocus** (ADR-0003), sin su autoridad en memoria:
  - lo que se escribe no se pierde al reconectar, sin pasar por el portapapeles;
  - guardar es fusionar;
  - los mensajes llevan solo el cambio;
  - hay cursores con el nombre de la cuenta.

  Ellos tiran la sesión cuando se va el último editor; nosotros guardamos siempre al cerrarla, y cerrarla corta la
  sesión de edición del historial. Leer y editar no van en ventanas distintas: se edita en la propia página, con el
  candado del ADR para ponerla en lectura.
- **Versiones e historial**: ellos no tienen; lo cubre el ADR-0003.
- **«Mostrar a los jugadores»** (módulo 5 o la mesa): mandarlo a cuentas concretas y poder mandar solo la imagen, como
  ellos. Pero mostrar es **conceder** ver, de forma temporal o fija, y lo decide el servidor: nunca un cliente que se
  sube el permiso. Solo el máster lo pide, y se comprueba en el servidor.
- **Archivos con permiso**: imágenes y PDF se sirven por la API, con la proyección o con URLs firmadas de vida corta,
  nunca desde una carpeta pública. Es para el módulo 1, porque trae recursos y visor de PDF.
- **Búsqueda en el servidor**: texto completo en español por documento (ADR-0003), filtrado por permisos, con el
  fragmento que coincide. Una sola búsqueda para títulos y texto de todo el mundo, nada de dos modos.
- **Una subpágina más abierta que su madre**: Foundry lo permite y la deja sin camino. Para el módulo 5 propongo que
  una subpágina se vea como mucho como su madre, o que la miga de pan diga «oculta» sin título. Se decide allí.
