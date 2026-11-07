# Visión, muros, puertas, luces y niebla en Foundry VTT

Módulo de Crisol: 6. Mesa · Fecha: 2026-11-07 · Versión estudiada: Foundry VTT 14.369 y dnd5e 6.0.6

## Pregunta

Para la spec de la mesa, con lo que decidió Enrique en la entrevista (se juega sobre todo en persona, con una segunda
ventana en la tele que enseña la vista del grupo; niebla automática por lo que ven las fichas del grupo y niebla a
mano; la escena es del mundo y el estado, de cada campaña; el servidor filtra y a la tele no le llega nada que el
grupo no vea), queríamos saber:

1. **Muros y puertas**: tipos, restricciones, estados, y qué recibe un jugador de una puerta secreta.
2. **Línea de visión**: cómo se calcula lo visible, cuánto cuesta, cómo crece con los muros y las fichas, qué se
   guarda en memoria y cuándo se recalcula; y si nosotros podríamos calcularlo en el servidor.
3. **Luces y oscuridad**: qué tiene una luz, el nivel de oscuridad, la iluminación global, las fuentes de oscuridad y
   cómo se combina todo con la visión.
4. **Visión de las fichas**: alcance, modos, qué ve un jugador con varias fichas, qué ve el máster, cuándo se ve una
   ficha ajena y qué llega de las ocultas.
5. **Niebla explorada**: cómo se guarda, cómo se reinicia, si se comparte y qué hay para destapar a mano.
6. **Lo que llega por la red** de todo lo anterior.
7. **Compromisos** y una propuesta concreta para Crisol.

No se repite lo que ya está en `visibilidad-y-revelar.md` (pines, la opción «global» de los pines con niebla, PNJ
ocultos, combat tracker), `sincronizacion-e-historial.md` (el volcado completo al cargar, la difusión de cada cambio,
la presencia) ni `usuarios-y-permisos.md` (roles y niveles).

## Lo que hacen

Grado de certeza: **[código]** leído en el código instalado, **[observado]** comprobado en la instancia de estudio.

### Cómo se estudió

- Lectura del cliente instalado (percepción, fuentes de luz, visión y sonido, geometría, capas del lienzo, la niebla)
  y de los documentos comunes de muros, luces, fichas, escenas y niebla; del servidor, los módulos de la niebla, los
  muros y las fichas. Con craft-anything se mapeó la carpeta del lienzo (287 archivos) y se siguió el barrido.
- En el mundo `crisol-rea` se creó la escena «Mesa Cripta» (no se activó): tres salas, una puerta normal entre A y B,
  una puerta secreta entre B y C, un muro de cada clase especial (terreno, invisible, ventana, de un solo sentido y
  etéreo), cuatro luces (una antorcha, una oculta, una que da visión y una fuente de oscuridad), la escena a
  oscuridad 0,9 sin luz global, y cinco fichas: dos personajes de la jugadora «Mesa Jugadora» (uno sin visión en la
  oscuridad y otra con 60 pies), un goblin, un acechador oculto y un esqueleto tras la puerta secreta. Otro jugador,
  «Mesa Otro», sin fichas, para escuchar la red.
- La jugadora y el máster entraron con un Chromium 153 sin pantalla (WebGL por software) para ver qué fichas, puertas
  y puntos pintaba cada uno. Con un script propio de Node y el cliente de socket.io de la instalación (MIT), la
  jugadora y «Mesa Otro» entraron por la red para ver el volcado, abrir puertas y pedir la niebla.
- Para medir el barrido, en la escena vacía «Mesa Banco de pruebas» (60×60 casillas de 100 px) se metieron segmentos
  sintéticos **solo en la memoria de la pestaña del máster** (nada se guardó) y se cronometró el cálculo de polígonos.
  El VPS tiene 6 núcleos Intel Broadwell; el barrido es JavaScript puro (V8), así que la cifra vale para Node en la
  misma máquina.

### 1. Muros y puertas

Un muro es un segmento con **cuatro restricciones independientes**: luz, vista, sonido y movimiento [código]. Las tres
sensoriales admiten cinco valores (el movimiento, solo «no bloquea» y «bloquea»):

| Valor | Qué hace |
|---|---|
| Ninguna | No bloquea |
| Limitada («terreno») | El primer muro limitado que cruza un rayo no cuenta; el segundo sí bloquea (follaje, cortinas) |
| Normal | Bloquea |
| Por proximidad | Deja pasar si la fuente está a menos de una distancia umbral (ventanas) |
| Por distancia | Lo contrario: deja pasar si la fuente está más lejos del umbral |

Además, cada muro tiene **dirección** (los dos lados, o solo uno: un muro de un solo sentido deja ver desde un lado y
no desde el otro), umbrales por sentido en unidades de la rejilla, y una atenuación opcional de la luz que cruza un
umbral [código]. La herramienta de muros trae preajustes [código]:

| Preajuste | Luz | Vista | Sonido | Movimiento |
|---|---|---|---|---|
| Normal | bloquea | bloquea | bloquea | bloquea |
| Terreno | limitada | limitada | limitada | bloquea |
| Invisible | no | no | no | bloquea |
| Etéreo | bloquea | bloquea | no | no |
| Puerta / puerta secreta | bloquea | bloquea | bloquea | bloquea |
| Ventana | proximidad, 2 casillas, con atenuación | igual | bloquea | bloquea |

- **Puertas**: un muro puede ser puerta normal o secreta, con tres estados: cerrada, abierta y cerrada con llave. Una
  puerta abierta apaga todas sus restricciones (el segmento sigue, pero no bloquea nada) [código]. Puede llevar sonido
  de abrir y cerrar y, desde la v14, hojas con textura que giran o se deslizan al abrirse [código].
- **Quién abre**: el máster, todo. Un jugador solo puede cambiar el estado de una puerta que no esté cerrada con llave
  (ni ponerle ni quitarle la llave), y nada más del muro [código]. Con la partida en pausa, la interfaz no le deja.
- **El icono de la puerta**: la secreta solo le sale al máster; la normal le sale al jugador solo si el centro de la
  puerta está a la vista de sus fichas [código, observado]. El máster con una ficha seleccionada tampoco ve iconos
  fuera de la vista de esa ficha [observado].
- **La secreta solo es secreta en la interfaz**: la jugadora abrió y cerró la puerta secreta por la red, sin icono, y
  el servidor lo aceptó y se lo mandó a todos [observado]. La regla del servidor solo mira la llave, no el tipo.
- **El servidor no tiene geometría**: no comprueba que una ficha atraviese un muro; eso lo hace el cliente al mover
  [código]. Cualquier cliente puede mover una ficha a través de una pared por la red.
- Desde la v14, una escena puede tener varios **niveles** (plantas), y muros, luces y niebla van por nivel [código].

### 2. Línea de visión

**El modelo.** Todo lo que bloquea se convierte en «aristas»: los segmentos de los muros, los bordes de la escena y
los contornos de las fuentes de oscuridad. Se guardan por nivel en un mapa con un índice espacial en árbol cuaternario
(como mucho 100 por nodo y 6 niveles de profundidad). Los cruces entre aristas se precalculan (se ordenan por la x y
se prueban los pares que se solapan en x) y se rehacen, perezosamente, después de cualquier cambio [código].

**El cálculo.** Cada polígono sale de un **barrido angular** alrededor del origen [código]:

1. Se cogen las aristas candidatas: las que caen en la caja del polígono (el índice espacial) y pasan los filtros
   (bloquean ese sentido, no son colineales con el origen, el lado de un muro de un solo sentido, los umbrales de
   proximidad y la prioridad).
2. Sus extremos y sus cruces se convierten en vértices, que se ordenan por ángulo y, a igual ángulo, por distancia.
3. Se recorren en orden con un conjunto de aristas «activas» (las que cruza el rayo en ese ángulo): si el vértice
   queda detrás de una activa más cercana, se ignora; si no, se lanza un rayo hacia él para ver dónde choca, y los
   muros limitados necesitan dos choques.
4. Se recorta con las formas límite: el círculo del radio y el cono del ángulo.

El resultado es un polígono. El coste es el de ordenar los vértices más, por cada vértice, un repaso de las aristas
activas: casi lineal mientras un rayo cruce pocas paredes, y cuadrático en el peor caso.

**Cuántos barridos** [código]:

- **Uno por cada ficha que da visión, con el radio de toda la escena**, porque la percepción de la luz no tiene
  límite (se ve una antorcha lejana). Del mismo polígono salen, recortándolo con un círculo, el campo de visión (el
  alcance de su vista en la oscuridad) y la percepción de la luz: no hay segundo barrido. Al ser de toda la escena,
  **entran todas las aristas del mapa**.
- Uno por cada luz, con su radio (aquí el índice espacial sí reduce las aristas), uno por cada fuente de oscuridad y
  uno por cada sonido.
- Cada cliente calcula sus propias fichas y **todas** las luces. Con la niebla compartida, además, la visión de todas
  las fichas de los jugadores (punto 5).

**Lo que cuesta.** Mediana y p95 de un polígono de visión (radio de toda la escena) y de uno de luz de 600 px, con
calentamiento previo, 20 orígenes y 3 repeticiones [observado]:

| Mapa sintético (6.000×6.000 px) | Segmentos | Visión, mediana | Visión, p95 | Luz 600 px | Cruces al cambiar un muro |
|---|---|---|---|---|---|
| Cuevas irregulares | 250 | 1,2 ms | 1,7 ms | 0,2 ms | 1 ms |
| Mazmorra, paredes de un tramo por sala | 400 | 1,9 ms | 2,9 ms | 0,3 ms | 2 ms |
| Cuevas irregulares | 1.000 | 3,9 ms | 5,4 ms | 0,3 ms | 4 ms |
| Mazmorra, tramos de 100 px | 1.320 | 5,3 ms | 18 ms | 0,4 ms | 8 ms |
| Cuevas irregulares | 2.000 | 6,8 ms | 13,5 ms | 0,5 ms | 12 ms |
| Mazmorra, tramos de 50 px | 2.280 | 12,8 ms | 32 ms | 0,7 ms | 22 ms |
| Cuevas irregulares | 5.000 | 24,5 ms | 42 ms | 1,2 ms | 46 ms |
| Mazmorra, tramos de 20 px | 5.880 | 26,3 ms | 40 ms | 1,0 ms | 66 ms |
| Cuevas irregulares | 10.000 | 62,6 ms | 101 ms | 2,1 ms | 165 ms |
| Mazmorra, tramos de 10 px | 11.400 | 66,6 ms | 116 ms | 1,6 ms | 351 ms |

- Unos **5-6 µs por segmento y ficha**. La misma mazmorra cuesta 2 ms con sus paredes en tramos largos (400) y 67 ms
  troceada en tramos de 10 px (11.400): **trocear paredes rectas en segmentos colineales es lo que más castiga**, y
  los cruces se disparan porque todos los trozos de una misma columna se comparan entre sí.
- Combinar seis líneas de visión con la unión de diez luces (unión, intersección y unión final con Clipper, la
  biblioteca de polígonos que trae Foundry) costó de 3 a 112 ms según los vértices [observado].
- Los seis mapas UVTT de muestra que bajó el otro estudio de hoy tienen de 5 a 351 segmentos (una cueva de 65×39
  casillas, 351). Un mapa de Dungeondraft normal anda en cientos de segmentos; uno grande o con cuevas de contorno
  suave, en miles.
- En el cliente real, en la escena pequeña de 19 muros, reinicializar una fuente de visión (barrido, mallas y
  sombreado) costó 2,7 ms por ficha [observado]: el barrido es solo parte del trabajo.

**Qué se guarda en memoria** [código]: las aristas y su índice; los cruces, hasta el siguiente cambio; el polígono de
cada fuente, hasta que se reinicializa; el resultado de «¿hay línea de visión?» de cada fuente dentro de una misma
prueba; y las luces fijas, pintadas en una textura que solo se repinta si cambia alguna (las de las fichas se pintan
siempre). Los cambios de un mismo fotograma se agrupan en una sola actualización.

**Cuándo se recalcula** [código]:

- **Al mover una ficha**: solo sus fuentes (su visión y su luz). Con la animación de visión activada (lo normal), **en
  cada fotograma de la animación**; desactivada, al acabar. Mientras se arrastra, el que arrastra ve una vista previa
  que no cuenta para la niebla.
- **Al abrir o cerrar una puerta**, o cambiar cualquier muro que bloquee la vista: **todas** las fuentes de visión; si
  bloquea la luz, también todas las luces; si bloquea el sonido, los sonidos.
- Al cambiar una luz, todas las luces. Al seleccionar o soltar fichas, cambia cuáles dan visión.

### 3. Luces y oscuridad

- **Una luz** tiene posición, radio brillante y radio tenue (en unidades), ángulo y giro, color, intensidad y ajustes
  visuales (luminosidad, contraste, saturación, sombras), animación, atenuación, prioridad, un rango de oscuridad de
  la escena en el que está encendida, si la frenan los muros o no, si está apagada (oculta) y si **da visión**
  [código]. Las fichas llevan su propia luz con el mismo modelo, que se mueve con ellas.
- **La escena** tiene un nivel de oscuridad de 0 a 1 (las herramientas «día» y «noche» lo cambian con transición), una
  **iluminación global** con su propio rango de oscuridad (si la oscuridad de la escena cae dentro, toda la escena
  cuenta como iluminada, como de día), colores de ambiente para la luz y la oscuridad, y, por nivel, colores de lo
  explorado y lo no explorado y una imagen opcional para tapar lo no explorado. Las regiones pueden cambiar la
  oscuridad en una zona [código].
- **Una fuente de oscuridad** es una luz negativa: un área de oscuridad mágica cuyo contorno se convierte en aristas de
  un solo sentido que tapan la vista y la luz desde fuera. Una ficha dentro queda cegada (solo ve su propio hueco)
  salvo que tenga más prioridad, y una luz de más prioridad la anula [código]. En la niebla guardada se ve su sombra
  [observado].
- **Iluminado o no**: los niveles de luz (oscuridad, penumbra, sin luz, tenue, brillante) sirven para pintar; para
  detectar, un punto está iluminado si cae dentro de alguna luz encendida, tenue o brillante sin distinción, o si la
  iluminación global está activa [código].
- **La combinación**: una ficha ve **lo que está dentro de su alcance de visión y en su línea de visión, haya luz o
  no**, más **lo que está iluminado dentro de su línea de visión**; a eso se suma, para todos, lo que cubre una luz
  que da visión, y se resta la oscuridad mágica [código]. Foundry **nunca calcula esa región como un polígono**: pinta
  los polígonos en una textura de un canal en la tarjeta gráfica, con mezclas (máximo para unir, máscara para
  intersecar, borrado para la oscuridad). Para decidir si se ve una ficha, una puerta o un pin, prueba puntos contra
  los polígonos de cada fuente [código].
- **Una luz que da visión** hace visible su área a todos los usuarios, como si una ficha la viera, y la marca como
  explorada. La jugadora veía al goblin de la sala B con la puerta cerrada porque estaba dentro de esa luz
  [observado].

### 4. Visión de las fichas

- **Una ficha** tiene la visión encendida o apagada, un alcance (en unidades; 0 quiere decir que solo ve lo
  iluminado y su propio hueco), un ángulo, un modo de visión (básica, en la oscuridad, monocroma, ceguera, sentir
  vibraciones, amplificación de luz: cambian sobre todo cómo se pinta lo que ve) y unos **modos de detección**, cada
  uno con su alcance: percepción de la luz (sin límite por defecto), vista básica (el alcance de la visión), ver lo
  invisible, sentir lo invisible y sentir vibraciones (estas dos atraviesan muros), verlo todo y sentirlo todo
  [código]. dnd5e rellena el alcance, el modo y los modos de detección a partir de los sentidos de la criatura
  (visión en la oscuridad, vista ciega, sentido sísmico, visión verdadera) [código]. Los estados de ceguera,
  invisibilidad y excavar cambian lo que detecta cada modo [código].
- **Qué fichas dan visión a un jugador**: si tiene seleccionadas fichas con visión, solo esas; si no tiene ninguna
  seleccionada, **todas las fichas cuyo actor puede observar, juntas** [código, observado]. La jugadora sin nada
  seleccionado (o con las dos) veía la unión: la enana veía el rincón oscuro de la sala A y la heroína no. Una ficha
  oculta nunca da visión a un jugador.
- **El máster**: sin ficha seleccionada no se pinta la capa de visión y lo ve todo, también las fichas ocultas
  (medio transparentes); con una ficha seleccionada ve exactamente lo que ve esa ficha [código, observado].
- **Cuándo ve un jugador una ficha ajena**: si alguno de los puntos de prueba repartidos por su forma lo detecta
  alguna de sus fuentes: una luz que da visión, la vista básica (dentro del alcance y en línea de visión), la
  percepción de la luz (en línea de visión e iluminado) o un modo especial (que le pone un contorno) [código]. Una
  ficha oculta, nunca. Comprobado: el acechador oculto no salía; el esqueleto tras la puerta secreta, tampoco; el
  goblin, sí [observado].
- **Por la red** llegan todas las fichas, las ocultas también, con su posición, y cada movimiento de cualquier ficha
  le llega a todos, con su recorrido (unos 2 KB por paso): «Mesa Otro» recibió dónde movía el máster al acechador
  oculto y cada paso de la heroína [observado].

### 5. Niebla explorada

- **Modos por escena**: sin niebla, individual (por defecto) y compartida (nueva en la v14). Si la escena no usa
  visión de fichas, no hay niebla: se ve todo [código].
- **Cómo se guarda**: un documento por **usuario, escena y nivel** con una **imagen** de la escena en base64, de un
  solo canal, a la resolución del lienzo hasta 4.096 px por lado (una escena mayor se guarda reducida) [código]. Está
  configurada como WebP de calidad 0,8; en nuestro navegador sin pantalla salió en PNG: 2.000×1.600 px, 72 KB, 96 KB
  en base64 [observado]. Lo explorado se va acumulando en la tarjeta gráfica en cada refresco de la visión (todo lo
  que se ha visto en algún fotograma, también a lo largo del recorrido animado) y se guarda 2 s después del último
  cambio, al pulsar Esc y al cerrar [código].
- **Reiniciar**: un botón del máster en las herramientas de luz borra la niebla de la escena **para todos los
  usuarios** y avisa a todos [código]. Borrar una escena o un nivel borra su niebla [código]. Hay además una función
  del máster, marcada como experimental, que copia la niebla de un usuario a otros [código].
- **Compartir**: en modo individual, cada usuario tiene la suya. En el compartido, cada cliente pinta en su niebla la
  visión de **todas las fichas de los jugadores** (aunque en directo solo vea la de las suyas), y al cargar une su
  niebla con la de los demás jugadores que se guardaron en los 10 s anteriores a la más reciente; la del máster no
  cuenta [código]. El servidor sabe reenviar una niebla a todos, pero el núcleo no lo usa [código].
- **Por la red**: la niebla no va en el volcado inicial y sus cambios no se difunden [código, observado]. Pero **el
  servidor no mira quién pide**: «Mesa Otro» pidió la niebla de «Mesa Jugadora» y se la dio entera; la restricción
  solo está en el cliente [observado].
- **A mano**: **el núcleo no tiene pincel ni rectángulo para destapar**. Lo que se hace sin módulos: poner una luz que
  da visión (destapa un área para todos y la deja explorada), una ficha de los jugadores con visión que haga de «ojo»,
  quitar la visión de la escena, o reiniciar o copiar la niebla. La comunidad lo resuelve con módulos que añaden una
  capa de niebla manual (por ejemplo, «Simple Fog»; no lo hemos leído): una capa aparte de formas (pincel,
  rectángulo, polígono) que tapan o destapan encima del mapa, independiente de la visión automática.

### 6. Lo que llega por la red

| Qué | Qué recibe un jugador | ¿Filtra el servidor? |
|---|---|---|
| Muros de todas las escenas | Todos al cargar, con coordenadas, tipo y estado (unos 230 B cada uno; 2.000 muros, unos 460 KB) | No |
| Puertas secretas | Como un muro más, marcado como secreta: sabe dónde está | No; además puede abrirla por la red |
| Cambios de estado de una puerta | A todos los conectados | No |
| Luces apagadas, fuentes de oscuridad y luces que dan visión | Todas, con su configuración | No |
| Fichas ocultas o fuera de la vista | Todas, con posición y cada movimiento | No |
| Su niebla | Cuando la pide | — |
| La niebla de otros | No se le manda, pero si la pide se la dan | No |
| Presencia (cursor, regla, escena que mira) | A todos (ya en `sincronizacion-e-historial.md`) | No |

El servidor no podría filtrar por visibilidad aunque quisiera: no sabe nada de geometría [código].

### Pruebas

Resultados que cita la nota (scripts, salidas e imágenes, fuera del repo):

1. La jugadora por socket: el volcado con los 19 muros (la puerta secreta marcada como tal), las cuatro luces (la
   apagada y la de oscuridad incluidas), las cinco fichas (la oculta incluida) y ningún documento de niebla.
2. La jugadora en el navegador: la unión de sus dos fichas, sin seleccionar y con las dos; con solo la heroína, el
   rincón oscuro deja de verse; el goblin visible por la luz que da visión; el acechador y el esqueleto, no; el icono
   de la puerta normal sí y el de la secreta no.
3. El máster en el navegador: sin ficha, todo (el oculto incluido) y los dos iconos de puerta; con la heroína, solo lo
   que ve ella y ningún icono fuera de su vista.
4. La jugadora abre y cierra la puerta secreta por socket: aceptado, y «Mesa Otro» recibe los dos cambios.
5. «Mesa Otro» escucha mientras el máster abre la puerta normal y mueve al acechador oculto y la jugadora mueve a la
   heroína: le llegan la puerta, la posición del oculto y cada paso; ninguna niebla.
6. «Mesa Otro» pide la niebla de la jugadora y la de toda la escena: se la dan (un PNG de 2.000×1.600 px con la sala A,
   el círculo de la luz que da visión y las sombras del muro etéreo, la ventana y la oscuridad).
7. El banco de pruebas de la tabla del punto 2, con segmentos en memoria.

## Compromisos y límites

- **Todo en el cliente**: el servidor no gasta nada y la vista responde al instante y con degradados bonitos en la
  tarjeta gráfica, pero no guarda ningún secreto: puertas secretas, fichas ocultas y sus movimientos, luces apagadas y
  la niebla de los demás están al alcance de quien mire la red. Para una tele en casa da igual; para jugar online, es
  justo lo que Enrique no quiere.
- **El coste crece con todos los muros del mapa por cada ficha**, porque la línea de visión no tiene radio, y se paga
  en cada fotograma mientras una ficha se mueve. Los mapas grandes, con miles de segmentos o paredes troceadas, se
  notan lentos.
- **La niebla como imagen**: unir es gratis (pintar encima) y el tamaño está acotado, pero la resolución tiene techo
  (4.096 px), cada usuario guarda unos 100 KB por escena, no hay historial ni se puede editar a mano, y reiniciar es
  todo o nada, para todos los usuarios de la escena.
- **La niebla individual no encaja con un grupo**; la compartida funciona porque cada cliente calcula la visión de
  todos, y une documentos por una ventana de tiempo, algo frágil.
- **Sin niebla manual** en el núcleo: hay que apañarse con luces que dan visión o con módulos.
- **El servidor no valida nada geométrico**: ni que una ficha cruce un muro, ni que la puerta que se abre se vea o no
  sea secreta.
- **El modelo de detección es rico** (modos con alcance, estados que ciegan o hacen invisible), pero está atado al
  cliente y a los sombreadores.

## Qué nos llevamos a Crisol

Con la decisión de Enrique: el servidor calcula y filtra; la tele pide la vista del grupo; la niebla es del grupo y de
cada campaña; automática y a mano.

**El modelo de datos (la escena, en el mundo)**

- Muros con las mismas cuatro restricciones, los cinco valores, la dirección y los umbrales; puertas normales y
  secretas con su estado inicial; luces con radio brillante y tenue, ángulo, color, rango de oscuridad, si las frenan
  los muros y si dan visión; fuentes de oscuridad; nivel de oscuridad e iluminación global. Es casi lo mismo que traen
  un UVTT (muros, portales y luces) y una escena de Foundry, así que importar es copiar.
- **Al importar, simplificar**: unir los segmentos contiguos y colineales. En el banco de pruebas, la misma mazmorra
  pasa de 67 ms a 2 ms por ficha.

**El estado (la campaña en la escena)**

- Una fila por campaña y escena con: el estado de cada puerta que difiera del inicial, las luces encendidas o
  apagadas, las fichas, lo explorado, las formas de la niebla a mano y una versión. Los cambios a mano (puertas,
  destapar, reiniciar) pasan por `operation()` y se deshacen; lo que se explora solo, no (sería ruido).

**Lo que calcula el servidor**

- Las aristas de la escena con las puertas de esa campaña, en un índice espacial, guardadas en memoria por campaña y
  escena hasta que cambie una puerta o un muro.
- Los polígonos de las luces, guardados igual: solo dependen de muros, puertas y luces, no de las fichas.
- Una línea de visión por ficha del grupo (los personajes de la campaña que están en la escena) y, de ella, su campo
  de visión. Lo visible es la unión, para cada ficha, de su campo de visión y de su línea de visión dentro de lo
  iluminado; más las luces que dan visión y lo destapado a mano; menos la oscuridad mágica. Se calcula con operaciones
  de polígonos (Clipper o Clipper2 tienen licencia Boost, permisiva: comprobarlo antes) o directamente sobre la
  rejilla de la niebla.
- **Cuándo**: al soltar una ficha, no mientras se arrastra (solo se recalcula la suya); al abrir o cerrar una puerta,
  todas las del grupo y las luces; al cambiar la oscuridad, las luces. Para que se explore el pasillo recorrido, se
  calcula también en cada casilla del camino.
- **El presupuesto**: con 2.000 segmentos, unos 10 ms por ficha y unos 50 ms para un grupo de cinco al abrir una
  puerta; con 10.000, unos 65 ms por ficha. Cabe en el servidor si va en un hilo de trabajo (para no bloquear el
  resto), agrupando los cambios seguidos, y con una prueba de carga como la de la wiki. Si hiciera falta, limitar el
  radio de la línea de visión al de la luz más lejana que importe deja trabajar al índice espacial.

**La niebla explorada, por campaña y escena (del grupo, no de cada usuario)**

- Una rejilla de bits fina (por ejemplo, 10 px: un mapa de 6.000×6.000 px son 360.000 bits, 45 KB sin comprimir y
  pocos KB comprimidos) guardada en Postgres. Unir es poner bits a 1; el pincel y el rectángulo a mano son lo mismo;
  reiniciar es vaciarla, para esa campaña y nada más. Otra campaña que abre la misma cripta empieza con la suya.
- La alternativa vectorial (la unión de polígonos) da bordes nítidos a cualquier zoom pero crece sin techo; la rejilla
  está acotada y es más sencilla. Proponemos la rejilla.

**La niebla a mano**

- Formas por campaña y escena: pincel (un trazo con su grosor), rectángulo y polígono, para **destapar** o **tapar**.
  Destapar deja la zona **a la vista** (se ve el mapa y las fichas no ocultas que haya dentro), como una luz que da
  visión pero sin luz; tapar la vuelve a cubrir aunque se hubiera explorado. En la rejilla gana lo último que se pinta.
- Una escena sin muros se marca «sin visión automática»: solo vale la niebla a mano. Así sirve igual para un mapa
  dibujado a mano que para una cripta de Dungeondraft.

**La ventana de la tele: la vista del grupo, proyectada en el servidor**

- Recibe la máscara de lo explorado, la región a la vista, las fichas cuyos puntos de prueba caen en lo visible y no
  están ocultas (con su nombre para jugadores y su estado en palabras, como en el módulo 5) y los efectos de luz
  recortados a lo visible. **No recibe muros, ni puertas, ni luces apagadas, ni fichas fuera de la vista**; los
  cambios llegan como diferencias por `/api/realtime`.
- **La imagen del mapa también se filtra**: Foundry manda el fondo entero y lo tapa en el cliente, así que lo no
  explorado viaja igual. Proponemos servir el mapa en teselas y dar solo las que tocan lo explorado (o recortarlas en
  el servidor). Si basta con teselas que asoman un poco por el borde de lo explorado lo decide Enrique.
- El máster ve todo, y «ver como el grupo» usa la misma proyección (como `ver_como_jugador` en la wiki).

**Puertas**

- En el servidor, con reglas: el máster abre todas; cuando haya jugadores online, uno solo abre puertas visibles, no
  secretas, sin llave y junto a su ficha. Una puerta secreta es un muro para los jugadores hasta que el máster la abre;
  entonces se ve el hueco, pero nunca el icono ni que era secreta. Mover una ficha a través de un muro también se
  rechaza en el servidor.

**Pensando ya en jugar online**

- La proyección es por «quién mira» = un conjunto de fichas: la tele mira con todas las del grupo y un jugador, con las
  suyas. La niebla puede seguir siendo del grupo, o pasar a ser por personaje si algún día hace falta.
- La IA, por el MCP: abrir y cerrar puertas, destapar y tapar zonas, reiniciar la niebla y preguntar «qué ve el
  grupo».

**La prueba de fugas** debe comprobar que a la tele (y a un jugador) no le llegan: muros, puertas secretas (tampoco al
abrirlas), fichas ocultas o fuera de la vista ni sus movimientos, luces apagadas, teselas sin explorar ni la niebla de
otra campaña; y que abrir una puerta secreta o cruzar un muro por la API se rechaza.

**Qué no traer**: recalcular en cada fotograma, la composición en la tarjeta gráfica como fuente de verdad, la niebla
como documento de cada usuario que cualquiera puede leer, y el volcado de todos los muros de todas las escenas al
entrar.
