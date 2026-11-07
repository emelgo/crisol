# ADR-0018: La mesa, una sala por campaña en el servidor

Estado: propuesta (Claude, 2026-11-07; por confirmar con Enrique al verla funcionar) · Módulo 6

## Contexto

El ADR-0001 decidió que la partida es autoritativa en el servidor y que cada cliente dibuja su vista, para acabar con
la dependencia de la pestaña del máster. En la entrevista del módulo 6 (`docs/modulos.md` § «### 6. Mesa») Enrique
dijo cómo juega: sobre todo en persona, él lleva la mesa desde su ordenador y **una segunda ventana en la tele**
enseña lo que ve el grupo; más adelante, también online. La niebla, automática (por lo que ven las fichas, con muros,
puertas y luces) y a mano. La escena es del mundo y el estado, de cada campaña. Y el límite: a la tele no le llega
nada que el grupo no vea.

Lo que enseñan los estudios:

- **Foundry** (`research/foundry/vision-muros-y-niebla.md`) calcula la visión en el cliente y manda casi todo: los
  muros de todas las escenas con las puertas secretas marcadas, las fichas ocultas con cada movimiento, la niebla de
  otro jugador si se pide. El servidor no valida ni puertas ni movimiento; los turnos y la caducidad de los efectos
  dependen del navegador del máster.
- **La mesa del Crisol actual** (`docs/mesa-crisol-actual.md`) vive en la pestaña del máster: la ventana de jugadores
  copia su imagen y a la sala online le llegan fotogramas. Pero su núcleo (rejilla, medidas, visión, luz, niebla,
  iniciativa) es TypeScript puro, con pruebas, y vale en el servidor.
- **La visión cuesta** unos 5 µs por segmento de muro y ficha: con 2.000 segmentos, unos 10 ms por ficha; con 10.000,
  unos 65. Unir los segmentos colineales al importar la baja mucho (la misma mazmorra, de 67 a 2 ms).

## Decisión

1. **Un núcleo compartido**, `packages/tabletop`: TypeScript puro, sin DOM ni PixiJS, con el modelo de la escena y del
   estado, los comandos, la rejilla (cuadrada y hexagonal), las medidas, la visión, la luz, la niebla y la iniciativa.
   Se porta del núcleo de la mesa actual con identificadores en inglés, un esquema con nombres propios y una cabecera
   de origen en cada archivo. Lo usan el servidor (decidir y proyectar) y la web (pintar y adelantar el arrastre).
2. **Lo del mundo y lo de la campaña, separados en la base**. La escena es una pestaña de la página del lugar
   (ADR-0007), con su imagen, su rejilla, sus muros, puertas, luces, pines y lo preparado. El estado es de cada
   campaña y escena: las fichas, las puertas que difieren de como se dibujaron, la niebla, las plantillas, los dibujos y
   el combate. Lo que tiene identidad propia (una ficha, un muro, una luz) va en filas, como los pines de los mapas;
   lo explorado, en una rejilla de bits.
3. **Una sala por campaña en el proceso del servidor**: se abre cuando alguien se conecta a la mesa de la campaña y se
   cierra cuando no queda nadie. Carga la escena abierta y su estado y aplica los comandos. Cada comando se valida
   (permisos y reglas: un jugador no abre una puerta secreta ni cruza un muro), se guarda en la misma `operation()`
   que cualquier cambio (historial y deshacer) y se manda a cada conexión **su proyección**, como diferencias. El
   arrastre de una ficha, el láser y la medida en curso van en vivo y no se guardan. La mesa tiene su propio
   WebSocket, con la misma sesión; el de `/api/realtime` sigue avisando de lo demás.
4. **La proyección es por «quién mira»**, un conjunto de fichas: el máster lo ve todo, con lo oculto marcado; **la
   pantalla de la tele mira con las fichas del grupo** (los personajes de la campaña que están en la escena); más
   adelante, cada jugador mirará con las suyas. A la pantalla no le llegan muros, puertas, luces apagadas, fichas
   fuera de la vista u ocultas, PG ni hojas: solo lo explorado, lo que está a la vista, las fichas visibles con su
   estado en palabras (como en el módulo 5) y las teselas del mapa que tocan lo explorado.
5. **La visión, en el servidor y en un hilo de trabajo**, con lo que no depende de las fichas guardado en memoria por
   campaña y escena (las aristas en un índice espacial, los polígonos de las luces). Se recalcula al soltar una ficha
   (la suya, también en las casillas del camino, para explorar el pasillo), al abrir o cerrar una puerta (todas) y al
   cambiar la luz. Al importar, se unen los segmentos colineales. **Presupuesto**: recalcular la vista del grupo (seis
   fichas, 2.500 segmentos, 20 luces) en menos de 100 ms en el p95, medido en una prueba de rendimiento con su paso en
   la CI, como la de lo que lee un jugador.
6. **La niebla es del grupo, por campaña y escena**: lo explorado, una rejilla de bits (unos 10 px por bit: pocos KB
   comprimidos) que se va llenando sola; la de a mano, formas de destapar o tapar (pincel, rectángulo, lazo). Lo que
   ve el grupo es lo que ven sus fichas más lo destapado a mano, menos lo tapado a mano, que manda siempre. Una escena
   sin muros va «sin visión automática»: solo vale la de a mano. Los cambios a mano se deshacen; lo que se explora
   solo, no (sería ruido).
7. **El mapa, en teselas**: al subirlo o importarlo, el navegador del máster lo trocea en teselas WebP (como saca hoy
   las imágenes de un zip de Foundry, sin subir el original entero); el servidor las guarda como archivos del mundo y
   da a la pantalla solo las que tocan lo explorado o lo visible. Si las del borde se recortan en el servidor con la
   máscara o se sirven enteras (asoma como mucho una tesela más allá de lo explorado) es **un ajuste de cada campaña**
   (Enrique, 2026-11-07: «me gusta lo de poder mostrar todo o recortar»): enteras por defecto, que basta jugando en
   persona; recortadas, para jugar online. Se construye con `vision`.
8. **La pantalla de la tele es una ruta de la web** que la mesa del máster abre con `window.open`; se conecta por su
   cuenta, con la sesión del máster, pidiendo la vista del grupo. Seguir al máster, quedarse fija o encuadrar al grupo
   son cámaras de esa vista; presentar y ocultar, distinto de abrir la escena.
9. **La web pinta con PixiJS 8** (MIT, el de la mesa actual), cargado solo en la mesa.
10. **Turnos, caducidad de estados e iniciativa, en el servidor**, con la fórmula del sistema. No dependen de que haya
    nadie conectado.
11. **La IA habla con el servidor**, no con una pestaña: las herramientas MCP de la mesa funcionan sin nadie
    conectado (escriben en la base y avisan a la sala si está abierta), hablan en casillas y nombran las fichas por su
    rótulo.
12. **La prueba de fugas** se amplía: a la pantalla (y a un jugador, cuando juegue online) no le llegan muros, puertas
    secretas, luces apagadas, fichas fuera de la vista u ocultas, PG, ni teselas sin explorar.

## Alternativas descartadas

- **Calcular en el cliente y esconder en la interfaz** (Foundry): sencillo, pero todo viaja y se ve con las
  herramientas del navegador. Va contra el ADR-0001 y el ADR-0017.
- **Fotogramas del navegador del máster** (mesa actual): depende de su pestaña, pesa en la red y no deja a la IA
  trabajar sola.
- **Pintar en el servidor** (WebGL sin pantalla): el VPS no tiene GPU, y cada vista costaría un render.
- **La escena como documento Yjs**: sincroniza muy bien, pero manda el documento entero a todos; no filtra por quién
  mira.
- **La niebla como unión de polígonos**: bordes nítidos a cualquier escala, pero crece sin techo; la rejilla está
  acotada y es más sencilla.

## Consecuencias

- El servidor gana trabajo de verdad (la visión y la proyección), en un hilo aparte y con su prueba de rendimiento.
- Un canal nuevo, el de la mesa, con su contrato zod en `@crisol/contracts` y su prueba de fugas.
- PixiJS entra en la web, solo en la ruta de la mesa.
- Con una sola instancia del servidor basta; si algún día hay varias, cada sala tendrá que vivir en una, repartidas
  con Valkey.
- Jugar online queda a un paso: la misma proyección con las fichas de cada jugador, y las reglas de puertas y
  movimiento ya en el servidor.
