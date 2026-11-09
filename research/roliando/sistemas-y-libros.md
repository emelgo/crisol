# Sistemas, libros y compendio en Roliando

Módulo de Crisol: «sistemas y libros» (tras el 3, sistemas, y el 4, compendio; ver `docs/modulos.md`, 2026-11-10) ·
Fecha: 2026-11-10 · Versión estudiada: web pública de roliando.com a fecha de hoy (novedades hasta la 0.1.11 del
2026-11-09; interfaz «Tinta» 0.1 del 2026-11-06)

## Pregunta

Enrique quiere que en Crisol **un sistema sean las reglas y los libros rellenen su compendio** (en el 5e, sus libros de
D&D y Fateforge; Daggerheart, en otro sistema), y que al crear una campaña se elija el sistema y luego qué libros usa.
Las preguntas del estudio:

1. Qué es Roliando y para quién.
2. Qué sistemas tiene; cómo se organiza el contenido por libro; qué trae cada libro; si los libros se compran, se
   desbloquean o los sube el usuario; homebrew propio y de la comunidad.
3. Cómo se eligen el sistema y los libros de una campaña; si el máster limita lo que usan los jugadores; si los
   jugadores aportan sus libros.
4. Cómo se busca y se filtra el compendio, cómo se ve una entrada y si dice de qué libro es.
5. Otras cosas diferenciales que aporten valor.

**Cómo se leyó.** Solo la web pública, sin cuenta: la portada, «Funciones», «Sistemas», «Comparativa», «Novedades»,
«Licencias» y unas veinticinco de sus ~130 guías (`/guias`), las que tratan compendio, módulos, importación, Bazar,
campaña, permisos, creación de personajes y planes. Con el navegador de craft-anything se comprobó que el compendio
(`/dnd/compendio`) pide iniciar sesión: sin cuenta sale el formulario de entrada (evidencias
`ev_7c6a4cbd…` y `ev_1ec8df5b…`). Las guías se leyeron con WebFetch porque las herramientas web de craft-anything no
devuelven el texto de una página como prosa (aviso registrado: 18624779). En la red no hay opiniones de usuarios: el
proyecto es muy joven. Grado de certeza:

- **[guía]**: lo dice una guía oficial de su ayuda.
- **[web]**: lo dicen las páginas públicas (portada, funciones, comparativa, licencias, novedades).
- **[observado]**: comprobado con el navegador.
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### Qué es y para quién

Una mesa virtual en el navegador, en español (y en inglés), gratis para dirigir y jugar, pensada para el público
hispanohablante que hoy juega en Roll20, Foundry o Nivel20 [web]. Es enorme para su edad: fichas que calculan solas,
creador de sistemas sin código (y un modo «a lo Roll20» con HTML), mesa con visión, niebla, plantas y relieve, combate
5e muy automatizado, rol por escrito con canales, wiki de campaña, diario, tiendas, botín, barajas, música, voz,
emisión para OBS, tablón para buscar partida, foro y logros [web, guía]. Se compara a sí misma con Roll20, Nivel20,
Foundry, Alchemy y Fantasy Grounds, y reconoce dos límites: catálogo pequeño y **no vende manuales** [web].

Un plan gratuito (tres campañas a la vez y **una** creación de cada tipo: un sistema, un módulo, una aventura, un pack…)
y «Máster Leyenda» (5,99 €/mes o 59,99 €/año) sin límites, con 3D, emisión, equipos y más espacio [web, guía]. Jugar
siempre es gratis.

### Sistemas: cuatro clases, tres con motor propio

Una campaña tiene **un** sistema, y el sistema decide la ficha, los dados y la ayuda automática de la mesa [guía]. Hay
cuatro clases [guía]:

| Clase | Qué es |
|---|---|
| Oficial | Los que trae Roliando con licencia o permiso del autor (25 publicados, casi todos OSR o indies; algunos en colaboración con editoriales hispanas) |
| Foundry | Sistemas de Foundry que el usuario sube (su `.zip`), con su propia hoja y reglas |
| De la comunidad | Hechos por otros con el creador y publicados |
| Propio | Hechos por uno con el creador; privados hasta publicarlos |

Solo tres tienen **motor propio** («nativos»): D&D 5e, Fate Core y GUMSHOE. El resto usa la ficha universal o la del
creador [guía]. Solo el 5e tiene **compendio** descrito como tal; los sistemas del creador tienen catálogo de objetos,
bestiario, monedas, reglas opcionales y un manual en Markdown, todo dentro del sistema [guía]. Las novedades citan
arreglos en Daggerheart, que funcionará como sistema de Foundry o de la comunidad [web, inferido].

### El modelo de «libros»: SRD de serie y módulos para todo lo demás

Es exactamente el modelo que busca Enrique, con otro nombre:

- **De serie, solo lo abierto.** El compendio 5e trae el SRD (2014 y 2024) en español e inglés; las «reglas básicas»
  de las dos ediciones están siempre [guía, web].
- **Todo lo demás llega en un «módulo».** Un módulo es un paquete de contenido que **solo añade** al sistema: un libro
  oficial que el usuario importa, material de terceros o homebrew propio [guía]. No hay distinción técnica entre «libro
  comprado» y «homebrew»: todo es módulo [guía, inferido].
- **Hay módulos de D&D y módulos de sistema.** Los de D&D declaran subrazas, subclases, conjuros, dotes, monstruos,
  objetos mágicos, trasfondos y especies, con su automatización (economía de acción, tirada, usos por descanso,
  condición, objetivos); los de un sistema propio marcan qué partes tocan (campos, perks, objetos, criaturas, barajas,
  manual, creación, niveles) [guía]. Si un módulo intenta cambiar algo del sistema base, el cambio se revierte con un
  aviso [guía].
- **Los packs de objetos de antes son ahora módulos de sistema**: se publican, se consiguen y el máster los activa como
  cualquier suplemento [guía]. Unificaron todo en un solo concepto.
- **Las aventuras son otra cosa**: un documento por capítulos, con mapas, salas, bestiario, escenas y galería, que se
  «pone en la mesa» de una campaña. Su bestiario va dentro de la aventura, no en un módulo [guía].

**Ningún campo de libro de origen.** El formato de módulo en JSON lleva nombre, descripción, edición (2014, 2024 o las
dos), nota de licencia, portada e icono; cada entrada, su categoría, edición, nombre en inglés y en español, sus datos y
su texto en Markdown. No hay autor, abreviatura de fuente ni página [guía]. El «libro» de una entrada es el módulo que
la contiene [inferido]. *Corregido con cuenta (2026-11-10): las entradas sí muestran libro y página; ver la sección
«Con cuenta» al final.*

### Cómo entran los libros: el usuario aporta lo suyo

Roliando **no vende ni distribuye** manuales: lee lo que el usuario sube, «material que ya posee» [guía, web]. Vías:

- **Importador de homebrew** (dentro de un módulo, desde el Taller o desde el Bazar). Tres orígenes: un enlace de
  Homebrewery (o buscar en su catálogo público), un archivo PDF, `.md` o `.txt`, o texto pegado [guía]. El **PDF se lee
  en el navegador y no se sube**; sin OCR, así que los escaneados no sirven, y las maquetaciones con columnas pierden
  estructura [guía].
- **Detecta por el contenido, no por el título**: un conjuro por su línea de nivel y escuela y sus rótulos de tiempo y
  alcance; una dote por su requisito en cursiva; un objeto por tipo y rareza; una criatura por su bloque de estadísticas;
  una especie por tamaño y velocidad; un trasfondo por sus competencias; una subclase por el título «Clase: Nombre». Los
  títulos marcan libro, capítulo y entrada, y la ruta se guarda como ubicación [guía]. No dice que use IA [guía].
- **Paso de revisión antes de guardar**: incluir o quitar cada entrada, renombrarla, cambiar su categoría y **ver el
  texto original del que salió**; las que ya existen con el mismo nombre vienen sin marcar [guía].
- **«Importar como»**: módulo de D&D, aventura, mundo de una campaña o documento; propone uno y se puede cambiar [guía].
  Lo importado nace **privado y sin publicar** [guía].
- **Otras vías**: módulo en JSON o paquete `.zip`; aventuras en JSON con índice e imágenes; sistemas y módulos de
  Foundry con sus compendios [guía].
- **«Basar en…»**: crear una entrada nueva partiendo de una oficial o de la biblioteca, en copia [guía].

### Campañas: el máster enciende los libros

- **Al crear la campaña**, el asistente tiene los pasos «Lo básico», «Sistema», «Reglas y contenido», «Cómo se juega»,
  «Quién entra», «Portada» y «Revisar», con un ritmo «Rápido» (nombre y sistema; lo demás, luego) [guía]. Cambiar de
  sistema a mitad del asistente devuelve a su valor de serie las reglas y el contenido elegidos [guía].
- **En la configuración, bloque «Suplementos»**: cada módulo sale como «En la mesa» o «Apagado» [guía]. Solo aparecen
  los bloques que el sistema admite [guía]. Hay un ajuste para **mezclar las dos ediciones** de D&D (apagado de serie)
  [guía].
- **Lo apagado no existe para la campaña**: un libro fuera de la mesa no sale en el compendio de esa campaña ni en el
  creador de personajes; un permiso, «Ver todos los manuales», deja ver el compendio completo [guía].
- **El creador de personajes** ofrece solo lo permitido por la edición, los libros permitidos y los módulos activos; la
  campaña fija también el nivel inicial, el método de características y de puntos de golpe, y si se admite trasfondo
  propio [guía]. Una ficha suelta (sin campaña) elige sus propias reglas y puede usar todo lo de la biblioteca del
  jugador [guía].
- **Aprobación**: al enlazar una ficha a una campaña queda pendiente hasta que el máster la apruebe; la base de datos
  impide saltárselo [guía]. Se puede exigir que los personajes se creen dentro de la campaña [guía].
- **Los jugadores no aportan libros a la campaña.** Lo que un jugador comparte por código llega como una copia
  «prestada» (no editable) a la biblioteca del otro, y para que cuente en una campaña la tiene que activar el máster
  [guía]. No hay un «reparto de contenido» como el de D&D Beyond [inferido].
- **Importar un personaje** de D&D Beyond (público) resuelve clase, conjuros y equipo **por nombre contra el
  compendio**; lo que no casa sale aparte, y la solución que da es activar o importar el libro que falta [guía].

### El compendio 5e

- Una sola fuente para la ficha, el creador y la mesa; se abre como página o desde la ficha con un atajo, y desde allí
  se añade una entrada al personaje [guía].
- **Filtros**: edición (2024, 2014 o ambas), búsqueda en español o inglés y **dos vistas: «Por categoría»** (conjuros,
  bestiario, trasfondos, opciones…) **y «Por manual»** (cada libro con sus secciones de reglas) [guía]. No describe
  filtros por nivel o escuela [guía]. En la mesa, el directorio del máster mezcla campaña, biblioteca, compendio y
  sistema con una marca de origen, y filtra criaturas por VD o nivel [guía].
- **Correcciones**: en cualquier entrada, «Corregir para mí» guarda una versión propia, «Ver original» la compara y
  «Quitar corrección» la borra; la corrección de un jugador solo la ve él, **la del máster vale para toda su mesa**
  [guía].
- Si una entrada dice o no su libro, no consta (*con cuenta: sí lo dice, con página; ver al final*); la vista por manual los agrupa [guía]. **Sin cuenta no se ve**
  [observado].

### Compartir: biblioteca, códigos y Bazar

- **Biblioteca**: almacén personal por tipos y carpetas que sobrevive a las campañas; desde ella se «lleva» algo a una
  campaña [guía].
- **Compartir crea copias**, nunca préstamos vivos: «Solo yo», «Con código» o «En el Mercado» [guía].
- **El Bazar** es un repositorio por pieza (sistemas, módulos, aventuras, packs), con **versiones numeradas y notas**,
  licencia obligatoria para publicar, búsqueda por tipo, sistema, idioma y licencia, estrellas, **instalar = copia
  propia** que no cambia sola, botón «Actualizar» cuando hay versión nueva, fijar o volver a una versión, **propuestas
  de cambio** que el autor fusiona o cierra, enlaces con caducidad y usos máximos, y denuncias por copyright [guía].
  Las ventas «todavía no están abiertas» (hay campo de precio) [guía].
- **Paquetes de Foundry**: los módulos se activan por campaña; una versión nueva de un sistema se instala **junto a la
  anterior** y cada campaña sigue con la suya hasta que se cambie; no deja quitar un paquete que use una campaña y dice
  cuál [guía].

## Compromisos y límites

- **Ganan** un modelo simple y legal: un solo concepto (módulo) para libros, terceros y homebrew; el SRD de serie; el
  máster decide qué existe en su campaña y todo (compendio, creador, ficha, mesa) obedece a esa elección.
- **El precio de no vender libros** es que cada máster tiene que meter sus libros a mano, con un importador heurístico
  que depende del formato del texto (falla con PDF maquetados o escaneados) y, en el plan gratuito, **un solo módulo**.
  Es la fricción más grande del modelo; aquí Crisol, con la IA por MCP, puede ir mucho mejor.
- **Sin procedencia por entrada** (*corregido con cuenta: la hay en lo de serie; en lo casero solo el nombre del módulo*): ni libro, ni abreviatura, ni página. Si se mezclan libros en un módulo, se pierde de
  dónde sale cada cosa; y no hay forma de citar «PHB p. 211» [guía, inferido].
- **Copias, no referencias**: compartir e instalar copian. Es robusto (nada cambia por sorpresa), pero un libro
  corregido no llega a quien ya lo tenía salvo con «Actualizar» del Bazar [guía].
- **Los jugadores no suman libros**: todo pasa por la biblioteca del máster [guía, inferido].
- **Solo el 5e tiene compendio de verdad**; en los demás sistemas el contenido vive dentro del sistema o de módulos de
  sistema, con menos estructura [guía].
- La ayuda tiene incoherencias (títulos que no casan con el contenido: «once columnas» que son diez, «cuatro áreas» que
  son seis): crece muy deprisa [guía].

## Qué nos llevamos a Crisol

1. **Confirma el modelo de Enrique**: sistema = reglas; libro = paquete que solo añade contenido al compendio de su
   sistema; la campaña elige sistema y luego libros; lo no elegido no existe para esa campaña (compendio, creador,
   ficha, mesa y MCP). En Crisol los libros ya son las «fuentes» del sistema: basta con tratarlos como paquetes de
   primera clase (con portada, edición y licencia) y permitir **añadir un libro a un sistema que ya existe**.
2. **Procedencia por entrada, mejor que ellos**: cada entrada guarda su libro, y si se sabe, la página; la ficha de la
   entrada lo dice; el compendio filtra por libro y tiene la vista **«Por libro»** además de «Por tipo».
3. **El importador con revisión**: origen (PDF, Markdown, Homebrewery, módulo de Foundry, JSON) → lo reconocido, con
   el texto original al lado, incluir/quitar, renombrar y cambiar de tipo → destino (libro de un sistema, aventura,
   wiki o documento). La lectura la hace la IA por MCP (Fateforge son PDF maquetados: el heurístico de Roliando no
   bastaría); la revisión es nuestra pantalla.
4. **Correcciones por capas**: la del máster vale para su campaña, la del jugador solo para él, siempre con «ver
   original» y «quitar». Encaja con las «ediciones en la campaña» del lienzo de srd-5e y evita copiar libros enteros
   para cambiar un número.
5. **Ajustes de creación por campaña**: edición(es) y si se mezclan, libros permitidos, nivel inicial, método de
   características y de puntos de golpe, trasfondo propio, crear dentro de la campaña y aprobación del máster.
6. **Versiones de libro sin sorpresas**: una versión nueva de un libro convive con la anterior; cada campaña sigue con
   la suya hasta que el máster la cambie; no se puede borrar un libro que use una campaña, y se dice cuál.
7. **«Basar en…»** para el homebrew: crear una criatura o un conjuro copiando uno de un libro, en un libro propio de la
   campaña o del mundo.
8. **Importar personajes resolviendo por nombre contra el compendio de la campaña**, con lo que no casa aparte y la
   sugerencia de activar el libro que falta.
9. **Lo que haremos distinto**: Crisol es de uso privado (ADR-0014), así que no hace falta Bazar ni tienda; compartir
   entre mundos de Enrique puede ser por referencia (un libro, varias campañas) en vez de copias. Si algún día los
   jugadores aportan libros, sería por campaña y con el visto bueno del máster.

### Lo que no se pudo ver sin cuenta (para la fase con cuenta de prueba)

*Casi todo se vio el 2026-11-10: ver «Con cuenta» abajo y, lo que falta, su «Lo que sigue sin verse».*

- El compendio por dentro: cómo se ve una entrada, si dice su libro y página, filtros reales (nivel, escuela, VD), la
  vista «Por manual».
- El paso «Reglas y contenido» del asistente de campaña y el bloque «Suplementos»: cómo se presentan los libros
  (portada, lista, buscador), y si el SRD se puede apagar.
- El importador de homebrew en marcha: probarlo con un PDF propio de prueba y con Markdown; la pantalla de revisión.
- El editor de módulos y el formato real de un módulo exportado.
- El permiso «Ver todos los manuales»: quién lo tiene y dónde se da.
- Qué ve un jugador del compendio en una campaña con libros apagados, y el creador de personajes con esos límites.
- El Bazar por dentro: qué hay publicado para 5e y cómo se ve un repositorio.

## Con cuenta, 2026-11-10

Segunda fase con la cuenta de prueba de Enrique (plan gratuito), interfaz en español. Marca nueva: **[cuenta]**,
comprobado dentro de la app. Se creó lo mínimo para ver los flujos (ver «Qué se creó» al final); nada se publicó.

### 1. Crear la campaña: los libros no están en el asistente

- El asistente tiene tres ritmos (Rápido, Normal, Avanzado) y los siete pasos ya descritos; a la derecha, una vista
  previa de cómo se verá la mesa en el buscador de partidas o en su portada [cuenta].
- El paso «Sistema» dice que los libros se eligen en el paso siguiente, pero el paso «Reglas y contenido» solo trae la
  **edición** (2024 o 2014) y el interruptor de **mezclar ediciones**, más el nivel inicial y los ajustes de mesa
  (presets, búsqueda de ajustes, niveles de detalle). Sin módulos en la biblioteca no hay nada que elegir, y no aparece
  ningún paso de libros [cuenta]. Con un módulo ya llevado, la elección vive en la configuración de la campaña (abajo).
- La lista de sistemas del asistente solo mostraba el 5e (oficial) y un sistema propio vacío de la cuenta; los otros
  sistemas oficiales salen al crear una ficha suelta [cuenta]. Inconsistencia o filtro por «tiene compendio» [inferido].
- **Una vez creada, la edición queda bloqueada** en la configuración (el desplegable sale desactivado) [cuenta].

### 2. Elegir libros en la campaña: «Contenido de D&D»

En Configuración → Reglas y ajustes, grupo «Contenido de D&D» [cuenta]:

- Una línea fija para lo de serie, **«Básico (SRD)»**, con su botón «Elegir contenido».
- Atajos de conjunto: **Todo**, **Solo lo oficial**, **Añadir lo de terceros** y **Limpiar**, cada uno con su recuento
  («0 libros · 1 módulo»). Distingue **libros** (oficiales) de **módulos** (de terceros o caseros).
- La lista de módulos de la biblioteca del máster, cada uno con su nombre, número de entradas, «Elegir contenido» y una
  marca «En la mesa»; arriba, «1 de 1 activados» y «Quitar todo». **No hay portadas** en esta lista: solo texto.
- Un enlace «¿Te falta contenido?» a una carpeta de módulos (ver «Riesgos» abajo) y un botón para importar un módulo de
  Foundry.
- **Selección por entrada dentro de cada libro** (lo más valioso): «Elegir contenido» abre un diálogo con buscador,
  recuento global («1374 de 1384 dentro»), «Quitar todo / Activar todo» y una fila por tipo con casilla y fracción
  (Conjuros 339/339, Bestiario 336/336…); cada fila se despliega en botones por entrada para quitar o poner una a una.
  Explica que lo desmarcado no sale al crear personajes, al subir de nivel, en el inventario ni en el compendio de la
  campaña, y que **lo que el libro añada después entra marcado**. Tras guardar, la línea resume «10 quitadas».
- **El SRD se puede recortar entero**, tipo a tipo o entrada a entrada; no es un interruptor único, pero «Quitar todo»
  lo deja vacío [cuenta].
- **Fallo visible**: al quitar todas las especies se quitaron también los idiomas «Mediano» y «Orco», que se llaman
  igual que dos especies. La selección parece ir por nombre y no por identificador y tipo [cuenta, inferido].
- Llevar un módulo a una campaña se hace desde el propio módulo («Llevar a» → la campaña), con un aviso que permite
  deshacer; entra ya activado [cuenta].

### 3. El compendio por dentro

- Al abrirlo desde la campaña (lleva la campaña en la dirección) solo ofrece la **edición de la campaña** y respeta lo
  elegido; una casilla **«Ver todos los manuales (no solo los de la campaña)»** lo abre entero, y entonces aparece
  también la otra edición. La ve el máster; no se pudo ver qué ve un jugador (no hay segunda cuenta) [cuenta].
- **Pestañas por tipo**: Todos, Conjuros, Bestiario, Objetos, Clases, Subclases, Especies, Trasfondos, Dotes, Opciones,
  Reglas, Tablas, Otros. En «Todos» hay que buscar o elegir tipo (no lista nada de entrada) [cuenta].
- **Filtros por tipo**, en un panel plegable: conjuros por nivel, escuela, clase y tiempo de lanzamiento, más ritual y
  concentración; bestiario por tipo de criatura, VD y **manual**; subclases por clase; la búsqueda global también
  filtra por manual [cuenta]. Los nombres de clase de los filtros salen en inglés aunque la interfaz esté en español.
- **Cada fila dice su libro**: «Nivel 2 · Evocación · *libro*»; criaturas con VD, tipo, CA, PG y libro; subclases con
  su clase y libro [cuenta].
- **La entrada** se abre en una ventana flotante (minimizar, anclar, cerrar) con el nombre en español y en inglés, una
  línea de datos que acaba en **«*libro*, pág. N»**, el cuerpo con las distancias en doble unidad (pies / metros) y un
  botón «Mostrar» a la mesa [cuenta]. En la página de reglas de la campaña, la misma entrada lleva «Fuente: *libro*,
  pág. N».
- **El SRD se reparte en los libros comerciales que le corresponden**: lo de serie de 2024 aparece como si fuera del
  manual del jugador, la guía del máster o el manual de monstruos de esas ediciones, con su página. Es una etiqueta de
  procedencia, no el libro de pago [cuenta, inferido].
- **«Por manual»** (en el menú «Vista del compendio») lista los libros con su número de **secciones de reglas** (39 en
  el del jugador, 0 en los otros) y, al abrir uno, sus reglas (condiciones, habilidades, glosario…). No agrupa los
  conjuros ni las criaturas por libro: para eso está el filtro «Manual» [cuenta].
- Búsqueda bilingüe: buscar en inglés encuentra la entrada en español, mezclando tipos (conjuros y objetos) con su
  libro en cada resultado [cuenta].
- No apareció «Corregir para mí» en las entradas de serie abiertas desde la campaña [cuenta]; quizá solo en otro
  contexto o para módulos.

### 4. El creador de personajes dentro de la campaña

- Se entra con la campaña en la dirección; la cabecera dice campaña, edición y nivel inicial, y avisa de que se usa el
  sistema de la mesa (con opción de otro sistema para una ficha aparte) [cuenta].
- **Solo ofrece lo activado**: con las especies del SRD quitadas y la del módulo de prueba activa, el paso «Origen»
  solo ofreció esa especie (más «Personalizada…»). **Cada opción lleva debajo el nombre de su libro** (los trasfondos,
  el del jugador; la especie, el módulo). Los idiomas también salen ya filtrados [cuenta].
- Pasos: Identidad, Origen, Clase, Características, Detalles, Resumen; arriba, las características y derivados en vivo
  [cuenta]. El personaje se guarda solo como borrador en cuanto tiene nombre.
- No se nota en ningún sitio que haya cosas quitadas: simplemente no salen [cuenta].

### 5. Añadir contenido: módulos e importador

**Crear un módulo** (Taller → Módulos): ritmo Rápido o Normal, «Para D&D» o «para uno de mis sistemas», nombre y
edición, importar un JSON o crear vacío; nace **privado y en borrador**. El plan gratuito permite **un** módulo: tras
crearlo, la biblioteca avisa del tope y el botón de importar lo recuerda [cuenta]. En la biblioteca, lo de serie sale
como dos tarjetas fijas («Reglas básicas 2024» y «2014», incluidas y que no se quitan) y existen **carpetas de
módulos** (un paquete de varios módulos) [cuenta].

**El editor de módulos** [cuenta]:

- Barra de tipos a la izquierda: Conjuros, Bestiario, Objetos, Clases, Dotes, Trasfondos, Reglas/Opciones, Especies,
  Idiomas, Subclases, Tablas y «Deidades, trampas y más».
- Cada entrada se edita en un panel a la derecha con **vista previa en vivo** en pestañas: cómo sale en el compendio,
  cómo sale en la ficha y qué se automatiza. La vista previa pone sola «Fuente: *nombre del módulo*»; **no hay campo de
  página** ni de libro original.
- Nombre en español y en inglés; para conjuros, nivel, escuela, lanzamiento, alcance, componentes, duración,
  concentración, ritual, descripción y mecánica automatizable.
- **Ampliar otro libro**: un conjuro marca sus **clases** (las de serie o «Clase de otro módulo»), así entra en la lista
  de esa clase; una subclase elige su **clase padre**; los conjuros, rasgos por nivel, recursos y bolsas de rasgos van
  dentro. No hay un «añadido a la entrada de otro» explícito: se amplía porque la entrada nueva apunta a la ajena.
- Deshacer y rehacer, y guardado automático en cuanto la entrada tiene nombre.
- Menú «Más»: Basar en…, Importar homebrew, importar módulo JSON, paquete .zip o tabla, Ficha del módulo, Ver manual,
  exportar en JSON o .zip y Publicar en el Bazar.
- **«Basar en…»** abre el compendio entero (SRD y biblioteca, ambas ediciones) con buscador para copiar una entrada.
- **La ficha del módulo**: nombre, descripción, edición (2024, 2014 o ambas), atribución y licencia, portada y un
  bloque de **aspecto del manual** (fondo pergamino o limpio, letras, color de acento, columnas, capitular, línea bajo
  el título, imagen de tapa e icono por tipo de entrada). Se ven claves de traducción sin traducir en los colores.

**El importador de homebrew** (dentro del módulo) [cuenta], tres pasos:

1. *Origen*: enlace de Homebrewery (o buscar en su catálogo público, con «solo 5e»), archivo o texto pegado.
2. *Revisar*: entradas agrupadas por tipo, cada grupo con «Todas / Ninguna»; por entrada, casilla, desplegable de
   **categoría**, «Renombrar» y «Ver original» (el trozo de Markdown del que salió). Avisa de datos que faltan (una
   criatura sin características: «quedan en 10»).
3. *Destino*: dentro de un módulo, fijo a ese módulo, con un campo de atribución y licencia; botón «Importar N
   entradas».

Prueba con un texto inventado (un conjuro, una dote, una subclase, una criatura y un objeto), sin guardar:

- **En inglés y con el formato de Homebrewery** reconoció cuatro de cinco con su tipo correcto; la subclase se perdió.
- **En español**, el mismo contenido dio dos de cinco y mal clasificadas (el conjuro como regla, la criatura como
  tabla por su tabla de características); la dote, la subclase y el objeto desaparecieron sin aviso.
- Conclusión: el detector depende de rótulos en inglés; para libros en español (Fateforge) no sirve tal cual.

### 6. Riesgos y detalles de experiencia

- **El enlace «¿Te falta contenido?» lleva a una carpeta de módulos compartida por un usuario anónimo** que reúne
  transcripciones de decenas de libros de pago (nombrados por su abreviatura) con libro y página por entrada, y un aviso
  de que la app no lo distribuye y que se comparta solo en privado. No se añadió ni se copió nada. La propia app lo
  ofrece desde la pantalla de contenido: es su mayor riesgo legal [cuenta].
- Se entiende al primer vistazo: los atajos de conjunto con recuento, la fracción «339/339» por tipo, el libro en cada
  fila del compendio y del creador, la ventana flotante de la entrada.
- Cuesta: los libros no se eligen al crear la campaña aunque el asistente lo promete; la lista de contenido no tiene
  portadas; «Por manual» solo enseña reglas; la selección por nombre se lleva entradas ajenas; textos mezclados en
  inglés.

### Qué nos llevamos (añadido)

1. **Elegir por libro y, dentro, por tipo y por entrada**, con fracciones y «lo nuevo del libro entra marcado». Es la
   granularidad que necesita Crisol para «la campaña usa Fateforge pero sin tal clase». Siempre por identificador.
2. **Atajos de conjunto con recuento** (todo, solo oficial, añadir terceros, limpiar) sobre la lista de libros, pero
   **con portada** y recuento por tipo (a lo Nivel20).
3. **Procedencia «libro, pág. N» en cada entrada**, en la fila y en la ficha; en lo casero, campo de página opcional
   (ellos no lo tienen).
4. **El compendio de la campaña filtra solo**, con una casilla para el máster de «ver todo»; el creador de personajes
   enseña el libro debajo de cada opción.
5. **Revisión del importador** como la suya (por tipo, categoría, renombrar, ver original, avisos de datos que faltan),
   pero con la IA leyendo el PDF o el Markdown en español; y que lo no reconocido salga en una lista aparte, no que
   desaparezca.
6. Pedir el libro en el asistente de campaña de verdad (un paso «Libros»), y permitir cambiarlo después; la edición, en
   cambio, bloquearla tiene sentido si la campaña ya tiene personajes.
7. **Evitar** enlazar o sugerir contenido de terceros sin licencia.

### Lo que sigue sin verse

- Qué ve un **jugador** del compendio y del creador en esa campaña (haría falta una segunda cuenta invitada).
- El importador desde **archivo PDF** (no se subió ningún PDF) y la opción «Importar como» fuera de un módulo (el tope
  del plan gratuito bloquea crear un segundo módulo).
- «Corregir para mí» y el Bazar por dentro.

### Qué se creó en la cuenta de prueba de Roliando

- La campaña **«Prueba Crisol»** (D&D 5e, 2024), con las especies del SRD quitadas y el módulo de prueba activo.
- El módulo **«Libro de prueba Crisol»** (privado, borrador) con una especie, «Forjado de prueba».
- Un borrador de personaje, **«Personaje de prueba»**, ligado a esa campaña.
- La interfaz se pasó a español en los ajustes rápidos de la cuenta.
- Ya estaban antes: un sistema propio vacío («Sin nombre», borrador) y una campaña «Mesa de ensayo».
