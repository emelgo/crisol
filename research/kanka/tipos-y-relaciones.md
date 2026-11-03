# Tipos, plantillas y relaciones en Kanka

Módulo de Crisol: 2. Tipos de página, plantillas y consultas · Fecha: 2026-11-03 · Versión estudiada: web pública a
fecha de hoy

## Pregunta

Cómo resuelve Kanka lo que vamos a construir en el módulo 2 (`docs/modulos.md`, «2. Tipos de página y plantillas»):
tipos de página de serie y propios, plantillas, campos, enlaces entre páginas y tablas que se llenan solas. Las siete
preguntas del estudio:

1. Tipos o plantillas de serie frente a los del usuario: si se editan, si se crean desde cero o copiando, su ámbito.
2. Qué pasa con las páginas ya hechas al cambiar una plantilla.
3. Clases de campo, y cómo son los campos que enlazan a otras páginas.
4. Listas inversas automáticas: quién las define, dónde se ven y si hace falta escribir algo parecido a una consulta.
5. Cómo crea el usuario una página desde plantilla.
6. Qué falla o de qué se quejan los usuarios.
7. Cómo expone la API los tipos, los campos y las relaciones.

Solo se leyó la web pública: la documentación (docs.kanka.io), la base de conocimiento, el blog con las notas de
versión (hasta la 3.17, del mismo día), la documentación de la API y la página de su MCP. Ni cuenta ni código: Kanka
publica el suyo con licencia copyleft y no se abrió. Grado de certeza:

- **[doc]**: documentación oficial o base de conocimiento.
- **[blog]**: notas de versión del blog oficial.
- **[API]**: documentación pública de la API.
- **[inferido]**: deducido, sin comprobar.

**Ojo con los nombres.** Kanka renombró casi todo entre 2025 y 2026, y la API y algunos textos siguen con lo antiguo
[doc, API]. Los módulos ahora son *categorías* (antes también *entity types*), los atributos son *propiedades*, las
plantillas de atributos son *kits de propiedades*, las plantillas de entidad son *arquetipos* y los posts son
*artículos*. Aquí se usan los nombres nuevos, en español.

## Lo que hacen

### El modelo, en breve

Toda página (*entry*) pertenece a una categoría. Hay unas dos docenas de serie: personajes, lugares, organizaciones,
familias, razas, criaturas, objetos, misiones, notas, eventos, diarios, mapas, calendarios, líneas temporales,
habilidades, etiquetas… [doc]. Todas comparten un tronco común (nombre, un «tipo» que es texto libre, madre, texto,
imagen, etiquetas, permisos) y cada una añade sus campos y sus subpáginas. Su razón, según la propia documentación: que
cada clase tenga funciones propias que se relacionen con el resto del mundo, y que el usuario no pierda el tiempo
montando su jerarquía [doc].

La página de la documentación que explica las categorías aún dice que no se pueden añadir tipos. Pero desde la 3.0
(febrero de 2025) las campañas de pago pueden crear categorías propias [blog, doc]. La documentación se contradice.

### 1. Lo de serie frente a lo del usuario

Kanka reparte entre seis piezas lo que en Crisol será «plantilla»:

| Pieza | Qué es | ¿Se edita? | Ámbito | Cómo nace |
|---|---|---|---|---|
| Categoría de serie | Tipo fijo, con campos y subpáginas propios | Solo nombre singular y plural, icono, imagen por defecto, activa o no | Campaña | Viene dada |
| Categoría propia | Tipo nuevo, solo con el tronco común | Sí | Campaña, hasta 5, solo de pago | Desde cero: singular, plural, icono y roles con lectura |
| Kit de propiedades | Lista de propiedades que se añade a una página | Sí | Campaña | Desde cero. Se anidan: un kit trae también los de sus hijos |
| Arquetipo | Una página normal marcada como modelo | Es una página más | Campaña, y solo para su categoría | Se marca una página que ya existe |
| Plantilla de artículo | Un apartado reutilizable | Sí | Campaña | Se marca un artículo |
| Hoja de personaje | Maquetación de las propiedades | La edita el autor | Biblioteca de plugins, se instala en la campaña | Plugin |

[doc, blog]

- **Las de serie no se borran.** Se desactivan y sus datos quedan ocultos, no perdidos [doc].
- **Renombrar una categoría de serie** funciona bien en inglés, pero la documentación avisa de que en idiomas con género
  las frases de la interfaz salen raras, porque dan por hecho el género del nombre original [doc].
- **Las categorías propias son de segunda.** Solo tienen el tronco común. Lo demás va en propiedades [blog]. Al copiar
  una página suya a otra campaña, llega como nota. Si la campaña deja de pagar, se ven y se editan, pero no se crean
  nuevas [doc, blog].
- **Nada es de la cuenta.** Categorías, kits, arquetipos y plantillas de artículo son de cada campaña. Para llevar algo a
  otra campaña se copian páginas en bloque. Lo único compartido entre campañas parece ser la biblioteca de plugins
  [doc, inferido].

### 2. Al cambiar una plantilla

- **Kits.** Se aplican al guardar la página, y lo que hacen es copiar propiedades. Si luego cambia el kit, las páginas
  no se enteran: hay que volver a aplicarlo a mano, de una en una o en bloque. Si la página y el kit tienen una propiedad
  con el mismo nombre, gana la de la página [doc].
- **Kit por categoría.** Un kit se puede atar a una categoría para que se aplique solo a las páginas nuevas de esa
  categoría. Pero solo funciona desde el formulario completo, no desde la creación rápida ni al crear una página desde
  una mención [doc].
- **Arquetipos.** La página nueva sale rellena con lo del arquetipo y el nombre en blanco. Una pestaña de opciones elige
  qué cosas relacionadas se copian, todas marcadas por defecto [doc]. Es una copia: los cambios posteriores del arquetipo
  no llegan a las páginas hechas [inferido].
- **Cambiar de categoría.** Se puede convertir una página a otra categoría. Conserva lo común (nombre, tipo, texto,
  etiquetas, permisos, propiedades, artículos, relaciones…) y pierde los campos propios de la categoría de origen, que
  no vuelven aunque se deshaga la conversión. Las menciones a la página siguen funcionando [doc].

### 3. Clases de campo y enlaces

**Campos fijos de cada categoría** [doc, blog]:

- Texto: el «tipo», el título, la edad, el género con sugerencias de los valores más usados en la campaña…
- Casillas y estados. Un personaje está vivo, muerto o, desde la 3.10, desaparecido. Una misión está sin empezar, en
  curso, abandonada o completada.
- **Campos foráneos**: enlaces a páginas de una categoría concreta. Un personaje tiene lugar (uno), familias y razas
  (varias). Un lugar tiene lugar madre. Un objeto, creadores. El selector busca por nombre desde tres letras y trae un
  «+» para crear la página destino al vuelo.

En 2026 varios enlaces sencillos pasaron a múltiples: objetos con varios creadores, eventos, misiones, diarios y familias
en varios lugares [blog]. Elegir «uno» al principio les obligó a cambiarlo después.

**Propiedades**, para todo lo demás [doc, API]:

| Clase | Notas |
|---|---|
| Texto | Hasta 191 caracteres |
| Párrafo | Texto largo |
| Número | Admite un rango mínimo y máximo, escrito con una sintaxis dentro del nombre |
| Casilla | Marcada o no |
| Sección | Agrupa propiedades en cajas |
| Aleatorio | Solo en kits: número de un intervalo o elemento de una lista, sorteado al aplicar |
| Lista de opciones | Aparece en la API. En la documentación, las opciones se escriben con la misma sintaxis del rango |

- Los valores son texto. Pueden llevar menciones a cualquier página, referencias a otras propiedades de la misma página
  y cuentas sencillas [doc].
- Los rangos y las opciones solo se respetan al editar en línea. El formulario completo los muestra como texto y acepta
  cualquier valor [doc].
- Una propiedad puede ser privada (solo administradores) y fijarse en la columna lateral de la página [doc].

**Relaciones (conexiones).** Enlaces libres entre dos páginas cualesquiera, con una etiqueta de texto, una actitud de
-100 a 100, color, visibilidad y opción de fijarla. Al crearla se puede pedir la relación espejo, que es una segunda
relación en sentido contrario, no la misma vista desde el otro lado [doc, API].

**Menciones** en el texto, a cualquier página [doc].

### 4. Listas inversas

**Vienen dadas por la categoría**, no se configuran [doc]:

- El lugar tiene una subpágina con los personajes cuyo campo «lugar» apunta a él.
- La organización y la familia, sus miembros.
- La misión, sus elementos (lista manual, cada uno con su papel).
- El lugar muestra en su columna lateral los mapas que lo tienen como lugar.

**La pertenencia a una organización es un objeto propio**, no un campo del personaje. Lleva un papel (texto libre), un
estado (miembro, antiguo miembro, desconocido), un superior (otro miembro), privacidad, y se puede fijar en el personaje,
en la organización o en los dos. Se edita desde la pestaña de organizaciones del personaje o desde la organización
[doc, API].

**La subpágina de conexiones** junta las relaciones a mano y una lista automática de «relacionados»: las páginas que
apuntan a esta por un campo o una relación. Las menciones en el texto no cuentan. En las campañas de pago se ve también
como grafo [doc].

**Listas filtradas por categoría.** Cada lista (todos los personajes, todos los lugares…) se filtra por lugar, familia,
raza u organización, con cuatro modos: incluir, excluir, con descendientes, o sin ninguno. También por nombre y valor de
propiedad, siempre por coincidencia exacta. Los campos de texto aceptan una pequeña sintaxis de signos para negar, exigir
el valor exacto o buscar vacíos. Un filtro se puede copiar a un widget del panel principal o a un marcador, y así queda
como lista guardada [doc]. Es lo más parecido a una tabla configurable, pero vive en el panel o en la barra lateral, no
dentro de una página. Los filtros no evalúan las cuentas de las propiedades [doc].

No se vio ningún bloque que el usuario pueda meter en una página para listar otras según un campo [inferido].

### 5. Crear una página desde plantilla

- **Desde la lista de una categoría**: junto al botón de crear hay un desplegable con los arquetipos de esa categoría.
  Abre el formulario completo ya relleno, con el nombre en blanco para no repetir nombres [doc].
- **Creación rápida** (botón o tecla N): se elige categoría, nombre y pocos campos sin salir de la página. En modo masivo
  cada línea es una página. Desde la 3.2, el modo masivo puede partir de un arquetipo de la misma categoría [doc, blog].
- **Desde un campo foráneo**: el «+» abre la creación rápida, crea la página y la deja puesta en el campo [doc].
- **Desde una mención** a una página que no existe [doc].
- **Kits**: en la pestaña de propiedades del formulario se elige un kit, o una hoja de personaje. Se aplica al guardar
  [doc].
- Los jugadores ven los arquetipos que pueden leer y los usan si pueden crear en esa categoría [doc].

### 6. Límites y quejas visibles

- La documentación se contradice sobre si hay tipos propios [doc].
- Categorías propias: cinco por campaña de pago, menos campos que las de serie. Al salir no tenían vista de tabla ni
  acciones en bloque (llegaron en la 3.2 y la 3.10) [blog].
- Los valores de las propiedades son texto: los desplegables solo valen al editar en línea, y los iconos en el nombre de
  una propiedad rompen sus menciones de vez en cuando [doc].
- Los kits no se resincronizan, y el kit por categoría no se aplica desde la creación rápida ni desde las menciones
  [doc].
- Hasta la 3.0, guardar dos propiedades con el mismo nombre borraba la antigua sin avisar [blog].
- Renombrar categorías rompe la gramática en idiomas con género [doc].
- Filtros y propiedades se casan por nombre exacto: renombrar una propiedad deja fuera a las páginas que aún tienen el
  nombre viejo [inferido].
- El MCP es de solo lectura, busca solo por nombre y está hecho sobre todo para personajes. Del resto de categorías da
  poco más que el nombre, el estado y la descripción [blog].

### 7. API y MCP

- **Categorías**: una lista por campaña con singular, plural, icono, si es propia y si se anida. Las propias se crean,
  editan y borran por la API. Las páginas de una categoría se piden filtrando por ella [API].
- **Propiedades**: por página, con su clase como número (siete clases), privada o no, fijada o no, y un identificador
  libre para casarla con sistemas externos. Desde la 3.10 las casillas vuelven como booleano y no como texto [API, blog].
- **Kits**: se gestionan por la API desde la 3.2, aún con su nombre antiguo [API, blog].
- **Arquetipos**: se listan y se marca o desmarca una página como arquetipo [API].
- **Miembros de organización**: recurso propio con papel, estado, superior y dónde se fija [API].
- **Relaciones**: con la opción de crear la espejo [API].
- En la 3.10 rompieron la API: el campo madre de cada categoría pasó a un campo común a todas las páginas [blog].
- **MCP** (beta, 27-10-2026): solo lectura. Lista mundos, busca páginas por nombre y lee su texto, propiedades,
  artículos y relaciones. Sin búsqueda en el texto. Su autor deja claro que no quieren IA dentro de Kanka, solo que la
  del usuario pueda leer [blog].

## Compromisos y límites

Las categorías fijas dan a cada clase sus funciones (árboles familiares, calendarios, mapas, miembros) y sus listas
inversas sin configurar nada. El precio es que lo que no encaja acaba en notas o en propiedades, que son texto sin tipo.
Las categorías propias llegaron tarde y no tienen campos propios. Separar el tipo (categoría) del contenido inicial
(arquetipo, kit) es limpio, pero el usuario tiene que aprender cuatro o cinco ideas parecidas a «plantilla». Las listas
inversas solo existen donde Kanka las previó, y la pertenencia a organizaciones, que es rica (papel, estado, superior),
es un caso especial que no se puede repetir para otras relaciones.

## Notion, como contraste

En Notion, una relación es una propiedad de una base de datos que apunta a otra base concreta. Por defecto es de un
solo sentido. Si se activa, crea la propiedad gemela en la otra base, y las dos se editan juntas. Se puede limitar a una
sola página, y las *rollups* resumen datos de las páginas relacionadas (cuentas, sumas, fechas). Las plantillas son de
cada base de datos y solo se usan en ella. Se eligen en el desplegable del botón de crear o al abrir una página vacía.
La ayuda no dice que editar una plantilla cambie las páginas ya hechas. Para las listas inversas dentro de una página,
la receta conocida (guías de terceros) es meter en la plantilla una vista enlazada filtrada por la propia plantilla: al
crear una página desde ella, el filtro pasa a apuntar a la página nueva. Las guías avisan de que es fácil elegir mal la
página del filtro y quedarse con una lista vacía o con todo. Lo que se aprende: «esta página» tiene que ser una opción
propia del filtro, no una página concreta que el usuario elige.

## Qué nos llevamos a Crisol

- **Tipo y plantilla, juntos pero con linaje.** Crisol junta las dos cosas: la página recuerda de qué plantilla salió y
  eso es su tipo. Kanka las separa (la categoría no cambia aunque se use un arquetipo). Para no perder eso, una plantilla
  propia copiada de una de serie debería recordar de cuál viene («hecha a partir de PNJ»), y la spec tiene que decidir
  si una tabla de «páginas de tipo PNJ» las incluye. Si no, cada copia retocada de PNJ deja fuera sus páginas de las
  tablas.
- **Tablas de serie y configurables a la vez.** Kanka solo tiene las que previó. Nosotros las traemos ya puestas en las
  plantillas de serie («Miembros» en Facción, «Habitantes» en Lugar) y además se añaden con desplegables. Su lista de
  «relacionados» (todo lo que apunta aquí por un campo) es una tabla genérica barata que podría venir gratis.
- **La pertenencia es más pobre que la suya, y lo aceptamos.** Con el campo «Facción» en el PNJ no se dice «antiguo
  miembro» ni un papel distinto en cada facción. Para las 45 tablas de Eana basta. Las columnas de la tabla pueden
  mostrar campos del PNJ (Rol). Que quede escrito como compromiso en la spec.
- **Campos con tipo de verdad.** Su trampa es el texto con sintaxis: un número que admite cualquier cosa en el
  formulario y unas opciones que solo existen al editar en línea. En Crisol, número es número y opciones es una lista
  cerrada, en la interfaz, en el servidor y en el MCP.
- **Los campos se identifican por una clave estable, no por su nombre visible.** Kanka filtra por nombre exacto.
  Nuestras tablas apuntan a la clave del campo de la plantilla, y renombrar la etiqueta no saca a nadie de la tabla.
- **Un único camino de creación.** Toda forma de crear (Página nueva, desde una mención, desde el «+» de un campo enlace,
  el MCP) aplica la plantilla igual. Kanka falla justo ahí con los kits por categoría.
- **Crear al vuelo desde un campo enlace.** Si el campo Facción de un PNJ apunta a una facción que no existe, crearla
  desde el propio campo, y con la plantilla Facción.
- **Nada de frases con género.** Kanka avisa de que renombrar tipos rompe la gramática. En Crisol las plantillas propias
  las nombra el usuario («Frente»), así que los textos no flexionan el nombre: «Página nueva · Frente», nunca «Nuevo
  …» o «Nueva …».
- **Cambiar de plantilla, posible.** Kanka convierte entre categorías y conserva lo común. La spec puede dejar cambiar
  la plantilla que recuerda una página, conservando los campos de igual clave. Lo que no hay que hacer es cerrarlo, como
  World Anvil (ver su nota).
- **Aplicar una plantilla a una página que ya existe**, sin borrar nada: solo añade los campos y apartados que falten.
  No es propagar cambios, es un gesto explícito. Ayuda a pasar las 570 páginas con tipo de Eana por el MCP.
- **El MCP como ventaja.** El de Kanka es de solo lectura y flojo fuera de personajes. El nuestro crea páginas desde
  plantilla con sus valores, lista las plantillas con sus campos y lee las tablas ya calculadas.

## Fuentes

Documentación oficial (docs.kanka.io, versión «latest»):

- https://docs.kanka.io/en/latest/entries/overview.html
- https://docs.kanka.io/en/latest/entries/characters.html
- https://docs.kanka.io/en/latest/entries/locations.html
- https://docs.kanka.io/en/latest/entries/organisations.html
- https://docs.kanka.io/en/latest/entries/families.html
- https://docs.kanka.io/en/latest/entries/races.html
- https://docs.kanka.io/en/latest/entries/quests.html
- https://docs.kanka.io/en/latest/entries/notes.html
- https://docs.kanka.io/en/latest/entries/foreign-fields.html
- https://docs.kanka.io/en/latest/entries/property-kits.html
- https://docs.kanka.io/en/latest/features/properties.html
- https://docs.kanka.io/en/latest/features/relations.html
- https://docs.kanka.io/en/latest/features/connections.html
- https://docs.kanka.io/en/latest/features/articles.html
- https://docs.kanka.io/en/latest/features/nested.html
- https://docs.kanka.io/en/latest/features/profile-sidebar.html
- https://docs.kanka.io/en/latest/features/quick-creator.html
- https://docs.kanka.io/en/latest/features/mentions.html
- https://docs.kanka.io/en/latest/features/campaigns/categories.html
- https://docs.kanka.io/en/latest/features/campaigns/csv-import.html
- https://docs.kanka.io/en/latest/guides/archetypes.html
- https://docs.kanka.io/en/latest/guides/convert.html
- https://docs.kanka.io/en/latest/guides/bulk.html
- https://docs.kanka.io/en/latest/guides/lists.html
- https://docs.kanka.io/en/latest/advanced/filters.html
- https://docs.kanka.io/en/latest/advanced/api.html
- https://docs.kanka.io/en/latest/plugins/character-sheets.html
- https://docs.kanka.io/en/latest/overview.html
- https://kanka.io/kb

Blog oficial:

- https://blog.kanka.io/2025/02/19/version-3-0-custom-modules/
- https://blog.kanka.io/2025/06/03/version-3-2-quick-creator-templates
- https://blog.kanka.io/2026/04/01/version-3-10-user-requests
- https://blog.kanka.io/2026/08/26/version-3-15-locations-locations-locations/
- https://blog.kanka.io/2026/10/27/kanka-mcp/

API y MCP:

- https://app.kanka.io/api-docs/1.0/overview
- https://app.kanka.io/api-docs/1.0/campaigns/categories
- https://app.kanka.io/api-docs/1.0/entities/attributes
- https://app.kanka.io/api-docs/1.0/attribute-templates
- https://app.kanka.io/api-docs/1.0/entities/templates
- https://app.kanka.io/api-docs/1.0/organisation-members
- https://app.kanka.io/api-docs/1.0/entities/connections
- https://app.kanka.io/mcp
- https://app.kanka.io/roadmap (las ideas piden sesión: solo se vio lo que está en curso)

Notion (contraste):

- https://www.notion.com/help/relations-and-rollups
- https://www.notion.com/help/database-templates
- https://redgregory.notion.site/Self-Referential-Filters-2a59cbf4153447df966d9df78c6a02e3 (guía de terceros, vista
  solo en el extracto del buscador)
