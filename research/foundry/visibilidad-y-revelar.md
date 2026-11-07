# Visibilidad, revelar y lo que ve un jugador en Foundry VTT

Módulo de Crisol: 5. Visibilidad por campaña · Fecha: 2026-11-06 · Versión estudiada: Foundry VTT 14.369 y dnd5e
6.0.6

## Pregunta

Para la spec del módulo 5 queríamos saber, sin repetir lo que ya está en `journal.md` (permisos por entrada y página,
secretos, «mostrar a los jugadores»), `usuarios-y-permisos.md` (roles y niveles) y `sincronizacion-e-historial.md` (el
servidor manda todo y el cliente filtra):

1. **Pines del mapa** (notas de escena): cuándo ve un jugador un pin enlazado a una entrada, qué ve si no tiene
   permiso, qué hace la opción «global», y si lo decide el servidor o el cliente.
2. **Compendios por rol**: cómo se oculta un compendio entero, si se puede ocultar una carpeta o una entrada, y qué
   recibe un jugador de un compendio que no ve.
3. **Un PNJ en partida**: nombre y barras de la ficha, el combat tracker, la hoja sin permiso o limitada en dnd5e,
   alguna salud en palabras, y qué llega por la red de sus PG.
4. **Enlaces a lo que no ves**: cómo se pinta y qué pasa al pulsar un enlace a algo sin permiso o limitado.
5. **Avisos al revelar**: si el jugador se entera cuando cambia un permiso o se revela un secreto, y qué deja
   «mostrar a los jugadores».
6. **Herencia**: si es viva o una copia, solo en lo que toca a pines y compendios.

## Lo que hacen

Grado de certeza: **[código]** leído en el código instalado, **[observado]** comprobado en la instancia de estudio.

### Cómo se estudió

En el mundo `crisol-rea` se crearon, desde un navegador de máster, dos jugadores («Vis Pícara» y «Vis Guerrero»), una
carpeta de diario con entradas de cada nivel (ninguno, limitado, observador, una solo para la pícara, una página
«ninguno» dentro de una entrada visible y una entrada llena de enlaces), tres PNJ (uno sin permiso, uno limitado y uno
oculto), tres compendios del mundo (oculto, limitado y visible para el rol jugador), una escena sin visión con ocho
pines, tres fichas y un combate, y otra escena con visión para la opción «global» (detalle en `entorno.md`). Luego:

- la pícara entró con un navegador (Playwright) para ver la interfaz;
- un script propio de Node, con el cliente de socket.io de la instalación, entró como la pícara para ver la carga
  inicial y pedir documentos a mano, y como el guerrero para escuchar todo lo que llegaba mientras el máster quitaba
  y daba permisos, revelaba un secreto, mostraba una entrada y hería a un PNJ.

### 1. Pines del mapa

Un pin es una nota de la escena con posición, icono, tamaño, un texto propio opcional, la entrada y, si se quiere, una
página concreta de esa entrada, más un indicador «global» [código]. **No tiene permiso propio ni casilla de oculto**,
al revés que las fichas: su visibilidad sale de la entrada o la página a la que apunta [código].

Lo que vio la pícara en la escena sin visión [observado]:

| El pin apunta a… | Lo que ve |
|---|---|
| Una entrada «ninguno» | Nada: ni icono ni nombre |
| Una entrada «limitado» | El icono y el nombre de la entrada; al pulsar no se abre |
| Una página de imagen dentro de una entrada limitada | El icono y el nombre de la página; al pulsar se abre solo la imagen |
| Una entrada «observador» | El icono y el nombre; se abre |
| Una página «ninguno» dentro de una entrada visible | Nada: manda el permiso de la página |
| Una entrada solo para ella | El icono y el nombre; se abre |
| Nada (un pin de solo texto creado por el máster) | Nada |
| Una entrada visible, con texto propio en el pin | El texto propio en vez del nombre de la entrada |

- **Ver** el pin pide al menos limitado sobre la página (si la tiene) o la entrada, y **abrirlo** pide observador; la
  excepción es la página de imagen con limitado exacto, que abre la imagen [código, observado].
- **Los pines sin entrada** solo los ven los jugadores si los creó un jugador (por ejemplo, uno de confianza, que puede
  crear notas) o si no tienen autor. Uno del máster queda solo para él [código, observado].
- **El nombre** que sale es el texto propio del pin; si no tiene, el de la página o el de la entrada. Con limitado se
  ve el nombre real de algo que no se puede abrir [código, observado].
- **«Global»** no toca el permiso. Solo decide si el pin necesita que el sitio esté a la vista o explorado cuando la
  escena usa visión: sin «global», un pin en una zona sin explorar no sale; con «global», sale aunque no se haya
  explorado [código, observado].
- **La capa de notas** se puede enseñar siempre o solo con su herramienta: es un ajuste de cada usuario [código].
- **Lo decide el cliente.** Los ocho pines llegaron por la red en la carga inicial, con su entrada, su página, su
  texto, su posición y su autor, aunque la pícara solo pintó cinco [observado]. Cuando cambia el permiso o el nombre
  de la entrada o la página, el cliente vuelve a dibujar sus pines, sin recargar [código]. Las escenas también llegan
  todas.

### 2. Compendios por rol

- **Un nivel por rol**, no por persona: para jugador, jugador de confianza y asistente se elige ninguno, limitado,
  observador o propietario (o heredar del rol de abajo); el máster siempre es propietario. Se guarda en un ajuste del
  mundo, la configuración de compendios, que reciben todos los usuarios [código, observado].
- **Lo que da cada nivel** [observado salvo donde se dice]:

  | Nivel del rol | En la barra | En la búsqueda de la barra | Al abrir una entrada |
  |---|---|---|---|
  | Ninguno | No se lista | No sale | Aviso de que no tiene permiso |
  | Limitado | No se lista | Sus entradas salen | Se abre. En dnd5e, la hoja del objeto salió entera, con su descripción |
  | Observador | Se lista y se abre | Sus entradas salen | Se abre |

  Un diario dentro de un compendio limitado cuenta como observador, porque limitado no significa nada en el diario
  [código].
- **Ni carpetas ni entradas sueltas.** Las carpetas de un compendio no guardan permisos, y dentro de un compendio el
  permiso de cada documento es el del compendio entero, sin mirar el suyo [código]. Lo comprobamos: una página de
  diario marcada «ninguno» dentro del compendio visible se le enseñó a la pícara igual que la pública [observado].
  Los secretos de esa página sí se esconden al pintar, porque el jugador no es propietario [observado]. La única forma
  de enseñar una criatura y ocultar otra es repartirlas en compendios distintos.
- **Lo que llega por la red** de un compendio que no se ve:
  - en la carga inicial, cada usuario recibe el índice (nombre, tipo, imagen, carpeta y orden) y las carpetas de
    **todos** los compendios activos: 26 compendios y unas 4.600 entradas, incluidos el bestiario oculto y los rasgos
    de monstruo que dnd5e reserva al asistente [código, observado];
  - si lo pide, el servidor le da el documento entero: la pícara pidió el bestiario oculto y recibió el dragón con sus
    PG y su biografía privada [observado];
  - el servidor solo mira el permiso del compendio al escribir: cambiar el nombre del dragón se rechazó [observado].

### 3. Un PNJ en partida

- **Nombre y barras de la ficha**: cada uno tiene seis modos (nunca, al controlarla, al pasar el ratón si eres dueño,
  al pasar el ratón cualquiera, siempre para el dueño y siempre para todos) [código]. Con el goblin (nombre al pasar el
  ratón, barras solo para el dueño), la pícara no vio nombre ni barra, y al pasar el ratón, el nombre pero no la
  barra. Con el ogro (los dos siempre), vio su nombre y su barra de PG [observado]. La barra es un dibujo proporcional
  sin números, pero dice la proporción exacta. La disposición «secreta» quita nombre, barras, borde y estados a quien
  no es dueño [código]. Una ficha oculta no se pinta para el jugador [observado].
- **Combat tracker**: lista los combatientes no ocultos con su nombre, **sin mirar el modo de nombre de la ficha**: el
  goblin, sin nombre en el mapa, salía con su nombre en el combate [observado]. El recurso que sigue el tracker (aquí,
  los PG) solo se enseña con observador o más; la pícara no vio PG [código, observado]. El combatiente oculto no salía
  [observado]. dnd5e solo cambia el formato de la iniciativa y agrupa combatientes [código].
- **La hoja**: con «ninguno» no se abre y sale el aviso de que no tiene permiso para ver la hoja de ese actor
  [observado]. Con limitado, dnd5e enseña el retrato, el nombre y la descripción pública; nada de CA, PG,
  características, acciones ni la biografía privada [observado].
- **Salud en palabras**: el núcleo no tiene. dnd5e tiene un estado **«Bloodied»** (malherido) que se pone solo al
  bajar de la mitad de los PG (el umbral es configurable) y se quita al curar, con su icono en la ficha. Un ajuste del
  mundo decide si se ve en todas las fichas, solo en las amistosas (por defecto) o nunca [código]. Es un único
  escalón, más los estados de inconsciente o muerto. Lo pone **el cliente de quien cambia los PG**, no el servidor
  [código]. Con el goblin a 3 de 7, el estado llegó a la pícara pero escondido, por ser una ficha hostil; con el
  ajuste en «todas», se le enseñó [observado].
- **Otros ajustes de visibilidad de dnd5e**: si los jugadores ven el resultado de los ataques en el chat (todo, sin la
  CA o nada), las CD de las tiradas y la descripción de los objetos de un PNJ que el máster saca al chat [código].
- **Por la red** el jugador recibe el actor entero aunque tenga «ninguno»: PG, CA, características, acciones y
  biografía privada, y también la ficha oculta y el combatiente oculto [observado]. Cada cambio de PG llega a todos los
  conectados: al herir al goblin, el guerrero recibió los PG nuevos, y en las opciones del cambio, los anteriores con
  su máximo y su porcentaje; luego, la creación del estado «Bloodied» [observado].

### 4. Enlaces a lo que no ves

- **Todos los enlaces se pintan igual**, con el icono de su tipo y el nombre real, haya permiso o no: una entrada
  «ninguno», una limitada, una página «ninguno», un PNJ sin permiso y un PNJ de un compendio oculto (el cliente pide
  el documento al servidor y este se lo da) [observado]. Solo el enlace a algo que no existe cambia: sale en rojo, con
  un icono de enlace roto y la palabra «desconocido» [observado]. Si el autor escribió una etiqueta, sale la
  etiqueta en pantalla, pero el enlace lleva igual el identificador [observado].
- **Al pulsarlo** [observado]:
  - entrada «ninguno»: se abre una ventana vacía (en `journal.md` salió con el título; esta vez, en blanco);
  - entrada limitada: una ventana con el título (carpeta y nombre) y sin contenido;
  - página «ninguno» en una entrada visible: se abre la entrada en la primera página que sí ve;
  - PNJ sin permiso, o de un compendio oculto: el aviso de que no tiene permiso;
  - PNJ limitado: su hoja limitada.

### 5. Avisos al revelar

- **Cambiar el permiso** de una entrada llega como un cambio más del documento **a todos los conectados**: el guerrero
  recibió que la pícara pasaba a observador de la cripta, con el identificador de la entrada [observado]. A ella no le
  sale ningún aviso: la entrada aparece en su directorio en el acto y, al quitársela, desaparece igual [observado]; su
  pin se redibuja a la vez [código]. No hay marca de nuevo ni registro de lo que se ha dado.
- **Revelar un secreto** es editar el HTML de la página; llega el HTML entero a todos (ya lo dice `journal.md`). La
  pícara tenía la página abierta: se le repintó con el secreto, sin aviso [observado].
- **«Mostrar a los jugadores»**: al máster le sale un aviso de que se ha mostrado; al jugador se le abre la ventana,
  sin más aviso. Solo viaja a los elegidos (o a todos): al mostrar la torre a la pícara, el guerrero no recibió nada
  [código, observado]. Forzando, a la pícara se le abrió la torre limitada con su texto y su imagen, subida a
  observador solo en su memoria; en el servidor la torre siguió limitada, así que lo pierde al recargar, salvo que el
  máster cambie la propiedad en el mismo diálogo. Su directorio tampoco la añadió [observado]. No queda en el chat ni
  en ningún historial.
- No hay nada como «lo que sabe el grupo»: para repasar qué se ha revelado hay que mirar el permiso de cada entrada.

### 6. Herencia

- **Pines: viva.** El pin mira al pintarse el permiso de la página o de la entrada; una página en «heredar» toma el de
  su entrada en ese momento, y cualquier cambio de propiedad redibuja los pines [código, observado].
- **Compendios: sin herencia y sin excepciones.** El nivel del compendio manda sobre todo lo de dentro, también sobre
  las páginas con permiso propio [observado]. Las carpetas de la barra que agrupan compendios no dan permisos [código].
- **Carpetas del mundo: copia puntual**, como dice `usuarios-y-permisos.md`: la carpeta no tiene campo de propiedad y
  su diálogo aplica el nivel a lo que contiene en ese momento [código].

### Pruebas

Resultados que cita la nota (scripts y capturas fuera del repo):

1. La pícara en el navegador: cinco de ocho pines visibles, con los casos de la tabla; el goblin sin nombre ni barra y
   el ogro con los dos; el combate con «Vis Goblin» y «Vis Ogro» sin PG; la hoja limitada del ogro; el aviso de la del
   goblin; los nueve enlaces y lo que abría cada uno; el compendio visible en la barra, la espada en la búsqueda y la
   página oculta de la regla.
2. La pícara por socket: los ocho pines, los tres actores enteros con PG y biografía privada, el combatiente oculto,
   los índices de los 26 compendios y el dragón del bestiario oculto; su edición, rechazada.
3. El máster actuaba, la pícara miraba en el navegador y el guerrero escuchaba la red:
   - A. Quitar y dar la cripta a la pícara: al guerrero le llegan los dos cambios de propiedad; en la pícara, la
     entrada desaparece y vuelve a su directorio en el acto, sin aviso.
   - B. Revelar el secreto de la taberna con la página abierta: a la pícara se le repinta con el secreto, sin aviso;
     al guerrero le llega el HTML entero.
   - C. Mostrar la torre (limitada) solo a la pícara, forzando: se le abre con todo, sin aviso; el servidor la deja
     limitada; el guerrero no recibe nada.
   - D. Herir al goblin hasta 3 de 7 PG: a la pícara le llegan los PG y el estado «Bloodied» escondido; al guerrero,
     el cambio con los PG nuevos y los anteriores, y la creación del estado.
   - E. El ajuste de «Bloodied» en todas las fichas: el estado se le enseña a la pícara.
   - F. La escena con visión y nada explorado: no sale el pin sin «global» y sí el que lo tiene.

   Con el lienzo en marcha, el navegador sin GPU tardaba tanto en atender la red que parecía no recibir los cambios;
   la prueba A se repitió con el lienzo parado.

## Compromisos y límites

- **Todo se decide en el cliente con datos que ya tiene**: pines, actores, fichas y combatientes ocultos, índices de
  compendios ocultos y documentos de compendio a demanda. Es barato y reactivo (un cambio de permiso se nota al
  instante), pero no guarda ningún secreto frente a quien mire la red.
- **El pin no tiene vida propia**: no se puede enseñar un pin sin enseñar su entrada en limitado, y entonces sale el
  nombre real de la entrada. Tampoco se puede descubrir un pin y dejar la página para luego.
- **«Limitado» quiere decir algo distinto en cada sitio**: en el diario, casi nada; en un pin, icono y nombre; en un
  actor de dnd5e, retrato, nombre y descripción pública; en un compendio, «no listado pero se busca y se abre».
- **El nombre se escapa por muchos sitios**: el combat tracker no respeta el modo de nombre de la ficha, los enlaces
  pintan el nombre real, el pin limitado lo enseña y la búsqueda de compendios lo lista.
- **Salud**: un solo escalón (malherido), un ajuste por mundo y aplicado por un cliente; la barra, si se enseña, dice
  la proporción exacta.
- **Revelar no avisa**: si el máster no lo muestra, el jugador no se entera; y mostrar es efímero, sin rastro.
- **Compendios todo o nada por rol**: ni por persona, ni por carpeta, ni por entrada, ni por campaña (un servidor
  tiene un solo mundo y una sola mesa).

## Qué nos llevamos a Crisol

Pensando en la decisión de Enrique (conocimiento por campaña con excepciones por personaje, el servidor filtra todo):

- **Pines con visibilidad propia**, como «descubierto» en el Crisol actual y al revés que Foundry: un pin nuevo es
  del máster; se revela a la campaña o a unos personajes. Si se revela un pin cuya página no ven, ven el pin con su
  etiqueta y sin enlace; al revelar, Crisol puede ofrecer revelar también la página. Un pin no revelado no viaja: ni
  en la carga de la pestaña, ni en el tiempo real, ni por el MCP. La opción «global» de Foundry solo tiene sentido con
  niebla (módulo 6).
- **Enlaces a lo que no ves**: el servidor los quita al proyectar la página. Proponemos que salga la etiqueta como
  texto plano si el autor la escribió (forma parte del texto visible) y, si no, un texto neutro igual para lo oculto y
  lo que no existe, sin identificador, sin icono de tipo y sin nombre, para no delatar ni que existe. Lo mismo en la
  vista previa, la búsqueda, las entrantes y la exportación.
- **Compendio**: el del sistema, entero salvo lo que el máster oculte en la campaña (un tipo o una sección); el del
  mundo, entrada a entrada como una página. Al revés que Foundry, el servidor filtra el índice, la búsqueda, la
  lectura suelta y los enlaces; nada de mandar índices de todo al cargar.
- **Criaturas en juego**: el servidor calcula el estado en palabras a partir de los PG y al jugador solo le llega la
  palabra, nunca los números ni una barra proporcional. Propuesta de tramos: «Ilesa» con todos los PG, «Herida» por
  encima de la mitad, «Malherida» desde la mitad (el «Bloodied» de dnd5e), «A punto de caer» por debajo de una
  cuarta parte, y «Caída» a 0. El tramo lo decide el sistema (en el 5e, la mitad), no un cliente. Un único nombre
  para jugadores («Goblin 2») en todos los sitios: mapa, combate, tiradas, enlaces; sin hoja ni descripción salvo lo
  que el máster revele como página.
- **Revelar es un acto del servidor con destinatarios**: el aviso («Nuevo: …») y el cambio solo les llegan a ellos;
  los demás no reciben nada, ni siquiera que a la pícara se le ha dado algo (Foundry lo delata en el cambio de
  propiedad que manda a todos). La marca de nuevo es por personaje hasta que lo abre. «Lo que sabe el grupo» es la
  lista de esos actos, con deshacer, que Foundry no tiene.
- **«Mostrar»**: si Crisol lo tiene, es revelar y además abrir la página en sus pantallas; nunca un permiso temporal
  que se sube el cliente.
- **Herencia viva calculada en el servidor**, con su origen a la vista, como ya decidió Enrique; la carpeta que copia
  de Foundry es justo lo que hay que evitar. En el compendio, la sección oculta en la campaña hereda a todo lo que
  contiene, con excepciones por entrada.
- **La prueba de fugas de la CI** debe cubrir los casos de esta nota: pines no revelados, índice y lectura suelta del
  compendio, la hoja y los PG de una criatura, una criatura o un combatiente ocultos, el nombre en un enlace y el
  aviso que no debe llegar a quien no recibe la revelación.
