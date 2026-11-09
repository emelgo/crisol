# Sistemas y libros en Nivel20

Módulo de Crisol: sistemas y libros (tras el ADR-0019; pedido por Enrique el 2026-11-10) · Fecha: 2026-11-10 ·
Versión estudiada: web pública de nivel20.com, v2.20.9 (pie de página), y sus novedades de marzo de 2018 a octubre de 2026

## Pregunta

Crisol quiere separar el **sistema** (las reglas: tipos de ficha, campos, tiradas) de los **libros** que rellenan su
compendio, y que al crear una campaña se elija el sistema y luego qué libros usa. Queríamos saber cómo lo resuelve
Nivel20: qué sistemas tiene, cómo organiza el contenido por libro, cómo se consiguen los libros (de pago, gratis,
subidos por el usuario), cómo los elige una campaña y si el máster limita lo que usan los jugadores, cómo se busca en el
compendio y si cada entrada dice de qué libro es. Y, de paso, qué más hace que pueda aportar a Crisol.

**Cómo se leyó.** Solo la parte pública, sin cuenta: las páginas de cada juego y su compendio, las fichas de varios
libros, criaturas, conjuros y un personaje compartido, el manual del tablero 2D y la página de novedades (que es lo más
rico: casi ocho años de cambios explicados). El sitio no tiene ayuda, preguntas frecuentes ni blog públicos. El
navegador privado de craft-anything pasó el cortafuegos de CloudFront, que bloqueaba a curl y a WebFetch tras pocas
peticiones; Patreon no se dejó leer (desafío de Cloudflare). Grado de certeza:

- **[visto]**: observado en la página, sin sesión.
- **[novedades]**: lo cuenta su página de novedades.
- **[fuera]**: fuentes de terceros (buscador, fichas de la app).
- **[deducido]**: deducido, sin comprobar.

## Lo que hacen

### 1. Qué es y para quién

Nivel20 es una plataforma web gratuita, en español, de la empresa española TwinCoders, para crear y compartir
personajes y campañas de rol, con un registro de combate y un tablero virtual [visto]. Su público es el jugador
hispanohablante que no quiere pelearse con herramientas en inglés [fuera]. Tiene app de Android (antes llamada
Dungeon20, más de cien mil instalaciones) y un Discord con unos diecinueve mil miembros [fuera]. Se financia con
anuncios (muchos y muy invasivos: el banner de consentimiento habla de más de doscientos socios publicitarios) y con
Patreon, que quita la publicidad, da acceso anticipado, voto en lo próximo a desarrollar e inscripción temprana a sus
eventos [visto]. Promete seguir siendo gratis [visto]. No hay tienda ni planes de pago [visto].

Funciones: creador de personajes guiado por sistema, hoja en la web y en PDF imprimible, campañas con diario, bestiario
de campaña y registro de combate, tablero virtual (3D clásico y 2D nuevo), creación de contenido propio en «libros de
reglas» y un modo genérico para cualquier juego [visto].

### 2. Sistemas («juegos»)

Seis juegos: Pathfinder 2, D&D 2024, D&D 2014, D&D 3.5, El Resurgir del Dragón (de Nosolorol, compatible con 5e) y
**Universal** [visto]. Cada juego es un mundo aparte con su propio menú: personajes, campañas y un compendio con las
categorías que tocan a sus reglas (en D&D: bestiario, clases, conjuros, dotes, equipo, estados, razas o especies,
trasfondos y libros de reglas; en Pathfinder 2, además, familias de criaturas y rasgos comunes) [visto]. Los sistemas
los programa el equipo uno a uno; el usuario no puede crear un sistema [deducido: no hay rastro de editor de sistemas].

**Universal** es la salida para cualquier otro juego: el personaje es texto enriquecido más una hoja en PDF adjunta,
que desde septiembre de 2026 se rellena en la propia web si el PDF tiene campos, y unos botones de acción para tirar
dados [visto, novedades]. Anuncian como pendiente leer datos del PDF para usarlos en fórmulas, plantillas reutilizables
y más tipos de tirada (contar éxitos…) [visto]. Es decir: fuera de sus seis juegos no hay reglas, solo una hoja.

### 3. Libros de reglas

**El libro es la unidad de contenido.** Todo lo del compendio pertenece a un «libro de reglas» de un juego [visto]. La
ficha del libro tiene portada, descripción, quién lo creó (si es de un usuario) y el recuento por tipo de lo que trae,
con tres ejemplos de cada tipo («12 clases, como…, 319 conjuros, entre…»); cada recuento enlaza a ese compendio
filtrado por el libro [visto]. Los tipos que puede traer un libro son los del juego: clases, arquetipos (subclases, con
sección propia desde 2023), razas y subrazas (o especies y legados en 2024; ascendencias y herencias en Pathfinder 2),
trasfondos, dotes, conjuros, **listas de conjuros**, criaturas, familias de criaturas, rasgos comunes, equipo y rasgos
de clase [visto]. Un libro de usuario puede **ampliar lo de otro**: añadir rasgos a clases que ya existen (otra
invocación de brujo, otro estilo de combate) o conjuros nuevos a listas existentes como la del mago [novedades].

**Cuatro tipos de contenido**, que sirven de filtro en cada lista: reglas básicas, contenido oficial, contenido de
terceros y contenido casero [visto]. En la lista del compendio, las entradas de origen validado llevan un distintivo
[visto].

**La colección.** Cada usuario tiene una colección de libros por juego y solo puede usar en sus personajes lo de los
libros que tiene en ella [visto: «teniendo este compendio en tu colección tendrás acceso a…»]. Las reglas básicas
están siempre dentro, sin hacer nada [novedades]; los demás se añaden con un botón «Añadir a mi colección», gratis
[visto]. Los filtros de la lista de libros son «en mi colección», «fuera de mi colección» y «creados por mí» [visto].
Desde septiembre de 2026 cada libro de la colección se puede **activar o desactivar** sin quitarlo, para no ver
opciones que no se usan [novedades].

**Qué hay y cómo se consigue.** No se vende nada: el contenido oficial es el que tiene licencia abierta o cedida
[visto]:

- D&D 2014 y 2024: solo las reglas básicas, traducción propia de los SRD 5.1 y 5.2 [visto]. Ningún libro de pago de
  Wizards es contenido oficial; Nivel20 se ampara en la política de sitios de fans [visto].
- Pathfinder 2: las reglas básicas, los dos bestiarios, la guía avanzada y varios suplementos y ambientaciones, con las
  traducciones de Devir y al amparo de la política de uso comunitario de Paizo, que les prohíbe cobrar por ese
  contenido [visto]. Los bestiarios cuentan como reglas básicas (siempre en la colección); los suplementos, como
  oficiales que se añaden [visto, novedades].
- El Resurgir del Dragón: el manual básico (como reglas básicas) y siete suplementos y revistas de Nosolorol como
  oficiales [visto].
- D&D 3.5: el SRD [visto].

**El contenido casero lo crean los usuarios** como libros de reglas propios (con acceso anticipado en 2020, abierto
después) [novedades]. Se comparten porque un libro público aparece a los demás, que lo añaden a su colección; desde
2024 su autor puede invitar a amigos de Nivel20 a **editarlo juntos** [novedades]. Sin sesión, el filtro de casero sale
vacío, pero los libros de usuarios se abren por su dirección [visto]: así se ve que los usuarios **transcriben libros
de pago** (las criaturas de una aventura oficial, o un compendio que junta subclases, razas y monstruos de varios
manuales de Wizards con su lista de procedencias) y los comparten como «casero» [visto]. Los identificadores de libro
pasan de tres mil [visto: numeración de las direcciones], la mayoría de usuarios [deducido].

**Copiar a un libro o a una campaña.** Desde la ficha de una criatura, «Crear copia» la duplica en una campaña o en un
libro de reglas propio, para variarla; el autor puede impedir que se copie lo suyo [visto, novedades]. Los personajes
también se copian, incluidos los compartidos por otros [visto, novedades].

### 4. Campañas y libros

Desde agosto de 2026, el **filtro de contenido**: en un personaje o en una campaña se eligen qué libros de reglas se
pueden usar, y el contenido disponible se limita a esa selección [novedades]. En la campaña tiene un efecto más:
quienes crean personajes para ella **usan los libros elegidos por el máster aunque no los tengan en su colección**
[novedades]. O sea, los libros los aporta el máster y los jugadores heredan su acceso dentro de esa campaña; los
jugadores no aportan libros a la campaña [deducido: no se menciona lo contrario]. La campaña nace dentro de un juego
(las campañas cuelgan de cada juego en el menú) [visto]. El paso exacto de elegir libros al crearla no se ve sin
cuenta.

La campaña tiene además su **bestiario de campaña**: criaturas importadas o copiadas a ella, que salen primero al
montar encuentros [novedades].

### 5. El compendio: búsqueda, filtros y entradas

Cada tipo tiene su lista con búsqueda por nombre, filtros propios y orden [visto]:

- Criaturas (D&D): categoría (monstruo, bestia o PNJ), tipo, desafío desde y hasta, y orden por nombre o desafío. En
  Pathfinder 2, por familia. Columnas: desafío, nombre, tipo, alineamiento y **origen** (el libro) [visto].
- Conjuros: nivel, escuela, clase, categoría y orden. Cada fila trae el resumen de una o dos frases además de los datos
  de lanzamiento [visto].
- Equipo: tipo de objeto, categoría y propiedad; las armas salen en tabla con daño, propiedades, precio y peso [visto].
- Razas, clases, libros: tipo de contenido (básicas, oficial, terceros, casero) [visto].

La búsqueda se rehízo en 2026 para ser más rápida y relevante, y busca también personajes por clase, raza o campaña
[novedades]. La lista es paginada [visto].

**La entrada** dice siempre su **origen** con enlace al libro [visto]. Los conjuros tienen un **resumen corto** encima
del texto completo, y la lista de conjuros a la que pertenecen [visto]. Las criaturas traen bloque de estadísticas con
tiradas pulsables (características, salvaciones, ataques y daño): sus acciones y rasgos se convierten solas en botones,
que se pueden reordenar, ocultar o completar a mano [visto, novedades]. Las distancias se muestran en pies, metros o
casillas a elección del usuario, por juego, y al pulsarlas enseñan las otras unidades [novedades]. Todo tiene enlace
para compartir y, en el editor de texto, se puede enlazar un conjuro o una criatura que se abre en ventana flotante
[visto, novedades].

## Compromisos y límites

- **Ganan** un modelo muy simple de entender: un libro es un paquete de contenido; la colección dice qué tienes; la
  campaña dice qué se usa. Que la campaña preste sus libros a los jugadores quita el problema de «cada jugador tiene que
  tener el libro».
- **El acceso no está atado a la compra.** Como no venden libros, «añadir a la colección» es solo un interruptor. Para
  lo oficial de licencia abierta va bien; para lo de pago, el hueco lo llenan los usuarios transcribiendo libros como
  casero, algo que Nivel20 tolera y que es su mayor riesgo legal [deducido]. Crisol no tiene ese problema mientras sea
  de uso privado (ADR-0014), pero conviene que el libro sepa de dónde viene.
- **Sistemas cerrados.** Solo hay seis juegos, programados por ellos; lo demás cae en Universal, que es una hoja en PDF
  con botones. Crisol, con sistemas definibles por el usuario o la IA, va por delante aquí.
- **Libros planos.** El libro es una bolsa de entradas, sin capítulos ni texto de reglas que leer: la ficha del libro
  es una portada con recuentos. La parte narrativa de un suplemento (la ciudad, su historia) solo aparece como
  descripción.
- **Dos niveles de filtro solapados** (activar o desactivar en la colección y filtro por campaña o personaje) llegaron
  con un mes de diferencia: señal de que la colección crecía demasiado y molestaba al crear personajes [deducido].
- **Anuncios por todas partes**, incluidos enlaces publicitarios entre el menú y el contenido: estorban la lectura del
  compendio.

## Qué nos llevamos a Crisol

1. **El libro como unidad del compendio**, con su ficha: portada, descripción, procedencia (oficial, de terceros,
   propio) y el recuento por tipo con unos ejemplos; cada recuento abre el compendio filtrado por ese libro. Es
   exactamente lo que nos falta para elegir libros «por su nombre y con portada» al crear la campaña.
2. **La campaña presta sus libros**: lo que el máster activa en la campaña es lo que ven y pueden elegir los jugadores
   al crear su personaje, sin que tengan que tener nada. Encaja con lo que ya hacemos (la campaña elige sus fuentes).
3. **Origen en cada entrada**, con enlace al libro, y una columna de origen y filtro por libro en cada lista del
   compendio.
4. **Libros que amplían a otros**: un libro puede añadir una subclase, un rasgo o un conjuro a una lista de otro libro
   (Fateforge sobre el 5e). Hay que modelarlo: el libro aporta entradas y también «añadidos» a entradas ajenas.
5. **Copiar al libro propio o a la campaña** una criatura u objeto para variarlo, conservando de dónde salió. En Crisol
   podría ser «Crear copia» hacia un libro casero del máster o hacia la campaña.
6. **Resumen corto en conjuros** (y quizá en rasgos y objetos), útil en listas, en la ficha y en la mesa.
7. **Unidades a elección** (pies, metros, casillas) por usuario y sistema, convertibles al pulsar.
8. **Distinto**: los sistemas siguen siendo definibles (por archivo, Foundry o IA), no una lista cerrada; los libros
   pueden tener texto propio (capítulos, la parte de ambientación) y no solo entradas; y sin anuncios.

## Para la fase con cuenta de prueba

Lo que no se pudo ver sin sesión: el paso de crear una campaña y elegir sus libros (y si se cambian después); cómo ve
un jugador el creador de personajes con los libros de la campaña; el editor de libros caseros (qué tipos de entrada,
cómo se amplía una clase o una lista de otro libro, visibilidad pública o privada, colaboración); la colección con sus
interruptores; la lista de libros caseros visible con sesión; el bestiario de campaña y «Crear copia» hacia un libro;
y si hay importación de algún formato.

## Con cuenta, 2026-11-10

**No se pudo entrar.** Con la cuenta de prueba de Enrique (usuario `crisol_estudio`), al pulsar «Iniciar sesión» el
formulario lanzó un **reCAPTCHA con desafío de imágenes**. Por las reglas del estudio no se resolvió: se abandonó la
página sin llegar a iniciar sesión, así que no hubo sesión que cerrar ni se creó nada en la cuenta. Todo lo de «Para la
fase con cuenta de prueba» sigue pendiente: crear una campaña y elegir sus libros, la colección con sus interruptores,
el editor de libros caseros, el creador de personajes dentro de la campaña y el bestiario de campaña.

**Para reintentarlo**: que Enrique inicie sesión una vez a mano en el navegador del estudio (el desafío suele salir a
navegadores sin historial) y deje la sesión abierta para el estudio. Mientras tanto, lo de Roliando con cuenta
(`research/roliando/sistemas-y-libros.md`, «Con cuenta») cubre las cuatro prioridades desde el otro lado.
