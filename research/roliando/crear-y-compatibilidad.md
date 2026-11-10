# Crear y compatibilidad (exportar e importar) en Roliando

Módulo de Crisol: varios (3, sistemas; 4, compendio y libros; 6, mesa; 7, sala de jugadores; campaña alrededor de la
Mesa) · Fecha: 2026-11-10 · Versión estudiada: roliando.com con la cuenta de prueba (interfaz «Tinta»; novedades hasta
la 0.1.11)

## Pregunta

1. Qué se puede crear en Roliando (el Taller y sus tarjetas): qué es cada tipo, qué contiene, cómo se edita, cómo se usa
   en la mesa o la campaña y con qué pieza de Crisol casa.
2. Qué se puede exportar y en qué forma; qué importa Roliando; qué haría falta para que Crisol importe lo de Roliando (y
   al revés) y qué no casa.

**Cómo se leyó.** Con la cuenta de prueba de Enrique (plan gratuito), en el navegador de Playwright: el Taller, los
siete creadores, la biblioteca y sus menús. Se exportaron cuatro cosas **propias de la cuenta** y su forma se leyó
dentro de la propia página (lista de archivos del zip y claves del JSON), sin guardar nada en el repo. Se completó con
seis guías públicas (`/guias/formatos-importar`, `importar-mapas`, `importar-personajes`, `exportar-duplicar-campana`,
`apps-de-mesa`, `creador-tokens`, `creador-aventuras`, `creador-dados`). Marcas: **[cuenta]** visto dentro, **[guía]**
lo dice su ayuda, **[inferido]** deducido.

## Lo que hacen

### El Taller: un carrusel de diez tarjetas

«Taller» es una de las cinco secciones de la barra (Inicio, Partidas, Taller, Bazar, Mesa). Lo ocupa un carrusel de
diez columnas altas con una ilustración cada una: **Biblioteca, Sistemas, Módulos, Aventuras, Tokens, Dados, Puzzles,
Apps de mesa, Macros y Bazar**. La columna del centro está destacada y enseña lo último tocado de ese tipo, «Ver todos»
(la biblioteca filtrada) y «Crear». Arriba, un botón «Crear» abre un menú con los ocho tipos creables y otro «Canjear un
código» (para recibir copias compartidas) [cuenta]. Por debajo de 1100 px el carrusel pasa a ser una rejilla de
tarjetas [cuenta].

Todos los creadores comparten un marco: migas («Taller › Tipo»), título editable, estado («Guardado», «Sin guardar»,
«Borrador»), deshacer y rehacer, y a la derecha «Llevar a» (a una campaña), «Compartir» (Bazar o enlace), un menú de más
acciones y «Probar» [cuenta]. A la izquierda, una lista de **partes** con «N partes más» para no abrumar; a la derecha,
una **vista previa en vivo** [cuenta].

### Cada tipo

| Tipo | Qué es y qué contiene | Cómo se edita | En la mesa o la campaña | En Crisol |
|---|---|---|---|---|
| **Sistemas** | Reglas y ficha de un juego propio. 24 partes en cuatro grupos: Ficha (portada, campos, diseño, estilo, hojas de grupo), Personaje (creación, rasgos, niveles), En la mesa (tiradas, combate, opciones de mesa, economía), Contenido (objetos, bestiario, barajas, catálogos, paquetes) y siete avanzadas [cuenta] | Asistente con ritmo Rápido/Normal/Avanzado; «Basar en otro sistema»; «Revisión» de errores; cada paso acaba en «Siguiente: …» [cuenta] | La campaña elige un sistema y su ficha, dados y ayudas mandan en la mesa [guía] | **Sistema** (módulo 3). Casa en idea; Crisol lo describe con su propio documento de sistema |
| **Módulos** | Paquete de contenido que solo añade a un sistema (conjuros, bestiario, objetos, clases, dotes, trasfondos, reglas, especies, idiomas, subclases, tablas, «deidades, trampas y más») [cuenta] | Editor por categorías con panel de entrada y vista previa (ver `sistemas-y-libros.md`) | Se activa por campaña; filtra compendio y creador | **Libro / fuente** de un sistema y su **contenido del compendio** (módulo 4) |
| **Aventuras** | Documento por partes: Portada y ficha, Capítulos (texto con formato, tiradas, spoilers, imágenes, mapas y tablas insertados), Mapas (con muros, luces y rejilla), Bestiario (fichas de criatura 5e completas, «Basar en…» y «Pegar un bloque»), Escenas, Equipaje (música, apps de mesa y fichas prehechas, hasta 12 de cada) y Galería [cuenta] | Creador con vista previa de lector («Leer», «Imágenes») y «Ver» como la leerá otro; «Traer de otra aventura» para capítulos y escenas [cuenta] | «Poner en la mesa» la engancha a una campaña; «Traer a la campaña» elige qué copiar (aventura, encuentros, mapas, PNJ) y «Volver a traer» actualiza [guía] | **Páginas** de la wiki (capítulos) + **escenas** + **criaturas** del compendio + **encuentros**. Crisol no tiene un «paquete aventura» que lo agrupe |
| **Escena de aventura** | Nombre, lugar, arte de fondo y enlaces de vídeo, música y ambiente [cuenta]. Es una escena «de inmersión», no un mapa táctico; la biblioteca separa «Escenas tácticas» y «Escenas de inmersión» [cuenta] | Formulario corto | Se muestra a la mesa como telón con su sonido [inferido] | **Escena** de la Mesa sin rejilla (la rejilla admite «ninguna»; suelta, ADR-0020) o imagen mostrada; el sonido llega con el módulo 7 |
| **Tokens** | Imagen compuesta de una ficha: retrato (con zoom, giro y fondo), marco (lisos, de textura, de clase o propio), forma (círculo o libre), capas, desborde (lo que se sale del marco, a mano o automático), efecto animado y miniatura 3D en `.glb` [cuenta, guía] | Editor con lienzo (mover, desborde, goma) y vista «En el mapa» a 64 y 32 px [cuenta] | Es la ficha que se mueve en el mapa; independiente del retrato [guía] | **Token** de la Mesa con su **imagen** (archivos). Crisol no tiene creador de tokens |
| **Dados** | «Skin» de dados 3D: por cada tipo (d2 a d100) cuerpo y colores, número y contorno (con aviso de contraste), acabado (metal, madera, cristal, cromo, oro, iridiscente, nácar…), relieve, efecto de tirada (brillo, fuego, arcano) y **pintura a mano de cada cara** sobre la red desplegada, con pinceles, capas y texturas [cuenta] | Estudio de pintura con raíl de herramientas y lienzo; «Probar en 3D» [cuenta] | Los dados del jugador en la mesa; guardarlos es de pago [guía] | **Dados 3D** del módulo 3, pero Crisol solo deja un color por jugador. Sin equivalente para skins |
| **Puzzles** | Cerradura lista para la mesa (teclado de cifras, runas, cuadrícula lógica…) montada con **piezas**, un título, un texto, la respuesta e intentos máximos; «Sortearlo, con respuesta y todo» [cuenta, guía] | Tres modos: fácil (piezas), nodos y código [cuenta] | El máster lo presenta como ventana flotante a los jugadores; la respuesta vive en el servidor y se comprueba allí; el máster ve el progreso y puede darlo por resuelto [guía] | **No hay** |
| **Apps de mesa** | Mini página en HTML, CSS y JS con recursos, acceso de solo lectura a campos numéricos de la ficha, datos de la mesa filtrados por rol, red solo a dominios aprobados y estado compartido o efímero; tope de 72 000 caracteres y 24 recursos [cuenta, guía] | Editor de código con pestañas (HTML, CSS, JS, Recursos, Ficha, Datos y red, Ayuda), consola y plantillas (contador compartido, tabla editable, votación, cuenta atrás, pizarra, cerradura de runas) [cuenta] | Hasta tres a la vez en ventanas flotantes; el máster las presenta y las retira [guía] | **No hay** (el MCP de Crisol cubre parte del «automatizar», pero no hay apps para jugadores) |
| **Macros** | Botón o disparador con una lista de **pasos** (tirar dados, hacer daño, curar, preguntar a alguien, pedir una tirada, decir algo en el chat, mostrar un token, empezar el combate, cambiar la oscuridad de la escena…), cada uno con espera y probabilidad; quién la ve y quién la usa; «Salta sola cuando…» [cuenta] | Cinco vistas del mismo contenido: texto, código, lista, bloques y nodos; plantillas («Ataque con daño», «Trampa», «Emboscada», «Anochece»…); resumen «Haría esto» en lenguaje llano [cuenta] | En la barra de la mesa o de un token [inferido] | **No hay**; lo más cercano son las tiradas guardadas de la ficha y las herramientas MCP |
| **Biblioteca** (no se crea: es el almacén) | Todo lo anterior más escenas, PNJ, fichas, documentos, música, tablas, objetos, experiencias, paquetes de Foundry y assets de mapa, en carpetas [cuenta] | — | Desde aquí se lleva algo a una campaña | Archivos + compendio + wiki del mundo; Crisol no tiene un almacén por usuario fuera del mundo |

### Exportar: lo que sale y en qué forma

| Tipo | ¿Se exporta? | Forma |
|---|---|---|
| Sistema | Sí, «Exportar como paquete (.zip)» [cuenta] | Paquete común (abajo) con un único documento del sistema |
| Módulo | Sí: JSON suelto o paquete .zip; también cada categoría en JSON [cuenta] | Abajo |
| Puzzle y app | Sí, paquete .zip [cuenta] | Abajo |
| Macro | Sí, «Descargar JSON» [cuenta] | Abajo |
| Aventura | **Solo a medias**: desde la biblioteca, «Descargar» → Markdown o «Roliando (JSON)» [cuenta] | El JSON trae solo el índice (títulos de capítulo) y los recuentos (capítulos, mapas, criaturas, escenas, imágenes); el Markdown, el título y el texto de los capítulos, sin sus títulos, criaturas ni escenas [cuenta]. No hay copia completa |
| Token | Solo la imagen final, «Descargar la imagen» [cuenta] | Imagen (formato no dicho) |
| Dados | No se vio exportar; sí importar un tema de Dice So Nice [guía] | — |
| Escena y mapa | Sí: Universal VTT, escena de Foundry o escena de Roliando en JSON [guía] | UVTT solo con rejilla cuadrada; los hexagonales «con geometría equivalente» |
| Campaña entera | Sí, un `.roliando-campana.zip` con ajustes, escenas y mapas, tokens, PNJ, Mundo (wiki), Diario, tablas, macros, música y lo compartido; opcionalmente imágenes (hasta 350 MB) y fichas sin dueño; sin mensajes ni jugadores. Se reimporta como campaña nueva [guía] | No se probó |
| Personaje | No consta exportar a archivo; sí a PDF [guía] | — |

**El paquete común (`.zip`).** Sistemas, módulos, puzzles y apps salen con la misma envoltura, pensada para versionar
en git [cuenta]:

- En la raíz, un **manifiesto** con: identificador de formato y su versión, **tipo** (sistema, módulo de D&D, puzzle,
  app…), un id legible «tipo/nombre-en-slug», nombre, versión semántica (nace en 0.1.0), licencia (texto), autores,
  **compatibilidad** (para un módulo, la edición de D&D), **dependencias**, idiomas, un **recuento de contenido** por
  carpeta y una lista de recursos.
- Un `.gitignore` y un `CHANGELOG.md` de serie.
- El **documento principal** del tipo (el del sistema, el del módulo o el de la app) en JSON. Las partes grandes no van
  dentro: el documento las **referencia** con un marcador de «archivo» (apunta a otro JSON del paquete) o de «carpeta»
  (apunta a una carpeta y lleva el **orden** de sus elementos por slug).
- Un módulo guarda **cada entrada en dos archivos**, `entradas/<categoría>/<slug>.json` con sus datos y `.md` con su
  texto, de modo que el texto se edita y se compara como Markdown.
- Un puzzle trae su app (HTML, CSS, JS y un pequeño manifiesto de qué lee y qué puede hacer) y el puzzle aparte (título,
  texto, respuesta, intentos y la carpeta de piezas, una pieza por JSON).
- El sistema vacío trae un solo JSON con unas cuarenta claves de nivel superior: campos de la ficha, disposición en
  escritorio y móvil, estilo, reglas de tirada, combate, economía, inventario, niveles, progresiones, árboles de
  habilidad, estados, barajas, bestiario, catálogos, tablas de tirada, secciones de reglas, ajustes y lógica de reglas.

**El módulo en JSON suelto** (el formato de importar que ya describía la guía) lleva una cabecera de formato y versión,
la ficha del módulo (nombre, descripción, portada, icono, edición, idioma, nota de licencia, fuente oficial, versión,
registro de cambios, estilo del manual y varios campos internos de la tienda: visibilidad, precio, aprobación, código de
compartir, descargas, bloqueo por plan) y la lista de entradas: edición, categoría y subcategoría, slug, nombre en inglés
y en español, cuerpo en Markdown (y en inglés), orden y un bloque de datos por categoría. En la especie de prueba, ese
bloque traía tamaño, velocidad, una parte «mecánica» y otra para el creador de personajes (rasgos, CA natural,
resistencias, habilidades) y **el nombre del libro de origen** como texto. Al importar se regeneran los slugs y se
reescriben las referencias entre entradas [guía].

**La macro en JSON**: cabecera de formato con versión, y la macro con nombre, icono, color, modo, la lista de pasos (cada
uno con su tipo, su objetivo, su espera en milisegundos, su probabilidad y su nivel de anidado), si es acción de token,
quién la ve y quién la usa, y su disparador [cuenta].

### Importar: qué entra en Roliando

| Origen | Qué entra |
|---|---|
| Foundry VTT | Sistemas y módulos (su zip, con sus compendios), mundos enteros con informe, escenas con rejilla, muros y luces, y solo muros y luces sobre un mapa ya puesto [guía] |
| Universal VTT (`.uvtt`, `.dd2vtt`, `.df2vtt`) | Imagen, rejilla, muros, puertas y luces [guía] |
| Owlbear Rodeo (`.ob2`) | Escenas con tokens y dibujos; lo que no tiene equivalente, con aviso [guía] |
| TaleSpire | Estructura de un slab y su foto cenital [guía] |
| Dungeondraft | Packs de arte como assets de mapa [guía] |
| Roll20 | Hojas de personaje como sistema (modo código) y personajes en JSON [guía] |
| D&D Beyond | Personaje público por enlace, resuelto por nombre contra el compendio [guía] |
| HexSheet | Personajes en JSON [guía] |
| Homebrewery, PDF, Markdown, texto | Libros como módulo, aventura, mundo de la campaña o documento (`sistemas-y-libros.md`) |
| Obsidian, LegendKeeper (y Notion, según la nota anterior) | Wiki de la campaña; Obsidian además se sincroniza [cuenta: menú «Importar desde Obsidian, LegendKeeper…»] |
| Dice So Nice | Temas de dados [guía] |
| CSV o Excel | Tablas de tirada [guía] |
| Roliando | Sus propios JSON y paquetes, escenas y campañas [guía, cuenta] |

## Compromisos y límites

- **Ganan** un formato común de paquete, legible y versionable (manifiesto, cambios, texto en Markdown aparte, piezas
  ordenadas por carpeta), que sirve igual para el Bazar, para compartir y para guardar copia.
- **Pero no es uniforme**: el módulo existe en dos formas (JSON suelto y paquete), la macro tiene su propio JSON, el
  token solo da una imagen y la aventura, la pieza más rica, **no se puede sacar entera** a un archivo (el JSON de la
  biblioteca es solo un índice). Un máster que escriba una aventura en Roliando depende de Roliando para conservarla
  (salvo dentro del zip de la campaña).
- Los JSON llevan **campos internos de su tienda** (precio, aprobación, código de compartir, descargas, bloqueo por plan)
  mezclados con el contenido.
- La procedencia de una entrada de módulo es un **texto libre con el nombre del libro**, no una referencia; tampoco hay
  página.
- Importan de casi todo (mapas, Foundry, Roll20, Owlbear, D&D Beyond), con informe de lo que no entra: es su forma de
  captar usuarios de otras mesas.

## Qué nos llevamos a Crisol

### Equivalencias, en corto

| Roliando | Crisol |
|---|---|
| Sistema | Sistema |
| Módulo | Libro (fuente) de un sistema + contenido del compendio |
| Aventura | Páginas (capítulos) + escenas + criaturas + encuentros, sin paquete que los una |
| Escena de aventura (de inmersión) | Escena suelta sin rejilla (ADR-0020) o imagen mostrada; sonido en el módulo 7 |
| Mapa táctico | Escena de la Mesa |
| Token | Token + imagen (sin creador) |
| Dados (skin) | Dados 3D con un color por jugador (sin skins) |
| Puzzle | — |
| App de mesa | — |
| Macro | — (tiradas de la ficha y herramientas MCP) |
| Tabla de tirada | Tabla aleatoria |
| PNJ, documentos, Mundo | Páginas de la wiki con plantilla |
| Campaña exportada | Campaña (ADR-0019); Crisol solo exporta la wiki en Markdown |

### Para importar lo de Roliando en Crisol

1. **Módulo → libro de un sistema.** Es lo más fácil y lo que más vale: leer el JSON suelto o el paquete (detectar por
   el identificador de formato del manifiesto o de la cabecera), crear un libro del sistema 5e con su nombre, edición,
   licencia y portada, y una entrada de compendio por cada entrada, con el Markdown como texto y el nombre de libro de
   origen como procedencia. Haría falta una **tabla de categorías** (especie, conjuro, criatura, objeto, dote, trasfondo,
   clase, subclase, idioma, regla, tabla) a los tipos de contenido del sistema de Crisol, y traducir el bloque de datos
   de cada categoría al documento de Crisol (es lo laborioso: su forma es propia y cambia por categoría). Las
   referencias entre entradas (un conjuro que apunta a sus clases, una subclase a su clase) van por slug: resolverlas
   primero dentro del paquete y luego por nombre contra el compendio, con lo que no case en una lista aparte.
2. **Escenas y mapas → Mesa.** Sin trabajo nuevo: Roliando exporta UVTT y escena de Foundry, y Crisol ya importa los
   dos (módulo 6). Su JSON de escena propio no hace falta.
3. **Campaña → mundo o campaña.** El `.roliando-campana.zip` sería la vía para traer una aventura entera (y la wiki,
   tablas y PNJ). No se probó: haría falta exportar una campaña de prueba para ver su forma antes de comprometerse.
4. **Aventura suelta.** Hoy no se puede: su exportación no trae el contenido. Como mucho, el Markdown de los capítulos
   a páginas de la wiki.
5. **Sistema propio → sistema de Crisol.** Posible pero caro: su documento de sistema tiene unas cuarenta partes con
   fórmulas propias. Mejor que lo traduzca la IA por MCP, parte a parte, con informe de lo que no entra.
6. **Macros, puzzles, apps y skins de dados**: no tienen dónde caer en Crisol. Las tablas (CSV) sí.

### Para que Roliando lea lo de Crisol

Roliando importa módulos en su JSON, escenas UVTT y de Foundry, personajes de Roll20 o D&D Beyond y wikis de Obsidian.
Crisol ya podría darle el **Markdown de la wiki** (para su importador de Obsidian o de libros) y **escenas en UVTT** si
algún día las exporta. Un exportador de libro a su formato de módulo es factible pero no tiene sentido mientras Crisol
sea de uso privado (ADR-0014).

### Ideas para Crisol

1. **Un paquete propio de Crisol** para sistemas y libros (y, cuando existan, aventuras), con su misma idea: manifiesto
   con tipo, versión, licencia, autores, compatibilidad y dependencias; texto de cada entrada en Markdown aparte; orden
   explícito; cambios en un archivo. Sirve de copia de seguridad, de intercambio entre mundos y de formato para la IA.
   **Sin campos internos de servicio** dentro.
2. **La aventura como pieza de primera clase**, que Crisol no tiene: capítulos (páginas), escenas, criaturas, encuentros
   y su «equipaje» (música, imágenes, fichas prehechas) bajo un mismo nombre, que se «pone en la mesa» de una campaña y
   **se exporta entera** (lo que Roliando no hace).
3. **Distinguir escenas tácticas y de inmersión** (telón con música y ambiente). En Crisol encaja con las escenas
   sueltas de ADR-0020 y con el sonido del módulo 7.
4. **Partes con «N partes más»** y vista previa en vivo en los editores largos; «Basar en…» en todos.
5. **Macros con resumen en lenguaje llano** («Haría esto: …») y la misma macro vista como lista, bloques o código: buena
   idea si algún día Crisol tiene macros (hoy la automatización va por la IA y el MCP).
6. **Puzzles y apps para los jugadores** con la respuesta comprobada en el servidor: atractivo, pero fuera del alcance
   actual; anotarlo para el módulo 10 («otras herramientas»).
7. **Informe al importar** y referencias resueltas primero dentro del paquete y luego por nombre (ya estaba en
   `otras-ideas.md`).

### Qué se creó en la cuenta de prueba (esta fase)

- La aventura **«Aventura de prueba Crisol»** (privada, sin publicar) con un capítulo («La cripta de ensayo»), una
  criatura («Guardián de prueba») y una escena («Entrada de la cripta»). Se creó al pulsar «Crear» en su tarjeta.
- Una macro **«Anochece»** (desde su plantilla), creada al elegir la plantilla; no se le dio botón ni se llevó a ninguna
  campaña.
- Se exportaron (descarga del navegador, fuera del repo): el módulo «Libro de prueba Crisol» (JSON y zip), el sistema
  vacío «Sin nombre» (zip), el puzzle «El cerrojo del almacén» (zip; ya estaba en la cuenta), la aventura (JSON y
  Markdown) y la macro (JSON).
- No se publicó, compartió ni compró nada. Se cerró la sesión al terminar.
