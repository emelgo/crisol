# ADR-0003: Páginas de la wiki con Yjs; secretos en documentos aparte

Estado: aceptada · Fecha: 2026-10-29 · Módulo: 1 (wiki)

## Contexto

El ADR-0001 eligió TipTap 3 + Yjs para el editor y Hocuspocus para sincronizarlo. Antes de la spec de la wiki
(`docs/modulos.md` § 1) hay cinco cosas que condicionan todo lo demás:

- **Secretos.** Yjs sincroniza un documento entero: no puede mandar a cada cuenta solo lo que le toca. En el módulo 1
  la wiki es solo del máster, pero en el 5 los jugadores leerán páginas con secretos revelados a unos sí y a otros no.
  Foundry lo manda todo y oculta en la interfaz (`research/foundry/sincronizacion-e-historial.md`): es justo lo que no
  queremos.
- **Historial y deshacer.** El módulo 0 apunta cada operación con las filas antes y después, y deshace aplicando lo
  inverso (`packages/db/src/operation.ts`, `packages/domain/src/undo.ts`). Un documento de Yjs cambia con cada tecla:
  no cabe una operación por pulsación.
- **Versiones de página** con restaurar. El Crisol actual guarda las 40 últimas, como mucho una cada pocos minutos.
- **Claude por el MCP** tiene que escribir en una página aunque Enrique la tenga abierta. Además, Eana se pasará así,
  porque no hay importador: muchas páginas, con subpáginas, propiedades, enlaces, secretos y archivos.
- **Exportar a Markdown.**

## Decisión

### Qué va en Postgres y qué en Yjs

- La página es una fila (`pages`) que pasa por `operation()` como todo lo demás. Guarda:
  - el título;
  - el padre y el orden en el árbol;
  - el icono y la portada;
  - las propiedades;
  - el candado;
  - si se ve como hoja;
  - si está en la papelera.

  Su historial y su deshacer son los del módulo 0.
- Solo el **cuerpo**, lo que se escribe en el editor, es Yjs. Cada documento de Yjs tiene una fila en `documents`, con
  su página, su tipo y el estado de Yjs.
- Las propiedades no van en Yjs: se editan en un formulario, tienen historial gratis y el módulo 5 podrá ocultar una
  sola. El candado solo pone el editor en lectura; no es un permiso.

### Los secretos, en documentos aparte

- Cada **secreto** y cada **nota oculta** es un bloque con su propio documento de Yjs (tipo `secret` o `note` en
  `documents`). El cuerpo solo lleva un nodo con su id, sin el texto.
- El editor pinta ese nodo con un editor anidado, conectado al documento del secreto.
- El permiso se decide por documento: abrir el cuerpo no da el secreto. En el módulo 1, todos los documentos de un
  mundo son de su máster. El 5 añadirá quién ve cada secreto sin cambiar cómo se guarda.
- Lo que no pasa por Yjs también se guarda por documento: búsqueda, enlaces entrantes, versiones y exportación. Así el
  módulo 5 los filtrará con la misma proyección.
- Los incrustados y la vista previa al pasar el ratón leen la otra página por la API, que proyecta. Nunca abren su
  documento de Yjs.
- Una prueba lo garantiza: el estado guardado de un cuerpo nunca lleva el texto de sus secretos.

### Sincronización

- Hocuspocus 4 (MIT) corre dentro del servidor, en `/api/collab`, con el WebSocket de Fastify. Una conexión por pestaña
  lleva todos los documentos abiertos, el cuerpo y sus secretos: Hocuspocus los multiplexa.
- Al abrir cada documento se comprueban el origen, la sesión de Better Auth (por la cookie) y la capa de políticas.
  - Sin permiso de escritura, el documento se abre en solo lectura y Hocuspocus rechaza sus cambios.
  - Si la página está en la papelera, no se abre.
- Si cambian los permisos (expulsar, salir, papelera), el servidor cierra esas conexiones. Al reconectar se vuelve a
  decidir.
- Hay límites por mensaje y por documento, para que una pestaña no pueda llenar la base de datos.
- La presencia (los cursores) va por documento, así que solo la ve quien puede abrirlo. El nombre del cursor sale de la
  cuenta de la conexión, no de lo que diga el cliente.
- El árbol, los títulos y las propiedades siguen avisando por `/api/realtime`, como en el módulo 0.

### Guardar

- Hocuspocus guarda unos segundos después del último cambio, con un máximo.
- **Guardar es fusionar** (`Y.mergeUpdates`) con lo que ya hay en la base de datos, nunca pisarlo. Así ningún orden de
  escrituras pierde un cambio.
- **Nunca se vuelve atrás sobrescribiendo el estado.** Un editor abierto con el estado nuevo lo volvería a subir al
  reconectar. Restaurar una versión, deshacer y lo que escriba Claude son cambios de Yjs hacia delante.
- Cada guardado rehace lo que sale del contenido: el texto para la búsqueda en español, los enlaces y las menciones.
  Nada de eso va al historial.

### Historial, versiones y deshacer

- **Sesión de edición.** Los cambios de una cuenta en una página se agrupan. La sesión empieza con el primer cambio y
  se cierra en cualquiera de estos casos:
  - tras unos minutos sin cambios;
  - a los 15 minutos;
  - al cerrar la última pestaña de la página;
  - antes de cualquier operación del servidor sobre ella (Claude, restaurar, deshacer).
- Al cerrarse una sesión se apuntan dos cosas:
  - una **operación del historial** (`editPage`, con quién, por dónde y cuándo);
  - una **versión de la página**: el estado de cada uno de sus documentos (el cuerpo y sus secretos). Los documentos
    que no cambian se comparten entre versiones por su huella.
- La operación toca una fila propia, `page_bodies`, una por página. Guarda la versión en la que está el contenido, su
  huella y su `version`.
  - Va aparte de `pages` para que editar el texto y cambiar el título no choquen al deshacer: el módulo 0 compara la
    fila entera.
  - En `changes` solo entran ids y huellas, nunca el texto. El historial no puede filtrar un secreto.
- **Deshacer una sesión** funciona como en el módulo 0:
  1. Comprueba que `page_bodies` sigue como la dejó. Si alguien escribió después, dice quién y no toca nada.
  2. Deja la fila como estaba.
  3. Aplica hacia delante, en cada documento, el contenido de la versión anterior.

  Tras deshacer lo último, se puede deshacer lo anterior.
- **Restaurar una versión** es una operación nueva con el mismo mecanismo, y también se puede deshacer.
- **Ctrl+Z del editor** es el deshacer de Yjs en el navegador. Solo deshace los cambios propios, y por documento:
  dentro de un secreto, deshace en el secreto.
- Cuánto se guarda (la spec ajusta los números):
  - las versiones duran lo que las operaciones que las nombran (90 días);
  - las 40 últimas de cada página se guardan siempre;
  - al purgar una página de la papelera, se van sus documentos y sus versiones.
- Si el servidor se para con una sesión abierta, lo nota al cargar el documento: su huella no coincide con la de
  `page_bodies`. Entonces cierra la sesión a nombre de quien escribió el último.
- Las tablas que salen del contenido cuelgan de la página con borrado en cascada: el estado de Yjs, las versiones, la
  búsqueda y los enlaces. Deshacer no las cuenta como filas que dependen de la página. Para eso, `dependentRow`
  (`packages/db/src/repos/undo.ts`) pasa a mirar solo las tablas de dominio (`TRACKED_TABLES`).

### Claude por el MCP

- Cada herramienta que escribe es una operación (`via: 'ai'`, con su herramienta), como en el módulo 0, y pasa por los
  modos y la cola de aprobación.
- Claude lee y escribe el mismo Markdown que se exporta. Al escribir puede:
  - añadir al final;
  - cambiar un bloque o una sección;
  - cambiar el cuerpo entero.

  Señala los bloques por su id. Los ids son estables (`@tiptap/extension-unique-id`, MIT) y salen al leer cuando los
  pide.
- Cómo se aplica un cambio de Claude:
  1. Se cierran las sesiones abiertas de la página.
  2. En una transacción se calcula el contenido nuevo sobre el guardado y se apuntan la versión y la operación.
  3. Al confirmarse, el cambio entra en el documento vivo por una conexión directa de Hocuspocus y le llega a quien
     tenga la página abierta. Si se cruza con lo que alguien está escribiendo, Yjs lo fusiona.
- Un `> [!secreto]` en lo que escribe Claude crea su documento aparte. Nunca entra en el cuerpo.
- Crear una página con su cuerpo es una sola operación, sin documento vivo. Es la vía para pasar Eana; la spec decide
  si hace falta crear varias de una vez.
- Lo que espera aprobación guarda lo pedido y la huella de partida. Al aprobarse, se aplica sobre lo que haya en ese
  momento. Si el bloque ya no existe, queda `failed` con su código, como en el módulo 0.

### Markdown

- Hay un solo dialecto, el de Obsidian que Enrique ya usa. Sirve para exportar, para que Claude lea y para que Claude
  escriba:
  - las propiedades en YAML al principio;
  - `[[Título]]`, `[[Título#sección]]` y `[[Título|texto]]`;
  - callouts `> [!tipo]`;
  - `> [!secreto]` con su `^s-id`;
  - `%%nota oculta%%`;
  - ids de bloque `^id`;
  - imágenes y archivos con `![[archivo]]`.

  Los bloques de hoja (columnas, saltos de página, statblocks, notas al margen) también tienen su forma. La fija la
  spec, tras el REA de Homebrewery.
- Los enlaces se guardan por id.
  - Al exportar, salen con el título que tengan entonces, con la ruta si dos páginas se llaman igual.
  - Cuando escribe Claude, el servidor resuelve cada título a su id. Si hay dudas, contesta con las páginas candidatas.
- La web y el servidor usan `@tiptap/markdown` (MIT, con marked, MIT) con las mismas extensiones del editor. El esquema
  del editor (las extensiones sin sus vistas de React) es un paquete que comparten los dos.
- Una prueba de ida y vuelta lo garantiza: para cada nodo y marca del esquema, leer lo exportado da lo mismo. Un nodo
  sin su forma en Markdown hace fallar la prueba.
- Exportar un mundo da un .zip con una carpeta por cada página que tenga subpáginas, y con sus archivos. Pasa por la
  misma proyección: el máster lo exporta con sus secretos; un jugador (módulo 5), sin lo que no ve.

## Alternativas descartadas

- **Subdocumentos de Yjs para los secretos**: Hocuspocus no los sincroniza.
- **Un documento por clase de visibilidad** (lo público y lo del máster): en el módulo 5 cada secreto se revela a quien
  diga el máster, así que al revelar habría que mover texto de un documento a otro.
- **Editar sin Yjs**, guardando la página entera con su versión: gana quien guarda el último, así que Claude y el
  editor abierto se pisarían.
- **ProseMirror con el servidor como autoridad** (`prosemirror-collab`), filtrando los pasos por cuenta: filtrar los
  pasos que tocan nodos ocultos no es viable, y se pierde la fusión de Yjs.
- **El cuerpo en `changes`, antes y después de cada guardado**: miles de filas con el texto entero, y el secreto dentro.
- **Una versión cada pocos minutos, sin sesiones**, como el Crisol actual: deshacer lo que hizo Claude necesita la
  versión justo antes y justo después de su cambio.

## Consecuencias

- **Lo más arriesgado es el editor anidado de los secretos**, y es lo primero que se prueba en el plan: una página con
  dos secretos mientras Claude escribe en ella. Sus límites:
  - la selección no cruza su borde;
  - Ctrl+Z va por separado;
  - copiar un secreto a otra página crea otro documento.
- Restaurar o deshacer cuesta lo que pesa la página: se calcula el contenido entero de la versión y se aplica como un
  cambio. Las páginas son pequeñas; se mide con una página de prueba de tamaño realista.
- Una página con muchos secretos abre muchos documentos, aunque todos van por la misma conexión. Se mide igual.
- Hay que deshacer antes lo posterior. Si Enrique escribe en una página después de un cambio de Claude, para deshacer
  lo de Claude primero tiene que deshacer lo suyo, como en el módulo 0. Si eso molesta, más adelante se puede deshacer
  de forma selectiva con Yjs.
- Todo corre en un solo proceso: las sesiones y los documentos vivos están en su memoria. Varios procesos necesitarían
  la extensión de Redis de Hocuspocus (MIT, con Valkey) y llevar las sesiones a la base de datos. No se hace hasta que
  haga falta.
- La prueba de fugas se amplía con `/api/collab`:
  - en el módulo 1, un jugador no abre ningún documento de la wiki;
  - en el 5, no recibe ni un byte de un secreto que no ve.
- Dependencias nuevas, todas MIT, comprobadas el 2026-10-29: `@hocuspocus/server` y `@hocuspocus/provider` 4.8,
  `yjs` 13.6 y, de TipTap 3.32:
  - `@tiptap/core`;
  - `@tiptap/extension-collaboration`;
  - `@tiptap/extension-collaboration-caret`;
  - `@tiptap/extension-unique-id`;
  - `@tiptap/markdown`.

  Sus versiones se fijan en el catálogo al añadirlas.
