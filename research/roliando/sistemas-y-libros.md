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
la contiene [inferido].

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
- Si una entrada dice o no su libro, no consta; la vista por manual los agrupa [guía]. **Sin cuenta no se ve**
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
- **Sin procedencia por entrada**: ni libro, ni abreviatura, ni página. Si se mezclan libros en un módulo, se pierde de
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

- El compendio por dentro: cómo se ve una entrada, si dice su libro y página, filtros reales (nivel, escuela, VD), la
  vista «Por manual».
- El paso «Reglas y contenido» del asistente de campaña y el bloque «Suplementos»: cómo se presentan los libros
  (portada, lista, buscador), y si el SRD se puede apagar.
- El importador de homebrew en marcha: probarlo con un PDF propio de prueba y con Markdown; la pantalla de revisión.
- El editor de módulos y el formato real de un módulo exportado.
- El permiso «Ver todos los manuales»: quién lo tiene y dónde se da.
- Qué ve un jugador del compendio en una campaña con libros apagados, y el creador de personajes con esos límites.
- El Bazar por dentro: qué hay publicado para 5e y cómo se ve un repositorio.
