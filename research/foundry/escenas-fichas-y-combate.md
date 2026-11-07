# Escenas, rejilla, fichas, combate, plantillas, regla y escenas en un zip en Foundry VTT (dnd5e)

Módulo de Crisol: 6. Mesa · Fecha: 2026-11-07 · Versión estudiada: Foundry VTT 14.369 y dnd5e 6.0.6

## Pregunta

En la entrevista del módulo 6, Enrique pidió que en combate la mesa sea el centro, «como en foundry o dndbeyond»: la
ficha es el personaje o la criatura en juego, al pulsarla se abre su hoja, el daño baja su barra, la iniciativa lleva
los turnos y un encuentro pone sus criaturas en juego. La escena es del mundo y cada campaña tiene su estado encima. Y
quiere traer las escenas de un zip de Foundry. Queríamos saber:

1. **La escena**: qué guarda, qué es preparación y qué es estado de partida; escena activa y vista; navegación y
   miniatura.
2. **La rejilla**: cuadrada, hexagonal y sin rejilla; reglas de diagonales; cómo se ajusta una ficha según su tamaño.
3. **Las fichas**: enlazada o no y su «delta»; tamaño, barras, nombre, disposición, oculta, elevación; estados con
   duración y su caducidad; objetivos.
4. **El combate**: combate y combatiente, iniciativa (la fórmula de dnd5e), rondas y turnos, derrotados, grupos, y
   cómo se enlaza con las fichas y con la caducidad de los efectos.
5. **Plantillas de área y regla de medir**: tipos, cómo se colocan desde un conjuro en dnd5e, qué abarcan, si pasaron a
   ser regiones; la regla con puntos intermedios, el arrastre midiendo, el historial y el coste del terreno.
6. **Escenas en un zip**: formato en disco de los paquetes de escenas y de aventuras, referencias a imágenes y actores,
   qué pasa con los ids, miniaturas, y qué se reaprovecha del importador de Crisol.
7. **Lo que no tiene el núcleo** (encuentros con formación, instantáneas).
8. **Una propuesta para Crisol.**

La visión, los muros, las luces y la niebla son de otro estudio de este módulo: aquí solo se nombran donde tocan.
Lo que ve un jugador de un PNJ (modos de nombre y barras, registro de combate, «malherido») ya está en
`visibilidad-y-revelar.md` § 3; las fichas enlazadas y no enlazadas y el encuentro de dnd5e, en
`criaturas-y-capas.md` § 2 y § 4; los documentos incrustados y las referencias, en `tipos-de-documento.md`.

## Lo que hacen

### Cómo se estudió

- Se leyó el código instalado (va sin minimizar): los documentos comunes de escena, nivel, ficha, delta de actor,
  efecto, combate, combatiente, grupo de combatientes, región y aventura; la rejilla cuadrada, hexagonal y sin rejilla;
  la ficha del cliente (movimiento, regiones, barras), el combate del cliente y su registro de caducidad de efectos;
  la regla; las capas de plantillas y regiones; el importador de aventuras; y las migraciones de escena del servidor.
  De dnd5e se restauraron sus fuentes desde su mapa de fuentes (MIT) y se leyeron su combate, su combatiente, su
  colocación de plantillas y de fichas, su regla, sus comportamientos de región, su encuentro y sus ajustes.
- Se observó la instancia en marcha con un script propio de Node y el cliente de socket.io de la instalación (MIT),
  entrando como el máster (el servidor admite varias conexiones del mismo usuario, así que no se echó a nadie). Se
  crearon dos compendios del mundo con una escena moderna, una con la forma antigua y una aventura, y se leyeron sus
  bases LevelDB copiadas fuera (lista de datos al final). También se leyó la base de escenas del mundo.
- La sesión de craft-anything la tenía abierta el otro estudio sobre el lienzo; para no pisar su memoria, aquí se leyó
  el código directamente.
- No hay en la instalación ninguna escena publicada (no hay módulos ni aventuras; dnd5e no trae escenas): las formas
  reales salen de las escenas de prueba.

Marcas: **[código]** leído en el código; **[observado]** visto en la instancia o en sus datos; **[inferido]**.

### 1. La escena

**Qué guarda** [código]:

| Grupo | Qué |
| --- | --- |
| Lienzo | Ancho y alto en píxeles (los de la imagen), un margen alrededor (fracción de 0 a 0,5 que se redondea a casillas enteras) y un desplazamiento del fondo |
| Rejilla | Tipo, tamaño en píxeles (mínimo 20), distancia de una casilla y su unidad (de serie, las del sistema: en dnd5e, 5 pies), y su estilo, grosor, color y opacidad. La regla de diagonales **no es de la escena sino un ajuste del mundo** |
| Niveles (nuevo en v14) | Cada escena tiene uno o más niveles (plantas): cada uno con su fondo (imagen, color de relleno), su primer plano (el techo), su imagen de niebla, su ajuste de texturas y su franja de elevación. El fondo y el primer plano de antes de v14 pasaron a vivir en el primer nivel |
| Vista inicial | Un punto y un zoom donde se abre; si falta, centrada |
| Ambiente | Oscuridad, luz global, colores de día y de noche, si las fichas tienen visión, el modo de niebla (desactivada, por usuario o compartida) y sus colores. Lo estudia la otra nota |
| Lo de dentro | Fichas, muros, luces, sonidos, notas (pines), tiles (imágenes puestas encima), dibujos, regiones y niveles, cada uno un documento incrustado con su id |
| Enlaces | Un diario y una de sus páginas, una lista de música y una pista, el clima |
| Navegación | Si sale en la barra de escenas, su orden, un nombre para los jugadores, si es la activa, la miniatura, carpeta y permisos |

- **Coordenadas** [código]: todo lo de dentro (fichas, muros, notas…) va en píxeles del lienzo entero, **con el
  margen incluido**. Para pasarlo a coordenadas de la imagen hay que restar el margen (redondeado a casillas) y el
  desplazamiento del fondo.
- **Preparación y estado, mezclados** [código, observado]: no hay separación. En la misma escena conviven lo preparado
  (fondo, rejilla, muros, luces, notas, tiles) y lo que cambia jugando: dónde está cada ficha y si está oculta, sus PG
  si no está enlazada (en su delta), si cada puerta está abierta, cerrada o con llave (un campo del muro), las luces
  encendidas o apagadas (su «oculta»), la oscuridad, los dibujos y plantillas que se dejan, el historial de movimiento
  de cada ficha y la fecha del último «reiniciar niebla». La niebla explorada va aparte, en un documento por usuario y
  escena; el combate, en su propio documento enlazado a la escena. Para jugar la misma escena con dos grupos hay que
  duplicarla.
- **Activa frente a vista** [código]: la activa es una por mundo (al activar una se desactivan las demás, en el
  servidor) y es a la que van los jugadores; el máster puede estar viendo otra, cada usuario ve la suya, y el máster
  puede «traer» a los jugadores a la que quiera. La barra de navegación lista las que tienen la marca de navegación,
  en su orden, con el nombre alternativo para los jugadores.
- **Miniatura** [código]: la genera **el navegador del máster** pintando el fondo y los tiles visibles en una imagen
  pequeña (por defecto 300×100, webp) y subiéndola como archivo; sin lienzo o sin permiso para subir, no hay
  miniatura. En los paquetes viaja como una ruta más.
- **Duplicar una escena** la deja inactiva y fuera de la navegación [código].

### 2. La rejilla

- **Tipos** [código]: sin rejilla; cuadrada; y cuatro hexagonales: por filas (hexágonos con punta arriba) con las filas
  impares o las pares desplazadas, y por columnas (con lado arriba) con las columnas impares o pares desplazadas. En
  hexágonos el tamaño es la distancia entre lados paralelos y la otra medida sale 2/√3 veces mayor. Las escenas
  hexagonales de antes de v10 llevan una marca de «hexágono antiguo» que cambia el tamaño.
- **Diagonales** [código]: un ajuste del mundo, con su valor por defecto del sistema (dnd5e no lo fija, así que queda
  en «todas iguales») y que pide recargar. Siete reglas:

  | Regla | Cuánto cuesta una diagonal |
  | --- | --- |
  | Equidistante | Como una recta (1) |
  | Exacta | √2 |
  | Aproximada | 1,5 |
  | Rectilínea | 2 (se cuenta como dos pasos rectos) |
  | Alterna 1-2 | La primera 1, la segunda 2… (el 5-10-5 de la variante de 5e) |
  | Alterna 2-1 | La primera 2, la segunda 1… |
  | Prohibida | No se puede ir en diagonal |

  En cuadrada vale también en 3D (cambiar de elevación cuenta como otra dimensión, con su propio peso). En hexágonos,
  donde no hay diagonales en el plano, solo cuenta al moverse a la vez en el plano y en elevación.
- **Sin rejilla**, la distancia es la de la recta y nada se ajusta [código].
- **Ajuste de una ficha** [código]: el tamaño se redondea a medias casillas.
  - En cuadrada, una ficha de tamaño entero se pega a los vértices (su esquina en un cruce de líneas); una de tamaño
    con media (1,5) se pega también a centros y mitades de lado; las diminutas (media casilla) se pegan a una
    subrejilla de cuartos, de modo que caben cuatro en una casilla. La elevación se redondea a múltiplos de la
    distancia de la casilla.
  - En hexágonos, cada combinación de ancho, alto y forma tiene un dibujo de hexágonos (forma de elipse, de trapecio o
    de rectángulo, dos variantes de cada una, según hacia dónde crece) con un punto de anclaje que se pega al centro de
    un hexágono. Las fichas nuevas en una escena hexagonal nacen con la elipse; si la combinación no tiene dibujo, se
    ajusta como un rectángulo a centros, vértices y lados.
  - Las casillas que ocupa una ficha salen de esa misma cuenta, y sirven para medir, para las regiones y para la
    visión.

### 3. Las fichas

- **Qué guarda una ficha** [código, observado]: su nombre propio y cuándo se ve; el actor al que apunta por su id; si
  está enlazada; su delta; posición, elevación, ancho y alto en casillas, profundidad (v14, para 3D), forma y nivel;
  imagen (que admite comodín para elegir una al azar), rotación, opacidad; oculta, bloqueada; disposición; cuándo se
  ven las barras y qué atributo sigue cada una (dos); luz y visión propias; el anillo dinámico; el marcador de turno;
  su forma de moverse (andar, volar, nadar, excavar, trepar, arrastrarse, saltar, teletransporte); el historial de
  movimiento y las regiones en las que está.
- **Enlazada o no** (ver `criaturas-y-capas.md` § 2) [código, observado]: la enlazada es el actor del mundo y no
  guarda delta (al crear una escena el servidor se lo borra si lo trae). La no enlazada guarda en su delta solo lo que
  cambia frente al actor: en la prueba, los PG que bajan y el efecto «Apresado»; en «Vis Mapa», el estado «Bloodied»
  del goblin. La ficha prototipo del actor dice cómo nace cada ficha (enlazada o no, tamaño, barras, disposición, si
  numera las copias o les pone un adjetivo al azar). En dnd5e los personajes nacen enlazados y amistosos; los PNJ, sin
  enlazar; y el tamaño de la criatura fija el de la ficha (diminuta, media casilla; pequeña y mediana, una; grande,
  dos; enorme, tres; gargantuesca, cuatro).
  - **Frente a Crisol**: la «única» del módulo 4 es la enlazada sin el riesgo de compartir estado entre dos fichas, y
    la «genérica» es la no enlazada, pero con su estado en la campaña y no en la ficha; así borrar la ficha no borra
    sus PG.
- **Barras** [código]: cada una sigue una ruta de los datos del actor (en dnd5e, la primera son los PG). Si es un par
  valor/máximo, se pinta como barra; si es un número suelto, como valor. Se cambia desde el menú de la ficha. Cuándo
  se ven, seis modos: nunca, al controlarla, al pasar el ratón si eres dueño, al pasar el ratón cualquiera, siempre
  para el dueño y siempre para todos. El nombre tiene los mismos seis modos.
- **Disposición** [código]: hostil (borde rojo, la de serie), neutral (amarillo), amistosa (azul) y secreta (sin borde
  ni información para quien no es dueño).
- **Oculta**: solo la ve el máster. **Elevación**: un número en las unidades de la rejilla que se ve en la ficha; en
  v14 se suma la profundidad y el nivel [código].
- **Estados y efectos** [código, observado]: un estado es un efecto activo sobre el actor (o sobre el delta de la
  ficha no enlazada) que lleva una o varias marcas de estado. El menú de la ficha enciende y apaga los estados que
  define el sistema (en dnd5e, sus condiciones más «malherido», concentración y otros); «muerto» puede ponerse como
  icono grande encima.
  - **Duración** (rehecha en v14): un valor y una unidad (años, meses, días, horas, minutos, segundos, **rondas** o
    **turnos**) y un **momento de caducar**: al empezar o acabar el combate, la ronda o el turno (por defecto, al
    empezar un turno si tiene valor). Al crearse en un actor durante un combate, guarda su inicio: combate,
    combatiente, ronda, turno, iniciativa y hora del mundo. Fuera de combate, las rondas se convierten en tiempo (en
    dnd5e, seis segundos por ronda) y avanzar la hora las consume. En la prueba, un efecto de 3 rondas creado sin
    combate quedó sin inicio y con caducidad «al empezar el turno» [observado].
  - **Quién lo hace caducar**: un registro en el navegador del **máster activo** revisa los efectos en cada inicio y
    fin de turno, de ronda y de combate y al avanzar la hora; los que llegan a cero en su momento se marcan como
    caducados (no se borran: es configurable) y dejan de aplicarse. «Al empezar el turno» se refiere al turno de quien
    lleva el efecto.
  - **dnd5e** añade caducar en un descanso corto o largo, y al empezar o acabar **el turno de quien lo lanzó** o el de
    quien lo recibe (el «hasta el final de tu próximo turno» de 5e). Cuando un combatiente sale del combate, borra sus
    efectos caducados y los que dependían de ese combate.
- **Objetivos** [código]: cada usuario marca los suyos (clic en el menú, o una tecla sobre la ficha; con Mayús, se
  suman); no se guardan, se difunden a los demás conectados y se pierden al cambiar de escena. dnd5e los usa para
  aplicar daño desde la tarjeta del chat y para elegir a los acertados o fallados de un ataque.

### 4. El combate

- **Documentos** [código, observado]: el combate es un documento del mundo, enlazado a una escena (o a ninguna: sale
  en todas), con su ronda, su turno, si es el activo, sus combatientes y, en v14, sus **grupos de combatientes**. Puede
  haber varios preparados a la vez. Cada combatiente apunta a un actor, una ficha y una escena, y lleva su iniciativa,
  oculto, derrotado, su grupo y la ronda en que entró (nuevo en v14, para las duraciones).
- **Con las fichas** [código]: se meten desde el menú de la ficha o desde una selección; al borrar una ficha se borra
  su combatiente (o se recoloca si la ficha se sustituye). El combatiente lee nombre, imagen y PG de su ficha y su
  actor. Una ficha en combate pinta el marcador de turno cuando le toca.
- **Iniciativa** [código]: en el núcleo, una fórmula del sistema tirada con los datos del actor, una tirada por
  combatiente, al chat y en privado si el combatiente está oculto; «tirar todos» y «tirar PNJ» tiran a los que no
  tienen. En dnd5e la tirada es la de iniciativa de la hoja: d20 más el modificador de iniciativa (y competencia o
  bonos), con ventaja o desventaja por estados, y dos ajustes del mundo: sumar la Destreza dividida entre cien para
  desempatar (no, de serie) e iniciativa fija (10 más el modificador) para los PNJ o para todos (no, de serie).
- **Orden** [código]: de mayor a menor iniciativa; en el núcleo, el empate se resuelve por id (al azar en la práctica).
  dnd5e desempata por el actor de origen y luego por el nombre, así las copias de la misma criatura quedan juntas.
- **Grupos** [código]:
  - En el núcleo de v14, un grupo es un documento dentro del combate con nombre, imagen e iniciativa propia; sus
    miembros toman la iniciativa del grupo (actúan juntos), y el grupo cuenta como oculto o derrotado si lo están
    todos.
  - dnd5e, además, agrupa al vuelo en el registro (plegables) las fichas no enlazadas de un mismo actor, misma
    disposición y misma iniciativa (ajuste, sí de serie), y antes de empezar tira **una sola iniciativa para todas las
    copias** de un mismo actor (otro ajuste, sí de serie).
- **Rondas y turnos** [código]: empezar pone ronda 1 y turno 0; «siguiente turno» pasa al siguiente (o a la ronda
  siguiente) y avanza la hora del mundo (seis segundos por ronda en dnd5e); se puede volver atrás. **Saltar
  derrotados** es un ajuste del registro (no, de serie): derrotado es la marca del combatiente o el estado «muerto» de
  su actor; marcarlo en el registro pone también ese estado en la ficha. dnd5e puede poner solo «muerto» o
  «inconsciente» al llegar a 0 PG (ajuste: nunca, de serie).
- **Eventos de turno** [código]: solo el navegador del **máster activo** dispara, por este orden, fin de turno, fin de
  ronda, inicio de ronda e inicio de turno (también los de los turnos saltados, marcados como saltados). De ahí cuelgan
  la caducidad de los efectos, borrar el historial de movimiento de las fichas al empezar cada turno, los eventos de
  las regiones en las que está la ficha y, en dnd5e, **recuperar usos por periodo** (al empezar el combate, al tirar
  iniciativa, al empezar la ronda, al empezar o acabar el turno de cada criatura: recargas, acciones legendarias…), con
  un mensaje privado al dueño con lo recuperado. Si no hay máster conectado, nada de esto pasa.
- **Acabar** [código]: borra el combate tras confirmar; no quita fichas ni actores. dnd5e, al acabar, recupera los
  usos que se recuperan por turno.
- **Qué ve un jugador** de los PNJ en el registro: ver `visibilidad-y-revelar.md` § 3. Los combatientes ocultos no le
  salen y su iniciativa se tira en privado [código].
- **El ajuste del registro** guarda qué recurso enseña (en el mundo de pruebas, los PG), saltar derrotados y el
  marcador de turno [observado].

### 5. Plantillas de área y regla de medir

- **En v14 las plantillas son regiones** [código, observado]: el documento de plantilla medida quedó obsoleto (se
  mantiene una capa de compatibilidad hasta v16) y una plantilla es ahora una región con una marca de «plantilla
  medida», que enseña sus medidas y se resalta por casillas cubiertas.
  - Una región tiene una o varias formas (rectángulo, círculo, elipse, cono, anillo, línea, polígono, la silueta de
    una ficha, unas casillas sueltas y la **emanación**, que rodea otra forma a una distancia), cada una con la opción
    de **ajustarse a la rejilla** (se mide con la regla de diagonales: un círculo en «equidistante» sale cuadrado) y
    de ser un agujero.
  - Además: franja de elevación, niveles, si su forma **se recorta con los muros** de un tipo (movimiento, vista, luz,
    oscuridad o sonido) vistos desde su origen, como un conjuro que no atraviesa paredes (el recorte lo calcula un
    navegador y lo guarda), si va **pegada a una ficha** (la sigue), comportamientos, visibilidad (siempre, para el
    máster, para quien la puede ver, o solo en su capa), oculta, bloqueada y permisos.
  - El cono puede ser redondeado, plano o semicírculo.
- **Migración** [código]: el servidor convierte las plantillas antiguas en regiones: el círculo en círculo, el cono en
  cono (con el ángulo de la plantilla, 90° si no tenía), el rayo en línea con su anchura, y el rectángulo (que se daba
  por su diagonal) en un rectángulo con giro a múltiplos de 90°. Las ocultas pasan a «solo quien la puede ver».
- **Desde un conjuro en dnd5e** [código]: el objetivo de una actividad declara un tipo de área: círculo, cono, cubo,
  cilindro, línea, emanación, anillo, esfera, cuadrado o muro, con sus medidas. Al usarla se coloca con el ratón (se
  mueve, se gira con la rueda y se confirma con clic) y se crea una región con el nombre del objeto y del usuario, de
  su color, visible para todos, **recortada por los muros que cortan el movimiento** (dnd5e duda en sus comentarios
  si es lo adecuado para áreas que rodean paredes), pegada a la ficha si el área es una emanación que no es fija, y con el origen anotado (actividad, objeto, ficha, nivel del conjuro). El cono de 5e lleva 53,13°; los
  cuadrados no giran (ajuste, sí de serie). La actividad puede añadirle comportamientos (aplicar un efecto a quien
  entra, terreno difícil, girar a quien está dentro).
- **Qué abarca** [código]: una ficha está dentro si alguno de sus puntos de prueba cae dentro de la región (una ficha
  de una casilla, su centro; una mayor, el centro de cada casilla que ocupa y el suyo). Las regiones guardan qué
  fichas tienen dentro y avisan al entrar y salir. **dnd5e no apunta solo a las fichas de dentro**: el daño se aplica
  a los objetivos o a las fichas elegidas.
- **La regla** [código]: cualquier usuario mide arrastrando; con clic añade puntos intermedios y con clic derecho
  quita el último; puede cambiar la elevación del destino; enseña la distancia de cada tramo y la total y resalta las
  casillas; se difunde a los demás salvo que se oculte.
- **Arrastrar una ficha** [código]: dibuja su camino previsto (los demás lo ven si no está oculto), con puntos
  intermedios, el coste y la elevación en cada uno, y busca un camino que rodee los muros. En dnd5e el trazo se
  **colorea por la velocidad** de la acción elegida: dentro de la velocidad, hasta el doble (correr) y más allá.
- **Historial de movimiento** [código]: solo se graba **en un combate empezado**; se borra al empezar cada turno y al
  salir del combate; se ve en la regla como camino ya recorrido y se puede deshacer el último movimiento (o todos).
- **Coste del terreno** [código]: un comportamiento de región del núcleo multiplica el coste por acción de movimiento
  (de 0 a 5, en cuartos; el salto toma el mayor de andar y volar); dnd5e tiene su propio terreno difícil con tipos y
  disposiciones que lo ignoran. La regla suma esos costes y los enseña junto a la distancia.

### 6. Escenas en un zip

- **Dónde vienen** [código, observado]: en el zip de un **módulo** (su manifiesto declara paquetes de tipo Escena,
  Aventura, Actor, Diario…) o en el de un **mundo** (con su manifiesto de mundo y una base por colección). Desde v11
  cada paquete es una carpeta LevelDB; antes, un archivo NeDB (una línea JSON por documento).
- **Un paquete de escenas** [observado]: cada escena es una entrada, y cada cosa de dentro, otra, con la colección y
  los ids encadenados: las fichas, muros, luces, notas, tiles, dibujos, sonidos, regiones y niveles a un nivel; los
  **comportamientos de una región, el delta de una ficha y los efectos de ese delta, a dos y tres niveles**. El delta
  es único (la ficha guarda su id, no una lista). La escena lista los ids de lo suyo en orden. La base de escenas de
  un mundo tiene la misma forma.
- **Un paquete de aventuras** [observado]: cada aventura es **una sola entrada con todo dentro**: nombre, imagen,
  subtítulo y descripción, y listas de escenas (con sus fichas, muros y demás anidados), actores, objetos, diarios,
  tablas, macros, cartas, listas de música, combates y carpetas. La de prueba, con una escena, dos actores y un diario,
  ocupaba 16 KB.
- **Importar una aventura** [código]: crea lo que no existe y **sobrescribe lo que ya existe con el mismo id** (avisa
  antes), siempre **conservando los ids**; así las fichas encuentran a sus actores, las notas a sus diarios y los
  combates a sus fichas. Deja anotado que se importó, con qué versiones, para poder reimportarla. Una aventura de un
  paquete que no es de un sistema descarta sus actores y objetos.
- **Importar una escena suelta** de un compendio le da un id nuevo (salvo «conservar ids» al importar todo) [código]:
  sus fichas siguen apuntando al id de un actor del mundo donde se hizo; si ese actor no existe, la ficha no tiene
  hoja, y una no enlazada pierde todo menos su delta. Por eso los módulos de aventuras usan el documento Aventura.
- **Imágenes** [código]: rutas relativas a la carpeta de datos: las del propio módulo (dentro del zip), las del mundo,
  las del sistema, los iconos de serie de Foundry (que no vienen en el zip) o cualquier carpeta del usuario (tampoco).
  Fondos y techos van en los niveles; además tiles, fichas (con comodín), notas, sonidos y la miniatura.
- **Versiones** [código, observado]: el servidor migra los documentos guardados con una versión anterior al abrir un
  compendio o un mundo, o al importar un archivo: de v10 los campos sueltos de rejilla y el fondo como imagen, los
  tiles «por encima», la niebla y la luz global (v12), las formas de las fichas en hexágonos (v13), las plantillas a
  regiones y el fondo a niveles (v14). **Crear una escena con la forma antigua por el API no la migra**: la escena «Mesa
  Zip Antigua» perdió su fondo, su techo y sus tres plantillas, y se quedó sin nivel [observado]. Un zip hecho para v12
  trae sus escenas con la forma de v12.
- **Tamaños** [observado, en lo creado aquí]: la escena de prueba (3 muros, 1 luz, 2 fichas, 2 regiones, 1 tile, 1
  dibujo, 1 nota y 1 sonido) son 17 entradas en LevelDB. Una ficha completa ronda 1,3 KB; un muro, 230 bytes; una
  luz, 430; una región, 560; la escena sin lo de dentro, 1,7 KB. La
  escena de prueba del otro estudio («Mesa Cripta») lleva 19 muros, 4 luces y 5 fichas. Una mazmorra publicada suele
  llevar centenares de muros y mapas de varios megas [sin comprobar].

### 7. Lo que no tiene el núcleo

- **Encuentros guardados con su formación** [código]: no hay. Lo más parecido es preparar en la escena las fichas
  ocultas y un combate sin empezar con ellas (un paquete de aventura puede traer esos combates). El encuentro de dnd5e
  (ver `criaturas-y-capas.md` § 4) guarda miembros y cantidades (o fórmulas), **no posiciones**: al colocarlo se pone
  cada ficha a mano, una a una, con el ratón (clic para confirmar, clic derecho para saltar), se numeran las copias y,
  según un ajuste, se meten en el combate y se tira su iniciativa.
- **Instantáneas de la escena** [código]: no hay. Solo «deshacer» los últimos cambios de cada capa en el navegador
  (unos pocos pasos), duplicar la escena, reiniciar la niebla y deshacer movimientos grabados en combate.
- **Quitar las criaturas al acabar** [código]: tampoco. Al borrar el combate las fichas se quedan; los PNJ muertos
  siguen en el mapa con su icono hasta que se borran a mano.

## Compromisos y límites

- **Todo en la escena**: es sencillo de guardar y de exportar (una aventura es un único bloque), pero preparación y
  partida van juntas. No hay manera de jugar la misma escena con dos grupos sin duplicarla, ni de volver a dejarla
  como estaba salvo reimportándola (y eso sobrescribe por id).
- **La lógica de la partida vive en el navegador del máster**: los eventos de turno, la caducidad, las recargas y la
  miniatura dependen de que el máster activo esté conectado. El servidor solo guarda. Para una segunda ventana en la
  tele o para la IA, eso no sirve.
- **El estado de las copias, en la ficha**: borrar una ficha no enlazada borra sus PG y sus estados.
- **La regla de diagonales es del mundo**, no de la escena ni del sistema por campaña, y cambiarla pide recargar.
- **Las plantillas como regiones** ganan mucho (siguen a una ficha, se recortan con los muros, aplican efectos, se
  ajustan a la rejilla), pero la plantilla sencilla de «dejar un cono en el mapa» ahora es una región con muchas
  opciones.
- **dnd5e no apunta solo** a lo que abarca una plantilla: el máster elige los objetivos a mano.
- **Ids conservados**: las aventuras funcionan porque los ids no cambian; la contrapartida es que reimportar
  sobrescribe y que dos aventuras con el mismo id chocarían.
- **Zips grandes y con referencias fuera**: las imágenes pueden estar fuera del zip (iconos de serie, carpetas del
  usuario, otros módulos de mapas) y las escenas de versiones viejas necesitan migrarse.
- **Formación**: nada en el núcleo ni en dnd5e; colocar un encuentro es ficha a ficha.

## Qué nos llevamos a Crisol

### Modelo: la escena del mundo y el estado de cada campaña

| Del mundo (preparación) | De la campaña (partida) |
| --- | --- |
| La escena: nombre, la página del lugar a la que se engancha (una pestaña «Escena» en esa página, como el mapa de ADR-0007), la imagen (un archivo del mundo) y su techo, medidas, rejilla (tipo, tamaño, unidad y distancia), la regla de diagonales (de serie la del sistema, cambiable por escena), la vista inicial y la miniatura (hecha en el servidor) | Qué escena tiene abierta la campaña y qué enseña la tele (encuadre incluido) |
| Muros, puertas (su tipo), luces, tiles, pines a páginas y terrenos (la otra nota) | Puertas abiertas, cerradas o con llave; luces encendidas; oscuridad; niebla explorada |
| **Colocaciones preparadas**: quién está en la escena antes de jugar (una entrada del compendio del mundo o del sistema como única o genérica, o el sitio de un personaje), con su posición, tamaño, oculta y disposición | **Fichas**: la presencia en la escena de un personaje o de una criatura en juego, con su posición, elevación, tamaño, forma, giro, oculta, disposición y modos de nombre y barras |
| **Encuentros guardados**: criaturas con cantidad o fórmula, únicas o genéricas, y su **formación** (posiciones relativas en casillas a un ancla, o fijas si están en una escena) | Plantillas y dibujos dejados, el combate, el historial de movimiento del turno, las instantáneas |

- Origen de lo importado en cada cosa (paquete, versión, id de Foundry), como hace hoy el contenido.
- Todo por `operation()` con historial y deshacer, como el resto.

### Ficha ↔ personaje o criatura en juego

- **La ficha no guarda PG ni estados**: los lee del personaje (módulo 3) o de la criatura en juego (`campaign_creatures`
  y su `play`). Así el daño aplicado desde el registro, desde la hoja o desde el mapa baja la barra en todas partes, y
  borrar una ficha no pierde nada. Es la mejora sobre el delta de Foundry.
- **Una única**, como mucho una ficha por escena de la campaña. **Una genérica**: cada copia numerada es su ficha.
  Arrastrar una entrada del compendio al mapa la pone en juego y crea su ficha a la vez (genérica por defecto; única
  si la entrada lo es).
- **Tamaño** de serie desde el sistema (un campo «tamaño» de la criatura con su número de casillas: en el 5e de
  ejemplo, ½, 1, 2, 3, 4), cambiable en la ficha. En hexágonos, la forma elipse por defecto.
- **Al pulsarla**, su hoja (la del módulo 3 o 4) con sus tiradas; al arrastrarla, la regla.
- **Barras**: el sistema declara qué recurso es la barra principal (los PG) y la secundaria. Tres modos bastan para
  Crisol: nunca, al pasar el ratón y siempre; y para quién: el máster, el dueño o todos. En la tele, a las criaturas
  nunca les llegan números: su **estado en palabras** («Ilesa», «Herida», «Malherida», «Fuera de combate»), con
  umbrales del sistema (el 5e, malherida a la mitad).
- **Disposición** (amiga, neutral, hostil) como borde, y «secreta» para no dar nada a quien no es dueño.
- **Objetivos**: del máster (y luego de cada jugador), efímeros como en Foundry, para «aplicar a los objetivos» desde
  una tirada.

### Combate y caducidad, en el servidor

- **Un combate por campaña** (puede estar enlazado a una escena), con combatientes que apuntan a la ficha (y por ella
  al personaje o la criatura en juego), iniciativa, oculto, derrotado y grupo; ronda y turno. Se pueden preparar
  varios sin empezar.
- **Iniciativa**: el sistema declara su fórmula (en el 5e de ejemplo, la tirada de iniciativa de la hoja: d20 más su
  modificador, con ventaja o desventaja por estados) y el servidor la tira. Ajustes de la campaña: **una tirada para
  todas las copias** de una criatura (sí, como dnd5e), desempate por Destreza y valor fijo para las criaturas. Orden:
  mayor iniciativa; empate, por criatura y luego por nombre.
- **Grupos**: las copias de una criatura se pliegan juntas en la lista; un grupo con iniciativa propia actúa a la vez.
- **Los eventos de turno los da el servidor**, no el navegador del máster: al pasar turno, fin del turno anterior, fin
  e inicio de ronda si toca e inicio del siguiente (también los saltados), y de ellos cuelgan la caducidad, las
  recargas y las legendarias del módulo 4 (que hoy se pulsan a mano), el historial de movimiento y los avisos. Así
  funcionan igual con la tele, con el móvil o con la IA.
- **Estados con duración** en el `play` de personajes y criaturas: el estado (del sistema), quién lo puso, la duración
  (rondas, turnos, minutos, horas, días o «hasta un descanso») y cuándo caduca: al empezar o acabar el turno **de quien
  lo lleva o de quien lo puso**, al empezar o acabar la ronda, o al acabar el combate (lo de dnd5e, que es lo que pide
  5e). Al crearse en combate guarda su inicio (combate, ronda, turno). Al caducar, se quita y queda en el registro con
  deshacer (Foundry solo lo marca; dnd5e lo borra al salir del combate).
- **Saltar derrotados**, ajuste de la campaña (sí de serie en Crisol: en persona no se quiere pasar por los muertos).
- **Acabar el combate**: quita de juego las genéricas (las derrotadas o todas, a elegir en el aviso) con sus fichas;
  las únicas y los personajes se quedan. Lo pide Enrique y no lo tiene nadie.

### Plantillas y regla

- **Plantillas como objetos de la escena de la campaña**, no como regiones con todo: círculo (radio), cono (longitud y
  ángulo, 53,13° en el 5e), línea (longitud y anchura), cuadrado (lado, alineado a la rejilla) y, después, emanación
  pegada a una ficha y anillo. Se dejan en el mapa, se mueven, se giran y se borran; de serie las ve todo el mundo.
- **Qué abarcan**: las casillas cuyo centro cae dentro (con la regla de diagonales de la escena) y las fichas con
  alguno de sus puntos dentro, como Foundry; y, mejor que dnd5e, **«apuntar a las de dentro»** para aplicarles el daño
  con `applyRoll`.
- **Desde una acción con área**: la mecánica del contenido (ADR-0012) declara el área (tipo y medidas) y la hoja ofrece
  «Colocar plantilla» al tirarla.
- **Regla**: puntos intermedios, distancia por tramo y total, elevación; arrastrar una ficha enseña la regla, y en
  combate se colorea por su velocidad (la lee del sistema). Historial del turno con deshacer. El coste del terreno,
  después, con los terrenos de la otra nota.
- **Medición**: la de Foundry por rejilla (cuadrada con sus siete reglas, hexagonal por distancia de cubo, sin rejilla
  por recta) es pequeña y se puede rehacer en `packages/` con pruebas propias.

### Importar las escenas de un zip de Foundry

Se reaprovecha del importador de sistemas (`apps/server/src/foundry/read.ts`, `apps/web/src/systems/foundry-zip.ts`,
`packages/systems/src/foundry/`):

- Listar el zip sin descomprimir, sacar solo lo pedido con su tope, encontrar el manifiesto, localizar un paquete
  LevelDB o NeDB, leer LevelDB en una carpeta temporal y NeDB por líneas, y leer los idiomas.
- `convertFoundry` para los actores que nombran las fichas (van al compendio del mundo, módulo 4), con sus retratos y
  fichas del mapa de arte; `htmlToMarkdown` para los diarios a los que apuntan las notas.
- `zipPathOf`, `licenseOf` e `imagesFromZip` para sacar del zip los mapas, techos, tiles y fichas con su licencia y su
  crédito; `putSystemImages` como modelo de subida por tandas.

Falta:

- **Los tipos Escena y Aventura**: hoy los filtran `IMPORTED` (web) y `FOUNDRY_DOCUMENTS`; y el manifiesto de mundo.
- **Leer a más profundidad**: `assemble` solo junta un nivel; hacen falta dos y tres (comportamientos de región, delta
  de la ficha y sus efectos) y el delta como pieza única, no como lista. La aventura viene entera en una entrada: hay
  que repartir sus escenas, actores, diarios y combates.
- **Normalizar versiones**: de v10 a v14 (fondo suelto o en niveles, techo, plantillas o regiones, campos de niebla y
  de rejilla antiguos, hexágonos antiguos), porque crear con la forma antigua no la migra. Una escena con varios
  niveles, de momento, una escena por nivel.
- **Coordenadas**: restar el margen redondeado y el desplazamiento del fondo.
- **Ids**: Crisol no puede conservar los de Foundry; una tabla del importe que traduzca cada id (actor de una ficha,
  diario y página de una nota, ficha de un combatiente, ficha a la que va pegada una región) a lo nuevo, y el origen
  guardado para **reimportar** con aviso de qué cambia en lugar de sobrescribir.
- **Fichas** → colocaciones preparadas: la enlazada, a una única; la no enlazada, a una genérica (su nombre, oculta,
  tamaño, disposición y, si su delta cambia los PG, ese valor de partida); las de personajes, a sitios de personaje.
  Las fichas sin actor en el zip, a marcadores con su imagen.
- **Notas** a pines con su página; **plantillas** de la escena, fuera (son de partida); **terrenos** y regiones que
  bloquean, con la otra nota; **sonidos**, al módulo 7.
- **El tamaño**: los zips de aventuras pesan de cientos de megas a más de un giga; hoy `importFoundry` admite 30 MB y
  se descomprime todo en memoria. Hará falta leer el zip en el navegador por partes, subir solo lo que nombran las
  escenas elegidas (en tandas mayores que 6 MB, o por la subida de archivos) y convertir en segundo plano. Las imágenes
  que no vienen en el zip, con un icono propio; los mapas en vídeo (webm), como imagen fija o fuera.
- **Licencias**: los mapas de pago, solo para uso privado (ADR-0014), con su aviso y su entrada en `docs/terceros.md`.

### Qué haremos distinto

- Preparación del mundo y partida de cada campaña separadas: la misma cripta para dos grupos sin duplicar nada.
- La lógica de los turnos, la caducidad y las recargas en el servidor, para que la tele, el móvil y la IA vean lo
  mismo sin depender de un navegador.
- La ficha como presencia del personaje o la criatura en juego, sin estado propio.
- Encuentros con formación, instantáneas de la escena por campaña y quitar las genéricas al acabar, que no tiene nadie.
- Apuntar solo a las fichas de dentro de una plantilla.
- La regla de diagonales por escena (con la del sistema de serie), no por mundo.

## Sin comprobar

- No se jugó un combate en el navegador: la caducidad, las recargas de dnd5e, los grupos y el historial de movimiento
  salen del código.
- No se probó importar una aventura en la interfaz ni cómo queda una escena de un módulo de verdad (centenares de
  muros, mapas grandes, imágenes fuera del zip): no hay ninguno instalado.
- Que el servidor migre al abrir un paquete de un módulo viejo sale del código; solo se observó que crear con la forma
  antigua no migra.
- Cómo se ven en pantalla los grupos de combatientes del núcleo frente a los plegables de dnd5e.

## Datos de prueba creados

En el mundo `crisol-rea`, desde un script como el máster (2026-11-07), con el prefijo «Mesa Zip» para no confundirlos
con los del otro estudio («Mesa Cripta», «Mesa Jugadora», «Mesa Otro»):

- El compendio del mundo **«Mesa Zip Escenas»** (tipo Escena) con las escenas **«Mesa Zip Moderna»** (hexagonal, un
  nivel con fondo y techo, tres muros con una puerta y una puerta secreta, una luz, la ficha enlazada «Mesa Zip Jefe»
  y la no enlazada y oculta «Mesa Zip Goblin (1)» con PG y el efecto «Mesa Zip Apresado» de 3 rondas en su delta, las
  regiones «Mesa Zip Cono» como plantilla y «Mesa Zip Terreno» con coste ×2, un tile, un dibujo, una nota y un
  sonido; las imágenes apuntan a rutas inventadas) y **«Mesa Zip Antigua»** (creada con la forma de v13; quedó sin
  fondo, sin nivel y sin plantillas).
- El compendio del mundo **«Mesa Zip Aventuras»** (tipo Aventura) con la aventura **«Mesa Zip Aventura»** (la escena
  moderna, los actores «Mesa Zip Goblin» y «Mesa Zip Jefe», el diario «Mesa Zip Diario» y la carpeta «Mesa Zip
  Carpeta»).
- Nada en el mundo fuera de esos dos compendios.
