# Spec: Módulo 1 — Wiki

Estado: aprobada por Enrique («vamos», 2026-10-29), con las cuatro propuestas de «Preguntas abiertas» ·
Fecha: 2026-10-29

Fuentes:
- Decisiones de partida: `docs/modulos.md` § «1. Wiki».
- Arquitectura: `docs/adr/0003-paginas-yjs-y-secretos.md`.
- REA: `research/homebrewery/hojas-y-pdf.md`, `research/foundry/journal.md` y `research/dndbeyond/contenido-y-enlaces.md`.
- Inventario: `docs/inventario.md` § 2.

## Objetivo

La wiki completa del Crisol nuevo: páginas con subpáginas, editor de bloques, enlaces, búsqueda, versiones, archivos,
hojas con estilo y exportación. Claude tiene que poder hacer todo esto por el MCP, porque **Eana se pasará así** (no
hay importador).

No se usa de verdad hasta que la app esté terminada. Mientras, Eana sigue en el Crisol actual y no se pasa nada.

Usuario del módulo: Enrique, como máster. Hasta el módulo 5, la wiki es **solo del máster**: los jugadores no la ven.

Tamaño de referencia: Eana tiene 2.384 páginas, contadas el 2026-10-29 sin abrirlas.
- La página mediana pesa 1,3 KB; el 95 % pesa menos de 27 KB; la mayor, 518 KB.
- 59 páginas tienen secretos, 2.165 tienen etiquetas, 637 tienen alias y 37 tienen incrustados.
- Hay 99 archivos (710 MB), casi todos PDF; el mayor ocupa 204 MB.

### Historias

1. Como máster, creo páginas y subpáginas en el árbol de un mundo, las recoloco arrastrando o con el teclado y las abro
   en pestañas.
2. Escribo con el editor de bloques y su menú «/». Los secretos y las notas ocultas se ven marcados.
3. Enlazo páginas con `[[`. Veo su vista previa al pasar el ratón o con el foco, y veo qué páginas enlazan a la mía y
   dónde se la menciona sin enlace.
4. Busco en todo el mundo, en español y aunque me equivoque al escribir. Salto a cualquier página con Ctrl+K.
5. Pongo a cada página propiedades, etiquetas, alias, icono y portada, y guardo marcadores.
6. Veo las versiones de una página y restauro una. Desde el historial deshago lo que hice yo o lo que hizo Claude.
7. Subo archivos, los uso en las páginas y abro los PDF en el visor.
8. Activo la hoja en una página: dos columnas, statblocks y notas laterales. Quien lee puede volver a la vista
   sencilla. La imprimo o la guardo en PDF.
9. Exporto a Markdown una página, una rama o el mundo entero.
10. Desde claude.ai, Claude busca, lee, crea y edita páginas con subpáginas, propiedades, enlaces y secretos, muchas de
    una vez. Si tengo la página abierta, veo sus cambios al momento.

## Mapa de capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `paginas` | La fila de la página, el árbol, propiedades, etiquetas y alias, pestañas, marcadores y papelera | — |
| `editor` | El cuerpo en Yjs con Hocuspocus, los bloques, los secretos y las notas ocultas en documentos aparte | `paginas` |
| `markdown` | El dialecto, de ida y vuelta, y la exportación | `editor` |
| `enlaces` | Enlaces por id, sin resolver y rotos; entrantes, menciones, vista previa e incrustados | `editor` |
| `versiones` | Sesiones de edición, versiones, restaurar y deshacer del cuerpo | `editor` |
| `archivos` | Recursos del mundo: subir, servir con permiso, usar en páginas y visor de PDF | `paginas` |
| `busqueda` | Búsqueda en español, selector rápido, paleta de órdenes y buscar en la página | `editor`, `enlaces` |
| `hojas` | La vista de hoja: bloques de hoja, paginación, temas, imprimir y PDF | `editor`, `archivos` |
| `ia` | Las herramientas MCP de la wiki | todas las anteriores |

Orden: `paginas` → `editor` → `markdown` → `enlaces` → `versiones` → `archivos` → `busqueda` → `hojas`.

Cada capacidad lleva su API y su interfaz. Sus herramientas MCP llegan con ella, no al final: `ia` solo junta las que
quedan y la prueba de pasar muchas páginas.

**Primero, lo más arriesgado** (ADR-0003): el editor anidado de los secretos. Abre `editor` con un prototipo: una
página con dos secretos mientras Claude escribe en ella.

## Requisitos

### `paginas`

- **La página es una fila** (`pages`) que pasa por `operation()`. Guarda:
  - el mundo;
  - el padre y el orden;
  - el título (de 1 a 200 caracteres);
  - el icono (un emoji);
  - la portada (un archivo del mundo);
  - las propiedades;
  - el candado;
  - la hoja y sus ajustes;
  - la papelera.

  Su historial y su deshacer son los del módulo 0.
- **Árbol**:
  - subpáginas sin límite práctico (tope técnico: 32 niveles) y orden manual;
  - recolocar arrastrando y también con el teclado: subir, bajar, meter dentro y sacar;
  - una página nunca puede quedar dentro de sí misma.

  El árbol carga por ramas y se pinta virtualizado, porque Eana tiene 2.400 páginas. Sigue el patrón ARIA de árbol.
- **Los títulos se pueden repetir**: los enlaces van por id. Cuando dos coinciden, el selector y las sugerencias
  enseñan la ruta.
- **Propiedades**: pares de nombre y valor, en el orden que elija el máster.
  - Tipos: texto, número, sí/no, lista de textos y enlace a una o varias páginas.
  - Tres propiedades reservadas:
    - `alias`: otros nombres para enlazar, buscar y encontrar menciones;
    - `etiquetas`: una lista, con jerarquía por «/»;
    - `resumen`: el texto de la vista previa.
- **Etiquetas**: un panel con todas las del mundo y cuántas páginas tiene cada una. Pulsar una abre la búsqueda filtrada.
- **Portada**: una imagen de cabecera, con un punto de encuadre.
- **Título en línea** sobre el cuerpo. El **candado** pone la página en lectura, pero no es un permiso.
- **Navegación**: migas de pan, anterior y siguiente entre páginas hermanas, el índice del documento al lado (en el
  móvil, un desplegable «Ir a…») y volver arriba.
- **Pestañas**:
  - varias páginas abiertas, que se pueden fijar;
  - se recuerdan por cuenta y mundo;
  - en el móvil se sustituyen por la lista de recientes.
- **Marcadores**: con grupos y por cuenta y mundo. Igual que las pestañas, son preferencias de cada cuenta: no van al
  historial.
- **Papelera**:
  - borrar manda la página a la papelera con sus subpáginas, en una sola operación;
  - antes avisa si la enlazan otras páginas («La enlazan 3 páginas»);
  - se restaura desde la papelera del mundo, y la purga de 30 días es la del módulo 0.
- **Permisos**: en el módulo 1, leen y escriben la wiki de un mundo su máster y el propietario de la organización. Un
  jugador no recibe nada de ella por ninguna vía.

### `editor`

- TipTap 3 + Yjs, sincronizado con Hocuspocus 4 en `/api/collab`, como dice el ADR-0003: la conexión, los permisos por
  documento y el guardado por fusión.
- **Bloques del menú «/»**:
  - texto y títulos de nivel 1 a 3 dentro del cuerpo (el título de la página va aparte);
  - listas con viñetas o numeradas, y casillas;
  - cita, código y separador;
  - tabla, con fila de cabecera y añadir o quitar filas y columnas;
  - callout, de los tipos nota, consejo, aviso, peligro y leer en voz alta;
  - caja;
  - secreto y nota oculta;
  - enlace a una página o a una página nueva;
  - imagen con pie;
  - archivo o PDF incrustado;
  - incrustar una página o una sección.

  Además, los bloques de hoja (ver `hojas`).
- **Marcas**: negrita, cursiva, subrayado, tachado, código, enlace externo (solo `http`, `https` y `mailto`) y enlace a
  una página.
- **Atajos de Markdown al escribir**: `## `, `- `, `1. `, `[ ] `, `> `, ` ``` `, `---` y `[[`.
- Una barra flotante al seleccionar. Si el texto seleccionado coincide con un título o un alias, propone enlazarlo.
- Un asa para arrastrar bloques, y su menú: convertir en otro bloque, duplicar o borrar.
- **Ids de bloque estables**, para los enlaces a bloques, el MCP y la exportación.
- **Secretos y notas ocultas**:
  - cada uno es un documento de Yjs aparte, pintado con un editor anidado;
  - se ven marcados («Secreto», «Nota oculta»);
  - un bloque normal se puede convertir en secreto, y al revés;
  - copiar un secreto a otra página crea otro documento.
- **Ctrl+Z** es el de Yjs, con los cambios propios y por documento.
- **Si se corta la conexión**, se sigue escribiendo y todo se sincroniza al volver. Se avisa con «Sin conexión: se
  guardará al volver». No se trabaja sin conexión después de recargar.
- Los cursores de otra cuenta llevan su nombre. Lo que escribe Claude aparece al momento y se resalta un instante.
- **Pegar**: el HTML pegado pasa por el esquema, que solo deja entrar lo que conoce. Las imágenes pegadas se suben como
  archivos.
- **Límites**: el estado de un cuerpo, hasta 4 MB; un mensaje, hasta 1 MB. Al pasarse se avisa y no se guarda el
  cambio. La página mayor de Eana (518 KB) cabe de sobra.

### `markdown`

- Un solo dialecto, el de Obsidian (ADR-0003): sirve para exportar, para que Claude lea y para que Claude escriba. Cada
  nodo tiene su forma:

| Contenido | Markdown |
|---|---|
| Propiedades | YAML al principio (`alias`, `etiquetas`, `resumen` y las demás) |
| Enlace a página, sección o bloque | `[[Título]]`, `[[Título#Sección]]`, `[[Título#^id]]`, `[[Título\|texto]]` |
| Incrustado | `![[Título]]`, `![[Título#Sección]]` |
| Imagen o archivo | `![[archivo.png]]`, `![[archivo.png\|300]]` (ancho), `![[libro.pdf#page=12]]` |
| Callout | `> [!nota]`, `> [!consejo]`, `> [!aviso]`, `> [!peligro]`, `> [!leer]` |
| Caja | `> [!caja]` |
| Secreto | `> [!secreto]` con su `^s-id` |
| Nota oculta | `%%` en líneas propias, antes y después |
| Id de bloque | `^id` al final del bloque |
| Bloques de hoja | Ver `hojas` |

- **Exportar**:
  - una página, una página con sus subpáginas, o el mundo entero en un .zip;
  - una página con subpáginas es una carpeta con su nota dentro (`Página/Página.md`), como el Crisol actual;
  - los archivos van en `_archivos/`;
  - los enlaces salen con el título que tengan entonces, con la ruta si dos páginas se llaman igual;
  - exportar pasa por la proyección: el máster exporta con sus secretos.
- **Ida y vuelta**: una prueba recorre cada nodo y marca del esquema y comprueba que leer lo exportado da lo mismo. Un
  nodo sin su forma en Markdown hace fallar la prueba.
- El esquema y su Markdown viven en un paquete que comparten la web y el servidor (`packages/editor`, sin React).

### `enlaces`

- **`[[` sugiere páginas** por título y alias, con tolerancia a erratas, y la ruta si hay títulos repetidos. Al final
  ofrece «Crear página «X»».
- **Un enlace va a una página, a una sección o a un bloque, por id.** Puede llevar texto propio; si no, enseña el
  título que tenga la página en cada momento.
- **Enlaces sin resolver**: un `[[Título]]` que todavía no existe se guarda por título y se ve como «por crear».
  Cuando aparece en el mundo una página con ese título o alias, se resuelve solo. Es lo que necesita pasar Eana en
  cualquier orden.
- **Enlaces rotos**: si el destino está en la papelera, el enlace se ve roto y ofrece restaurarlo.
- **La tabla de enlaces** se rehace en el servidor con cada guardado y guarda de qué documento sale cada enlace
  (ADR-0003). De ella salen:
  - **Entrantes**: un panel con las páginas que enlazan a esta, con el fragmento donde lo hacen.
  - **Menciones sin enlazar**: dónde aparece el título o un alias sin enlace, con «Enlazar» de un clic.
  - La lista de enlaces sin resolver del mundo.
- **Vista previa**:
  - se abre tras unos 300 ms con el ratón encima, o con el foco del teclado;
  - va anclada al enlace y se puede entrar en ella: sus enlaces y su botón «Abrir» funcionan;
  - se cierra con Escape;
  - en el móvil, un toque la abre en una hoja inferior con «Abrir página».

  Enseña el título, la ruta, la portada pequeña y el resumen o el primer párrafo. Si el enlace va a una sección,
  enseña esa sección. Sale de la API, que proyecta, y se guarda en caché durante la sesión hasta que el canal avise
  de un cambio.
- **Incrustados**: una página, una sección o un bloque, en solo lectura y con enlace a su origen. Llegan hasta 3 niveles
  y los ciclos se cortan con un aviso. Se leen por la API, nunca abriendo el documento de Yjs del otro.

### `versiones`

- **Sesiones de edición y versiones**, como dice el ADR-0003. Cada sesión cerrada es una operación del historial
  (`editPage`) y una versión de la página. Cada cambio de Claude, también.
- **Panel de versiones de la página**:
  - la lista, con quién (una persona o Claude) y cuándo;
  - ver una versión en solo lectura, con sus secretos;
  - «Restaurar», que es una operación nueva y también se puede deshacer.
- El **historial** del módulo 0 enseña las operaciones de la wiki con su frase (i18n), y deshacer funciona con sus
  conflictos: si alguien escribió después, lo dice y no toca nada.
- **Cuánto se guarda**: las versiones de los últimos 90 días y, además, siempre las 40 últimas de cada página.

### `archivos`

- **Recursos del mundo**:
  - subirlos con un botón, arrastrando archivos o una carpeta entera, o pegándolos en el editor;
  - se ordenan solos en carpetas por tipo (imágenes, PDF, otros);
  - renombrarlos y reemplazarlos, y mandarlos a la papelera, con aviso si alguna página los usa.

  Subir y borrar son operaciones; los bytes no van al historial.
- **Tipos**: imágenes (PNG, JPEG, WebP, GIF, AVIF y SVG), PDF y, guardados sin vista previa, cualquier otro. Los SVG se
  sirven como imagen, con una CSP que no deja ejecutar nada.
- **Hasta 250 MB por archivo**: el mayor de Eana pesa 204 MB. La subida va por partes con su progreso, y el
  almacenamiento es la interfaz del ADR-0001 (disco en el VPS).
- **Con permiso**: cada archivo se sirve por la API con la sesión y la política, nunca desde una carpeta pública, y con
  caché privada.
- **Visor de PDF** con pdf.js (Apache-2.0):
  - se carga cuando hace falta y antes enseña el tamaño;
  - permite ir a una página;
  - acepta enlaces a una página concreta (`#page=12`).
- Las imágenes llevan su ancho, su pie y su texto alternativo, y se abren en una caja de luz.

### `busqueda`

- **Una sola búsqueda** de títulos, alias, propiedades y texto. Va en Postgres, con la configuración española,
  `unaccent` y `pg_trgm` para las erratas.
  - Agrupa por página, con las secciones que coinciden y un extracto resaltado.
  - Se puede filtrar por etiqueta y por rama del árbol.
  - Los resultados van paginados.
  - Lo que coincide dentro de un secreto sale marcado como secreto.

  Indexa por documento (ADR-0003).
- **Selector rápido** con Ctrl+K: busca títulos y alias con sugerencias a los 250 ms, de 5 a 8 resultados, primero los
  recientes, y «Ver todos». Si se escribe «>» al principio, pasa a ser la **paleta de órdenes**.
- **Buscar en la página abierta**, resaltando lo encontrado en el texto.
- **Rendimiento**: en el servidor, el 95 % de las búsquedas tarda menos de 300 ms en un mundo de 5.000 páginas.

### `hojas`

- **Por página, el máster activa «Ver como hoja»** y elige sus ajustes:
  - el papel: A4 por defecto, o Letter;
  - el tema: Pergamino o Neutro;
  - numerar las páginas, y desde qué número;
  - el pie con el título.
- **Quien lee puede volver a la vista sencilla.** Se recuerda por cuenta y página. En pantallas estrechas se abre la
  sencilla, con un botón para ver la hoja.
- **Bloques de hoja** (de `research/homebrewery/hojas-y-pdf.md`). En la vista sencilla se ven discretos o como un
  callout:

| Bloque | Vista sencilla | Vista hoja | Markdown |
|---|---|---|---|
| Salto de página | Una raya con su rótulo, solo al editar | Empieza página | `<div class="salto-pagina"></div>` |
| Salto de columna | Igual | Empieza columna | `<div class="salto-columna"></div>` |
| Statblock: un marco con contenido libre (los datos llegan en el módulo 4) | Caja con marco | Marco del tema, sin partirse | `> [!statblock]` |
| Nota lateral, a la izquierda o a la derecha | Callout | Recuadro estrecho en la columna, con el texto alrededor | `> [!lateral]`, `> [!lateral\|izquierda]` |
| A lo ancho: atributo del statblock, la tabla, la imagen, el callout o la caja | Sin efecto | Ocupa las dos columnas | `\|ancho` en el callout; `> [!ancho]` para varios bloques |
| Índice de contenidos | Lista de enlaces a los títulos | Con el número de página y puntos guía | `> [!indice]` (al leerlo, se vuelve a generar) |

- **Paginación automática por bloques**:
  - los saltos de página y de columna son opcionales y fuerzan el salto;
  - statblocks, tablas, callouts e imágenes no se parten; un título nunca se queda solo al pie;
  - guionado en español;
  - si un bloque no cabe ni en una página vacía, la hoja lo avisa en esa página en vez de cortarlo.
- **Editar**: en la vista sencilla. En escritorio ancho, con la hoja al lado y sincronizadas por bloque: pulsar en la
  hoja lleva al bloque, y el cursor lleva la hoja al bloque.
- **Imprimir y PDF**:
  - «Imprimir» saca la hoja con su CSS de impresión, por el diálogo del navegador, que también guarda en PDF. Chrome y
    Edge son la referencia; en Firefox y Safari tiene que quedar legible.
  - En el papel no sale nada de la interfaz.
  - Los secretos no salen por defecto, salvo que se marque la casilla «Incluir secretos». Las notas ocultas no salen
    nunca.
- **Temas propios**: un CSS base de hoja (caja de página, columnas, impresión y contadores), y cada tema son variables
  CSS `--sheet-…`.
  - Fuentes OFL de `@fontsource` y textura propia, que se eligen en el paso de diseño.
  - Nada de las fuentes ni de las imágenes de Homebrewery.
  - Si se aprovecha su CSS (MIT), va con su atribución (`research/README.md`).

### `ia`

Herramientas MCP nuevas. Siguen los modos y la cola de aprobación del módulo 0; en la columna «Tipo», `read`, `write` y
`delete` son los de `ActionKind`.

| Herramienta | Tipo | Qué hace |
|---|---|---|
| `buscar_paginas` | `read` | Búsqueda con filtros por etiqueta y rama; devuelve páginas, secciones y extractos |
| `ver_arbol` | `read` | El árbol de un mundo o de una rama, hasta los niveles que se pidan |
| `leer_pagina` | `read` | Propiedades y cuerpo en Markdown, con los ids de bloque si se piden |
| `crear_paginas` | `write` | Hasta 50 páginas en una llamada, anidables entre sí, con propiedades y cuerpo en Markdown. Es una sola operación |
| `editar_pagina` | `write` | Añadir al final, cambiar un bloque o una sección (por id o por título), cambiar el cuerpo entero, el título, el icono o las propiedades |
| `mover_pagina` | `write` | Cambiar el padre y la posición |
| `borrar_pagina` | `delete` | A la papelera, con sus subpáginas |
| `enlaces_pagina` | `read` | Entrantes, salientes, menciones; y los enlaces sin resolver del mundo |
| `versiones_pagina` | `read` | La lista de versiones de una página |
| `restaurar_version` | `write` | Restaurar una versión |
| `listar_archivos` | `read` | Los archivos del mundo, por nombre y tipo, para enlazarlos con `![[…]]` |

- Lo que Claude escribe en Markdown pasa por el mismo esquema que el editor:
  - un `> [!secreto]` crea su documento aparte;
  - cada `[[Título]]` se resuelve a su id; si no existe, queda sin resolver; si hay dudas, Claude recibe las páginas
    candidatas.
- **Si la página está abierta**, el cambio de Claude entra en vivo (ADR-0003).
- **Ritmo**: `crear_paginas` con 50 páginas medianas tarda menos de 3 s en el servidor. Eana entera cabe en unas 50
  llamadas.
- **Archivos**: Claude no los sube, porque los binarios no caben por el chat. Enrique sube las carpetas desde la
  interfaz y Claude los enlaza por su nombre.

### Interfaz

- La wiki del mundo tiene:
  - el árbol a la izquierda, plegable y en un cajón en el móvil;
  - la página en el centro, con sus pestañas encima;
  - a la derecha, el índice del documento, los entrantes y las versiones.
- Más pantallas:
  - búsqueda;
  - etiquetas;
  - archivos;
  - la papelera del mundo, que ya existe, con las páginas y los archivos.
- Los prototipos se hacen y se aprueban en el paso de diseño, con la identidad «Hoja». El pulido queda para el final.
- Todo usable en el móvil y con el teclado; WCAG 2.1 AA.

## Pila

La del ADR-0001 y el ADR-0003. Dependencias nuevas, todas con licencia admitida y comprobada al añadirlas:
- `@hocuspocus/server` y `@hocuspocus/provider` 4.8 y `yjs` 13.6 (MIT);
- de TipTap 3.32 (MIT): `@tiptap/core`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`,
  `@tiptap/extension-unique-id`, `@tiptap/markdown` (con marked, MIT) y las extensiones de tabla, índice y asa que hagan
  falta;
- `pdfjs-dist` (Apache-2.0);
- las fuentes de los temas de hoja, de `@fontsource` (OFL-1.1).

## Comandos

Los del módulo 0 (`docs/specs/fundacion.md` § Comandos). No hay comandos nuevos.

## Estructura

```
packages/editor     Esquema del editor (extensiones de TipTap sin React) y su Markdown; lo usan la web y el servidor
apps/server/src/collab  Hocuspocus en /api/collab: permisos por documento, guardar fusionando, sesiones de edición
apps/web/src/wiki   Árbol, página, editor (vistas de React de los nodos), vista previa, hoja, búsqueda, archivos
```

Lo demás, como en el módulo 0: contratos en `packages/contracts`, reglas en `packages/domain` y tablas y repositorios
en `packages/db`.

## Estilo

El del módulo 0 (`docs/specs/fundacion.md` § Estilo). Cada nodo del esquema declara su forma en Markdown junto a su
definición, para que la prueba de ida y vuelta lo encuentre.

## Pruebas

- **Dominio** (sin base de datos):
  - el árbol: mover sin ciclos y el orden;
  - la resolución de enlaces, con títulos repetidos, alias y sin resolver;
  - la paginación de la hoja con bloques de tamaño simulado;
  - la sesión de edición: cuándo se abre y cuándo se cierra.
- **`packages/editor`**: la ida y vuelta del Markdown para cada nodo y marca, y que el Markdown de Claude con
  `> [!secreto]` deje el texto fuera del cuerpo.
- **Integración**, contra Postgres:
  - guardar fusionando, en cualquier orden;
  - deshacer una sesión, con y sin cambios posteriores;
  - restaurar con un editor abierto, sin que vuelva lo viejo;
  - la cascada al purgar;
  - la búsqueda en español: acentos, erratas y el rendimiento con 5.000 páginas;
  - la tabla de enlaces y los entrantes.
- **Colaboración**: dos clientes de Hocuspocus y una conexión directa (Claude) a la vez. Convergen, y el historial apunta
  bien a cada uno.
- **MCP**: cada herramienta en cada modo; `crear_paginas` con 50 páginas enlazadas entre sí en cualquier orden; Claude
  escribiendo en una página abierta.
- **Fugas**, ampliando `@fugas`. Un jugador no recibe nada de la wiki por ninguna vía: API, `/api/realtime`,
  `/api/collab` (no abre ningún documento), MCP, archivos, búsqueda y vista previa. Además, una prueba confirma que el
  estado guardado de un cuerpo nunca lleva el texto de sus secretos.
- **E2E** (Playwright + axe):
  - crear, editar y recolocar páginas;
  - enlazar y la vista previa con el teclado;
  - secretos;
  - versiones y deshacer;
  - subir un archivo;
  - la hoja e imprimir (`page.pdf()` de la ruta de impresión: sin interfaz y sin bloques partidos);
  - exportar.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas, con TDD en cada porción.

## Límites

- **Siempre**:
  - pasar por la capa de políticas y por `operation()`;
  - nunca volver atrás sobrescribiendo el estado de Yjs;
  - textos por i18n;
  - pruebas antes de cada commit;
  - la CI en verde antes del merge.
- **Preguntar antes**:
  - dependencias que no estén en «Pila»;
  - Chromium en el servidor para «Descargar PDF»;
  - cambiar `CONSTRAINTS.md`;
  - cualquier puerto, servicio o cambio en Caddy.
- **Nunca**:
  - el texto de un secreto dentro del documento de su página;
  - archivos servidos sin permiso;
  - HTML o CSS del autor;
  - fuentes o imágenes de Homebrewery;
  - nada de `research/` en el código;
  - tocar el Crisol actual.

## Criterios de éxito

1. **En staging**, Enrique crea páginas de prueba con subpáginas, todos los bloques, propiedades, etiquetas, enlaces,
   secretos y archivos, y las ve en las dos vistas.
2. **Saca el PDF de una hoja** de dos columnas con un statblock, una nota lateral y una tabla. Ningún bloque sale
   partido y en el papel no hay nada de la interfaz.
3. **Desde claude.ai**, Claude crea un árbol de 20 páginas en pocas llamadas, con propiedades, secretos y enlaces entre
   ellas. Los enlaces a páginas que aún no existían se resuelven solos. Después cambia una sección de una página que
   Enrique tiene abierta, y Enrique lo ve aparecer sin recargar.
4. **Enrique deshace desde el historial lo que hizo Claude.** Si él escribió después, el deshacer se niega y dice por
   qué. Restaura una versión anterior de una página.
5. **Un jugador no recibe nada de la wiki**: la prueba de fugas ampliada pasa. El cuerpo guardado de una página nunca
   lleva el texto de sus secretos.
6. **Ida y vuelta**: un mundo de prueba exportado a .zip se vuelve a leer página a página y sale igual.
7. **Búsqueda**: «dragon» y «dargón» encuentran «Dragón». El 95 % de las búsquedas tarda menos de 300 ms con 5.000
   páginas.
8. **Calidad**:
   - la CI está en verde, sin supresiones nuevas;
   - axe no da fallos críticos ni graves en las pantallas de la wiki;
   - el árbol, la vista previa y el editor se usan con el teclado;
   - una página mediana se abre lista para escribir en menos de 1 s en staging.

## Fuera del módulo 1

- El importador: Eana se pasa con Claude cuando la app esté terminada.
- Editar el Markdown a mano.
- Los bloques de mapa, línea temporal y tirada (módulos 9, 8 y 3).
- Tipos de página, plantillas, formularios y consultas tipo Dataview o Bases (módulo 2).
- Statblocks con datos de criatura (módulo 4).
- Que los jugadores lean la wiki y revelar secretos (módulo 5).
- Fechas del calendario del mundo en las propiedades (módulo 8).
- Comparar versiones, comentarios y CSS propio del autor.
- Portadas de hoja, índice alfabético e imprimir una página con sus subpáginas.
- Trabajar sin conexión después de recargar.
- Varios procesos del servidor.
- El pulido de la interfaz, que va al final.

## Preguntas abiertas

Decididas: Enrique aprobó las cuatro propuestas (2026-10-29).

1. ~~**Los archivos de Eana**~~: los sube Enrique desde la interfaz, arrastrando las carpetas, y Claude solo los enlaza por
   su nombre. Claude no puede pasar 710 MB por el chat. **Decidido: así, con un límite de 250 MB por archivo.**
2. ~~**El PDF**~~: en el módulo 1 basta «Imprimir → Guardar como PDF» del navegador. «Descargar PDF» generado en el
   servidor necesita Chromium en el contenedor de staging, y eso pide permiso. **Decidido: imprimir ahora y dejar
   preparada la ruta de impresión para el servidor.**
3. ~~**La paginación de la hoja**~~: automática, con saltos opcionales, o solo a mano como Homebrewery. **Decidido:
   automática.** Con saltos solo a mano, una página que se pasa a hoja sería una sola página desbordada.
4. ~~**Los tipos de propiedad**~~: texto, número, sí/no, lista y enlace a página. **Decidido: estos.** Las fechas del
   mundo llegan con el calendario (módulo 8); hasta entonces, como texto.
