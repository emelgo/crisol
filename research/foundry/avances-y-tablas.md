# Avances de personaje (dnd5e) y tablas aleatorias en Foundry VTT

Módulo de Crisol: 3. Sistemas, fichas y dados · Fecha: 2026-11-05 · Versión estudiada: Foundry VTT 14.369 y dnd5e
6.0.6

## Pregunta

Para la capacidad `personajes` (un creador y una subida de nivel cuyos **pasos se escriben como datos de cada
sistema**, con un motor común, y las **tablas aleatorias** como pieza compartida):

1. **Los avances de dnd5e**: cómo describe, como datos de clases, subclases, especies, trasfondos y dotes, lo que gana
   un personaje en cada nivel. Qué tipos hay, qué declara cada uno y dónde se guardan las elecciones del jugador.
2. **El flujo**: qué se pregunta al crear y al subir, en qué orden y qué es automático; la multiclase; qué pasa al
   bajar de nivel o al deshacer; límites y quejas conocidos.
3. **Las tablas del núcleo de Foundry**: su modelo (resultados, rangos, fórmula, con o sin reemplazo, texto frente a
   enlaces y tablas anidadas), cómo se resuelve y se registra una tirada, y quién puede tirar y ver qué.

No se repite lo ya estudiado: el creador y la subida de D&D Beyond (`research/dndbeyond/creador-y-hoja.md`) y cómo está
hecho un sistema de Foundry (`sistemas-y-su-api.md`).

## Lo que hacen

Grado de certeza: **[O]** observado en los archivos instalados (las fuentes originales de dnd5e, recuperadas de su
mapa de fuentes, y el código del núcleo, que viene legible); **[O, datos]** contado en una copia de los compendios de
dnd5e; **[I]** inferido; **[I, issues]** o **[I, wiki]** lo que cuentan el gestor de incidencias público de dnd5e y su
guía oficial. **No se arrancó Foundry**: nada está visto en ejecución.

### Cómo se estudió

- Con craft-anything: el brief, el plan, tres hallazgos con evidencia, una incógnita y el traspaso. Se recuperaron las
  405 fuentes originales de dnd5e (MIT) desde su mapa de fuentes y se trazó el módulo de tablas del núcleo.
- Los compendios de clases, subclases, especies, trasfondos, dotes y tablas se **copiaron** al scratchpad y se leyeron
  allí, con la librería LevelDB (MIT) que trae Foundry, para no tocar la instalación. Solo se contaron tipos, campos y
  formas; aquí no va ningún dato suyo.
- No se arrancó Foundry porque escribe en la carpeta de datos (registros, el mundo), y la consigna era no modificar
  nada en `/opt/rea-targets`.
- Fuentes web: las incidencias de `foundryvtt/dnd5e` en GitHub (leídas con `gh`), su wiki (la guía de avances, marcada
  como vigente para la 3.0, más antigua que la versión estudiada) y el directorio de paquetes de Foundry.

### 1. El modelo de avances de dnd5e

#### La idea

- Un **avance** es una pieza de datos con tipo que vive **dentro** de un objeto de contenido: clase, subclase,
  especie, trasfondo o dote [O]. No es un documento aparte: va en un mapa por id dentro de los datos del objeto, con su
  propio modelo y sus migraciones [O].
- Cada avance tiene **dos mitades** [O]:
  - la **configuración**, que escribe el autor del contenido (qué se concede, entre qué se elige, cuántos puntos…);
  - el **valor**, que es lo que eligió o recibió el jugador.
- Campos comunes [O]: id, tipo, nivel (uno, o varios según el tipo), nombre, una pista en texto enriquecido, imagen y
  una **restricción de clase**: para todas, solo si es la clase con la que empezó el personaje, o solo si se toma como
  multiclase.
- **Qué tipo cabe en qué contenido** lo dice un registro del sistema [O]: los PG y la subclase, solo en clases; el
  tamaño, solo en especies; la mejora de característica, en clase, especie, trasfondo y dote; el resto, en todos.
- Cada tipo trae **cuatro operaciones** [O]: aplicar (con los datos de su paso), revertir (y devolver lo que quitó para
  poder reponerlo), restaurar, y decir si puede aplicarse sin preguntar y con qué datos.
- Y **dos pantallas** [O]: la de configurarlo (el autor, en la hoja del objeto) y la de su paso en el flujo (el
  jugador).

#### Los nueve tipos

Los nombres son nuestros.

| Tipo | Qué declara el autor | Qué se guarda como elección | Qué hace en el personaje |
|---|---|---|---|
| **Puntos de golpe** | Nada más que el dado de golpe de la clase. Uno por clase, para todos los niveles | Por nivel: máximo, media o un número | Suma al valor actual al aplicarse. El **máximo se deriva** al preparar la hoja de los valores guardados, con el modificador actual y un mínimo de 1 por nivel [O] |
| **Mejora de característica** | Puntos libres, bonos fijos por característica, tope de puntos por característica, características bloqueadas, un máximo de puntuación propio (para subir el techo) y una dote recomendada | Si fue mejora o dote, el reparto o la dote | **Escribe** la puntuación base del actor; si es dote, crea el objeto [O]. En una clase puede cambiarse por una dote si las reglas o un ajuste lo permiten [O] |
| **Rasgo** (competencias) | Lo que se concede siempre y una lista de «N de este conjunto». Las claves son jerárquicas y admiten comodines (todas las habilidades, todas las armas de una categoría). Un modo: competencia, pericia (solo sobre algo que ya tiene), pericia directa, subir un grado o maestría de arma; y si se puede sustituir lo repetido | El conjunto elegido | **Escribe** el grado en el actor [O]. Cubre salvaciones, habilidades, idiomas, armaduras, armas, herramientas, resistencias, inmunidades, vulnerabilidades y estados [O] |
| **Conceder** | Referencias a contenido, cada una opcional o no. Si concede conjuros: la característica (o varias a elegir), cómo se preparan y usos gratis por descanso | Qué objetos se crearon y de qué contenido salen; la característica elegida | **Copia** los objetos al actor con una marca de su avance de origen [O] |
| **Elegir** | Por nivel, cuántos y si se puede **sustituir** uno de antes. Un repertorio de referencias, si se aceptan otros arrastrados y un filtro (tipo, subtipo, nivel, lista y escuela de conjuros) | Lo elegido en cada nivel y cada sustitución (el original y el nuevo) | Como «conceder», y comprueba los requisitos de lo elegido: si algo deja de cumplirlos, lo quita, en cascada [O] |
| **Valor escalado** | Un identificador, un tipo (texto, número, valor de desafío, dados, distancia o usos con su recuperación) y una tabla nivel → valor | Nada | **Nada: se deriva**. En cada nivel vale lo último definido hasta él, y las fórmulas lo leen con un nombre «clase.identificador» [O] |
| **Tamaño** | Los tamaños posibles | El elegido | Escribe el tamaño [O] |
| **Subclase** | Solo el nivel en que se elige | Cuál y su copia | Copia la subclase al actor. Sus propios avances van al nivel de clase [O] |
| **Modificar objeto** | Un efecto y a qué objetos aplicarlo (por identificador) | Qué efecto se puso en qué objeto | Copia el efecto en los objetos del actor que coinciden [O]. Ningún contenido del SRD incluido lo usa [O, datos] |

Cómo lo usa el contenido de serie [O, datos]:

- Las 12 clases del SRD 5.2 llevan 103 concesiones, 82 rasgos, 64 mejoras de característica, 39 valores escalados, 12
  de PG, 12 de subclase y 9 elecciones. 51 rasgos llevan restricción de clase: 40 solo para la inicial y 11 solo para
  multiclase. Los valores escalados son sobre todo números y dados.
- Las especies usan sobre todo concesión y tamaño. Los trasfondos de 2024, una mejora de característica (tres puntos,
  tope de dos, y bloqueadas las tres características que no les tocan), una dote concedida y rasgos.
- Las elecciones con sustitución sirven para lo que se cambia al subir (invocaciones, estilos de lucha).

**Lo que no es un avance** [O salvo donde se dice]:

- los espacios de conjuro y el bono de competencia: se calculan del nivel;
- los conjuros conocidos o preparados de las clases lanzadoras: se añaden a mano desde la hoja. Hay un tipo
  «lanzamiento de conjuros» propuesto y abierto desde 2022 [I, issues #1540];
- **la generación de características**: no hay matriz estándar, compra por puntos ni 4d6; se escriben a mano;
- el **equipo inicial**: clase y trasfondo lo declaran como un árbol de «y / o» con una riqueza alternativa, pero en
  esta versión solo se pinta en la descripción [O; I, issues #3381];
- los **requisitos de multiclase**: la característica principal de la clase solo se muestra en su página; nada impide
  tomarla [O, estático];
- los requisitos de las dotes, salvo tres cosas que sí se comprueban: nivel mínimo, otros objetos que hay que tener y
  si se puede repetir. Lo demás (una característica mínima, por ejemplo) es texto libre [O].

#### Dónde se guarda cada cosa

```
 Compendio                       Personaje (actor)
┌────────────────────┐  copia   ┌────────────────────────────────────────┐
│ Clase              │ ───────▶ │ Clase (copia)                          │
│  avance: config    │          │  avance: config + ELECCIÓN             │
└────────────────────┘          │ Objetos concedidos o elegidos          │
                                │  marca: contenido, avance y raíz       │
                                │ Escrito: puntuaciones, competencias,   │
                                │  tamaño, PG actuales, clase inicial    │
                                │ Derivado: PG máximos y valores         │
                                │  escalados                             │
                                └────────────────────────────────────────┘
```

- **Las elecciones van en la copia del objeto que vive en el actor** [O]. Al soltar una clase en la hoja, el actor
  recibe una copia entera con su configuración, y el valor de cada avance se rellena en esa copia. El original no
  cambia.
- Los objetos concedidos llevan una **marca de procedencia** [O]: el contenido del que salen, el avance que los creó
  (objeto y avance) y la raíz de la cadena. Así se sabe qué quitar al revertir y a qué nivel va algo que concedió un
  rasgo de clase. Las dotes generales no se atan a la clase: van con el nivel de personaje.
- En el actor quedan **los efectos escritos** y la clase inicial [O]. La inicial es la primera que se añadió; si se
  borra, pasa a serlo la de más niveles.
- **La copia no sigue al original** [I, wiki; I, issues #7603]: si el autor cambia la clase del compendio, el
  personaje no se entera. La guía lo avisa y hay una petición abierta para sustituir los objetos desfasados.
- **Un solo origen para reglas y automatización** [O]: la página de una clase en el diario genera su tabla de
  progresión (rasgos concedidos, valores escalados y espacios de conjuro por nivel) a partir de los mismos avances.

### 2. El flujo para el usuario

#### El gestor de pasos

- Todo cambio con avances pasa por **un único gestor** [O]:
  - hace una **copia en memoria del actor** y aplica ahí cada paso;
  - lleva una lista de pasos de cuatro clases (aplicar, revertir, restaurar y borrar), cada uno automático o con
    pantalla;
  - al **terminar**, compara la copia con el actor y lo vuelca todo en una sola operación (crear, cambiar y borrar
    objetos, y el actor);
  - **cerrar a medias** pide confirmación y lo descarta todo: el actor no se toca.
- **Navegación lineal** [O]: anterior, siguiente, volver a empezar (con confirmación) y terminar en el último. Enseña
  «paso X de Y» contando solo los visibles, y en el título el objeto y el nivel.
- **Al retroceder**, el paso se revierte, pero lo elegido se guarda para proponerlo al volver a avanzar [O]. Esa memoria
  solo vive mientras el gestor está abierto.
- **Pasos que nacen de otros** [O]. Si un paso añade un objeto con avances propios (la dote que trae un trasfondo, una
  subclase, una dote elegida en vez de una mejora), el gestor mete sus pasos en el sitio que les toca por nivel. Si un
  paso quita uno, mete su reversión. Al retroceder, los saca.
- **Errores** [O]: si un paso falla (falta el valor de PG, una elección deja de cumplir requisitos), sale un aviso, el
  paso se vuelve interactivo y se marca el campo.
- **Lo automático** [O]:
  - el gestor tiene una opción para aplicar sin preguntar lo que no necesita decisión, pero **viene apagada y nada la
    enciende**: el jugador pasa por cada concesión fija aunque solo pueda pulsar «siguiente»;
  - lo que sí hace cada paso es rellenarse con lo único posible (el rasgo sin alternativa, la lista concedida, el tamaño
    único, los PG del primer nivel).
- **Orden dentro de un nivel**: lo fija el tipo (PG, características, tamaño, rasgos, concesiones, elecciones,
  modificaciones, valores escalados, subclase), no el autor [O]. Hay una petición abierta para ordenarlos a mano
  [I, issues #6005].
- Un **ajuste del mundo** apaga todo el sistema de avances: no se pregunta nada al crear ni al subir [O].

#### Crear un personaje

- **No hay asistente de creación** [O]. Se crea un actor vacío y se le **sueltan** objetos (especie, trasfondo, clase)
  desde un compendio o desde el explorador de compendios. Cada objeto con avances abre el gestor con sus pasos hasta el
  nivel actual.
- Reglas al soltar [O]:
  - una sola especie y un solo trasfondo;
  - no se pueden soltar a la vez varios objetos con avances: se avisa y se ignoran;
  - una subclase, solo si su clase no tiene ya otra.
- Las características se escriben a mano antes, y las mejoras de especie o trasfondo se suman al pasar su paso [O]. No
  hay un orden obligado [I, wiki].
- El hueco lo cubren módulos de la comunidad: creadores de personaje y avance de conjuros [I, web: están en el
  directorio de paquetes].

#### Subir de nivel

- Cada clase de la hoja tiene un **selector de nivel** del 1 al 20 que enseña la diferencia (+1, +2…) y desactiva lo
  que pasaría del 20 total [O]. Soltar otra vez la misma clase también suma niveles.
- Se pueden subir **varios niveles de golpe**: el gestor encadena los pasos nivel a nivel [O].
- **Orden en cada nivel** [O]: especie (al nivel de personaje), clase y subclase (al nivel de clase), y después dotes y
  trasfondo (al nivel de personaje, o al de clase si los concedió un rasgo de clase).
- **PG** [O]:
  - en el nivel 1 de la clase inicial, el máximo, sin preguntar;
  - después: tirar el dado (la tirada va al chat), escribir un número o marcar «usar la media». Si el nivel anterior
    fue media, propone media;
  - el número se puede escribir a mano, sin control del máster.
- La experiencia no avisa de que toca subir: su barra solo informa [I, estático].

#### Multiclase

- Añadir otra clase es **soltarla en la hoja**: abre el gestor con su nivel 1 [O].
- Lo que cambia por ser multiclase lo declara el contenido con la restricción de clase de cada avance (competencias
  reducidas, salvaciones solo en la inicial) [O]. Los PG del nivel 1 de la segunda clase sí se preguntan.
- **No comprueba los requisitos de característica** para multiclasear [O, estático].
- Fallos recientes: valores escalados de rasgos de una clase que suben con la otra, y el total de PG anteriores mal
  calculado al multiclasear [I, issues #6499, #7696 y #7697, ya cerrados].

#### Bajar de nivel, borrar y cambiar elecciones

- **Bajar** con el selector abre un diálogo [O]. Avisa de que se borrarán las elecciones de esos niveles y trae una
  casilla, marcada, para quitar también sus efectos:
  - con la casilla, el gestor revierte en orden inverso y sin preguntar nada;
  - sin ella, solo baja el número y deja todo lo concedido [O; I, wiki].
- **Lo elegido en los niveles quitados se pierde** al terminar: al volver a subir se pregunta de nuevo [O, la memoria
  solo vive en el gestor]. No hay versiones del personaje: ni en dnd5e ni en Foundry (ver
  `sincronizacion-e-historial.md`).
- **Borrar** una clase, especie, trasfondo o dote con avances pregunta lo mismo y revierte todo lo suyo [O].
- **Cambiar las elecciones de un nivel pasado** [O]: en la pestaña de avances de la clase del personaje hay un botón
  por nivel. Revierte desde el nivel actual hasta ese, vuelve a preguntar ese nivel y **restaura solos** los de encima
  con lo que tenían. Si algo ya no vale, ese paso pasa a preguntarse.
  - Quejas: también repasa los avances de lo elegido en niveles superiores [I, issues #6664], y para cambiar un solo
    avance hay que pasar por todos los de su nivel [I, issues #4783].
- **Añadir un avance nuevo** a una clase que ya tiene el personaje revierte desde ese nivel, lo aplica y restaura lo
  demás [O].
- **Lo editado a mano durante el proceso se pierde** al terminar, porque se vuelca la copia [I, wiki y el volcado sin
  mezcla].

#### Límites conocidos (incidencias públicas)

- **Efectos escritos sin contar las fuentes**:
  - si dos fuentes dan la misma competencia y se quita la primera, se pierde aunque la otra la siga dando [I, issues
    #4415, abierta];
  - al revés, una herramienta concedida sigue en la hoja después de deshacer [I, issues #6577, abierta];
  - las dos cosas salen de escribir el resultado en el actor y deshacer con la operación inversa [I].
- **Sin variables entre avances**: un avance no puede usar lo que eligió otro (elige una característica, súbela y úsala
  en el rasgo concedido), ni hay un almacén común para no ofrecer dos veces la misma opción desde dos clases
  [I, issues #1469 y #1621, abiertas desde 2022].
- **Piezas que faltan** [I, issues, abiertas]: conjuros como avance (#1540), equipo inicial (#3381), ver las opciones no
  disponibles y su motivo (#3626), no poder elegir dos veces el mismo conjuro (#7031) y sustituir una opción de clase al
  subir (#7217).
- La configuración de los avances de una clase ya puesta en un personaje solo se edita con un interruptor, y su copia
  diverge de la del compendio [I, wiki].

### 3. Las tablas aleatorias del núcleo

#### El modelo

- Una **tabla** es un documento del mundo o de un compendio [O]: nombre, imagen, descripción enriquecida, carpeta,
  permisos por usuario y además:
  - una **fórmula** de dados; vacía, vale «1dN», con N la suma de los pesos;
  - **reemplazo** sí o no (por defecto, sí);
  - si se **enseña la tirada** en el chat.
- Cada **resultado** es un documento incrustado [O] con:
  - un tipo: **texto** (nombre y descripción enriquecida, con enlaces y tiradas en línea) o **documento** (una
    referencia a cualquier documento: actor, objeto, página, otra tabla…, del que toma nombre e imagen si faltan);
  - un **rango** [mín, máx] de la fórmula, y un **peso** que solo sirve para recalcular los rangos;
  - una marca de **sacado**.
- **Una tabla anidada** no es un tipo aparte: es un resultado de tipo documento que apunta a otra tabla [O].
- Utilidades [O]:
  - normalizar: rangos seguidos según el peso y fórmula 1dN;
  - reiniciar: desmarcar todo;
  - crear una tabla con los documentos de una carpeta, con peso 1 cada uno;
  - incrustarla en una página del diario con un botón para tirar;
  - arrastrarla a la barra de macros para tirar con un clic.

#### Cómo se resuelve una tirada

Todo ocurre en el **navegador de quien tira** [O]:

1. Si no hay fórmula guardada, normaliza, y lo guarda si puede editar la tabla.
2. Si no quedan resultados sin sacar, o ninguno cae entre el mínimo y el máximo posibles de la fórmula, avisa y no saca
   nada.
3. Tira y busca los resultados no sacados cuyo rango contiene el total. Si no hay ninguno (un hueco o uno ya sacado),
   **vuelve a tirar**, hasta 10.000 veces.
4. Puede salir **más de un resultado** si los rangos se solapan.
5. Si un resultado apunta a otra tabla, tira en ella y lo sustituye por lo que salga, hasta **5 niveles**.

Además [O]:

- **Sin reemplazo**, marca como sacados los resultados, también los de las tablas anidadas que sean sin reemplazo. La
  marca es **del documento**: la comparten todos los usuarios y todas las partidas del mundo, y se borra al exportar a
  un compendio.
- **Desde un compendio** no se puede tirar sin reemplazo.
- Desde la hoja se puede sacar un resultado concreto sin tirar y marcar o desmarcar cada uno (marcar exige ser dueño).
- Su API permite «tirar N veces»: encadena tiradas y las junta en un solo mensaje.
- La animación de la hoja al tirar es un ajuste del mundo.

#### Cómo se registra

- Como **un mensaje de chat** [O]: autor, orador, el sonido de dados si hubo tirada, la tirada (si la tabla la enseña),
  una tarjeta con la descripción de la tabla y cada resultado (nombre, imagen y enlace si es un documento) y una marca
  con la tabla de origen.
- La visibilidad es la del **modo de mensaje** que tenga elegido el usuario en el chat: público, solo máster, a ciegas
  o solo para él [O].
- Las partes secretas de la descripción de la tabla y de los resultados solo las ve quien es dueño [O]. Las tiradas en
  línea del texto de un resultado se resuelven al montar la tarjeta, también en el cliente [O].
- No hay otro registro: la tirada es el mensaje [I].

#### Quién puede qué

- Como cualquier documento [O]: verla exige permiso limitado; crearla y borrarla, ser ayudante o máster; cambiarla,
  ser dueño.
- **Quien ve la tabla ve todos sus resultados**: no hay resultados ocultos, solo bloques secretos dentro del texto [O].
- **Tirar con reemplazo**: basta el permiso limitado, aunque no pueda editarla [O].
- **Tirar sin reemplazo**: hay que poder marcar los resultados, y eso exige ser dueño (a quien no es máster solo le deja
  cambiar la marca, pero siendo dueño) [O]. Un jugador sin propiedad no puede tirar en ella [I].

#### Cómo las usa dnd5e

- 31 tablas en el SRD 5.1 y 66 en el 5.2 [O, datos]. Casi todas con reemplazo, una fórmula de dados y peso 1 en cada
  resultado. La mayoría de resultados son texto; los enlaces apuntan a criaturas, objetos y, en 6 casos, a otras tablas.
- Tres apaños que retratan el modelo [O, datos; I la intención]:
  - **una baraja** de cartas mágicas es una tabla sin reemplazo: sacar una carta es marcarla;
  - **«varias cosas a la vez»**: una tabla con fórmula constante y tres resultados con el mismo rango, dos de ellos
    enlaces a otra tabla, saca de una tirada dos idiomas y un texto fijo;
  - **una tabla de doble entrada** (filas por caso, columnas por resultado) se codifica con rangos solapados: una tirada
    devuelve un resultado por fila, y cada texto lleva delante su caso.

## Compromisos y límites

### Avances

**Lo que ganan**:

- El contenido **se describe a sí mismo**: con un catálogo pequeño de tipos cubren las clases, especies, trasfondos y
  dotes del SRD, y el mismo dato pinta la tabla de la clase y automatiza la ficha.
- **Transacción**: crear, subir, bajar o borrar es todo o nada, con marcha atrás dentro del proceso.
- Los **pasos que traen otros pasos** (la dote del trasfondo, la subclase) se resuelven solos.

**Lo que pierden**:

- **Mezcla de dos estilos**: unos efectos se derivan (PG máximos, valores escalados) y otros se escriben y se deshacen
  con la operación inversa (puntuaciones, competencias, tamaño). Los escritos fallan con varias fuentes o con
  ediciones a mano.
- **Copia, no referencia**: lo que cambia el autor no llega a los personajes.
- **Memoria efímera y sin versiones**: bajar y volver a subir lo pregunta todo otra vez.
- **Flujo lineal**: cambiar el nivel 1 obliga a pasar por todo lo de después; no hay vista de lo pendiente.
- **Piezas fuera**: características iniciales, conjuros, equipo y requisitos de multiclase.
- **Atado a 5e y a código**: el tipo «rasgo» conoce la pericia y la maestría, y la lógica de cada tipo es código del
  sistema; otro sistema necesita programar los suyos [I].
- **Confianza ciega**: todo corre en el cliente con los permisos del dueño; el jugador escribe los PG que quiera [O].

Frente a D&D Beyond: los dos suben cambiando el nivel de la clase, pero D&D Beyond navega libremente por secciones con
lo pendiente marcado y conserva las elecciones al bajar (ver su nota); dnd5e es un asistente lineal que olvida.

### Tablas

**Lo que ganan**: un modelo mínimo y general (fórmula, rangos, resultados de texto o enlace) que sirve para casi todo;
anidar por enlace; incrustar en el diario; tirar desde una macro.

**Lo que pierden**:

- La tirada se hace en el **cliente**: no se puede verificar.
- El estado «sacado» es **global** y exige ser dueño; desde un compendio no se puede tirar sin reemplazo.
- **Huecos y solapes callados**: un hueco se arregla tirando otra vez (hasta 10.000), y un solape devuelve varios
  resultados sin avisar. No se valida al guardar.
- **Sin forma explícita** de sacar varios, de tablas de doble entrada o de «tirar en varias subtablas»: se hace con
  apaños.
- **Sin modificadores** a la tirada según el personaje o la situación, ni condiciones.
- **Sin registro** aparte del chat ni resultados ocultos a los jugadores.

## Qué nos llevamos a Crisol

1. **Un catálogo cerrado de pasos neutros, con la configuración separada de la elección.** Copiamos el corte autor /
   jugador y el registro «qué paso cabe en qué contenido», pero con tipos que no sepan de 5e: conceder, elegir N
   (lista o filtro sobre el contenido del sistema, con sustitución), repartir puntos (fijos, tope, bloqueadas),
   elegir claves de un conjunto del sistema (con un «modo» que es el valor que se escribe), tabla por nivel, PG, elegir
   subtipo, opción simple y **generar características** (matriz, compra por puntos, dados, manual), que dnd5e no
   tiene. Pericia o maestría son parámetros, no tipos: un sistema nuevo se escribe solo con datos.
2. **Las elecciones son la verdad; la ficha se deriva.** Nada de escribir en las puntuaciones base o las competencias:
   el personaje es «base + elecciones por (contenido, paso, nivel)» y el motor lo recalcula contando las fuentes, como
   ya hace con los efectos. Así no hay #4415 ni #6577, bajar de nivel es quitar las elecciones de encima, y la hoja
   puede decir de dónde sale cada cosa.
3. **Referencia al contenido, no copia.** El personaje apunta al contenido por su clave (y la edición de la campaña) y
   solo guarda sus elecciones. Si el contenido cambia, los pasos se recalculan y lo que no cuadre sale como pendiente
   (!), en vez de divergir en silencio.
4. **La lista de pasos se calcula, no se encola.** Derivarla siempre de las elecciones actuales, incluidos los pasos
   que traen los objetos concedidos o elegidos, da la navegación libre con (!) que pidió Enrique: cambiar algo del
   nivel 1 solo marca lo que depende de ello, sin repasarlo todo. El orden dentro de un nivel, el que escriba el autor.
5. **Borrador en el servidor, una escritura y una versión.** De dnd5e, la transacción; pero en el servidor: un borrador
   de creación o subida que se valida entero y se confirma en una sola escritura con control de versión (su volcado
   pisa lo que otros cambiaron). Al confirmar, la versión automática («Nivel 5»). Lo que se quite al bajar queda en esa
   versión y, si vuelve a subir, se propone por defecto.
6. **Automático lo que no se decide, y la misma lista para la IA.** Cada tipo dice cuándo no hay nada que decidir (una
   sola opción, concesiones fijas, PG del nivel 1): se aplica y se resume, sin pantallas de «siguiente» vacías. El MCP
   recibe esa misma lista de decisiones pendientes con sus opciones válidas, para que la IA haga un personaje entero.
7. **Requisitos como fórmulas, con su motivo, y dados en el servidor.** Requisitos de dotes, de multiclase y de
   opciones, y el «solo clase inicial / solo multiclase», como expresiones del lenguaje de fórmulas del sistema sobre
   la ficha derivada. La pantalla enseña lo no disponible y por qué. PG y 4d6 se tiran en el servidor con su registro,
   y el máster decide si se puede escribir el número.
8. **Valores escalados con nombre estable y tabla de clase generada.** Tal cual: una tabla nivel → valor en la clase,
   derivada y legible desde las fórmulas por un nombre estable; y con esos mismos datos, la tabla de progresión de la
   clase en la wiki o el compendio.
9. **Tablas: el mismo modelo mínimo, pero tiradas en el servidor y con su estado por campaña.** Fórmula opcional (1dN
   por pesos), rangos, resultados de texto (con tiradas en línea), enlace a página o contenido, y a otra tabla (con tope
   de profundidad y sin ciclos), con o sin reemplazo. Distinto: se tira en el servidor y va al registro de tiradas con
   su visibilidad, como `tirar_dados`; lo sacado se guarda **por campaña** (así sirve desde el sistema o la cuenta);
   al guardar se valida que los rangos cubren la fórmula sin huecos ni solapes; y es explícito lo que Foundry hace con
   apaños: sacar N, tirar en varias subtablas y doble entrada. El resultado sale estructurado para `tirar_en_tabla` y
   para el creador (rasgos de personalidad, bagatelas).
