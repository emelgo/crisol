# Sincronización, visibilidad, historial y deshacer en Foundry VTT

Módulo de Crisol: 0. Fundación · Fecha: 2026-10-29 · Versión estudiada: 14.369

## Pregunta

3. Qué recorrido hace un cambio (petición del cliente → validación → persistencia → difusión) y qué recibe cada
   cliente al cargar y con cada cambio: ¿el servidor filtra por usuario o lo manda todo y la interfaz oculta?
4. ¿Hay un historial persistente de quién cambió qué? ¿Qué deshacer existe y dónde vive (cliente, memoria, tipo de
   objeto)?

## Lo que hacen

Grado de certeza: **[código]** leído en el código instalado, **[observado]** comprobado contra la instancia de
estudio, **[inferido]** deducido sin comprobarlo. Las pruebas están al final de esta sección.

### Recorrido de un cambio

| Paso | Dónde | Qué pasa |
|---|---|---|
| 1 | Cliente | Limpia y valida los datos con el esquema compartido y ejecuta los ganchos previos (un módulo puede cancelar). No comprueba permisos ni aplica nada todavía: no es optimista. |
| 2 | Cliente → servidor | Una sola vía, WebSocket: «tipo de documento + acción (crear, editar, borrar, leer) + operación» con un lote de datos o de cambios y el padre por referencia. |
| 3 | Servidor | El usuario sale de la sesión del socket, no de la petición. Las escrituras de cada base se ponen en fila, una tras otra. |
| 4 | Servidor | Por cada documento: carga, saneado con el usuario como contexto (campos solo-máster, propiedad, autor, HTML, imágenes), regla de permiso de su tipo, ganchos previos y validación completa. |
| 5 | Servidor | Escritura en lote en la base del mundo (LevelDB) y ganchos posteriores, que pueden producir efectos secundarios (borrar una escena borra su niebla). |
| 6 | Servidor → autor | La respuesta vuelve por el acuse del socket, con el resultado principal y los efectos secundarios. |
| 7 | Servidor → resto | **La misma respuesta se reenvía a todos los demás sockets conectados.** Al crear viaja el documento entero; al editar, solo el diff y la nueva fecha de modificación; al borrar, los identificadores. |
| 8 | Cada cliente | Aplica el resultado a su copia local en memoria y repinta. Los permisos solo deciden qué se enseña. |

[código; pasos 6-7 observados]

- **Lotes de varias operaciones**: primero se ensayan todas sin escribir; si alguna falla, no se aplica ninguna. Si
  pasan, se aplican en orden y, si una falla a mitad, las anteriores quedan escritas. No hay transacción de verdad.
  [código]
- **Orden**: la fila por base garantiza que dos escrituras sobre la misma colección no se pisen dentro del servidor.
  [código]

### Qué recibe cada cliente al cargar

Tras entrar, el cliente pide los datos del mundo. El servidor responde con un **volcado completo e idéntico para
cualquier usuario**: todas las colecciones del mundo (usuarios sin contraseña, actores, objetos, diarios con sus
páginas, escenas con todo lo que llevan dentro, mensajes de chat, carpetas, macros, tablas, música, mazos,
combates y ajustes del mundo, matriz de permisos incluida) más los índices de todos los compendios activos. El
usuario solo se usa para la configuración de archivos. [código, observado]

Lo que comprobamos con el jugador de prueba [observado]:

- Recibió la entrada de diario creada por el máster con acceso «ninguno» por defecto, **con el texto completo de su
  página** y con el mapa de propiedad que dice que no debería verla.
- Recibió un susurro dirigido solo al máster, con su contenido y la lista de destinatarios.
- Al pedir esa entrada secreta por su identificador, el servidor se la devolvió: tampoco hay filtro en las lecturas
  sueltas. En el código del servidor no hay ningún punto que consulte la regla de *ver*.

Por deducción del mismo volcado, también reciben las fichas ocultas de las escenas, los muros, las notas del mapa,
los combatientes ocultos y los objetos de actores ajenos. [inferido del código, no comprobado una a una]

### Qué recibe cada cliente con cada cambio

- **Todo cambio de documento llega a todos los conectados**, sin filtrar por usuario. Cuando el máster editó la
  página secreta, el jugador recibió al instante el diff con el texto nuevo. Cuando el máster susurró a sí mismo, el
  jugador recibió el mensaje entero. [observado]
- Las excepciones van dirigidas o se cortan a propósito [código]:
  - La exploración de la niebla es por usuario y su difusión general está desactivada; sincronizarla o compartirla son
    envíos dirigidos que solo puede lanzar el máster.
  - «Mostrar una entrada o una imagen» a ciertos jugadores se manda solo a sus sockets.
  - Los canales propios de módulos admiten una lista de destinatarios.
  - En la edición colaborativa de texto, los pasos solo van a quien tiene abierta la sesión, pero el aviso de
    autoguarda, con el HTML completo, va a todos los usuarios.
- Presencia (cursor, regla, objetivos, escena que se mira): el servidor la reenvía a todos sin comprobar nada. [código]

### Cómo oculta el cliente

El cliente guarda en memoria todo lo recibido y filtra al pintar: las listas solo muestran lo que el usuario puede
ver al menos en «limitado» (y si su padre también es visible), los susurros solo se pintan para su autor y sus
destinatarios, y el lienzo oculta las fichas que no toca ver. Cualquiera con las herramientas del navegador lo ve
todo. [código, observado a nivel de red]

### Historial persistente

- **No hay historial de cambios**. Cada documento principal lleva su fecha de creación, su fecha de última
  modificación y el **último** usuario que lo modificó, además de su procedencia (de qué compendio vino, de qué se
  duplicó, de qué mundo se exportó). Las versiones anteriores no se guardan. [código, observado]
- El último autor no siempre es fiable: tras la escritura del jugador por la edición colaborativa, la fecha cambió
  pero el último autor siguió siendo el máster. [observado]
- El **registro de texto del servidor** apunta las entradas (con IP), los fallos de contraseña, las creaciones y los
  borrados (tipo e identificador, **sin decir quién**) y los rechazos por permiso (con el nombre del usuario). Las
  ediciones solo salen en modo depuración. Es un registro de operaciones, no una auditoría que se pueda consultar.
  [código, observado en el registro tras las pruebas]
- Los borrados son definitivos: no hay papelera. [código]
- La edición colaborativa guarda en memoria los últimos 256 pasos con su autor, para sincronizar a los editores. Se
  pierde al cerrarse la sesión y no se usa para deshacer. [código]

### Deshacer

| Aspecto | Cómo es |
|---|---|
| Dónde vive | En el cliente, en memoria, por **capa del lienzo** (fichas, muros, luces, sonidos, dibujos, notas, regiones…) |
| Qué cubre | Solo objetos incrustados en la escena que se está viendo. Actores, objetos, diarios, ajustes, carpetas y chat no tienen deshacer. |
| De quién | Solo los cambios del propio usuario, apuntados cuando llega la confirmación del servidor, justo antes de aplicarla |
| Cuánto | Hasta 100 entradas por capa; se vacía al cambiar de escena o recargar |
| Cómo deshace | Lanza la operación inversa como un cambio nuevo, marcado para no volver a apuntarse: borrar lo creado, volver a crear lo borrado con los mismos identificadores, restaurar los valores anteriores de los campos tocados |
| Rehacer | No existe |
| Casos especiales | Al deshacer un movimiento de ficha se recoloca sin animación y se restaura su rastro; los cambios en los datos del actor que van con la ficha no se deshacen |

[código]

Al restaurar los valores anteriores no se comprueba si otro usuario los cambió después, así que deshacer puede pisar
el trabajo ajeno. El deshacer pasa por el servidor como cualquier cambio, así que sí respeta los permisos. [inferido
del código, no comprobado]

### Pruebas

Con un script propio de Node (cliente de WebSocket, fuera del repo) contra la instancia de estudio (`crisol-rea`),
entrando por la misma vía que el navegador:

1. El máster crea la entrada «Secreto REA» con acceso «ninguno» por defecto y una página de texto, y un susurro solo
   para él.
2. El jugador de prueba entra y pide los datos del mundo: recibe la entrada con su texto y el susurro.
3. Con el jugador escuchando, el máster cambia el texto de la página: el jugador recibe el diff con el texto nuevo, y
   lo mismo pasa con un susurro nuevo.
4. El jugador pide la entrada secreta por su identificador: se la devuelven. Intenta renombrarla: rechazado.
5. El jugador abre la edición colaborativa sobre esa página con contenido propio: a los 60 s la autoguarda lo
   escribe, todos reciben el aviso con el HTML, el máster lo ve y el último autor sigue siendo el máster.
6. El registro del servidor muestra las entradas, la creación del mensaje sin autor y la sesión de edición. La
   edición del máster no aparece.

## Compromisos y límites

- **Difundirlo todo es simple y rápido**: un único canal, una respuesta que se reenvía tal cual y clientes que se
  autoorganizan. No hay que calcular qué ve cada uno ni rehacer el diff por usuario. A cambio, **no hay secretos de
  verdad**: notas del máster, fichas ocultas y susurros llegan a todos los navegadores. Funciona entre amigos y es
  inaceptable para nosotros.
- **El volcado inicial completo** escala con el tamaño del mundo, no con lo que el usuario necesita. Su registro
  anota cuánto tarda en preparar y enviar los datos a cada cliente: unos 800 ms en un mundo casi vacío. [observado]
- **Lotes sin transacción**: el ensayo previo evita la mayoría de fallos a medias, pero no todos.
- **Autoría frágil**: solo el último autor, sin historial y con canales que no lo actualizan. No se puede responder
  «quién cambió esto y qué había antes».
- **Deshacer local y parcial**: cómodo al montar un mapa (Ctrl+Z al mover un muro), pero no sirve para lo que más
  duele perder (una ficha de personaje, una entrada de diario, un borrado), no sobrevive a una recarga y no sabe de
  conflictos.
- **Edición colaborativa como puerta trasera**: va por fuera de la capa de documentos, así que se salta permisos y
  autoría. Es el riesgo típico de añadir tiempo real «al lado» del modelo de datos.

## Qué nos llevamos a Crisol

- **El mismo recorrido, con dos cambios**: validar en el borde con el esquema compartido (zod), sacar la identidad de
  la sesión, autorizar en la capa de políticas, persistir, responder al autor y difundir el diff. Cambio 1: cada
  operación es **una transacción de Postgres**, todo o nada, y lleva un identificador de operación que agrupa los
  efectos secundarios. Cambio 2: la difusión **se proyecta por destinatario**.
- **Difusión proyectada**: por cada cambio y cada suscriptor, el servidor calcula si puede ver el recurso antes y
  después. Si lo ve antes y después, recibe el diff ya filtrado (sin campos ni bloques secretos). Si empieza a verlo,
  recibe el recurso completo filtrado. Si deja de verlo, recibe la orden de quitarlo. Si nunca lo ve, no recibe nada,
  ni siquiera su identificador. Agrupar suscriptores por «clase de visibilidad» (máster, todos los jugadores, cada
  jugador con permisos propios) evita calcular por conexión.
- **Carga inicial bajo demanda y filtrada**: nada de volcar el mundo. El cliente pide lo que necesita (listas
  paginadas, el recurso abierto, la escena activa), siempre pasando por la proyección. La misma función de proyección
  sirve para la API, el WebSocket, el MCP y la exportación a Markdown de un jugador.
- **Secretos dentro de un documento**: los susurros, los bloques secretos de una página o las notas del máster en una
  ficha necesitan proyección por campo o por bloque, no solo por documento. **Consecuencia para Yjs**: Yjs sincroniza
  el documento entero y no puede proyectar por usuario, así que el contenido secreto no puede vivir en el mismo
  documento Yjs que lo público. Cada bloque con otra visibilidad tendrá que ser un documento o subdocumento aparte con
  su propio permiso. Es una decisión para el módulo 1 (wiki), pero conviene escribirla ya en un ADR.
- **Hocuspocus dentro de la capa de políticas**: autenticar la conexión, comprobar el permiso de lectura al abrirla y
  el de escritura en cada actualización (o abrirla en solo lectura), y persistir por la misma capa de servicios con el
  autor real apuntado en el historial. Lo de Foundry, que una autoguarda escriba por fuera, es justo lo que hay que
  evitar.
- **Presencia atribuida por el servidor** y también proyectada: un jugador no tiene por qué saber qué escena oculta
  está mirando el máster.
- **Una prueba de fugas en la CI**: entrar como jugador, capturar todo lo que llega por la red (carga, difusiones,
  respuestas de la API y del MCP) mientras el máster crea y edita contenido secreto, y comprobar que no aparece ni un
  byte de él. Es lo que hicimos aquí a mano contra Foundry. Propondría añadirla a `CONSTRAINTS.md` como listón.
- **Historial en el servidor, que no tienen**: una tabla de operaciones (quién, persona o IA y en qué modo, desde
  dónde: interfaz, API o MCP, y cuándo) y otra de cambios por recurso (antes y después, o un parche) ligados a la
  operación. Se guardan 90 días. Además, «creado por / modificado por / cuándo» desnormalizado en cada recurso para
  enseñarlo barato, como ellos.
- **Deshacer por operación, con su buena idea**: deshacer es lanzar la operación inversa como una operación nueva,
  recreando lo borrado con los mismos identificadores. Así deshacer queda en el historial y se puede deshacer a su vez,
  lo que nos da rehacer gratis. Lo que haremos distinto:
  - Vive en el servidor, es para cualquier recurso y no depende de la pestaña.
  - **Detecta conflictos**: antes de deshacer se comprueba que los campos tocados siguen con el valor que dejó la
    operación. Si alguien los cambió después, se avisa o se rechaza en vez de pisar su trabajo.
  - Pasa por la capa de políticas con los permisos actuales de quien deshace.
- **Papelera de 30 días** con borrado blando: deshacer un borrado es restaurar la fila, no recrearla.
- **El historial también se proyecta**: un jugador que vea el historial de un recurso no puede leer en el «antes» un
  secreto que ya no ve, o que nunca vio.
