# Sala de jugadores en Foundry VTT (chat, presencia, enseñar, movimiento y controles del máster)

Módulo de Crisol: 7. Sala de jugadores · Fecha: 2026-11-10 · Versión estudiada: 14.369 (dnd5e 6.0.6)

## Pregunta

1. **Chat**: modos de mensaje, cómo se eligen los destinatarios de un susurro, si el máster ve los susurros entre
   jugadores, quién habla (usuario o personaje), dentro y fuera de personaje, burbujas sobre la ficha, avisos,
   persistencia y paginación del registro, borrar, exportar y vaciar, tarjetas de tirada frente a mensajes y comandos
   de texto.
2. **Presencia y control**: lista de jugadores, cursores y señales, la pausa (qué bloquea y cómo se ve), echar o vetar a
   un usuario y cambiar el acceso.
3. **Enseñar a los jugadores**: imágenes y diarios, a todos o a algunos, forzar que se abran, qué ve el jugador.
4. **Movimiento de los jugadores**: quién mueve qué ficha, muros, puertas, pausa, moverse fuera de su turno, pasar turno.

Lo que ya se sabe y no se repite aquí: el servidor difunde todo cambio a todos los conectados y los susurros llegan a
todos los navegadores (`sincronizacion-e-historial.md`); roles y matriz de capacidades (`usuarios-y-permisos.md`);
muros, puertas y quién las abre (`vision-muros-y-niebla.md` § 1); combate y turnos (`escenas-fichas-y-combate.md` § 4).
El sonido va aparte, en `sonido.md`.

## Lo que hacen

Grado de certeza: **[código]** leído en el programa instalado (cliente sin minificar, servidor minificado),
**[observado]** comprobado contra la instancia de estudio con scripts de socket propios, **[inferido]** deducido sin
comprobarlo.

### Cómo se estudió

- Con craft-anything se abrió el programa (`/opt/rea-targets/foundry/app`) y se mapeó la carpeta del cliente (649
  archivos). Se leyeron el documento de mensaje (común y cliente), el registro del chat y sus comandos, las burbujas,
  la lista de jugadores, la capa de controles (cursores y señales), la pausa del cliente y del servidor, «mostrar a
  jugadores» de diarios e imágenes, el permiso de puertas y de combate, y los ajustes de chat de dnd5e.
- En el mundo `crisol-rea` se crearon dos jugadores («Sala Ana» y «Sala Bruno») y, con un script de Node que usa el
  cliente de socket.io de la propia instalación (fuera del repo), los tres (máster, Ana y Bruno) se conectaron a la vez
  para ver qué llega a cada uno: susurros entre jugadores, suplantar a otro autor, pausar sin ser máster, los avisos
  que un jugador puede difundir, cambiar el turno del combate y echar a un jugador.

### 1. Chat

**El mensaje** [código]. Un documento del mundo con: autor (un usuario), hora, estilo, texto (HTML), «flavor» (una
cabecera), título, **hablante** (escena, actor, ficha y un alias), lista de **destinatarios** (usuarios), una marca de
**a ciegas**, tiradas (ya resueltas, guardadas enteras), un sonido opcional y datos del sistema (dnd5e pone ahí sus
tarjetas). No hay un campo «modo»: el modo se traduce, al crearlo, a destinatarios + a ciegas + estilo.

**Modos** [código]. Desde la v14 son cinco, configurables por módulos, y el elegido por cada usuario es un ajuste suyo
que vale para lo que escribe y para lo que tira:

| Modo | Qué hace con el mensaje | Quién lo ve |
|---|---|---|
| Público | Sin destinatarios | Todos |
| Solo máster | Destinatarios = los másteres (salvo que ya traiga otros) | El autor y los másteres |
| A ciegas | Igual, y además «a ciegas» | Los másteres; el autor ve que existe, pero no su contenido |
| Solo para mí | Destinatario = el autor | El autor |
| En personaje | Público, con estilo «en personaje» | Todos; solo vale si hay un hablante con actor y no es una tirada |

Los estilos son cuatro: otro, **fuera de personaje** (se marca con el color del jugador), **en personaje** (sale con el
nombre y retrato del personaje) y **emoción** («Simón saluda con la mano»).

**Susurros** [código]. Un susurro es un mensaje con destinatarios. Se eligen por comandos de texto: a uno o varios por
nombre de usuario **o de su personaje**, entre corchetes y separados por comas; a «GM»/«DM» (todos los másteres); a
«players» (todos los jugadores); y «responder» (a quien te susurró por última vez y al resto de aquel grupo). Susurrar
a un jugador exige la capacidad de susurrar (de serie la tienen todos); a un máster, siempre se puede. Un susurro lleva
el sonido de aviso.

**¿El máster ve los susurros entre jugadores?** **No en la interfaz** [código]: un mensaje con destinatarios solo se
pinta para su autor y sus destinatarios, sin excepción para el máster. Sí le llega por la red, como a todos
[observado: el máster y Bruno recibieron el susurro de Ana a Bruno]. Una tirada privada es la excepción: se pinta para
todos, pero quien no es destinatario solo ve «X ha tirado en privado» con los dados tapados.

**Revelar y ocultar** [código]: el autor o el máster pueden, desde el menú del mensaje, hacer público un mensaje
privado o pasarlo a «solo máster». Borrar un mensaje: el autor o el máster. Vaciar el registro entero: solo el máster,
con confirmación, y es definitivo.

**Quién habla** [código]. Al escribir, el hablante se decide por este orden: la ficha que controlas en la escena; si no,
tu personaje asignado (su ficha en la escena, o el actor); si no, tú como usuario. Un mensaje «fuera de personaje» se
pinta con el usuario aunque haya hablante. «En personaje» o «emoción» sin personaje se rechazan con un aviso. El
servidor **no deja suplantar al autor**: Ana mandó un mensaje con Bruno como autor y el servidor lo guardó con Ana
[observado]; el hablante (alias, actor), en cambio, lo pone el cliente [inferido del código].

**Burbujas** [código]. Un mensaje en personaje o una emoción, si el hablante es una ficha de la escena que se mira,
saca una burbuja sobre la ficha unos segundos (más cuanto más largo) y, si se quiere, mueve la cámara hasta ella. Cada
usuario puede apagar las burbujas y el desplazamiento. Hay además un aviso de burbuja suelto, sin mensaje, que se
difunde a todos.

**Avisos** [código]. Con el registro cerrado, cada mensaje nuevo sale como una tarjeta flotante que desaparece a los 5 s
(se para al pasar el ratón), si hay sitio en pantalla; si no, un punto en la pestaña del chat. Suena el sonido del
mensaje si lo trae (dados para las tiradas, aviso para los susurros) en el canal de interfaz.

**Persistencia y paginación** [código]. Todos los mensajes se guardan en la base del mundo sin límite ni caducidad y
viajan enteros a cada navegador al entrar. El registro pinta los 100 últimos y carga 100 más al llegar arriba. Las
horas relativas se refrescan solas. Exportar baja un texto plano con hora, alias, texto y fórmula = resultado de cada
tirada; **recorre todos los mensajes de la colección, sin filtrar por visibilidad**, así que un jugador que exporta se
lleva también los susurros ajenos que su navegador ya tenía [inferido del código].

**Tiradas y mensajes conviven** [código]. Una tirada es un mensaje más con sus tiradas dentro; si no trae texto, se pinta
la tarjeta de la tirada. Las fórmulas en línea (entre dobles corchetes) se resuelven al crear el mensaje. dnd5e cambia
la tarjeta (ataque, daño, salvación, con bandejas para aplicar daño o efectos a las fichas marcadas) y añade ajustes:
plegar las tarjetas de objeto, plegar las bandejas, resumir y tema del registro (por usuario), y quién ve si un ataque
acierta o la CD de una prueba (del mundo).

**Comandos** [código]: tirar (con variantes para cada modo: público, solo máster, a ciegas, para mí), fuera de
personaje, en personaje, emoción (`/em` o `/me`), solo máster (`/gm`), susurro (`/w`), responder, a los jugadores y
lanzar una macro. Un comando desconocido da error. El cuadro de texto guarda los 16 últimos mensajes enviados para
recuperarlos con las flechas.

### 2. Presencia y control

**Lista de jugadores** [código]. Una caja abajo a la izquierda con los conectados (los demás, desplegando): punto con
su color (gris si no está), nombre, pronombres y, entre corchetes, «GM» o el nombre de su personaje; un aviso de
inactividad a los **5 minutos** sin actividad [código del servidor]. Desde el menú de cada uno, el máster: configurar,
ver su avatar, **traer a la escena** (le cambia la escena que mira), **echar**, **vetar** y quitar el veto.

**Actividad** [código]. Cada navegador manda al servidor su escena y nivel, cursor, regla, objetivos y estado de vídeo;
el servidor la reenvía a todos sin comprobar nada y, al entrar alguien, le manda la de los demás. El servidor sabe qué
escena mira cada usuario y lo usa en la lista de usuarios.

**Cursores** [código]: se ven los de los demás si tienen la capacidad «mostrar cursor». **Señales** (pings): pulsación
larga en el mapa, con la capacidad de hacer ping. Cuatro formas: pulso (la normal), alerta (con Alt), **tirar de la
vista** (con Mayús: a quien la recibe le mueve la cámara a ese punto; solo hace caso si viene del máster) y flecha en el
borde cuando la señal queda fuera de pantalla. Modo fotosensible: siempre la forma suave.

**La pausa** [código, observado]:
- El estado vive **en la memoria del servidor** y no se guarda: el mundo **arranca siempre en pausa** [observado al
  lanzarlo]. Solo un máster puede cambiarla; si lo intenta un jugador, el servidor no hace nada [observado].
- Se ve como un rótulo grande «Partida en pausa» en el centro con un icono que gira [código].
- **Qué bloquea, solo a los jugadores y solo en su navegador**: mover fichas (para las que se estaban moviendo y cancela
  el arrastre o el plan de movimiento), crear o colocar cosas en el mapa (fichas, regiones, dibujos, plantillas),
  borrar o mover objetos del lienzo y abrir puertas, con el aviso «la partida está en pausa».
- **Qué no bloquea**: chat, tiradas, hojas de personaje, diarios, sonido ni combate. Y **el servidor no la aplica**: ni
  el documento de ficha ni el de muro miran la pausa, así que un cliente modificado mueve fichas en pausa [inferido
  del código].

**Echar y vetar** [código, observado]:
- **Vetar** es poner al usuario el rol «ninguno»: no puede volver a entrar mientras dure. **Echar** es vetar y quitar el
  veto al instante. En los dos casos **es el navegador del echado el que se sale solo** al ver que su rol cambió.
- **El servidor no corta su conexión**: Ana, vetada, seguía conectada y pudo escribir en el chat [observado]; tras quitar
  el veto, seguía dentro. Echar sirve contra un jugador que se ha dejado la pestaña abierta, no contra uno malicioso.
- **Cambiar el acceso**: no hay enlaces de invitación por persona; se entra eligiendo usuario y contraseña. Cambiar la
  contraseña de un usuario cierra sus sesiones en el servidor [código]. Los «enlaces de invitación» que enseña Foundry
  son solo las direcciones del servidor.

### 3. Enseñar a los jugadores

- **Diarios** [código]: «mostrar a jugadores» abre un diálogo para una entrada o una página: **a todos**, **a los que ya
  tienen permiso** o **a unos usuarios concretos**, y si se fuerza. Al jugador se le abre la hoja de la entrada (en una
  página concreta si era una página). Si no se fuerza, solo se abre a quien ya la puede ver; si se fuerza, su navegador
  se da a sí mismo permiso de observador **solo en su copia local**, sin cambiar el permiso guardado (al recargar, ya
  no la ve).
- **Imágenes** [código]: cualquier imagen ampliada (el retrato de una ficha, una página de imagen, un tile) tiene
  «mostrar a jugadores», a todos o a unos usuarios: se abre una ventana flotante con la imagen, su título (si se
  quiere) y un pie.
- El servidor manda estos avisos solo a los sockets elegidos (o a todos menos al emisor), **sin comprobar quién los
  manda**: Ana, jugadora, forzó abrir un diario a Bruno y le enseñó una imagen a todos [observado].
- No hay «pantalla de tele» en el núcleo: lo más parecido es un usuario más conectado en otra pantalla.

### 4. Movimiento de los jugadores

- **Qué ficha mueve** [código]: la de un actor del que es **propietario** (o una ficha sin actor, si es máster). El
  máster asigna la propiedad por actor; el personaje asignado al usuario es aparte (sirve para hablar y para la hoja).
- **Muros** [código]: el navegador del jugador recorta el movimiento contra los muros que bloquean el movimiento; solo el
  máster puede activar «movimiento sin restricciones». El servidor no tiene geometría y no lo comprueba (ya visto en
  `vision-muros-y-niebla.md`). Una ficha oculta no la mueve un jugador; una bloqueada, nadie.
- **Puertas**: las abre y cierra cualquier jugador con la capacidad de abrir puertas, si no están cerradas con llave;
  ver `vision-muros-y-niebla.md` § 1. Con pausa, no (en su navegador).
- **Fuera de su turno** [código]: el núcleo **no limita** moverse fuera del turno en combate, ni dnd5e. Lo hacen módulos
  de la comunidad (bloquear el movimiento salvo en tu turno, o según la distancia de movimiento) [inferido: no
  instalados aquí].
- **Pasar turno** [código, observado]: en su turno, el jugador dueño del combatiente ve en el registro de combate los
  botones de turno anterior, **terminar turno** y siguiente. Pero la regla del servidor deja a **cualquier jugador**
  cambiar la ronda y el turno: Ana, sin combatientes, adelantó el turno de un combate ajeno [observado]. Al llegar tu
  turno suena el aviso «te toca» y, al siguiente, «vas después».

## Compromisos y límites

- **Todo en el cliente**: pausa, echar, susurros, «mostrar a jugadores», burbujas, señales, pasar turno y choques con
  muros se hacen cumplir (o se esconden) en el navegador. Entre amigos funciona y es muy simple; ante un jugador con las
  herramientas del navegador, no hay nada.
- **El máster no ve los susurros entre jugadores** en su chat, aunque estén en su navegador: ni control ni registro.
- **Modos de mensaje en un ajuste del usuario**: el mismo selector vale para escribir y para tirar, y es fácil dejarse
  puesto «a ciegas» o «solo para mí».
- **Registro sin fin**: todos los mensajes viajan a cada navegador al entrar; vaciar es la única limpieza.
- **Pausa volátil**: no sobrevive a un reinicio y siempre arranca puesta.
- **Echar sin cortar**: el servidor sigue aceptando a un vetado mientras tenga el socket abierto.

## Qué nos llevamos a Crisol

- **Un solo registro de la partida** para mensajes, tiradas y lo enseñado, con la visibilidad como dato del mensaje
  (todos, máster, a ciegas, solo yo, unos destinatarios) y **proyectado en el servidor**: a cada uno le llega solo lo
  suyo, también al exportar. El máster ve los susurros entre jugadores marcados como tales (lo pidió Enrique), cosa que
  Foundry no hace.
- **El modo, por mensaje y visible**: un selector junto al cuadro de texto que vuelve a «todos» tras un susurro, en vez
  de un ajuste que se queda puesto. Destinatarios con fichas o nombres pulsables, no solo con `/w`.
- **Quién habla**: el personaje por defecto en la mesa, el usuario fuera de personaje; el autor siempre lo pone el
  servidor (como ellos), y el hablante también, comprobando que el personaje es suyo o asignado.
- **Paginación de verdad**: el registro pide páginas al servidor (por la hora) y no viaja entero al entrar.
- **Comandos** útiles y cortos (`/w`, `/r`, `/me`) como atajo, pero en español y con la interfaz como camino principal.
- **Avisos**: tarjeta flotante breve y un punto en el chat; en móvil, un aviso discreto.
- **Burbujas** sobre la ficha para lo dicho en personaje, en la tele también: encaja con la mesa presencial.
- **Presencia del servidor**: conectados, escena que mira cada uno (solo para el máster), color; señales y «traer a mi
  vista» del máster.
- **La pausa, en el servidor y guardada**: bloquea mover fichas, abrir puertas y colocar cosas en la API, no solo en la
  interfaz, y se ve igual en la tele y en los móviles.
- **Echar corta la conexión** en el servidor y, si se quiere, cambia el enlace de la campaña para que no vuelva.
- **Enseñar a uno, a varios, a todos o a la tele**, comprobando en el servidor que lo manda el máster; y si enseñar una
  página da permiso, que lo dé de verdad (y quede apuntado) o que sea una vista de solo una vez, pero no un permiso que
  solo existe en el navegador.
- **Modo de movimiento** (libre, en su turno, bloqueado) y pasar turno, **validados en el servidor**: en «en su turno»
  solo el dueño del combatiente activo mueve y solo él pasa su turno. Los muros también los comprueba el servidor.
