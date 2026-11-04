# El contenido 5e y su mecánica en D&D Beyond

Módulo de Crisol: 3. Sistemas, fichas y dados (capacidad `srd-5e`) · Fecha: 2026-11-04 · Versión estudiada: la web
pública de dndbeyond.com (centro de ayuda, notas de cambios hasta el 30-10-2026, blog y foros oficiales), sin entrar con
ninguna cuenta

## Pregunta

Para la spec de `srd-5e` (el 5e de serie, con todo el SRD 5.1 y el 5.2.1, automatizado y con un modelo que valga para
todo el 5e oficial; ver `docs/modulos.md`, «#### `srd-5e`»), queríamos saber:

1. **Fuentes y ediciones**: dónde se eligen las fuentes y lo «legado» (personaje, campaña o los dos); qué hace
   exactamente el interruptor de legado; si el máster puede limitar las fuentes de su campaña; cómo se ve lo que está en
   las dos ediciones; y qué reglas generales cambian entre 2014 y 2024 y cómo las resuelven.
2. **Cómo modelan la mecánica**, sobre todo según su editor de contenido propio: los tipos de modificador y a qué se
   aplican, los usos limitados y su recuperación, cómo escala un conjuro, cómo concede un rasgo acciones, conjuros u
   opciones, la sintonía y lo equipado, los dados de daño con su tipo, las condiciones de un modificador y qué dejan
   como texto.
3. **Criaturas**: qué partes de un statblock son datos y cuáles texto.

El creador, la hoja, las tiradas y el inventario ya se estudiaron en vivo en `creador-y-hoja.md`, y los enlaces, el
lector y los statblocks de los libros en `contenido-y-enlaces.md`. Aquí no se repiten: se citan.

Grado de certeza: todo es **[I]**, información pública, y cada marca enlaza a su fuente (lista al final). El tipo de
fuente va en la clave del enlace: `ayuda-…` (centro de ayuda oficial), `cambios` (notas de cambios oficiales, con la
fecha de la entrada), `blog-…` (artículos de dndbeyond.com), `foro-…` (foros oficiales: se dice si escribe el personal
de D&D Beyond o son usuarios). Lo deducido sin fuente directa va como **[I, inferido]**.

Una advertencia de partida: las guías de su editor son de 2017 a 2024 y el editor ha cambiado desde entonces. Lo que
describen es el modelo de fondo, no la pantalla de hoy.

## Lo que hacen

### 1. Fuentes y ediciones

#### Dónde se eligen: en cada personaje, nunca en la campaña

- **Por personaje.** Las fuentes son casillas por categoría en el inicio del creador y en los ajustes del personaje.
  Un personaje normal nuevo empieza con todas marcadas; los prediseñados pueden traer otras [I][ayuda-categorias]. Lo
  que pasa en el creador al quitarlas está en `creador-y-hoja.md` (punto 1, «2014 frente a 2024»).
- **Un valor por defecto por usuario.** Desde noviembre de 2024, cada cual guarda qué categorías quiere marcadas en sus
  personajes nuevos [I, cambios 2024-11-14][cambios].
- **Las categorías de hoy** [I][ayuda-categorias] [I, cambios 2024-11-14][cambios]:

  | Categoría | Qué trae |
  |---|---|
  | Contenido propio | Lo que crean los usuarios |
  | Núcleo | Las reglas básicas gratuitas y los tres libros básicos de 2024 |
  | Ampliado | Los demás libros oficiales que siguen las reglas de 2024 |
  | Núcleo de 2014 | Las reglas básicas y los tres libros básicos de 2014 |
  | Ampliado de 2014 | Los suplementos de 2014 |
  | Legado o no núcleo | Lo descatalogado, lo benéfico y lo que se ha reeditado |
  | Socios | Las editoriales asociadas, en bloque o una a una |

  Cada categoría lleva una línea que la explica, y las listas del creador se agrupan por ellas, en grupos plegables
  [I, cambios 2024-11-14][cambios].
- **El núcleo de 2024 no se pudo apagar hasta junio de 2025.** Al principio, lo de 2024 siempre estaba [I, cambios
  2024-09-03][cambios]. Desde el 9-6-2025 hay una casilla para quitarlo, y se avisa en cada paso de que con pocas fuentes
  no se puede terminar el personaje [I, cambios 2025-06-09][cambios]. El creador rápido impide desde octubre de 2026
  apagar las dos ediciones a la vez [I, cambios 2026-10-30][cambios].
- **Lo que se ve depende también de lo que se tiene.** Lo no comprado no sale. Con una suscripción alta, una campaña
  puede compartir el contenido de todos sus miembros (hasta cinco campañas, de doce jugadores más el máster). Lo
  compartido solo vale para los personajes activos de esa campaña, y solo si su categoría está marcada en el personaje
  [I][ayuda-compartir] [I][ayuda-adicional].

#### El máster no puede limitar las fuentes de su campaña

- **No hay ajuste de reglas ni de edición en la campaña.** Cada personaje decide sus fuentes. El artículo oficial para
  pasar una campaña a las reglas de 2024 recomienda duplicar cada hoja y rehacerla en el creador con la clase nueva
  [I][blog-1875].
- **La «gestión de contenido» (2019) solo bloquea la lectura** [I][cambios-575]:
  - aparece al activar el contenido compartido;
  - el máster bloquea un libro compartido, y los jugadores que no lo tienen dejan de poder leerlo en el compendio;
  - lo gratuito no se puede bloquear, y quien compró el libro lo sigue viendo;
  - **el creador, la hoja y los encuentros siguen ofreciendo lo bloqueado.** Se prometió para más adelante. En 2024 los
    usuarios confirman que sigue igual [I, foro de usuarios][foro-205106].
- **Lo piden desde 2024**: muchos hilos piden un «apagar 2024» por campaña o por personaje [I, foro de
  usuarios][foro-206666] [I, foro de usuarios][foro-207343].
- **Está en su hoja de ruta de 2026, pero en «después», sin empezar**: un flujo para que el máster diga qué campaña lleva,
  qué contenido vale y con qué valores por defecto [I][hoja-de-ruta].
- Lo que sí puede el máster: ver y editar las hojas de sus jugadores (`creador-y-hoja.md`, punto 4).

#### Qué hace exactamente el interruptor de legado

Hay que separar **la etiqueta** de **la casilla**, que se llaman igual.

- **La etiqueta «legado»** marca lo que ya no sigue las reglas o la ambientación vigentes porque hay una versión más
  nueva. Va en cada cosa, no en el libro: un libro puede tener unas cosas marcadas y otras no [I, cambios
  2024-09-03][cambios]. De 2014 la llevan, si tienen versión de 2024 [I, cambios 2024-09-03][cambios]:
  - las clases;
  - las subclases;
  - las especies, los trasfondos y las dotes;
  - los objetos;
  - los conjuros;
  - los monstruos.

  En 2026 aún se corrigen cosas a las que les faltaba la etiqueta [I, cambios 2026-09-28][cambios].
- **La casilla** ha cambiado tres veces:
  1. **El plan de agosto de 2024** sustituía los conjuros y objetos de 2014 por los de 2024; para seguir con los
     antiguos, había que copiarlos como contenido propio. Hubo protestas y lo retiraron en una semana: quien tiene los
     libros de 2014 conserva sus opciones y puede elegir de las dos ediciones [I][blog-1806] [I, cambios][cambios].
  2. **En septiembre de 2024**, la casilla de legado agrupaba lo de 2014 que tenía versión nueva y lo «no núcleo». Venía
     marcada, y desmarcarla escondía esas opciones; lo de 2024 seguía siempre [I, cambios 2024-09-03][cambios].
  3. **Desde noviembre de 2024**, esa categoría se partió: el núcleo de 2014 tiene su casilla, y «legado» queda para lo
     descatalogado o reemplazado [I, cambios 2024-11-14][cambios]. La ayuda de noviembre de 2025 añade: lo reeditado
     pasa al libro más reciente, y si las dos versiones siguen y difieren mucho, la vieja lleva la etiqueta y solo sale
     con la casilla de legado [I][ayuda-categorias].
- **Respuesta corta**: hoy la casilla de legado no esconde «todo 2014». Esconde lo descatalogado, lo reemplazado y lo no
  núcleo. Para quitar todo 2014 hay que desmarcar además el núcleo y el ampliado de 2014 [I, inferido de las dos
  fuentes anteriores]. No queda claro qué casilla manda en un conjuro del manual de 2014 con versión de 2024 (ver «Lo que
  no se pudo ver»).
- **Además, la clase filtra sola** [I, personal de D&D Beyond][foro-204813] [I, cambios 2024-09-03][cambios]:
  - **una clase de 2014** ve las dos versiones de cada conjuro que cambió, con la de 2014 marcada;
  - **una clase de 2024** solo ve las de 2024, más los conjuros de otros libros;
  - **una subclase antigua en una clase de 2024** usa la lista de conjuros de 2024, y sus conjuros de dominio pasan a
    ser los de 2024;
  - **una subclase que tiene versión de 2024** no se puede usar con la clase de 2024, solo con la de 2014.
- **Lo que no se duplica**: las armas y armaduras normales no tienen versión de 2024, porque los objetos mágicos
  cuelgan de ellas; solo ganan la maestría. El resto del equipo sí tiene entidad nueva [I, personal de D&D
  Beyond][foro-204813].
- **Mezclar en un personaje** está permitido, con dos vetos y una red [I][ayuda-5e-juntos]:
  - **multiclase**: las clases de 2014 y 2024 no se mezclan (`creador-y-hoja.md`). Desde septiembre de 2025 tampoco una
    clase con su propia versión antigua, salvo si se apagan los requisitos de multiclase [I, cambios
    2025-09-02][cambios];
  - **una especie de 2024 con un trasfondo de 2014** se quedaría sin mejoras de característica: el creador las ofrece
    igualmente [I, personal de D&D Beyond][foro-204813];
  - **un trasfondo de un libro antiguo con reglas de 2024** pide además elegir una dote de origen y las mejoras de
    característica nuevas [I, cambios 2024-09-03][cambios].

#### Cómo se ve lo que está en las dos ediciones

- **Son dos entidades distintas con el mismo nombre**, no una con dos versiones [I, personal de D&D
  Beyond][foro-204813].
  - La de 2014 lleva la etiqueta de legado.
  - Desde marzo de 2026 todo lleva además «5e» (2014) o «5.5e» (2024). Lo explican así: el año se escaneaba peor y no
    decía si las reglas casan. Es solo etiqueta: nada cambia de reglas ni de compras [I, cambios 2026-03-02][cambios]
    [I][ayuda-5e-cambio] [I][ayuda-5e-anio] [I][ayuda-5e-saber].
- **Agrupado, no fundido**: el creador agrupa por categoría de fuente, y conjuros y objetos se filtran por categoría
  [I, cambios 2024-11-14][cambios]. También se filtra por edición:
  - la biblioteca, por «reglas» (5e, 5.5e o todo) [I, cambios 2025-12-17][cambios];
  - los prediseñados [I, cambios 2026-10-30][cambios];
  - el creador rápido enseña siempre el libro en cada clase [I, cambios 2026-10-23][cambios].

  No se vio en qué orden salen las dos versiones (ver «Lo que no se pudo ver»).
- **El precio son las listas dobles**: con una clase de 2014, casi cada conjuro sale dos veces, y los usuarios lo sufren
  [I, foro de usuarios][foro-207343] [I, foro de usuarios][foro-205106].
- **Los enlaces**:
  - en el plan de agosto de 2024 (una entrada luego retirada), el enlace de un libro iba a la versión que existía al
    publicarlo, y el de uno posterior, a la nueva [I, cambios 2024-08-21, retirada][cambios];
  - una dirección con solo el nombre lleva a la versión más antigua (`contenido-y-enlaces.md`).
- **Enlazar la versión equivocada es un fallo constante.** Las notas de cambios de septiembre y octubre de 2026 traen
  muchas correcciones [I, cambios 2026-09-08 a 2026-10-23][cambios]:
  - objetos y subclases de 2024 que añadían los conjuros de 2014, o al revés;
  - una dote que solo traía conjuros de legado y se quedaba vacía al quitar el legado;
  - especies antiguas a las que les faltaban «los conjuros de 5.5e»;
  - un objeto mal repartido entre las dos ediciones.

  Lo último sugiere que cada «concede tal conjuro» apunta a una entidad concreta, y que han tenido que poner las dos
  versiones a mano [I, inferido].

#### Las reglas generales que cambian, y cómo las resuelven

No hay una regla única: cada cosa la resuelven de una manera.

| Regla | Cómo la resuelven |
|---|---|
| Nombres (especie, inspiración heroica, acciones «Magia» y «Utilizar», «Influir» y «Buscar», puntuación de iniciativa) | Cambian para todos los personajes, también los de 2014, con un texto que no altera las reglas de 2014 [I, cambios 2024-09-03][cambios]. Hay quejas de que la inspiración ya no enseña su texto antiguo [I, foro de usuarios][foro-206666] |
| Estados (el agotamiento, sobre todo) | Cada estado enseña el texto de 2024 y debajo el de 2014, marcado como legado. Apagar el núcleo de 2024 no lo cambia [I, cambios 2024-09-03 y 2025-06-09][cambios] |
| Efectos del agotamiento | No se aplican a las tiradas; se apuntan solo los niveles [I, foro de usuarios, 2026][foro-238294] |
| Descanso largo (dados de golpe) | Se pregunta en cada descanso con qué reglas (`creador-y-hoja.md`, «Descansos») |
| Maestría de armas | Solo se enseña si el personaje tiene el rasgo o la dote que la da [I, cambios 2024-09-03][cambios] |
| Preparar conjuros | Las clases de 2024 cambian sus conjuros tras un descanso largo y preparan los que marca su tabla, sin depender del modificador [I, personal de D&D Beyond][foro-204813] |
| Rasgos con el mismo nombre en las dos clases | Cada clase el suyo: el dado de Artes marciales de cada monje no se distinguió hasta junio de 2025 [I, cambios 2025-06-09][cambios]. El arma de pacto de cada brujo es una combinación distinta de modificadores [I, personal de D&D Beyond][foro-76031] |
| Orden del creador | El de 2024 para todos [I, cambios 2024-09-03][cambios] |
| Statblocks | Se anunció la maqueta de 2024 para todos: iniciativa, todas las salvaciones, nombres cortos [I, cambios 2024-08-21, retirada][cambios] |
| Dificultad de encuentros | El antiguo creador de encuentros usa la guía de 2014; su mesa virtual, la de 2024 [I][ayuda-encuentros] [I][ayuda-dificultad] |
| Reglas gratuitas | Dos conjuntos: las básicas de 2014 (como legado) y unas básicas nuevas hechas con el SRD 5.2 (abril de 2025) [I, cambios 2025-04-22][cambios] |

En resumen: unas cosas dan los dos textos y no automatizan, otras preguntan al usarlas, otras siguen la edición de la
clase, y en las herramientas comunes manda la regla de 2024. No hay un ajuste de reglas en la campaña.

### 2. Cómo modelan la mecánica

#### El editor de contenido propio es el suyo

- **El editor es la misma herramienta con la que el equipo mete el contenido oficial.** Lo dicen el tutorial del foro
  de 2017, que enlaza la ayuda, y la guía de su personal de 2020–2024. Por eso recomiendan copiar algo oficial como
  plantilla y mirar cómo está hecho [I, guía del foro oficial][foro-3625] [I, personal de D&D Beyond][foro-76031].
  Así que el editor enseña el modelo.
- **Siete tipos de contenido propio** [I][ayuda-elementos] [I][ayuda-homebrew]:
  - trasfondo, dote, especie y subclase;
  - objeto mágico, conjuro y monstruo.

  **No hay clases propias** [I][ayuda-sin-clases]. Además:
  - crear exige una suscripción [I][ayuda-homebrew];
  - copiar algo oficial como plantilla exige haberlo comprado [I][ayuda-plantilla];
  - desde 2024, la plantilla puede ser de 2024 o de legado [I, cambios 2024-09-03][cambios];
  - los trasfondos de 2024, que dan mejoras de característica, no se pueden hacer como propios [I, personal de D&D
    Beyond][foro-204813].
- **La forma de cada cosa**: campos de datos, uno o varios textos con formato y unos subformularios que se repiten en
  todas [I, personal de D&D Beyond][foro-76031] [I, cambios 2018-04-16][cambios-204]:
  - modificadores;
  - conjuros;
  - acciones;
  - opciones;
  - criaturas;
  - requisitos;
  - escalado por nivel;
  - usos limitados.
- **Ellos mismos admiten que sus reglas están «en el código»**: su hoja de ruta de 2026 rehace la plataforma para que
  reglas, contenido y acceso sean datos y no lógica escrita a mano, y así sacar opciones nuevas más deprisa [I][blog-2132]
  [I][hoja-de-ruta].

#### Los modificadores

**La forma de un modificador** [I, personal de D&D Beyond][foro-76031]:
- un **tipo** (la familia: bono, fijar, ventaja…) y un **subtipo** (a qué toca: una característica, la CA, una
  habilidad, un tipo de daño…). Cada subtipo es de un tipo;
- y, si hace falta:
  - una característica;
  - un número de dados y su dado;
  - un valor fijo;
  - un bono que crece con la competencia o con el número de objetos sintonizados;
  - un texto de detalle libre;
  - una duración con su unidad.

  La duración apenas sirve: la hoja no tenía efectos temporales.

**Las familias** (descritas con nuestras palabras) [I, personal de D&D Beyond][foro-76031] [I][blog-1103]:

| Familia | Qué hace | Sobre qué, por ejemplo |
|---|---|---|
| Bono | Suma un número, un dado o una característica | Características y su máximo, CA (a secas, con armadura o sin ella), ataque y daño de un arma mágica, iniciativa, pruebas, salvaciones |
| Fijar | Pone un valor que no se suma a otro | Una característica, la CA sin armadura, los huecos de sintonía |
| Fijar la base | Pone un mínimo que otros bonos pueden subir | El alcance de un sentido |
| Bono acumulable | Se suma al final, sobre el resultado ya calculado | Las características |
| Ventaja y desventaja | Marca una tirada | Salvaciones, pruebas de una característica, Sigilo (por la armadura) |
| Grados de competencia | Competencia, media (redondeando abajo o arriba), pericia, o doble sin exigir competencia antes | Habilidades, herramientas, salvaciones, armas, armaduras; a veces «elige una» |
| Defensas | Resistencia, inmunidad y vulnerabilidad | Tipos de daño, críticos, ataques a distancia |
| Sentidos | Conceder uno con su alcance | Vista ciega, visión en la oscuridad, sentido sísmico, visión verdadera |
| Idiomas y dotes | Conceder uno o dejar elegir | Especies y subclases |
| Tamaño y carga | Cambiar el tamaño o la capacidad de carga | Las especies; la hoja solo calcula de pequeño a grande |
| Ignorar | Quitar una regla | Los límites de luchar con dos armas, la penalización de velocidad por armadura pesada, la Destreza en la CA sin armadura |
| Propiedades de arma | Añadir o quitar una propiedad, o cambiar el tipo de daño | Solo armas mágicas |
| Daño | Dados con su tipo, o daño adicional | Armas mágicas y conjuros |
| Para un rasgo concreto | Familias que solo existen para una cosa | Mejorar un truco del brujo, activar el arma de pacto o el arma maldita, y cambiar la característica de esa arma |

Lo que no cuadra:
- **Seis familias más existían en el editor sin efecto alguno en la hoja**, en 2020 [I, personal de D&D
  Beyond][foro-76031].
- **Cada tipo de contenido admite unas familias.**
  - Los objetos mágicos no admiten elecciones.
  - En los conjuros solo hacen algo el bono y el daño, porque la hoja no tenía efectos temporales [I, personal de D&D
    Beyond][foro-76031].
- **Lo condicional no se puede decir.** «Si ya tienes la competencia, ganas pericia» no cabe en un modificador. Los
  usuarios hacen dos versiones de la misma dote [I, foro de usuarios][foro-13329].
- **El orden importa sin decirse.** Un «fijar» puede anular un «bono» de otro sitio. Una CA sin armadura se arma con
  tres piezas: fijar la base, sumar la característica e ignorar la Destreza [I, foro de usuarios][foro-67573] [I, foro
  de usuarios][foro-68414].
- **Hay nombres con efecto.** Para que una subclase de una clase sin magia lance conjuros, uno de sus rasgos tiene que
  llamarse literalmente como el rasgo de lanzar conjuros (o el de magia de pacto) [I, cambios 2018-04-16][cambios-204].

#### Las condiciones de un modificador

No hay condiciones generales. Se dicen de cuatro maneras:

1. **Por el estado del objeto**: lo de un objeto cuenta si va equipado (`creador-y-hoja.md`, punto 5) y, si pide
   sintonía, solo si está sintonizado [I, personal de D&D Beyond][foro-76031]. En octubre de 2026 aún corregían un hacha
   que daba sus bonos sin sintonizarla [I, cambios 2026-10-12][cambios].
2. **Dentro del subtipo**: «CA con armadura», «CA sin armadura», «Destreza máxima con armadura»… La condición es otro
   subtipo [I, foro de usuarios][foro-67573] [I, foro de usuarios][foro-68414].
3. **En el texto de detalle**, que la hoja enseña como nota y el jugador aplica. Por ejemplo, +2d6 contra aberraciones
   va como daño adicional, y el «contra quién», en el texto [I][blog-1103]. La ventaja «solo en cierto caso» sale como
   nota y no se aplica sola (`creador-y-hoja.md`, punto 4).
4. **Activando un rasgo (2024)**: los «efectos activos del personaje». Se activa la furia, una forma o el rasgo de
   nivel 20 de un paladín desde el propio rasgo, y sus efectos se aplican en toda la hoja mientras dura [I, personal de
   D&D Beyond][foro-204813]. Lo anunciaron solo para el contenido oficial de 2024, con la idea de llevarlo al antiguo.

Además, los **estados** que un conjuro o un objeto aplica, quita o suspende se apuntan con su duración, pero **solo
salen en las notas**: nunca se ponen en la hoja [I][blog-1169] [I][blog-1103].

#### Usos limitados y cuándo se recuperan

- **En acciones y rasgos** [I, personal de D&D Beyond][foro-76031]:
  - **cuándo se recuperan**: un tipo de reinicio (descanso corto, largo, al amanecer u otro);
  - **cuántos usos**: un número fijo, el modificador de una característica, o la competencia (sumada o multiplicada);
  - **cambios por nivel**: cambian los usos, los dados, el alcance, la activación o el reinicio, o quitan el límite.
- **En los rasgos de subclase**, una tabla de escalado por nivel de clase, como los dados de superioridad [I, cambios
  2018-04-16][cambios-204].
- **En los conjuros que da un rasgo**: usos propios (fijos o por modificador) con su reinicio, o el espacio de conjuro
  normal [I, personal de D&D Beyond][foro-76031].
- **En los objetos, cargas** [I][blog-1103]:
  - cuántas, y cuándo se recargan;
  - **cuántas se recuperan es texto** («1d4 al amanecer»);
  - un conjuro puede costar cargas: el mínimo lo lanza a su nivel, y cada carga de más lo sube uno.
- **En la hoja**, los usos y los espacios son casillas que se reinician al descansar (`creador-y-hoja.md`).
- **Lo que no llega**:
  - una reserva que alimenta otros rasgos (los puntos de concentración del monje de 2024);
  - recuperar un uso gastando otro recurso (se marca a mano);
  - gastar dados de golpe fuera del descanso corto [I, personal de D&D Beyond][foro-204813].

#### Cómo escala un conjuro

- **Tres modos** [I][blog-1169]:
  - por **nivel del personaje** (no de clase), como los trucos;
  - por **nivel del espacio**, con un patrón fijo («un dado más por nivel»);
  - con **efectos distintos según el espacio** (invocar criaturas de mayor VD).

  El artículo oficial nombra los dos últimos de forma confusa, y los usuarios dicen que el primero solo se admite en
  trucos.
- **La sección «a niveles superiores»** dice qué modificador escala (por ejemplo, el daño de fuego), cómo (más puntos,
  más objetivos [I, cambios 2026-10-19][cambios]) y con qué dados. Así la hoja deja lanzar con un espacio mayor y
  recalcula [I][blog-1169].
- **Los datos de un conjuro** [I][blog-1169] [I, guía del foro oficial][foro-3625]:
  - **lo básico**: nivel y escuela; tiempo de lanzamiento (número y unidad; la reacción, con su texto); componentes,
    con el material en texto;
  - **alcance y duración**: tipo de alcance (personal, toque, a distancia, a la vista, ilimitado) y distancia; tipo de
    duración (concentración, instantánea, especial, tiempo, hasta disiparse, hasta disiparse o activarse) y cuánto;
  - **listas**: ritual, clases y subclases que lo tienen;
  - **el efecto**: forma y tamaño del área; ataque cuerpo a cuerpo o a distancia; característica de la salvación, con
    lo que pasa si se supera o no (en texto); etiquetas;
  - **lo mecánico**: los modificadores (el daño con su tipo y sus dados) y los estados.
- **Lo que no llega**:
  - las criaturas que invocan los conjuros de 2024, cuyo statblock escala con el espacio: va en el texto del conjuro;
  - subir el alcance de los conjuros de una clase;
  - sumar daño solo a cierto grupo de conjuros [I, personal de D&D Beyond][foro-204813].

#### Cómo concede un rasgo acciones, conjuros u opciones

- **Acciones** (en dotes, especies y subclases) [I, personal de D&D Beyond][foro-76031]. Una acción lleva:
  - **qué es**: general, de arma o «como un conjuro»;
  - **la tirada**: característica; si suma la competencia; cuerpo a cuerpo o a distancia; salvación con su
    característica o con una CD fija;
  - **el efecto**: dados y valor fijo, tipo de daño, y qué pasa al fallar el ataque o al superar o fallar la
    salvación (en texto);
  - **cómo se ve**: si sale como ataque, alcance normal y largo, área, activación (acción, adicional, reacción, minutos…);
  - **los usos**: reinicio, usos y cambios por nivel;
  - y una casilla para que la escale el dado de Artes marciales del monje, que es otro caso especial.
- **Conjuros** [I, personal de D&D Beyond][foro-76031]:
  - **cuáles**: uno fijo, o elegir entre varios por filtros (nombres, niveles, listas de clase, tipo de ataque, nivel
    máximo según el del personaje, solo rituales y si se pueden o se deben lanzar como ritual);
  - **cómo se lanza**: característica, usos y reinicio, nivel al que se lanza, tiempo, alcance;
  - **cómo cuenta**: si gasta espacio, si cuenta como conocido, si está siempre preparado, a qué nivel llega y una CD
    propia;
  - una marca de «sin límite», para rasgos que dejan elegir conjuros sin tope;
  - aparte, **ampliar la lista**: añade conjuros a la lista entre la que elegir, sin darlos.
- **Opciones**:
  - una dote puede traer opciones con su número a elegir, y cada opción, sus acciones [I, personal de D&D
    Beyond][foro-76031];
  - un rasgo de subclase trae opciones (como las maniobras), y cada una puede llevar modificadores, conjuros y usos
    [I, cambios 2018-04-16][cambios-204].
- **Elecciones en las competencias y el equipo** [I, personal de D&D Beyond][foro-76031]:
  - una competencia, idioma o herramienta se concede; varias, se elige entre ellas; ninguna, se elige entre todas;
  - el equipo de un trasfondo se da como una pieza concreta, un tipo entre el que elegir (solo si hay competencia), oro,
    un objeto inventado o una instrucción;
  - en el creador, las elecciones se anidan (`creador-y-hoja.md`).
- **Requisitos de las dotes** [I, personal de D&D Beyond][foro-76031]:
  - por característica, saber lanzar un conjuro, nivel del personaje, competencia con una armadura, especie, tamaño o
    subespecie;
  - lo de dentro de un requisito se cumple todo junto, y entre requisitos basta uno.
- **Criaturas** [I, personal de D&D Beyond][foro-76031]: reglas que filtran monstruos para los extras de la hoja.
  - **El grupo**: forma salvaje, familiar, compañero, montura, mascota, invocación…
  - **El filtro**: tipo, VD máximo (o el nivel dividido por algo), movimientos excluidos y tamaños, o una lista
    cerrada.
- **Resúmenes**: cada rasgo lleva un texto corto para la hoja, con valores calculados dentro: una característica, un
  modificador, la competencia, una CD, el ataque de conjuro, los niveles, los usos, los PG, las velocidades, con
  redondeos y topes. **Solo se leen: no cambian el personaje** [I, guía del foro oficial][foro-25930].
- **Las subclases que se quieran publicar** tienen que poner sus rasgos en los niveles donde la clase deja hueco
  [I][ayuda-subclases].

#### La sintonía y lo equipado

- **Un objeto mágico** [I][blog-1103]:
  - **su base**: objeto, armadura o arma. Si es armadura, la armadura base, el tope de Destreza, la Fuerza mínima y la
    desventaja en Sigilo. Si es arma, el arma base;
  - **sus datos**: el tipo de objeto mágico; la rareza (con «varía» y «desconocida»); el peso, las cargas y las
    etiquetas;
  - **la sintonía**: si la pide y por quién, en un texto que completa una frase fija.

  Las armas y armaduras mágicas cuelgan de las normales, y por eso las normales no se duplicaron en 2024 [I, personal
  de D&D Beyond][foro-204813].
- **Los efectos solo cuentan si va equipado y, si lo pide, sintonizado** [I, personal de D&D Beyond][foro-76031]
  (`creador-y-hoja.md`, punto 5).
- **Los huecos de sintonía**: tres de serie. Un modificador los fija; el editor deja hasta seis, «por la interfaz», que
  es el máximo del artífice. Tener huecos sin límite fue un fallo que corrigieron [I, foro][foro-35787].

#### Los dados de daño con su tipo

- **El daño siempre es dados, más un fijo, más un tipo** [I][blog-1103] [I][blog-1169] [I, personal de D&D
  Beyond][foro-76031]:
  - un arma mágica lleva el daño de su arma base, y el bono mágico va en un solo modificador que suma a ataque y daño;
  - el daño adicional es otra parte, con sus dados y su tipo;
  - hay un modificador para cambiar el tipo de daño del arma;
  - en los conjuros, el daño es un modificador por tipo, y en las acciones, un campo.
- **En la hoja**, el icono del daño dice su tipo y el menú de la tirada dobla los dados del crítico (`creador-y-hoja.md`,
  punto 4).
- **Las resistencias del objetivo no se aplican solas**: en su mesa, el daño a un monstruo es un número que se resta
  [I][ayuda-combate].
- **Lo que no llega**:
  - ampliar el margen de crítico (Crítico mejorado del campeón);
  - un mínimo en el dado (Talento fiable);
  - maximizar la curación (Curación suprema);
  - quitar dados a una acción;
  - tantos dados como un modificador [I, personal de D&D Beyond][foro-204813].

#### Qué dejan como texto y no automatizan

- **Siempre texto**: la descripción, el resumen, el detalle de un modificador, cuánto se recarga un objeto, lo que pasa
  al superar una salvación y los estados de conjuros y objetos (ver arriba).
- **La lista que publicó su personal con el manual de 2024** [I, personal de D&D Beyond][foro-204813]. Las categorías,
  con un ejemplo cada una:

  | Lo que no automatizan | Ejemplo |
  |---|---|
  | Mínimos y máximos en los dados | Talento fiable, Fuerza indomable, Curación suprema |
  | Margen de crítico | Crítico mejorado |
  | Repetir tiradas con bono | Indomable |
  | Recursos que alimentan otros rasgos | Los puntos de concentración del monje |
  | Statblocks que escalan | Invocaciones, compañeros de bestia, montura fiel |
  | Ataques que el personaje añade a un statblock | Golpe primigenio en forma salvaje |
  | Modificar un grupo de conjuros | Alcance, daño o característica sumada |
  | Quitar concentración | Bendición del dios de la guerra |
  | Dar objetos desde un rasgo | Las herramientas del asesino |
  | Rasgos que se repiten | Algunas invocaciones del brujo (lo arreglaron después) |
  | Transformaciones | Forma salvaje de 2024 (al principio; luego sí) y formas del círculo de la luna |

- **Su salida, cuando no llegan**: una acción o un conjuro «de una vez» para tirar y llevar la cuenta, más el texto. La
  intervención divina mayor se apunta como un Deseo de un uso; los compañeros de bestia, como acciones con sus PG
  [I, personal de D&D Beyond][foro-204813].

### 3. Criaturas: qué es dato y qué es texto

- **Datos** [I, guía del foro oficial][foro-3625] (más el formulario descrito en `contenido-y-enlaces.md`, punto 3):
  - **quién es**: nombre, tamaño, tipo, alineamiento y VD, y si su statblock es de 2014 o de 2024;
  - **defensa**: la CA con el texto de su armadura; los PG medios con su fórmula (número de dados, dado y
    modificador);
  - **movimiento y características**: velocidades por tipo; las seis características; salvaciones; habilidades con su
    valor;
  - **lo que percibe y resiste**: percepción pasiva; daños (vulnerable, resistente o inmune, por tipo); estados a los que
    es inmune; sentidos (el alcance va en una nota de texto); idiomas;
  - **lo demás**: entornos, etiquetas, tesoro e imágenes.

  Para la maqueta de 2024 se anunció además la iniciativa y todas las salvaciones [I, cambios 2024-08-21,
  retirada][cambios].
- **Texto con formato, en ocho secciones**: rasgos, acciones, acciones adicionales, reacciones, descripción, acciones
  legendarias, míticas y de guarida (`contenido-y-enlaces.md`, punto 3).
- **Los ataques no son datos**: son texto con **marcas de tirada** alrededor de cada número [I, cambios
  2021-04-08][cambios-966] [I, guía del foro oficial][foro-106856].
  - **Qué lleva una marca**: lo que se ve, la fórmula, la clase de tirada (ataque, daño, curación, salvación, prueba,
    recarga o genérica), el nombre que sale en el registro y, en el daño, su tipo.
  - **Quién las pone**: el contenido oficial ya las trae, y en el contenido propio se ponen a mano o con un botón del
    editor que las añade solo.
- **Lo que tira cualquier monstruo, incluso uno propio**, sale de los datos: PG, pruebas, salvaciones y habilidades. Las
  marcas dan el resto: ataques, daño, recargas y otras tiradas [I, cambios 2021-04-08][cambios-966].
- **Dónde se usan**:
  - en el creador de encuentros (2021) [I, cambios 2021-04-08][cambios-966];
  - en su mesa virtual [I, cambios 2024-12-10, 2025-02-04, 2026-09-28][cambios] [I][ayuda-combate]:
    - se tira desde el statblock, con ventaja o desventaja;
    - se llevan los PG del monstruo (daño, curación, temporales y otro máximo);
    - la iniciativa sale de su puntuación o de una tirada;
    - los estados se ven en las fichas;
    - la dificultad sale de los VD, con la guía de 2024.
- **En la hoja de un personaje** se añade cualquier statblock como extra (montura, familiar, forma salvaje), y se
  actualiza solo cuando las reglas le afectan [I][ayuda-extras].
- **Lo que no llega**:
  - escalar una criatura a otro VD: queda «para el futuro» [I][ayuda-vd];
  - los statblocks que escalan con el nivel o el espacio [I, personal de D&D Beyond][foro-204813];
  - lo que un rasgo del personaje cambia en su compañero [I, personal de D&D Beyond][foro-204813].
- **Mecánica y ambientación se separan**: desde abril de 2025, sus reglas básicas gratuitas traen el statblock de cada
  monstruo del SRD 5.2, y la descripción exige el manual de monstruos [I, cambios 2025-04-22][cambios].

## Compromisos y límites

**Lo que ganan**:

- **Un solo modelo para lo oficial y lo propio**: lo que hace el equipo lo puede copiar y estudiar cualquiera.
- **Todo número se calcula y se tira**: el de un objeto, una dote o un monstruo propio.
- **Las dos ediciones conviven** sin obligar a nadie a migrar, con etiquetas y con la clase como filtro automático de
  los conjuros.
- **Compatibilidad hacia atrás**: las subclases antiguas sirven con las clases nuevas, ajustadas a su progresión.
- **Las tiradas de un monstruo** se marcan dentro del mismo texto que se lee, así que el statblock impreso y el que se
  tira son el mismo.

**Lo que pierden**:

- **Las reglas están en el código**, y lo admiten (la hoja de ruta de 2026). Se nota:
  - familias de modificador hechas para un solo rasgo;
  - una casilla para las Artes marciales;
  - rasgos que funcionan por cómo se llaman;
  - y una lista larga de lo que no llega con cada libro, porque cada regla nueva pide programarla.
- **Lo condicional casi no existe**: condiciones metidas en el subtipo, en el texto o en el estado del objeto. Lo que no
  encaja se resuelve con dos versiones del mismo contenido.
- **Los efectos temporales llegaron tarde** (2024), solo para lo oficial nuevo, y aún no llegan a las acciones propias.
  Los estados que causa un conjuro no se aplican nunca.
- **Dos ediciones como dos entidades**: listas dobles, enlaces por nombre que no distinguen versiones, y una fuente
  continua de errores al conceder la versión equivocada de un conjuro.
- **La campaña no manda**: ni edición, ni fuentes, ni reglas comunes. El máster no puede impedir en el creador lo que
  bloquea en el compendio, y pasar a 2024 a mitad de campaña es duplicar y rehacer cada hoja.
- **Las reglas comunes que cambian se resuelven a trozos**: los dos textos del agotamiento sin aplicar ninguno, el
  descanso que pregunta cada vez, el creador de encuentros con la guía de 2014 y la mesa con la de 2024.
- **Los ataques de un monstruo son texto marcado**: si cambia una característica, su bono de ataque no se mueve, y no
  hay forma de escalarlo a otro VD.
- **Su plan de agosto de 2024** cambiaba el contenido debajo de los personajes existentes y lo tuvieron que retirar. Es
  la lección más cara del estudio.

## Qué nos llevamos a Crisol

### Ediciones y fuentes

- **Cada documento de contenido lleva**:
  - su **fuente** (SRD 5.1, SRD 5.2.1, más adelante un libro con licencia);
  - su **edición** (2014 o 2024);
  - su **licencia y atribución**;
  - una **clave de concepto** que une las versiones de lo mismo: el conjuro de curar heridas de 2014 y el de 2024 son
    dos documentos con el mismo concepto.

  Con eso salen solas la etiqueta «Legado», el «solo lo más nuevo de lo repetido» y las listas sin duplicados. Es lo
  que D&D Beyond no tiene: sus dos versiones solo comparten el nombre.
- **La campaña manda, también en el creador**, como decidió Enrique: activa cada edición, esconde lo legado o deja solo
  lo más nuevo, y el personaje hereda esa elección. Es justo lo que ellos tienen sin empezar en su hoja de ruta.
  Propuesta: sin casillas de fuentes por personaje, o solo dentro de lo que permite la campaña.
- **Las referencias van al concepto, no a un documento.** «Concede curar heridas» se resuelve con la edición de lo que
  lo concede o de la clase, según el ajuste de la campaña. Una prueba comprueba que cada referencia se resuelve en las
  dos ediciones: su lista de errores enseña lo que cuesta no hacerlo.
- **Las listas de conjuros siguen la edición de la clase**, como en D&D Beyond. Lo que vea una clase de 2014, lo decide
  la campaña.
- **Las reglas comunes que cambian, como ajustes de la campaña con un valor por edición**: nunca se pregunta al usarlas.
  Candidatas, por comprobar en los dos SRD:
  - el agotamiento;
  - los dados de golpe del descanso largo;
  - la sorpresa;
  - el estado aturdido (la velocidad);
  - agarrar y empujar;
  - la inspiración;
  - las pociones como acción adicional;
  - la preparación de conjuros;
  - la dificultad de los encuentros.
- **Los estados son contenido con efectos**, en las dos ediciones. El ajuste elige cuál vale, y el agotamiento de 2024
  sí se aplica a las tiradas: ahí Crisol va más allá que ellos.
- **Mezclar clases de dos ediciones en una multiclase**: un ajuste de la campaña, apagado por defecto (ellos lo vetan).
- **Nunca cambiar el contenido debajo de un personaje**: una versión nueva es un documento nuevo; el personaje se queda
  con la que eligió. Pasar a 2024 será un asistente explícito más adelante, no copiar y rehacer.

### Mecánica: un modelo general en vez de casos sueltos

| Tema | D&D Beyond | Crisol |
|---|---|---|
| Modificador | Unas treinta familias, con subtipos cerrados y casos especiales para rasgos concretos | Un efecto general: destino (un campo o un elemento de un conjunto), operación (sumar, fijar, fijar base, mínimo, máximo, grado de competencia, ventaja o desventaja, conceder, defensa), valor (una fórmula del sistema) y origen. El orden de aplicación es fijo y sale en el desglose |
| Condición | En el subtipo, en el texto o en el estado del objeto | Una condición como fórmula sobre el estado («equipado», «sintonizado», «sin armadura», «con escudo», «activo», «nivel ≥ 5»). Lo que depende del objetivo («contra aberraciones») se propone en la tirada y el jugador confirma |
| Efectos temporales | Solo lo oficial de 2024 | Estados activables con duración (furia, formas) para todo, también lo propio: el mismo modelo que los estados |
| Usos | Tipo de reinicio y número; lo que se recupera, en texto | Un recurso con su máximo (fórmula), cuándo se recupera (descanso corto, largo, amanecer, otro) y cuánto (fórmula: todo, 1, 1d4) |
| Escalado de conjuros | Tres modos poco claros | Tres modos con nombre claro: por nivel del personaje (tabla de los trucos), por cada espacio por encima (dados, objetivos, duración) y tabla por espacio |
| Daño | Dados, fijo y tipo en sitios distintos | Siempre una lista de partes {dados, tipo}, con la curación y la salvación (característica, CD y qué pasa al superarla) como datos, no como texto |
| Conceder | Subformularios de acciones, conjuros, opciones, criaturas; nombres con efecto | Una lista de lo que concede: acciones, conjuros (fijos o a elegir con filtros, y cómo cuentan), elecciones anidadas, competencias, dotes y criaturas. Todo con marcas explícitas, nunca por el nombre |
| Sintonía | Una casilla y un texto; huecos con tope de interfaz | El requisito como dato (clase, especie, característica) más su texto; los huecos, una fórmula que los efectos pueden cambiar |
| Lo no automatizado | Anunciado en cada lanzamiento, fuera de los datos | Cada documento dice su grado de automatización (completo, parcial o texto) y qué se lleva a mano. Lo leen «Probar» y la IA |
| Resumen con valores | Texto con códigos que solo se leen | Texto con fórmulas del sistema dentro, solo para leer, comprobadas al guardar |

- **Lo muy complejo, como texto y con una salida**: Forma salvaje, Polimorfar y Deseo (lo dijo Enrique). Como hacen
  ellos, se da al menos una acción o un uso que se tira y se cuenta, más el texto.
- **Los personajes de referencia** (cada clase en los niveles 1, 5, 11 y 20, en las dos ediciones) son la red que a
  ellos les falta: su lista de «no llega» crece con cada libro.

### Criaturas

- **El statblock entero como datos, también las acciones**. Cada acción lleva:
  - su clase (cuerpo a cuerpo, a distancia, salvación u otra);
  - su bono de ataque y su alcance;
  - sus partes de daño con su tipo;
  - la salvación con su CD y su efecto;
  - la recarga, los usos por día y el coste legendario.

  El texto queda para la descripción. Así no hay dos copias del mismo número (la del texto y la de la marca) que se
  separen.
- **Los valores impresos del SRD, como valores fijos**, y una prueba que compruebe que la fórmula da lo mismo: el bono
  de ataque es característica más competencia por VD, y la CD, 8 más lo mismo. Así se cuadra con el SRD y queda la puerta
  abierta a escalar el VD más adelante.
- **El lanzamiento de conjuros de un monstruo**, con referencias por concepto a sus conjuros, y su CD y su ataque como
  datos.
- **La edición del statblock** (2014 o 2024) decide cómo se pinta: la de 2024, con iniciativa y todas las salvaciones.

### Preparado para el resto del 5e

- **Un registro de fuentes**: editorial, licencia, atribución y, más adelante, quién la tiene.
- **Lo que comparte una campaña, con reglas parecidas a las suyas**: solo para los personajes de esa campaña. Pero
  filtrado de verdad, también en el creador.
- **Un mismo concepto en varias fuentes**: lo reeditado en un libro posterior es otra versión del mismo concepto, con su
  fuente. Su norma de «lo reeditado pasa al libro más reciente» sale sola de la clave de concepto.

## Lo que no se pudo ver

Sin entrar con una cuenta no se puede saber:

- **Qué casilla esconde hoy un conjuro del manual de 2014 con versión de 2024**: la del núcleo de 2014, la de legado o
  cualquiera de las dos. La nota de noviembre de 2024 y la ayuda de noviembre de 2025 no lo dejan claro.
- **El orden de las dos versiones en una lista** (cuál sale primero) y si se agrupan juntas.
- **La lista completa y actual de familias y subtipos de modificador.** Solo se ve en el editor, que exige cuenta y
  suscripción; las guías públicas son de 2020 a 2024.
- **Cómo está hecho el contenido oficial por dentro**: se deduce del editor porque su personal dice que es la misma
  herramienta, pero copiar algo oficial como plantilla exige comprarlo.
- **Si los efectos activos de 2024 se pueden usar en el contenido propio**, y cómo se apagan al acabar.
- **Cómo decide la hoja qué versión de un conjuro da un rasgo antiguo a un personaje de 2024**: solo se ven los errores
  que corrigen.
- **En qué orden se aplican los modificadores** (fijar, bono, acumulable, anulación), más allá de lo que cuentan los
  usuarios.
- **Si una acción de monstruo oficial lleva algún dato estructurado** además de las marcas del texto.
- **Si las resistencias de un monstruo se aplican en algún sitio** de su mesa al restar daño.

## Cómo se hizo

- **Solo fuentes públicas**, sin entrar con ninguna cuenta ni usar la sesión de Enrique.
- **El centro de ayuda**, leído por su API pública: su índice entero (313 artículos) y una treintena leídos.
- **Lo demás, por HTTP**: las notas de cambios (la página actual, que guarda las entradas desde 2024, y tres antiguas
  de 2018, 2019 y 2021), cinco artículos del blog, la hoja de ruta de 2026 y dieciséis hilos de los foros oficiales
  (trece citados).
- **Quién escribe en los foros**: dos de los hilos citados son del personal de D&D Beyond, y tres son guías del foro
  (dos las enlazan su ayuda o sus notas de cambios). Los demás son de usuarios y se marcan así.
- **Las copias**, en el scratchpad de la sesión, fuera del repo, y borradas al acabar. Aquí no queda ningún texto suyo:
  los nombres de campos y opciones se describen con nuestras palabras, sin la sintaxis de sus marcas ni de sus resúmenes.

## Fuentes

Centro de ayuda oficial (leído por su API pública):

- `ayuda-categorias`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201820948-Enabling-Content-Categories-for-your-Character-Sheet
- `ayuda-compartir`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747210355604-Campaign-Content-Sharing-and-You
- `ayuda-adicional`: https://dndbeyond-support.wizards.com/hc/en-us/articles/13625288445716-Additional-Content-on-the-Character-Sheet
- `ayuda-5e-cambio`: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714465734164-What-s-Changing-on-D-D-Beyond
- `ayuda-5e-juntos`: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714534613524-Can-I-use-5e-and-5-5e-content-together-on-D-D-Beyond
- `ayuda-5e-saber`: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714571698068-How-will-I-know-whether-something-is-5e-or-5-5e
- `ayuda-5e-anio`: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714562845076-Why-not-just-label-everything-by-year-instead
- `ayuda-elementos`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747241361300-Element
- `ayuda-homebrew`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747238519700-Homebrew-Creation-and-Collection-Basics
- `ayuda-sin-clases`: https://dndbeyond-support.wizards.com/hc/en-us/articles/14175512652308-No-Homebrew-Classes
- `ayuda-plantilla`: https://dndbeyond-support.wizards.com/hc/en-us/articles/14175429918612-Unable-to-Use-Existing-Template
- `ayuda-subclases`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747240870036-Making-Homebrew-Subclasses-Publishable
- `ayuda-vd`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747237803540-Rejected-Version-of-Altered-Existing-Monster
- `ayuda-extras`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209465748-Extras
- `ayuda-combate`: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps
- `ayuda-dificultad`: https://dndbeyond-support.wizards.com/hc/en-us/articles/46363684535060-How-does-Maps-calculate-encounter-difficulty
- `ayuda-encuentros`: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747237485716-Encounters

Notas de cambios oficiales:

- `cambios` (la página actual, con las entradas desde 2024; se cita la fecha de cada una): https://www.dndbeyond.com/changelog
- `cambios-204` (subclases propias, 2018-04-16): https://www.dndbeyond.com/changelog/204-homebrew-subclasses-april-16th-2018
- `cambios-575` (gestión de contenido, 2019-08-29): https://www.dndbeyond.com/old-changelog/575-content-management-initial-release
- `cambios-966` (tiradas de monstruos, 2021-04-08): https://www.dndbeyond.com/old-changelog/966-monster-dice-rolling-for-the-encounter-builder

Blog de dndbeyond.com:

- `blog-1103` (objeto mágico propio, 2021): https://www.dndbeyond.com/posts/1103-how-to-create-a-homebrew-magic-item-using-d-d
- `blog-1169` (conjuro propio, 2022): https://www.dndbeyond.com/posts/1169-how-to-create-a-homebrew-spell-using-d-d-beyond
- `blog-1806` (la marcha atrás de agosto de 2024): https://www.dndbeyond.com/posts/1806-2024-d-d-beyond-ruleset-changelog-update
- `blog-1875` (pasar una campaña a 2024, 2024-12-16): https://www.dndbeyond.com/posts/1875-updating-your-campaign-to-the-5-5e-d-d-rules
- `blog-2132` (hoja de ruta de 2026, 2026-02-19): https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap
- `hoja-de-ruta` (consultada el 2026-11-04): https://www.dndbeyond.com/en/roadmap

Foros oficiales:

- `foro-3625` (tutoriales del foro, 2017, enlazados desde la ayuda): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/3625-everything-you-need-to-know-about-homebrew
- `foro-76031` (guía del editor, del personal, 2020–2024): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/76031-demystifying-homebrew-updated-with-pact-hex
- `foro-204813` (notas del manual de 2024, del personal, 2024-09-03): https://www.dndbeyond.com/forums/d-d-beyond-general/release-issues-support/204813-players-handbook-issues-and-support-thread
- `foro-25930` (guía de los resúmenes, 2018): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/25930-using-snippet-codes-in-your-homebrew
- `foro-106856` (guía de las marcas de tirada, 2021, enlazada desde las notas de cambios): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/106856-adding-rollable-tags-to-your-homebrew-monsters-for
- `foro-13329` (usuarios, 2018): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/13329-modifier-subtypes-of-type-bonus-proficiency-twice
- `foro-67573` (usuarios, 2020): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/67573-creating-a-new-unarmored-defense
- `foro-68414` (usuarios, 2020): https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/68414-subclass-armor-class
- `foro-35787` (usuarios y moderación, 2019): https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/35787-bring-back-more-than-3-attunable-items-on
- `foro-205106` (usuarios, 2024): https://www.dndbeyond.com/forums/d-d-beyond-general/general-discussion/205106-how-can-i-deakitvate-2024-spells-for-the-campain
- `foro-206666` (usuarios, 2024): https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/206666-i-really-need-a-disable-2024-completely-button-for
- `foro-207343` (usuarios, 2024): https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/207343-toggle-2024-ruleset-on-character-builder
- `foro-238294` (usuarios, 2026): https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/238294-exhaustion-levels

Notas propias citadas: `research/dndbeyond/creador-y-hoja.md` y `research/dndbeyond/contenido-y-enlaces.md`.

[ayuda-categorias]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201820948-Enabling-Content-Categories-for-your-Character-Sheet
[ayuda-compartir]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747210355604-Campaign-Content-Sharing-and-You
[ayuda-adicional]: https://dndbeyond-support.wizards.com/hc/en-us/articles/13625288445716-Additional-Content-on-the-Character-Sheet
[ayuda-5e-cambio]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714465734164-What-s-Changing-on-D-D-Beyond
[ayuda-5e-juntos]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714534613524-Can-I-use-5e-and-5-5e-content-together-on-D-D-Beyond
[ayuda-5e-saber]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714571698068-How-will-I-know-whether-something-is-5e-or-5-5e
[ayuda-5e-anio]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46714562845076-Why-not-just-label-everything-by-year-instead
[ayuda-elementos]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747241361300-Element
[ayuda-homebrew]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747238519700-Homebrew-Creation-and-Collection-Basics
[ayuda-sin-clases]: https://dndbeyond-support.wizards.com/hc/en-us/articles/14175512652308-No-Homebrew-Classes
[ayuda-plantilla]: https://dndbeyond-support.wizards.com/hc/en-us/articles/14175429918612-Unable-to-Use-Existing-Template
[ayuda-subclases]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747240870036-Making-Homebrew-Subclasses-Publishable
[ayuda-vd]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747237803540-Rejected-Version-of-Altered-Existing-Monster
[ayuda-extras]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209465748-Extras
[ayuda-combate]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps
[ayuda-dificultad]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46363684535060-How-does-Maps-calculate-encounter-difficulty
[ayuda-encuentros]: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747237485716-Encounters
[cambios]: https://www.dndbeyond.com/changelog
[cambios-204]: https://www.dndbeyond.com/changelog/204-homebrew-subclasses-april-16th-2018
[cambios-575]: https://www.dndbeyond.com/old-changelog/575-content-management-initial-release
[cambios-966]: https://www.dndbeyond.com/old-changelog/966-monster-dice-rolling-for-the-encounter-builder
[blog-1103]: https://www.dndbeyond.com/posts/1103-how-to-create-a-homebrew-magic-item-using-d-d
[blog-1169]: https://www.dndbeyond.com/posts/1169-how-to-create-a-homebrew-spell-using-d-d-beyond
[blog-1806]: https://www.dndbeyond.com/posts/1806-2024-d-d-beyond-ruleset-changelog-update
[blog-1875]: https://www.dndbeyond.com/posts/1875-updating-your-campaign-to-the-5-5e-d-d-rules
[blog-2132]: https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap
[hoja-de-ruta]: https://www.dndbeyond.com/en/roadmap
[foro-3625]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/3625-everything-you-need-to-know-about-homebrew
[foro-76031]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/76031-demystifying-homebrew-updated-with-pact-hex
[foro-204813]: https://www.dndbeyond.com/forums/d-d-beyond-general/release-issues-support/204813-players-handbook-issues-and-support-thread
[foro-25930]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/25930-using-snippet-codes-in-your-homebrew
[foro-106856]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/106856-adding-rollable-tags-to-your-homebrew-monsters-for
[foro-13329]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/13329-modifier-subtypes-of-type-bonus-proficiency-twice
[foro-67573]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/67573-creating-a-new-unarmored-defense
[foro-68414]: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/68414-subclass-armor-class
[foro-35787]: https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/35787-bring-back-more-than-3-attunable-items-on
[foro-205106]: https://www.dndbeyond.com/forums/d-d-beyond-general/general-discussion/205106-how-can-i-deakitvate-2024-spells-for-the-campain
[foro-206666]: https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/206666-i-really-need-a-disable-2024-completely-button-for
[foro-207343]: https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/207343-toggle-2024-ruleset-on-character-builder
[foro-238294]: https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/238294-exhaustion-levels
