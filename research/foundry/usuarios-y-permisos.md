# Usuarios, roles y propiedad de documentos en Foundry VTT

Módulo de Crisol: 0. Fundación · Fecha: 2026-10-29 · Versión estudiada: 14.369

## Pregunta

1. Cómo se definen los usuarios de un mundo, qué roles hay, qué permisos se pueden configurar (matriz rol → permiso),
   cómo se entra a un mundo y dónde se comprueban los roles (cliente, servidor o ambos).
2. Qué niveles de acceso tiene cada documento, cómo conviven el valor por defecto y el valor por usuario, cómo funciona
   la herencia (carpetas, documentos incrustados), cómo se escriben las reglas de crear/editar/borrar por tipo de
   documento (declarativas o funciones) y dónde se hacen cumplir.

## Lo que hacen

Grado de certeza de cada afirmación: **[código]** leído en el código instalado, **[observado]** comprobado contra la
instancia de estudio con un jugador de prueba (ver «Pruebas» al final de esta sección), **[inferido]** deducido sin
comprobarlo.

### Usuarios: viven dentro de cada mundo

- No hay cuentas globales. Cada mundo guarda su propia lista de usuarios junto a sus actores, diarios, escenas, etc.
  El mismo jugador en dos mundos son dos usuarios sin relación. Un servidor solo tiene un mundo activo a la vez, así
  que no hay multiinquilino: una instancia, un mundo, una mesa. [código, observado en el disco de datos]
- Un usuario es un documento más, con nombre, rol, contraseña (con hash y sal propia), color, avatar, personaje
  asignado, barra de macros y un mapa de excepciones de permisos. [código]
- Siempre tiene que quedar al menos un máster: el servidor impide degradar o borrar al último. [código]

### Roles: una escalera de cinco peldaños

| Peldaño | Qué significa | Notas |
|---|---|---|
| 0 · Vetado | No puede entrar | Sirve para expulsar sin borrar |
| 1 · Jugador | Lo básico para jugar | |
| 2 · Jugador de confianza | Algunas acciones más (dibujar, crear notas…) | Solo cambia lo que dé la matriz |
| 3 · Asistente | Casi todo lo del máster en partida | Ve y edita todo; no administra roles altos ni la matriz |
| 4 · Máster | Control total del mundo | |

- Los roles son **lineales**: «tener al menos el rol X» es una comparación numérica. No hay roles paralelos ni
  combinables. [código]
- «Es máster» en casi todo el código significa «asistente o máster»: los dos se tratan como propietarios de todos los
  documentos. Solo un puñado de acciones distinguen al máster pleno (cambiar la matriz, crear usuarios con
  excepciones, editar a otro máster). [código]
- No existe un rol de espectador. [código]

### La matriz de capacidades (rol → permiso)

Además de los roles hay unas veinticinco **capacidades** con nombre: crear ciertos tipos de documento (actores,
objetos, diarios, notas de mapa, fichas, mazos, listas de música, regiones, dibujos), explorar y subir archivos,
difundir audio y vídeo, mostrar cursor y regla, hacer ping en el mapa, susurrar, tirar a mano, ejecutar macros de
script, abrir puertas, configurar fichas, consultar a otros usuarios y modificar ajustes. [código]

Cada capacidad se resuelve en tres pasos, en este orden [código]:

1. **Mínimos irrevocables**: algunas capacidades están siempre concedidas a ciertos roles (casi siempre asistente y
   máster) y no se pueden quitar.
2. **Excepción por usuario**: el usuario puede llevar un sí o un no explícito para esa capacidad, que manda sobre su
   rol.
3. **Matriz del mundo**: si no hay excepción, se mira la matriz, guardada como un ajuste del mundo que asocia cada
   capacidad a la lista de roles que la tienen. De fábrica cada capacidad viene con un rol mínimo por defecto.
   [observado: el ajuste existe y el jugador lo recibe]

Solo el máster pleno puede cambiar la matriz; el asistente no. [código] Un vetado no tiene ninguna capacidad. [código]

### Entrar a un mundo

- La pantalla de entrada pide **elegir un usuario de una lista** y escribir su contraseña, que puede estar vacía.
  Esa lista (nombres y roles de todos los usuarios) se entrega a cualquier visitante que abra la página, antes de
  autenticarse. [código, observado]
- La contraseña se guarda derivada con sal por usuario y un número de iteraciones bajo para los estándares actuales.
  No vimos limitación de intentos: cinco contraseñas erróneas seguidas solo dejan avisos en el registro. [código,
  observado]
- La sesión vive **en memoria del servidor**: una cookie opaca, solo HTTP y de mismo sitio, dura un día y asocia
  «mundo → usuario». Si el servidor se reinicia, todos vuelven a entrar. [código]
- Las peticiones POST se rechazan si no vienen del mismo origen (protección contra CSRF). [código, observado]
- Un mismo usuario puede tener varias sesiones a la vez. [observado]
- El máster puede **entrar como otro usuario** (cambia su sesión a la de ese jugador) para ver lo que ve. [código]
- Cambiar la contraseña de un usuario invalida sus sesiones. [código]
- Hay una contraseña de administrador aparte, para la pantalla de gestión de la instancia, que no es un rol del mundo.
  [código]

### Niveles de acceso por documento

| Nivel | Qué permite |
|---|---|
| Heredar | Usar el nivel del documento padre (solo tiene sentido en documentos incrustados) |
| Ninguno | No lo ve |
| Limitado | Lo ve en las listas y una parte de su contenido; qué parte la decide el sistema de juego |
| Observador | Lo ve entero, sin editar |
| Propietario | Lo ve y lo edita |

- Cada documento principal guarda un **mapa usuario → nivel** más una entrada «por defecto» para todos los demás. El
  nivel de un usuario es el suyo explícito; si no tiene, el por defecto; si no hay, ninguno. [código]
- El asistente y el máster siempre cuentan como propietarios; el vetado, como ninguno. [código]
- Al crear un documento, el servidor añade al creador como propietario. [código, observado]
- Un no-máster no puede cambiar la propiedad de otros: al crear se le descartan en silencio las entradas de terceros y
  al editar se le rechaza. Lo mismo con el autor: el servidor lo fija al creador y solo un máster puede cambiarlo.
  [código]
- Los compendios (bibliotecas) no usan el mapa por documento sino uno **por rol** a nivel de compendio. [código]

### Herencia

- **Incrustados** (páginas dentro de una entrada de diario, objetos dentro de un actor, fichas dentro de una escena):
  no tienen propiedad propia y usan la del padre. Las páginas de diario son la excepción útil: nacen en «heredar» pero
  pueden fijar su propio nivel, así que una entrada visible puede tener una página solo del máster. Las fichas del
  mapa delegan en el actor que representan. [código]
- **Carpetas**: no hay herencia viva. El diálogo de propiedad de una carpeta no guarda nada en la carpeta: aplica el
  nivel elegido a todos los documentos que contiene en ese momento, con una opción de «no cambiar» por usuario. Lo
  que se añada después no hereda nada. [código]
- Visibilidad de un hijo en el cliente: solo se muestra si su padre también es visible. [código]

### Reglas por tipo de documento

Cada tipo declara en sus metadatos, para ver/crear/editar/borrar, una de estas cuatro formas [código]:

| Forma de la regla | Ejemplo con nuestras palabras |
|---|---|
| Rol mínimo | «Crear requiere asistente» (es el valor por defecto general) |
| Capacidad de la matriz | «Crear entradas de diario requiere la capacidad de crear diarios» |
| Nivel de propiedad | «Borrar requiere ser propietario»; «editar requiere ser propietario» (por defecto) |
| Función | «Un jugador solo puede editar una puerta para abrirla o cerrarla, y solo si no está cerrada con llave» |

- Los valores por defecto generales son: ver con limitado, crear con asistente, editar con propietario, borrar con
  asistente. Casi todos los tipos (unos veinticinco) cambian alguno, y unas dos terceras partes usan al menos una
  función para casos con matices (ajustes
  reservados al máster, ajustes de un usuario que solo él toca, cambios de imagen que exigen poder explorar archivos,
  usuarios que no pueden subirse el rol). [código]
- Hay además protección **por campo**: campos marcados como solo-máster (también los que declare el sistema de juego) y
  saneado con el usuario como contexto (HTML limpio, imágenes incrustadas que exigen permiso de subida). [código]

### Dónde se comprueba

El código de permisos es **el mismo en cliente y servidor** (una capa común). [código]

- **Cliente**: lo usa para decidir qué botones y menús enseñar y para validar el esquema antes de enviar, pero no
  bloquea el envío por permisos. [código]
- **Servidor**: es la autoridad en crear, editar y borrar documentos. Cada documento de cada petición pasa la regla de
  su tipo, con el usuario sacado de la sesión del socket. [código, observado: el jugador intentó renombrar una entrada
  solo del máster y el servidor lo rechazó]
- **Lo que el servidor no hace cumplir**:
  - La regla de *ver* se declara pero el servidor nunca la consulta: ni al cargar el mundo ni al pedir un documento
    concreto. [código, observado; detalle en `sincronizacion-e-historial.md`]
  - La edición colaborativa de texto abre sesión y guarda sin comprobar propiedad. Un jugador sin acceso sobrescribió
    una página solo del máster y el último autor siguió apuntando al máster. [observado]
  - Cursor, regla y ping: el permiso lo miran el cliente que emite y el que dibuja; el servidor reenvía sin mirar y se
    fía del identificador de usuario que manda el cliente. [código]
  - Los canales propios de módulos y sistemas se reenvían sin comprobación. [código]
  - El rol se mira al entrar y luego el socket conserva el usuario de ese momento. Un jugador vetado con la sesión
    abierta siguió creando mensajes hasta reconectar. [observado]

### Pruebas

Con un script propio de Node (cliente de WebSocket, fuera del repo) contra la instancia de estudio: se creó el
jugador de prueba, una entrada de diario con acceso «ninguno» por defecto y un susurro solo al máster, y se entró
como jugador. Resultados que cita esta nota:

- Visitante sin sesión → recibe la lista de usuarios con sus roles.
- Jugador intenta renombrar la entrada secreta → error de permisos del servidor.
- Jugador abre una sesión de edición colaborativa sobre la página secreta con contenido propio y espera la
  autoguarda → el texto queda guardado; el máster lo ve; el último autor sigue siendo el máster.
- Máster veta al jugador conectado → el jugador sigue creando mensajes por el mismo socket; una nueva entrada se
  rechaza.
- Cinco contraseñas erróneas → cinco rechazos sin bloqueo.
- Segunda entrada del mismo usuario → aceptada.

## Compromisos y límites

- **Sencillez frente a granularidad**: roles lineales y una matriz pequeña se entienden en un minuto y cubren la mesa
  típica. A cambio no hay roles por campaña, ni paralelos (un espectador, un co-máster de una sola campaña), ni
  permisos por recurso más allá de los cuatro niveles.
- **Usuarios por mundo**: no hay cuentas que crucen mundos ni registro, lo que simplifica una instalación casera
  pero obliga a recrear jugadores en cada mundo y hace imposible un servicio multiinquilino.
- **Entrada débil para un servicio público**: lista de usuarios a la vista, contraseñas opcionales, sin límite de
  intentos y sesiones en memoria. Encaja con «servidor en casa para mis amigos», no con un SaaS.
- **«Limitado» es ambiguo**: el núcleo delega en el sistema de juego qué se ve, así que cada sistema lo interpreta a
  su manera.
- **Herencia por carpetas que no hereda**: aplicar a la carpeta parece una regla, pero es una copia puntual que se
  desincroniza en cuanto se mueve o crea algo.
- **Una regla de ver que no se aplica**: escribir y borrar están bien vigilados en el servidor, pero la lectura se
  controla en la interfaz. Además hay canales laterales (edición colaborativa, presencia, canales de módulos) que se
  saltan la capa de permisos, y la revocación no surte efecto hasta reconectar.
- **Mismas reglas en los dos lados**: compartir el código de permisos evita que la interfaz ofrezca lo que el servidor
  luego niega. Es lo mejor del diseño.

## Qué nos llevamos a Crisol

- **Dos ejes separados, como ellos**: el rol de la pertenencia decide las capacidades generales (crear campaña,
  invitar, ver historial, deshacer) y el nivel de acceso del recurso decide qué se ve y se edita. Pero en Crisol el rol
  vive en la **pertenencia** (cuenta ↔ mundo o campaña) y las cuentas son globales, con Better Auth. Nada de usuarios
  por mundo.
- **Capacidades en una tabla declarativa y versionada** dentro de la capa de políticas: capacidad → roles que la
  tienen. Funciones solo para los casos con matices, como hacen ellos. En el módulo 0, con máster y jugador, la tabla
  basta y no hace falta matriz editable por mundo. Dejamos sitio para excepciones por pertenencia más adelante, sin
  construirlas ahora.
- **Mínimos irrevocables**: el máster siempre puede administrar su mundo, aunque alguien toque la configuración, y
  siempre queda al menos un máster por mundo.
- **Pocos niveles y explícitos**: nada de un «limitado» que interprete cada cual. Para Crisol propondría: solo
  máster, todos los jugadores de la campaña o jugadores concretos (lectura), más editar. El valor por defecto de una
  página nueva es «solo máster», como ya hace el Crisol actual y como hace Foundry.
- **Herencia viva o ninguna**: si una carpeta o un padre fija visibilidad, se hereda de verdad, se calcula en el
  servidor y la interfaz dice de dónde viene. Copiar una sola vez está prohibido. Que una parte de un documento visible
  (una página, un bloque secreto) pueda ser más restrictiva, como sus páginas de diario, es justo lo que necesitan los
  secretos del Crisol actual.
- **El servidor fija autor, creador y propietario** a partir de la sesión y nunca se fía de lo que mande el cliente.
  El dato de autoría distingue persona o IA (y el modo de IA), porque el historial lo necesita.
- **La regla de ver es la más importante y la aplica el servidor**: la misma capa de políticas que autoriza escribir
  filtra cada lectura, cada carga inicial y cada difusión. Ahí está la gran diferencia con Foundry (ver la otra nota).
- **Ningún canal lateral**: Hocuspocus/Yjs, presencia, MCP y cualquier socket pasan por la misma capa. La identidad
  sale siempre de la sesión, nunca del mensaje.
- **Revocar es inmediato**: cada petición vuelve a evaluar la pertenencia, o la caché se invalida al cambiarla, y al
  expulsar o cambiar el rol se cierran o rehacen las suscripciones en tiempo real de esa cuenta. Pondría una prueba
  automática: «vetado con el socket abierto no puede escribir ni recibir».
- **Entrada propia de un SaaS**: sin lista de usuarios a la vista, límite de intentos, sesiones persistentes
  (Postgres o Valkey) que sobreviven a un reinicio, cookie solo HTTP y de mismo sitio, y comprobación de origen en
  las peticiones que cambian algo, como ellos.
- **«Ver como jugador» sin cambiar de sesión**: su «entrar como» es útil al máster, pero en Crisol sería una
  proyección de solo lectura calculada en el servidor con los permisos del jugador. El Crisol actual ya lo tiene como
  herramienta MCP y queda registrado.
- **Pruebas en forma de tabla**: rol × acción × visibilidad del recurso, contra la capa de políticas, más una prueba
  de extremo a extremo que entra como jugador y comprueba qué rechaza el servidor. Es lo que aquí hicimos a mano
  contra Foundry.
