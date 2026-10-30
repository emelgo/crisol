# Módulos

Orden de trabajo y estado. Antes de empezar cada módulo se repasa con Enrique frente a `docs/inventario.md`: qué se
queda, qué se recorta y qué se descarta. Las decisiones se apuntan aquí.

## Dónde estamos

Actualiza esta sección al acabar cada sesión: es lo primero que lee la siguiente.

### Para retomar (2026-10-30)

- **El módulo 1 (wiki) está construido entero y en staging**: tareas 1 a 26, PR #52 a #70. Lo que hace cada tarea está
  en las entradas de abajo, del 2026-10-30.
- **Ahora mismo**: Enrique prueba en staging los puntos de control 3 a 6 y el final. Después viene la **etapa de
  interfaz** (Enrique ve la interfaz «horrible»). Lo que salga de sus pruebas se apunta abajo, en «Lo que dijo Enrique
  al probar», y se arregla al volver.
- **Lo que tiene que probar**:
  1. **Punto 3**: el conector MCP de staging (`https://neo.crisol.144-91-122-245.sslip.io/mcp`) en claude.ai con su
     cuenta de propietario. Probar `crear_paginas` con secretos y `editar_pagina` sobre una página abierta.
  2. **Punto 4**: versiones, restaurar una y deshacer desde el historial.
  3. **Punto 5**: subir archivos, usarlos en páginas, abrir un PDF y buscar con erratas.
  4. **Punto 6**: el PDF de una hoja con statblock, nota lateral y tabla, e «Imprimir» en Chrome, Firefox y Safari.
  5. **Final**: los 10 criterios de éxito de `docs/specs/wiki.md`.
- **Decisiones pendientes de Enrique** (no se tocan sin su permiso):
  - Chromium para los PDF en un contenedor aparte, sin secretos y con sandbox (hoy va en el de la app, sin sandbox y
    con el entorno limpio);
  - una cuota de almacenamiento por organización (hoy no hay ninguna);
  - más memoria para la app (512 MB) si se sacan PDF grandes.
- **Para vigilar**: en la CI, en una máquina lenta, lo escrito nada más abrir una página quedó a veces delante del
  contenido. No se ha visto en local ni en staging; si pasa, mirar `editable` hasta `ready` en
  `apps/web/src/wiki/editor.tsx`.
- **Al volver, el orden**:
  1. arreglar lo que diga Enrique de sus pruebas;
  2. la etapa de interfaz, con la skill `frontend-design` y `web-design-guidelines`, sobre la identidad «Hoja» ya
     elegida (`docs/modulos.md`, más abajo) y los prototipos aprobados de la wiki;
  3. cerrar el módulo 1 (marcar sus puntos de control en `tasks/todo.md`);
  4. empezar el módulo 2 con su ciclo (`interview-me` frente al inventario, REA, spec…).
- **Lo que aún no tiene el módulo 1**, a propósito o para más adelante: importador (Eana se pasa por el MCP), los
  jugadores viendo la wiki (módulo 5), los datos de criatura del statblock (módulo 4), y la capa de texto del visor de
  PDF (hoy se lee con «Abrir aparte»).
- **La bitácora de la tirada**: `tasks/bitacora.md` (decisiones pequeñas, lecciones y lo que queda de cada tarea).

### Lo que dijo Enrique al probar

(vacío: se apunta aquí al volver)

### Historia

- **2026-10-29 — Fase 0 hecha.**
  - Repo, normas (`CLAUDE.md`, `CONSTRAINTS.md`), inventario, ADR-0001 y skills de agent-skills en el proyecto.
  - REA arreglado (navegador).
  - Foundry 14.369 instalado para el REA (`research/foundry/entorno.md`).
- **2026-10-29 — Módulo 0 repasado, REA hecho, spec aprobada, plan escrito** (rama `fundacion/repaso-y-spec`).
  - Decisiones en «Decisiones por módulo» más abajo.
  - REA: `research/foundry/usuarios-y-permisos.md`, `research/foundry/sincronizacion-e-historial.md` y
    `research/dndbeyond/campanas-e-invitaciones.md`. Lo gordo: Foundry no proyecta nada por usuario (manda el mundo
    entero y oculta en la interfaz) y no tiene historial; D&D Beyond ata la pertenencia al personaje.
  - Spec `docs/specs/fundacion.md` **aprobada**; ADR-0002 (Better Auth solo para identidad; inquilinos e invitaciones
    en tablas propias); prueba de fugas añadida a `CONSTRAINTS.md`.
  - Plan aprobado: `tasks/fundacion/plan.md` y 25 tareas en `tasks/fundacion/todo.md` (archivados ahí al empezar el
    módulo 1).
- **2026-10-29 — Módulo 0 hecho: tareas 1 a 14 y 16 a 25** (PR #2 a #33). La 15 (Discord, Google y correo), pospuesta. Staging en
  https://neo.crisol.144-91-122-245.sslip.io (Compose `crisol-staging` en `~/crisol-staging`, puerto 8140; copia del
  Caddyfile en `/etc/caddy/Caddyfile.bak-20261029-104936-neo-crisol`). Desplegar tras cada merge:
  `scripts/desplegar-staging.sh` (con cerrojo).
  - Hecho: plataforma (1-5), cuentas con registro cerrado y arranque (6-8), núcleo de escritura con historial (9),
    mis mundos (10), conector MCP con OAuth 2.1 + CIMD y `listar_mundos` (11), campañas (12), enlace de invitación
    (13; el secreto se guarda cifrado además del hash para poder verlo siempre, decidido con Enrique) y unirse con
    el enlace (14; crear la cuenta une en la misma petición).
  - Miembros (16): verlos, expulsar (con «Expulsar y cambiar el enlace», porque el viejo aún le valdría) y dejar la
    campaña. Si a alguien no le queda nada en la organización y no es propietario, deja de ser miembro. Las
    operaciones de miembros, enlaces y entradas ya llevan su mundo en el historial.
  - Tiempo real (17): `/api/realtime`, un WebSocket por pestaña (origen y sesión comprobados antes de aceptarlo).
    Cada evento se decide con las pertenencias de ese momento y solo avisa de qué cambió; los datos se piden por la
    API. Expulsar o salir manda `revoked`. El máster ve «X ha entrado» con «Expulsar» a mano.
  - Fugas (18): `e2e/tests/fugas.spec.ts` (`@fugas`), paso propio de la CI que bloquea; falla si se mete una fuga
    por la API o por el WebSocket. Destapó que una jugadora podía forzar el permiso OAuth: ahora se le niega (hook
    de Better Auth) y `/mcp` lo sigue mirando en cada petición. «Deshacer» entra en la prueba con la tarea 20.
  - Punto de control 3 superado (salvo entrar con Discord, que llega con la 15). Lo que vio Enrique, arreglado en el
    PR #23: volver a una ventana ya visible no refrescaba (TanStack Query 5 solo mira `visibilitychange`; ahora
    también `focus`), y una pestaña abierta antes de un despliegue seguía con la web vieja. Ahora el canal saluda con
    la versión de la web (su script de entrada) y, si no coincide, sale «Hay una versión nueva» con «Recargar».
  - Historial (19): `listHistory`, de un mundo para su máster y de toda la organización para el propietario, por
    páginas (cursor: la última operación vista). La web pone la frase de cada acción con i18n y se pone al día con
    cualquier aviso del canal.
  - Deshacer (20): `undoOperation` aplica lo inverso como una operación nueva, enlazada a la original y a su vez
    deshacible. La lógica pura (qué fila ya no está como la dejó la operación, los pasos inversos) está en
    `packages/domain/src/undo.ts`; `packages/db/src/repos/undo.ts` la aplica con las filas bloqueadas y mira en el
    catálogo de Postgres si quitar algo se llevaría filas que dependen de ello, o si volver a poner una fila chocaría
    con otra igual. En cualquier conflicto no toca nada y dice qué operación posterior lo impide. Deshacer deja la
    versión de antes, así que tras deshacer lo posterior se puede deshacer lo anterior. El contador de entradas del
    enlace ya no pasa por el historial (si no, cada entrada impediría deshacer las anteriores). Lo del sistema no se
    deshace. Enrique probó el historial en staging: funciona.
  - Papelera (21): borrar un mundo o una campaña marca `deleted_at` (la misma fila; deshacerlo o restaurarla la deja
    como estaba). Lo de la papelera no cuenta en ninguna consulta de lo que ve una cuenta (pertenencias, listas,
    enlace de invitación). Papelera del mundo (su máster) y de la organización (el propietario, también mundos).
    Purga diaria a las 4:00 de Madrid con BullMQ 6.3.15 (`apps/server/src/jobs/purges.ts`): lo de más de 30 días en
    la papelera y las operaciones de más de 90; quien se queda sin nada deja de ser miembro. `msgpackr-extract`
    (acelerador nativo opcional) no ejecuta su script de instalación.
  - Modos de IA y cola (22): modo por cuenta (`ai_settings`; copiloto si no hay fila) y la decisión por modo × tipo
    de acción en `packages/domain/src/ai-modes.ts`. Lo que espera va a `approvals` (Postgres, fuera del historial):
    `apps/server/src/mcp/approvals.ts` lo apunta con los nombres de lo que toca (solo si la cuenta lo ve), avisa por
    el canal y espera hasta 15 s escuchando el bus del proceso (una conexión más de la cuenta en el hub); si no hay
    decisión, contesta `PENDING_APPROVAL`. `approve` lo hace con la cuenta y sus permisos de ahora, como hecho por la
    IA con su herramienta; si ya no se puede, queda `failed` con el código. Aprobar, rechazar y cambiar el modo solo
    desde la interfaz (`UI_ONLY`). Las herramientas que no son de leer no anuncian `outputSchema` (pueden contestar
    «esperando»). La caducidad (24 h) se decide con la hora, no se guarda; la purga diaria se lleva las peticiones de
    más de 90 días.
  - Herramientas MCP (24, antes que la 23): `listar_mundos` (mundos con sus campañas), `ver_campana`, `crear_mundo`,
    `crear_campana`, `enlace_invitacion` (sin `change`, leer; con `regenerate`, `open` o `close`, la acción de
    jugadores), `ver_historial`, `deshacer` y `pendientes`. `MCP_TOOLS` en `apps/server/src/mcp/tools.ts`: cada una es
    una acción del contrato o una ruta a varias. Probadas con el cliente del SDK: cada herramienta en cada modo, el
    criterio 4 (crear sin preguntar, regenerar espera y al aprobarlo se hace) y la proyección (lo de otra
    organización da `NOT_FOUND` y no entra en la cola).
  - Cola y ajustes de IA en la web (23): la cola (`components/approval-queue.tsx`) está en el marco de todas las
    páginas y solo se ve si hay algo pendiente; aparece sola con el aviso `changed approvals`. Cada petición dice en
    una frase lo que Claude quiere (`summaries.ts`: las mismas frases que el historial, por hacer), con su detalle,
    «Aprobar» y «Rechazar». Ajustes en `/ia` (enlace «IA» en la cabecera, solo para el propietario): la dirección del
    conector, el modo y cómo acabaron las últimas peticiones. La e2e (`e2e/tests/aprobaciones.spec.ts`) conecta
    «Claude» por OAuth con la ayuda `connectClaude` y llama al MCP sin cookies, como claude.ai; la prueba de fugas
    comprueba que la cola del máster no le llega a la jugadora.
  - Enrique probó en staging los criterios 4 a 6 con claude.ai: «funciona perfecto». Pidió un historial más claro
    al deshacer (PR #30: lo deshecho, tachado; deshacer un deshacer es «Rehacer» y se cuenta «rehízo»; un solo botón
    por cadena). Decidió que el máster sí puede deshacer que alguien saliera de su campaña (PR #32).
  - Cierre (25), lo hecho:
    - LCP de `/entrar` en staging, mediana de 5 cargas en frío: 0,27 s en escritorio y 1,9 s en móvil con 4G lenta y
      CPU ×4 (medido desde el VPS).
    - Tres revisiones: seguridad, servidor y web. Lo de seguridad y servidor, arreglado en el PR #31 (ver su
      descripción). Lo de la web, en el PR #33. Lo alto era que al salir la caché seguía a la vista de la siguiente
      cuenta: ahora `account/scope.tsx` la vacía y vuelve a montar la web. También:
      - Una sola región viva (`components/announcer.tsx`).
      - Foco en confirmaciones y tras navegar, con un título por pantalla (`page-title.tsx`).
      - `BusyButton` en vez de `disabled`.
      - Bordes de los campos a 3:1.
      - La sesión acabada lleva a entrar.
      - «Entras como…» al unirse.
      - El dominio del cliente en la pantalla de permiso.
      - Errores de carga con «Reintentar».
    - De paso salió un fallo del canal: un aviso que llegaba mientras se pedía algo por primera vez se perdía. Ahora se
      cancela lo que está en vuelo y se vuelve a pedir. Las e2e de Claude usan `fetch` y esperan al saludo del canal
      (`gotoLive` en `e2e/tests/ayudas.ts`).
    - Testing Library espera hasta 3 s (`test-setup.ts`): con todos los paquetes a la vez, 1 s no siempre bastaba.
  - Discord, Google y el correo (tarea 15), **pospuestos** por Enrique: de momento solo email y contraseña. Sin correo
    no hay «recuperar la contraseña»; las variables están comentadas en `.env.example`.
  - Puntos de control 1 y 2 superados: Enrique tiene su cuenta de propietario en staging (organización
    «Fateforge», mundo «Eana») y conectó claude.ai (cliente CIMD `https://claude.ai/oauth/mcp-oauth-client-metadata`).
  - GitHub gratis no protege ramas privadas: se fusiona solo con los 4 check-runs del commit en verde, esperando con
    un bucle con tope (un runner colgado dejó `gh pr checks --watch` esperando sin fin; ahora hay timeout-minutes).
  - MIT-0 admitida en `CONSTRAINTS.md`.
  - Puertos: desarrollo 8130 (servidor), 5173 (Vite), 54330 (Postgres), 63790 (Valkey), 10250/8250 (Mailpit);
    e2e 8131; prueba del MCP 8132; staging 8140.
- **2026-10-29 — Fase de diseño empezada** (ver «Entre el 0 y el 1» más abajo). Skills listas: `frontend-design`
  como plugin del proyecto (estaba en el marketplace oficial ya añadido) y las cuatro de Vercel en `.claude/skills/`.
  - Enrique desechó el aspecto del Crisol actual. Siete direcciones en un lienzo privado de claude.ai
    (https://claude.ai/artifact/1vbb4SGJvuqKQniFZ2acyG; fuentes en `out/lienzo-diseno/`, fuera de git): Imprenta,
    Fragua, Baraja, Cianotipia, Bosque, Grimorio y Hoja. Eligió **Hoja** («es más rol»): interfaz de hoja de
    personaje, solo el aire del género (sala limpia).
  - Identidad aplicada a la web (PR #35): Barlow y Barlow Condensed servidas desde Crisol (OFL-1.1, admitida solo
    para tipografías de `@fontsource`), tokens en `apps/web/src/styles/tokens.css` con sus contrastes probados,
    barra oscura, cajas con las esquinas cortadas (`--cut`), rótulos en rojo, botones condensados. Lo de Claude, en
    azul.
  - Barra de secciones y franja (PR #36):
    - En la barra de arriba van «Mis mundos» y, para el propietario, «Historial», «Papelera» e «IA». La sección
      actual va marcada.
    - El mundo y la campaña llevan una franja (`components/banner.tsx`) con su papel y sus casillas: campañas;
      jugadores; y, para el máster, cuántos han entrado. Comparte las consultas con los paneles de abajo.
    - Los enlaces del mundo se llaman «Historial de Eana» y «Papelera de Eana».
  - Repaso (PR #37):
    - El marco de la hoja es una pieza (`components/frame.module.css`, con `composes`).
    - La invitación lleva su franja, la portada es una portada y el permiso de Claude va en su caja.
    - Revisión con `web-design-guidelines`, con lo que salió arreglado: «Saltar al contenido», `theme-color`, el
      email sin corrector, `autocomplete` en los nombres, `touch-action` y títulos largos que no desbordan.
  - Lo que pidió Enrique al verlo:
    - El saludo de la portada, en la letra de los títulos.
    - La cuenta, en un desplegable (PR #38): el nombre abre una caja con el email, «Perfil» y «Cerrar sesión», con
      la letra de las secciones. Se cierra con Escape, al pulsar fuera o al salir con el tabulador
      (`components/account-menu.tsx`).
    - Las pruebas cierran sesión con `signOut()` (en `testing.ts` y en `e2e/tests/ayudas.ts`).
  - **Fase de diseño cerrada** con «Hoja». Enrique: «de la UI faltan cosas que no me convencen, pero lo abarcamos
    todo cuando tengamos la app terminada». El pulido visual queda para el final; si señala algo concreto, se apunta
    en «Para el repaso final de la interfaz», más abajo.
- **2026-10-29 — Módulo 1 (wiki): entrevista hecha** y confirmada por Enrique («vamos»). Las decisiones están en
  «Decisiones por módulo» § 1, más abajo. Lo gordo:
  - **No hay importador**: Eana se pasará con Claude por el MCP cuando la app esté terminada. Por eso las herramientas
    MCP de la wiki tienen que bastar para crearlo todo.
  - Las **hojas con estilo** (tipo Homebrewery) entran.
  - Sin editor de Markdown a mano.
  - La wiki es solo del máster hasta el módulo 5.
- **2026-10-29 — Módulo 1: ADR-0003 escrito** (`docs/adr/0003-paginas-yjs-y-secretos.md`).
  - La página es una fila con historial, como en el módulo 0. Solo el cuerpo es Yjs.
  - Cada secreto y cada nota oculta es su propio documento de Yjs; el cuerpo solo lleva su id.
  - Hocuspocus 4 va dentro del servidor, en `/api/collab`, con permiso por documento.
  - Guardar es fusionar, y nada vuelve atrás sobrescribiendo: restaurar, deshacer y lo de Claude son cambios hacia
    delante.
  - Los cambios se agrupan en sesiones de edición. Cada una es una operación sobre `page_bodies` y una versión de la
    página, y se deshace como en el módulo 0.
  - Claude escribe en el mismo Markdown de Obsidian que se exporta, con ids de bloque, y su cambio entra en vivo en la
    página abierta.
  - Lo más arriesgado es el editor anidado de los secretos, y es lo primero que se prueba en el plan.
- **2026-10-29 — Módulo 1: REA hecho.** Tres notas, cada una con sus preguntas para la spec al final.
  - `research/homebrewery/hojas-y-pdf.md` (Homebrewery 3.24.2):
    - Pagina a mano, con hojas de tamaño fijo, y lo que no cabe se corta sin avisar. Propuesta: paginar solo, bloque a
      bloque, con saltos opcionales y aviso.
    - Su PDF es la impresión del navegador.
    - Sus fuentes (CC BY-SA) y sus imágenes (sin licencia) no entran. De su código MIT se aprovecha lo de paginar e
      imprimir, con atribución.
    - Bloques de hoja propuestos: salto de página y de columna, statblock, nota lateral, ancho e índice. Dos temas
      propios, Pergamino y Neutro.
  - `research/foundry/journal.md`:
    - Sin subpáginas: carpetas → entrada → páginas planas.
    - Guarda HTML libre, con enlaces por id. No tiene entrantes ni vista previa, y lo borrado deja enlaces rotos sin
      avisar.
    - Los secretos van dentro del HTML y se escapan por la red, por la búsqueda y por los incrustados. Revelar es para
      todos a la vez. Confirma el ADR-0003.
    - Archivos sin sesión y «mostrar a los jugadores» sin comprobar en el servidor: los dos fallos que no repetiremos.
  - `research/dndbeyond/contenido-y-enlaces.md`:
    - Cada enlace lleva su tipo, con vista previa rápida (200–500 ms) pero solo con ratón: no sale con el teclado ni en
      el móvil.
    - Las anclas salen del texto del encabezado. El lector es de una columna, sin PDF.
    - La búsqueda llega a las secciones de los libros.
    - No hay wiki ni secretos por bloque.
  - `research/README.md` admite Homebrewery como fuente: su código, MIT, se puede aprovechar con atribución.
- **2026-10-29 — Módulo 1: spec aprobada** por Enrique («vamos»), con las cuatro propuestas (`docs/specs/wiki.md`).
  - Nueve capacidades: `paginas`, `editor`, `markdown`, `enlaces`, `versiones`, `archivos`, `busqueda`, `hojas` e
    `ia`.
  - Lo más arriesgado va primero: el editor anidado de los secretos.
  - Dimensionada con Eana, contada sin abrirla: 2.384 páginas, la mediana de 1,3 KB y 99 archivos (710 MB, casi todos
    PDF, el mayor de 204 MB).
  - Decidido:
    - los archivos los sube Enrique y Claude los enlaza;
    - el PDF, imprimiendo desde el navegador;
    - la hoja se pagina sola;
    - los tipos de propiedad.
- **2026-10-29 — Módulo 1: diseño aprobado** por Enrique («me parece bien»). Es el lienzo «Crisol: wiki»
  (https://claude.ai/artifact/Wvxy8bDfxQLDwcVHbsDLQv; fuentes en `out/lienzo-wiki/`, fuera de git). Tiene cinco
  tablas:
  - la página en vista sencilla;
  - el editor;
  - la hoja;
  - la búsqueda con Ctrl+K;
  - el móvil.

  En la hoja, la letra del texto (Alegreya) es una propuesta para el repaso final.
- **2026-10-29 — Módulo 1: plan aprobado** por Enrique («si, vamos»): `tasks/plan.md` y 26 tareas en `tasks/todo.md`.
  - El plan del módulo 0 está ahora en `tasks/fundacion/`.
  - Hay nueve fases y seis puntos de control. Lo arriesgado va pronto: Yjs en el servidor (6), el editor anidado de
    los secretos (8, con su punto de control) y Claude escribiendo en una página abierta (11).
- **Siguiente paso: módulo 1**, en este orden, cada uno con su PR de documentación (rama corta → CI → merge):
  1. ~~ADR-0003, Yjs y secretos~~: hecho.
  2. ~~REA dirigido~~: hecho (Homebrewery, Foundry Journal y D&D Beyond).
  3. ~~Spec~~: aprobada.
  4. ~~Diseño~~: aprobado.
  5. ~~`/plan`~~: aprobado.
  6. **`/build` tarea a tarea** (`tasks/todo.md`), con `/agent-skills:review` y `/ship`, como en el módulo 0. Hechas de
     la 1 a la 17. **Puntos de control 1 y 2 pasados** (2026-10-30, «todo funciona de momento»): el editor anidado se
     queda. **Sigue la 18** (archivos del mundo), y así hasta acabar el módulo (bitácora: `tasks/bitacora.md`).
  7. **Al acabar el módulo 1, la interfaz** (decisión de Enrique, 2026-10-30): se apunta por dónde vamos y se
     dedica una etapa a la interfaz antes del módulo 2. Ver «Para el repaso final de la interfaz».
- **2026-10-29 — Módulo 1, tarea 1: páginas y árbol en la API.**
  - La tabla `pages` tiene historial y su orden es una clave fraccionaria (`packages/domain/src/order.ts`, collation
    "C"). Mover solo escribe la fila que se mueve.
  - Hay nuevas acciones `createPage`, `updatePage`, `movePage`, `getPage` (con la ruta), `listPageChildren` y
    `listPageTree`.
  - Permisos `page.read` y `page.write`: el máster del mundo y el propietario de la organización. La organización sale
    de la fila del mundo, nunca de lo que diga quien pide.
  - El aviso `changed pages` solo llega a quien ve la wiki.
  - Herramientas MCP `ver_arbol` y `mover_pagina`; en la cola salen los títulos de las páginas.
  - `@fugas` amplía la prueba: la jugadora no recibe nada de la wiki. Se comprobó que falla si el aviso llegara a
    todos los del mundo.
- **2026-10-29 — Módulo 1, tarea 2: el árbol en la web.** Desplegada la 1 en staging (health 200, sin errores).
  - Rutas `/mundos/:worldId/wiki` y `/mundos/:worldId/wiki/:pageId` (`apps/web/src/wiki/`). En la wiki, el `main` es
    más ancho (90rem).
  - El árbol sigue el patrón ARIA de árbol de navegación:
    - las filas son enlaces con `role="treeitem"`, con su nivel y su posición;
    - hay una sola parada del tabulador;
    - las flechas se mueven, despliegan y pliegan; Inicio y Fin van al principio y al final;
    - Alt y las flechas recolocan;
    - también se recoloca arrastrando: el cuarto de arriba pone delante, el de abajo detrás y el centro dentro.
  - La flecha de desplegar es un dibujo dentro de la fila: un botón entre las filas no lo admite axe
    (`aria-required-children`).
  - Cada rama se pide al desplegarla, y la rama de la página abierta se despliega sola.
  - Con más de 300 filas visibles, solo se pintan las que se ven (`@tanstack/react-virtual` 3.14).
  - «Página nueva» y «Nueva subpágina» crean con «Sin título» y abren el título con el texto elegido, para escribir
    encima (`?nuevo=true`). Se renombra en el sitio, y Escape cancela.
  - Hay migas de pan y la lista de subpáginas.
  - En el móvil, el árbol va en un cajón: el foco entra al abrirlo y vuelve a «Páginas» al cerrarlo.
  - Desde el mundo hay un enlace «Wiki de Eana».
  - Hay e2e de crear, renombrar, recolocar con el teclado y arrastrando, y recargar. Otra comprueba el cajón, y otra
    pasa axe en los dos temas y en el móvil.
- **2026-10-29 — Módulo 1, tarea 3: propiedades, alias, etiquetas e icono.** Desplegada la 2 en staging (health 200,
  sin errores).
  - Las propiedades son de tipo texto, número, sí/no, lista o páginas, en el orden que elige el máster
    (`setPageProperties`).
    - Las reglas, en `packages/domain/src/properties.ts`: el nombre no se repite (sin mirar mayúsculas), y `alias` y
      `etiquetas` son listas y `resumen` es texto. Una etiqueta no lleva espacios y usa «/» para la jerarquía.
    - Las de tipo páginas solo enlazan páginas de la misma wiki, fuera de la papelera.
    - En el historial queda qué propiedades cambiaron, y deshacer las devuelve.
  - El icono es un emoji (`updatePage` con `icon`). Se elige entre 16 habituales o se escribe cualquier otro, y se
    quita con null. La caja sigue el patrón de despliegue del menú de la cuenta.
  - Hay un panel de etiquetas (`/mundos/:worldId/etiquetas`, `listTags`): cada madre cuenta también las páginas de sus
    hijas. Pulsar una etiqueta para buscar llega con la búsqueda (tarea 20).
  - El editor de propiedades:
    - tiene un botón para añadir cada reservada, y se sube, se baja y se quita;
    - un número que no lo es no se guarda, y lo dice;
    - las de tipo páginas se eligen por el título, con los títulos de `listPageTree` hasta 6 niveles, hasta que lleguen
      los enlaces (tarea 13).
  - Los desplegables y las áreas de texto de los formularios tienen ya el estilo de los campos.
- **2026-10-29 — Módulo 1, tarea 4: papelera de páginas.** Desplegada la 3 en staging (health 200, sin errores).
  - `deletePage` manda a la papelera la página y las subpáginas que no lo estaban, todas en una operación y con el
    mismo momento. MCP: `borrar_pagina`, de tipo `delete`.
  - `restorePage` las devuelve juntas: las que se borraron antes por su cuenta se quedan en la papelera. Mientras la
    madre siga en la papelera no se restaura (`PARENT_IN_TRASH`).
  - En la papelera sale solo la página de arriba de cada borrado, con cuántas subpáginas se fueron con ella.
  - La purga de 30 días se lleva las páginas con sus subpáginas (clave ajena en cascada).
  - En la web, «Borrar» pide confirmar y vuelve a la madre (o a la portada de la wiki). Lo de la papelera se restaura
    desde la del mundo.
  - De paso se arregló un fallo que venía de la tarea 1: pedir una página que no existe o que está en la papelera daba
    500 en vez de 404, porque se buscaba el mundo con un id vacío.
- **2026-10-29 — Módulo 1, tarea 5: pestañas, marcadores y anterior/siguiente.** Desplegada la 4 en staging (health
  200, sin errores).
  - Las preferencias de cada cuenta en cada wiki (`wiki_preferences`) no van al historial: `getWikiPreferences`,
    `setWikiTabs` y `setBookmarks`. Salen con los títulos de ahora, y lo que está en la papelera no sale (vuelve si se
    restaura).
  - Se adelantó a esta tarea el cambio de `dependentRow` que el plan dejaba para la 6: ahora mira solo
    `TRACKED_TABLES`. Si no, las preferencias impedían deshacer la creación de un mundo.
  - Pestañas:
    - cada página que se abre entra, y quedan 8 sin fijar como mucho; las fijadas van delante y no se cierran;
    - se ven en el acto y se guardan en fila, y solo cuenta la respuesta del último guardado;
    - en el móvil, las abiertas van en el cajón del árbol.
  - Marcadores por grupos, junto al árbol. El primero va de un clic a «Marcadores»; después se elige el grupo o se
    crea otro. «Quitar el marcador» la quita de todos.
  - Anterior y siguiente entre hermanas, al pie de la página. El índice del documento llega con el cuerpo (fase 2).
- **2026-10-29 — Módulo 1, tarea 6: documentos de Yjs en el servidor.** Desplegada la 5 en staging (health 200, sin
  errores).
  - Por el camino, una prueba del módulo 0 fallaba al azar (1 vez de cada 64) en la CI del PR #48: la del cifrado
    alterado de los enlaces no siempre alteraba el carácter. Arreglada.
  - Hocuspocus 4.8 corre dentro del servidor (`apps/server/src/collab/`), en `/api/collab`.
    - Comprueba el origen y la sesión, como el canal, y la vuelve a mirar cada minuto.
    - Un WebSocket por pestaña lleva todos sus documentos; hay que pasarle a mano los mensajes, los pong y el cierre.
  - El cuerpo de una página es el documento `page:<id>`. Al abrir cada documento se comprueban `page.read` y
    `page.write` con las pertenencias de ese momento; sin escritura, se abre en solo lectura.
  - La tabla `documents` (sin historial; migración 0011) guarda el estado de Yjs. Hay un solo cuerpo por página, y las
    filas de tipo `secret` y `note` llegarán en la tarea 8.
    - Guardar es fusionar (`Y.mergeUpdates`) con la fila bloqueada, unos 2 s después del último cambio y como mucho a
      los 10 s.
    - Si el estado pasa de 4 MB no se guarda, y se cierran sus conexiones.
  - Un mensaje de más de 1 MB corta la conexión. El tope del WebSocket pasó de 1 KB a 1 MB, así que el canal en tiempo
    real ahora corta él mismo lo que pase de 1 KB.
  - Al mandar una página a la papelera (con sus subpáginas) o un mundo, se cierran sus documentos abiertos y ya no se
    vuelven a abrir.
  - Las pruebas de integración usan clientes reales de Hocuspocus en Node: el WebSocket de Node manda la cookie y el
    origen, sin dependencias nuevas.
    - Dos pestañas convergen, lo guardado vuelve, y guardar fusiona con lo de fuera.
    - Una jugadora no abre ningún documento, ni tampoco un nombre desconocido o una conexión desde otro origen.
    - Se cierra al ir a la papelera, y cortan los límites.
  - `@fugas` en el navegador llegará con el editor (tarea 7): con el máster escribiendo, a la jugadora no le debe llegar
    nada.
- **2026-10-29 — Módulo 1, tarea 7: el editor en la web.** Desplegada la 6 en staging (health 200, sin errores).
  - `packages/editor` es el esquema del editor, sin React (dependency-cruiser lo comprueba). Usa TipTap 3.32.1, con
    todos sus paquetes en la misma versión exacta. Por ahora lleva la base: texto, títulos, listas, casillas, cita,
    código, separador y las marcas; los enlaces llegan en la tarea 13.
    - Los títulos del cuerpo van del 1 al 3 y se pintan como `h2` a `h4`, porque el `h1` es el título de la página. Al
      pegar se leen al revés, para que copiar dentro del editor no cambie su nivel.
    - La etiqueta de las casillas la pasa la web ya traducida («Por hacer: …»); la de TipTap sale en inglés.
  - En la web, `App` recibe un `collab` (en `main.tsx`, `createCollabClient()`); sin él, que es lo que pasa en las
    pruebas de componentes, el cuerpo no se abre.
    - La wiki abre un WebSocket por pestaña (`CollabSocket`), y cada página abre su `page:<id>` con un proveedor de
      Hocuspocus enganchado a ese socket.
    - Los cursores de otras cuentas llevan su nombre y su color.
    - Sin conexión sale «Sin conexión: se guardará al volver.».
  - El candado va en `updatePage` con `locked`: pone el editor en lectura sin volver a abrir el documento, y el
    historial lo cuenta.
  - E2e:
    - lo escrito sigue al recargar;
    - dos pestañas convergen;
    - sin red se sigue escribiendo y llega al volver (con `routeWebSocket`: `setOffline` no corta un WebSocket abierto);
    - el candado.
  - `@fugas`: con el máster escribiendo en el cuerpo, a la jugadora no le llega ni una palabra.
- **2026-10-30 — Módulo 1, tarea 8: secretos y notas ocultas (el riesgo).** Desplegada la 7 en staging (health 200,
  sin errores; `/api/collab` funciona a través de Caddy).
  - En el esquema, los nodos `secret` y `note` son bloques sin contenido que solo guardan el id de su documento
    (`packages/editor/src/separate.ts`). Dentro de un secreto no hay otros (`nested`).
  - En el servidor, cada uno es su propio documento de Yjs, `doc:<id>` (fila `documents` de tipo `secret` o `note`).
    - Al abrirlo se comprueba el permiso de su página; en el módulo 5 tendrá el suyo propio.
    - Al borrar la página se cierran también sus secretos.
  - `createPageDocument` crea el documento vacío, o la copia de otro (`copyOf`) si se puede leer el original. No va al
    historial: lo cuenta la sesión de edición del cuerpo.
  - En la web (`apps/web/src/wiki/separate.tsx`):
    - **Vista**: cada bloque es un editor anidado conectado a su documento por el mismo WebSocket.
    - **Insertar**: los botones «Secreto» y «Nota oculta» de la barra hacen secreto lo elegido (su contenido pasa al
      documento nuevo) o insertan uno vacío.
    - **Deshacer el bloque**: «Convertir en texto normal» devuelve el contenido al cuerpo.
    - **Copiar**: pegar un secreto crea una copia; la hace la pestaña que pegó. Mover arrastrando no copia.
    - **Teclado**: con las flechas se llega al bloque, Intro entra, las flechas salen por sus bordes y Escape vuelve
      al cuerpo con el bloque elegido.
    - **Ctrl+Z** va por documento.
    - Los rótulos de los cursores ajenos van ocultos a los lectores de pantalla: van dentro del texto.
  - Tokens `--color-secret*` con sus contrastes probados.
  - Pruebas:
    - de integración, el texto de un secreto nunca está en el estado guardado del cuerpo; dos secretos y otra pestaña
      escribiendo a la vez convergen; copiar; una jugadora no abre ningún secreto;
    - e2e, todo lo anterior en el navegador, con la base de datos mirada desde la prueba;
    - `@fugas` y a11y, con un secreto.
  - **Fallo encontrado y arreglado**: al escribir en el cuerpo justo después de dar el nombre a una página nueva,
    cuando se guardaba el nombre el foco saltaba al título y a «Renombrar», y lo que se tecleaba se perdía. Ahora las
    ayudas que devuelven el foco (`useReturnFocus` y el foco al título tras navegar) solo lo hacen si se había perdido
    (`focusIsLost`).
- Queda una ventana pequeña en el tiempo real: lo que cambie entre la primera carga de una página y la conexión del
  canal no se ve hasta volver a la pestaña. Taparla costaría volver a pedirlo todo al conectar la primera vez.
- **2026-10-30 — Módulo 1, tarea 9: todos los bloques y marcas.** Enrique pasó los puntos de control 1 y 2. Antes de
  irse a dormir pidió acabar el módulo sin parar. Dio permiso para:
  - las extensiones MIT de TipTap y `@floating-ui/dom`;
  - el volumen «archivos»;
  - Chromium en el contenedor para «Descargar PDF», en la tarea 24.

  Hecho:
  - **Esquema** (`packages/editor`):
    - tablas (`@tiptap/extension-table`);
    - recuadros (`callout`, de los tipos `note`, `tip`, `warning`, `danger` y `read-aloud`) y la caja (`box`);
    - el enlace externo, que solo admite http, https y mailto (`isExternalUrl`);
    - ids de bloque (`@tiptap/extension-unique-id`): 8 letras o cifras, en `data-id`. Los documentos de antes reciben
      los suyos al abrirse (`fillMissingIds`), y lo duplicado se copia sin ids (`withoutBlockIds`).
  - **Vistas**: la opción `separate` de `editorExtensions` pasa a ser `view` (las vistas de React de la web:
    `apps/web/src/wiki/views.ts`).
  - **Web**:
    - **Menú «/»** (`slash-menu.tsx`, con `@tiptap/suggestion`): grupos «Texto», «Recuadros» y «Del máster», según el
      lienzo. Filtra sin tildes, y el texto guarda el foco con `aria-activedescendant`. Va también dentro de los
      secretos, sin «Del máster».
    - **Barra de formato y barra de la tabla** (`bubble-menu.tsx`): se llega con Alt+F10 y se recorren con las flechas.
    - **Asa y menú del bloque** (`drag-handle.tsx`): convertir, duplicar, subir, bajar y borrar. El menú se abre
      también desde «Bloque» en la barra: así vale con el teclado y en el móvil. El asa se fija con la meta
      `lockDragHandle` de su plugin, porque los comandos son de la extensión y aquí no está.
  - **Tokens** de los recuadros (`--color-tip`, `--color-warning`, `--color-danger` y `--color-read-aloud*`), con sus
    contrastes probados.
  - **Pruebas**:
    - del esquema, con pegar HTML sucio en happy-dom (`pasteHTML`);
    - del catálogo de bloques;
    - e2e en `e2e/tests/bloques.spec.ts`: el menú «/» con el teclado, los atajos, la barra de formato y los enlaces,
      el menú del bloque, arrastrar, los ids al recargar, pegar HTML, y el menú dentro de un secreto;
    - a11y de los menús abiertos.
  - **Queda para la tarea 13**: «Enlace a página» en el menú «/» y la propuesta de enlazar en la barra de formato.
- **2026-10-30 — Módulo 1, tarea 10: el Markdown, de ida y vuelta** (`packages/editor/src/markdown`, entrada propia
  `@crisol/editor/markdown`, para que la web no cargue marked).
  - **Propiedades** (`frontmatter.ts`): un YAML pequeño hecho a mano para los cinco tipos (sin dependencia nueva).
    - Las páginas enlazadas se escriben `"[[Título]]"`; al leer vuelven sus títulos, que resuelve el servidor.
    - Lo que no entiende lo dice con su línea (`FrontmatterError`).
  - **Formas propias** (`syntax.ts`), declaradas en cada nodo (`markdownTokenizer`, `parseMarkdown` y
    `renderMarkdown`):
    - los recuadros `> [!nota|consejo|aviso|peligro|leer]`. También se leen los de Obsidian en inglés y el título tras
      el tipo;
    - la caja, `> [!caja]`;
    - el secreto, `> [!secreto]`;
    - la nota oculta, entre `%%` en su línea, o `%%texto%%`.
  - **Una página** (`page.ts`): `pageToMarkdown` y `pageFromMarkdown`.
    - Ids solo de primer nivel y solo si se piden: ` ^id` al final del párrafo o el título, `^id` en su línea en lo
      demás, y `^s-id` en los secretos.
    - Al leer se apartan lo de dentro de los secretos y las notas ocultas, con su id de bloque. Un secreto dentro de
      otro se deshace.
    - Se quitan los enlaces que no son http, https o mailto.
    - En el servidor no hay DOM: el HTML suelto queda como texto y no se ejecuta.
    - Si no hay propiedades y el cuerpo empieza por `---`, se escribe un YAML vacío.
  - **Prueba de ida y vuelta**: un cuerpo con todos los nodos y marcas del esquema. Falla si el esquema gana uno que la
    prueba no lleva.
  - **Límite conocido**: dos listas seguidas sin nada entre ellas se leen como una sola (pasa igual en Obsidian), salvo
    si se escriben con sus ids.
- **2026-10-30 — Módulo 1, tarea 11: Claude lee y escribe páginas.**
  - **Acciones y herramientas MCP** (`apps/server/src/actions/page-content.ts`):
    - `readPage` → `leer_pagina`: la página en Markdown, con los secretos dentro y los ids si se piden.
    - `createPages` → `crear_paginas`: hasta 50 en una operación. Van anidadas por `key` y `parent` (plano: sin
      esquemas recursivos en MCP).
    - `editPage` → `editar_pagina`: título, icono, propiedades y cuerpo, con `append`, `replace` (con su YAML),
      `block` o `section`.
  - **Propiedades de páginas**: se resuelven por título, alias o id, sin mayúsculas. Si no aparece, da
    `PAGE_NOT_FOUND`; si hay varias, `AMBIGUOUS_PAGE` con las candidatas. `InvalidRequestError` lleva ahora su
    `detail`, que la IA lee.
  - **En vivo** (`apps/server/src/wiki/content.ts`):
    - el cuerpo se cambia por `openDirectConnection` de Hocuspocus, con la diferencia justa (`updateYFragment`);
    - el servidor avisa con un mensaje sin estado de los bloques que cambió, y la web los resalta (`ai-highlight.ts`,
      con una decoración);
    - ese aviso puede llegar antes que el cambio, porque Hocuspocus junta los cambios al final de la vuelta, así que
      los ids esperan a que lleguen sus bloques;
    - a los lectores de pantalla se les dice «Claude ha cambiado la página».
  - **Secretos**:
    - un `> [!secreto]` nuevo crea su documento;
    - uno con el `^s-id` de un secreto de la página cambia ese mismo documento;
    - su texto nunca entra en el cuerpo, y lo comprueban las pruebas.
  - **Huella de partida**: la hora de la petición (`ctx.requestedAt`, al aprobar).
    - Si el cuerpo se guardó después, la respuesta dice `changedSinceRequest`.
    - Si el bloque o la sección ya no están, `failed` con `BLOCK_NOT_FOUND` o `SECTION_NOT_FOUND`.
  - **Al cambiar un bloque**, lo nuevo se queda con su id si no trae otro, así que los enlaces a él siguen valiendo.
  - **Arreglado en deshacer** (`staleChange`): una operación que toca una fila dos veces (crear una página y luego darle
    sus propiedades) se mira como quedó al final.
  - **Arreglado en el servidor**: al cerrarse guarda los documentos abiertos antes de salir (`collab.close()`). La CI
    daba un *deadlock* entre pruebas, y en producción se podía perder lo último escrito al reiniciar.
  - **El cuerpo aún no se deshace**: la operación queda en el historial, pero deshacerla solo toca la fila de la
    página. Se podrá deshacer con las versiones (tareas 16 y 17).
  - **Arreglado un ciclo** entre `markdown/syntax.ts` y `nodes/callout.ts`, que entró con la 10: los tipos de recuadro
    van ahora en `nodes/callout-kinds.ts`.
  - **Pruebas**:
    - integración: crear, leer, cambiar, secretos, errores sin dejar nada a medias, candidatas y permisos;
    - en vivo, con un cliente de Hocuspocus;
    - MCP: cada herramienta en cada modo, y la aprobación que falla o se aplica sobre lo de ahora;
    - fugas entre organizaciones;
    - e2e `claude-wiki.spec.ts`: Claude cambia una sección de la página abierta y se ve sin recargar.
- **2026-10-30 — Módulo 1, tarea 12: exportar.**
  - **Ruta** `POST /api/export`. No es una acción porque contesta con bytes: `application/zip` con su nombre en
    `content-disposition`, y como mucho 10 por minuto. Su entrada, `exportInput`, va en `packages/contracts`.
  - **`apps/server/src/wiki/export.ts`**:
    - **Rutas** dentro del .zip con el árbol de todo el mundo:
      - una página con hijas es `Título/Título.md`;
      - nombres saneados (`fileName`);
      - « (2)» entre hermanas que se llaman igual.
    - **Una rama** sale desde su carpeta; una página sola, su nota.
    - **Enlaces de las propiedades**: el título si es único en el mundo; si no, su ruta en el .zip.
    - **Cuerpos y secretos**: se cargan de una vez (`documentsWithState`); los que están abiertos, del documento
      vivo.
    - **Comprimido** con `fflate` (MIT, aprobado en el plan).
  - **Web** (`apps/web/src/wiki/export.tsx`):
    - «Exportar» en la página, que con subpáginas pregunta «Solo esta página» o «Con sus subpáginas»;
    - «Exportar la wiki» en «Más de la wiki»;
    - la descarga, con `api.exportWiki` y un enlace temporal; «Descargado: …» a los lectores de pantalla.
  - **Pruebas**:
    - integración: el mundo entero con carpetas, y cada archivo igual a lo que da `readPage`; rama, página sola,
      nombres raros, títulos repetidos y permisos;
    - e2e `exportar.spec.ts`: la descarga real, desabriendo el .zip;
    - `@fugas`: la jugadora no exporta ni usa `readPage`, `editPage` ni `createPages`.
  - **Queda para la 19**: los archivos, en `_archivos/`.
- **2026-10-30 — Módulo 1, tarea 13: enlaces por id, sin resolver y rotos.**
  - **Nodo `pageLink`** (`packages/editor/src/nodes/page-link.ts`): en línea y atómico, con `pageId`, `title`,
    `anchor` y `label`. En Markdown, `[[Título#Sección|texto]]`; al escribir lleva el título de ahora (o la ruta si se
    repite). `![[…]]` se queda como texto hasta la tarea 15.
  - **Dominio** (`packages/domain/src/links.ts`):
    - `resolveName`: por título o alias, o por una ruta «A/B»;
    - `searchNames`: por prefijo, palabra o contenido, y con erratas (Levenshtein contra el principio del nombre y de
      cada palabra, con una letra más o menos).
  - **Tabla `page_links`** (migración 0012). Se rehace con cada guardado de Hocuspocus (`onStored`, en
    `apps/server/src/wiki/links.ts`) y al crear páginas.
  - **Resolución sola** (`resolvePending`): al crear, renombrar, restaurar o dar un alias, los enlaces que esperaban
    ese nombre se resuelven en la tabla y en el texto (conexión directa).
  - **Claude**: sus `[[…]]` se resuelven al escribir. Con varias posibles, `AMBIGUOUS_PAGE` y las rutas. En una tanda,
    se pueden enlazar entre ellas en cualquier orden.
  - **Web** (`apps/web/src/wiki/page-links.tsx`):
    - **Lista de páginas**: `listPageNames`, en caché bajo `['pages', mundo]`, así que se pone al día con los avisos.
    - **Vista del enlace**, con tres estados:
      - bien;
      - «por crear»: pulsarlo la crea;
      - roto (en la papelera): «Restaurar».
    - **Intro** sobre un enlace elegido lo sigue.
    - **`[[`** sugiere y ofrece «Crear página «X»». Va también dentro de los secretos.
    - **«Enlazar con «X»»** en la barra de formato.
  - **Arreglado de paso**: `propertiesOf` pasa a `wiki/properties.ts`, para no hacer un ciclo.
  - **Pruebas**:
    - dominio (resolver y erratas) y Markdown (ida y vuelta con `pageLink`);
    - integración: en cualquier orden, en una tanda, alias, ambiguos con ruta, y papelera;
    - e2e `enlaces.spec.ts`, con a11y.
  - **Arreglado después, en la 14**: un enlace que solo llevaba el nombre se resolvía en `page_links` pero no en el
    texto. Ahora se le pone también ahí: al crear páginas, y tras cada guardado en una conexión directa aparte.
- **2026-10-30 — Módulo 1, tarea 14: entrantes, menciones y aviso al borrar.**
  - **Texto plano de cada documento**: `documents.text` (migración 0013) y `plainText`, en
    `packages/editor/src/text.ts`.
    - Se guarda con cada guardado y al crear páginas.
    - Lo que no lo tiene aún se rellena al buscar menciones.
    - Lo usará también la búsqueda (tarea 20).
  - **Acciones** (`apps/server/src/actions/links.ts`):
    - **`getPageLinks`**:
      - entrantes, con el trozo del bloque que enlaza y si sale de un secreto;
      - salientes, con su estado;
      - menciones sin enlazar: título o alias como palabra entera (`findName`), en páginas que no la enlazan.
    - **`listUnresolvedLinks`**: los sin resolver del mundo.
    - **`linkMention`**: «Enlazar» cambia la primera mención por un enlace, con su texto si no es el título.
  - **MCP `enlaces_pagina`**: con `pageId`, los de la página; con `worldId`, los sin resolver del mundo.
  - **Web**:
    - la sección «Enlaces» bajo el cuerpo (`backlinks.tsx`), con «La enlazan» y «La nombran sin enlazar», y
      «Enlazar»;
    - al borrar, «La enlazan N páginas: sus enlaces se verán rotos».
    - Su sitio a la derecha queda para la etapa de interfaz.
  - **Pruebas**:
    - integración: entrantes con su trozo y desde un secreto, salientes en sus tres estados, menciones con alias y sin
      falsos «Maela Varnes», «Enlazar» y los sin resolver;
    - MCP en cada modo;
    - e2e del panel y del aviso;
    - `@fugas` con las acciones nuevas.
- **2026-10-30 — Módulo 1, tarea 15: vista previa e incrustados.**
  - **Nodo `pageEmbed`** (`packages/editor/src/nodes/page-embed.ts`): un bloque, `![[Título#Sección]]` en su línea.
    Cuenta como enlace en `page_links` y se resuelve igual.
  - **`getPageContent`** (`apps/server/src/actions/preview.ts`):
    - la página (título, ruta, icono y resumen) y sus bloques, o los de una sección o un bloque (`^id`);
    - los secretos van con lo suyo (es la proyección del máster);
    - los incrustados de dentro se abren hasta 3 niveles, con `cycle` o `tooDeep` si no;
    - en la vista previa, los 4 primeros bloques con texto.
  - **Aviso nuevo del canal**, `pageContent`, tras cada guardado. La web vacía la caché de su contenido y de sus
    enlaces.
  - **Web**:
    - un pintor de JSON a React en solo lectura (`content.tsx`), sin editor ni Yjs; sus títulos no son encabezados;
    - **vista previa** (`preview.tsx`, en `PageLinkView`):
      - con el ratón, a los 300 ms;
      - con el teclado, al elegir el enlace con las flechas; Tab entra en ella y Escape la cierra y vuelve al texto;
      - en el móvil, un toque abre una hoja abajo con «Abrir página»;
    - **vista del incrustado** (`embed.tsx`);
    - **`![[`** en las sugerencias incrusta, y `#Sección` lleva el ancla;
    - **grupo «Wiki» en el menú «/»**: «Enlace a página» e «Incrustar página».
  - **Pruebas**:
    - integración: vista previa con resumen, sección y bloque; tres niveles y ciclo; un jugador no la ve;
    - componentes: la vista previa con Escape y en el móvil;
    - e2e `vista-previa.spec.ts`: ratón, teclado, incrustado que se pone al día, `![[`, móvil y a11y;
    - `@fugas` de `getPageContent`.
- **2026-10-30 — Módulo 1, tarea 16: sesiones de edición en el historial.**
  - **Tablas** (migración 0014):
    - `page_bodies`, en `TRACKED_TABLES`, una por página: su versión y su huella;
    - `page_versions`;
    - `snapshots`: el estado de un documento por su huella, compartido entre versiones;
    - `version_documents`.
    - En `changes` solo entran ids y huellas, nunca el texto.
  - **Huella de la página** (`apps/server/src/wiki/versions.ts`): sha256 del JSON del cuerpo y sus secretos, sin los
    ids de bloque ni el `pageId` de los enlaces. Así resolver un enlace solo, o poner ids, no da versiones falsas.
  - **Sesiones** (`apps/server/src/collab/sessions.ts`), en memoria por página y cuenta:
    - se abren con el primer cambio (`onChange`; las conexiones directas del servidor, no);
    - se cierran por inactividad (3 min), a los 15 min, al irse su última conexión, antes de una operación del
      servidor o al parar;
    - al cerrarse, lo vivo se guarda y se apunta `editPage` con su versión (`versionsRepo.recordEdit`). Si la huella
      no cambió, nada.
  - **Claude** (`editPage`): cierra antes las sesiones. Su cambio y su versión van en una sola operación, con título y
    propiedades. `createPages` deja la primera versión de cada página en la misma operación.
  - **Deshacer**: cierra antes las sesiones de las páginas cuyo `page_bodies` toca. Después aplica hacia delante la
    versión que queda (`applyVersion`, por conexión directa); si alguien escribió después, conflicto con quién.
  - **Recuperación**: al cargar el cuerpo sin sesiones abiertas, si lo guardado no es su última versión, se cierra a
    nombre del último que escribió.
  - **Dos cuentas a la vez**: la primera sesión que se cierra lleva lo de las dos; la otra no apunta nada si ya no hay
    nada nuevo. Nada se pierde; la autoría es aproximada en ese caso.
  - **Pruebas** (`sessions.integration.test.ts`):
    - agrupar y cerrar por inactividad;
    - dos cuentas y Claude a la vez, sin perder nada;
    - deshacer lo de Claude con un editor abierto, sin que vuelva lo viejo;
    - conflicto con quién;
    - recuperación tras parar.
- **2026-10-30 — Módulo 1, tarea 17: versiones de página.**
  - **Acciones** (`apps/server/src/actions/versions.ts`):
    - `listPageVersions`: quién (persona o Claude), cuándo y cuál es la de ahora;
    - `getPageVersion`: en solo lectura, con los secretos de esa versión;
    - `restorePageVersion`: cierra antes las sesiones, aplica la versión hacia delante y apunta `restoreVersion` con
      una versión nueva. Se deshace como lo demás.
  - **MCP**: `versiones_pagina` y `restaurar_version`.
  - **Purga** (en la diaria, `trashRepo.purge`): las versiones de más de 90 días, salvo:
    - las 40 últimas de cada página;
    - la de ahora;
    - las que nombra alguna operación que sigue en el historial.
    - Los estados que ya no usa ninguna versión, también se van.
    - `applyVersion` no vacía nada si la versión ya no está.
  - **Web** (`versions.tsx`): la sección «Versiones», que se abre, con «Ver» y «Restaurar». La frase del historial es
    «restauró una versión de «X»».
  - **Pruebas**:
    - integración: lista, ver con secretos, restaurar y deshacerlo; purgar con el reloj simulado (43 → 40);
      permisos;
    - MCP en cada modo;
    - e2e `versiones.spec.ts`;
    - `@fugas`.
- **2026-10-30 — Módulo 1, tarea 18: archivos del mundo** (migración 0015).
  - **Tabla `files`**, con historial: nombre único en el mundo (sin mayúsculas; si se repite, «nombre (2).ext»), tipo
    (`image`, `pdf` u `other`), tamaño, huella y clave del almacenamiento. Reemplazar pone una clave nueva: deshacer
    vuelve a los bytes de antes. Los bytes no van al historial.
  - **Almacenamiento** (`apps/server/src/files/storage.ts`): disco en `DATA_DIR/archivos`, claves `mundo/uuid`. En
    staging, el volumen «archivos» (`/data/archivos`, del usuario node).
  - **Rutas** (`files/routes.ts`):
    - `POST /api/files?worldId&name` y `PUT /api/files/:id`: el cuerpo es el archivo, en streaming, hasta 250 MB
      (`MAX_FILE_BYTES` en `@crisol/domain`). Si pasa, 413 sin romper la petición y sin dejar nada.
    - El tipo sale de los primeros bytes (`sniff`): PNG, JPEG, GIF, WebP, AVIF, PDF y SVG; lo demás, «otro», que se
      sirve como descarga. Un .png que es HTML no pasa por imagen.
    - `GET /api/files/:id`: con sesión y `page.read`; `private, no-cache` con ETag (la huella), `nosniff`, Range (para
      el visor de PDF) y, al SVG, la CSP `sandbox; default-src 'none'`.
  - **Acciones**: `listFiles`, `renameFile`, `deleteFile` y `restoreFile`; en la papelera del mundo salen los archivos.
    MCP: `listar_archivos`. Aviso en tiempo real `files`.
  - **Purga**: la fila, a los 30 días en la papelera; los bytes, cuando ya no los nombra ni una fila ni el historial (y
    nunca los escritos hace menos de un día: una subida a medias).
  - **Web** (`apps/web/src/wiki/files.tsx`, enlace «Archivos» en la wiki): subir varios o una carpeta, con botón o
    arrastrando, tres a la vez con su barra; carpetas por tipo; abrir, renombrar, reemplazar y borrar.
  - **Pruebas**: integración (límite con y sin tamaño dicho, permisos, Range, SVG, reemplazar y deshacer, papelera,
    purga), componentes, e2e `archivos.spec.ts` con accesibilidad y `@fugas` de los archivos.
  - **Queda para la 19**: el aviso «lo usan N páginas» al borrar, cuando las páginas usen archivos.
- **2026-10-30 — Módulo 1, tarea 19a: imágenes y archivos en las páginas** (migración 0016).
  - **Bloque `fileEmbed`**: una imagen (ancho, texto alternativo, pie y caja de luz), un PDF (por su página) u otro
    archivo. En Markdown, como Obsidian: `![[mapa.png|Texto alternativo|300]]`, `![[libro.pdf#page=12]]` y el pie en
    la línea siguiente, en cursiva. Se sabe que es archivo por la extensión (`.md` es una nota).
  - **`file_embeds`**: qué archivos usa cada documento, rehecha con cada guardado (como `page_links`). Lo que nombra un
    archivo que aún no está se resuelve solo al subirlo, renombrarlo o restaurarlo, también en el texto. Lo que escribe
    Claude con `![[…]]` se resuelve al momento. Renombrar no rompe nada: se enseña y se exporta el nombre de ahora.
  - **Al borrar un archivo** se avisa si lo usan páginas (`usedBy` en `listFiles`).
  - **Editor**: «Imagen o archivo» en «/» (lo sube), `![[` propone también los archivos, pegar o soltar archivos los
    sube y los pone ahí, y en un archivo que falta, «Subirlo».
  - Los nombres de archivo no llevan `[ ] | # ^`: al subir se cambian por «-».
  - **Pruebas**: Markdown de ida y vuelta, integración (resolver al subir, renombrar, Claude, papelera) y e2e
    `archivos-en-paginas.spec.ts` (con «/», pegar, «Subirlo», `![[` y accesibilidad).
- **2026-10-30 — Módulo 1, tarea 19b: visor de PDF, portada y archivos al exportar** (migración 0017).
  - **Visor de PDF** (`apps/web/src/wiki/pdf-viewer.tsx`, `pdfjs-dist`, Apache-2.0): antes enseña el nombre y el
    tamaño; pdf.js se carga al pulsar «Ver aquí» y pide los bytes a trozos (Range), así que un libro grande se abre
    por la página que toque sin bajarlo entero. Anterior, ir a una página y siguiente; abre por `#page=N`.
  - **Portada**: una imagen del mundo de cabecera con su punto de encuadre (`pages.cover`). Se elige de las del mundo
    o se sube, se encuadra con dos deslizadores y se quita; se puede deshacer y cuenta como uso del archivo. La vista
    previa la enseña pequeña. No va al Markdown (como el icono).
  - **Exportar** lleva `_archivos/`: todos los del mundo, o los que usan las páginas exportadas. El .zip se manda a
    trozos, sin cargarlo en memoria.
  - **Pruebas**: integración (exportar con archivos, portada) y e2e (PDF por la página 3 con pdf.js cargado solo al
    abrirlo; portada con el teclado y accesibilidad).
- **2026-10-30 — Módulo 1, tarea 20: búsqueda en español** (migraciones 0018 a 0020).
  - **Postgres**: `unaccent`, `pg_trgm` y `fuzzystrmatch`, y la configuración `es_unaccent` (español sin tildes).
    Cada documento se indexa por secciones (`search_sections`, lo de debajo de cada título) con cada guardado; cada
    página, por su título y sus propiedades (`pages.search_tsv`, generada). Lo de antes se indexa al buscar.
  - **Erratas**: `search_words` (las palabras de cada mundo, por triggers). Cada palabra buscada se amplía con las
    parecidas (trigramas y `levenshtein` ≤ 1, o ≤ 2 desde 6 letras) y la última, por su principio: «dargón» encuentra
    «Dragón» y «drag», también.
  - **Resultados** por página (el título pesa más), con hasta tres secciones con su extracto (lo encontrado entre
    `**`), lo de un secreto marcado, por etiqueta (con sus hijas) y por rama, de 20 en 20. Acción `searchWiki` y MCP
    `buscar_paginas`.
  - **Web**: `/mundos/:worldId/buscar?q&etiqueta&rama&pagina` y la caja de buscar en el lateral de la wiki.
  - El historial deja fuera las columnas generadas (la de búsqueda de `pages`).
  - **Pruebas**: integración («dragon», «DRAGONES», «dargón», «drag», secciones y secretos, etiqueta y rama, papelera,
    indexar lo de antes, paginada, permisos) y rendimiento con 5.000 páginas (p95 192 ms en local; < 300 exigido);
    componentes, e2e `buscar.spec.ts` con accesibilidad y `@fugas`.
- **2026-10-30 — Módulo 1, tarea 21: selector rápido, órdenes y buscar en la página.**
  - **Ctrl+K** (o Cmd+K) en cualquier pantalla de la wiki: un diálogo con combobox (ARIA). Vacío, las páginas
    recientes (las pestañas abiertas); al escribir, a los 250 ms, títulos y alias con erratas (hasta 8) y «Ver todos
    los resultados». Escape lo cierra y el foco vuelve a donde estaba.
  - **«>»** al principio: la paleta de órdenes (página nueva, buscar, archivos, etiquetas, historial y papelera).
  - **Buscar en la página**: botón encima del texto (y Ctrl+Alt+F; Ctrl+F sigue siendo del navegador). Resalta sin
    tildes ni mayúsculas, dice «n de m», Intro va a la siguiente y Mayús+Intro a la anterior. Lo de dentro de los
    secretos no entra.
  - **Pruebas**: componentes (teclado y foco), unidad de las coincidencias y e2e `selector.spec.ts` con accesibilidad.
- **2026-10-30 — Módulo 1, tarea 22: bloques de hoja.**
  - Salto de página y de columna, statblock, nota lateral (izquierda o derecha), «a lo ancho» (atributo del recuadro,
    la caja y el statblock, o un contenedor para varios bloques) e índice de contenidos. En Markdown, la tabla de la
    spec: `<div class="salto-pagina"></div>`, `> [!statblock]`, `> [!lateral|izquierda]`, `> [!ancho]`, `|ancho`,
    `> [!indice]`.
  - En la vista sencilla, discretos (los saltos solo se ven al editar). Grupo «Hoja» en el menú «/».
  - **Pruebas**: Markdown de ida y vuelta con todos y e2e `hoja.spec.ts` (con «/» y desde Markdown, con
    accesibilidad).
- **2026-10-30 — Módulo 1, tarea 23: vista de hoja** (migración 0021).
  - **«Hoja»** en las acciones de la página la activa, con sus ajustes en una fila: papel (A4 o Letter), tema
    (Pergamino, con Alegreya y una textura propia de gradientes, o Neutro), numerar y desde qué número, y pie con el
    título. Va al historial («puso «X» como hoja»).
  - **Quien lee** puede volver a la vista sencilla, y se recuerda por cuenta y página (`wiki_preferences.simple_pages`,
    acción `setPageView`). En pantallas estrechas se abre la sencilla, con «Ver la hoja».
  - **Paginación** por bloques en `@crisol/domain` (`paginate`): dos columnas (la primera se llena antes), los saltos
    fuerzan, un título va con su bloque siguiente, antes de un bloque a lo ancho se equilibran las columnas, y lo que
    no cabe ni en una página vacía va igual y la página lo avisa. Guionado en español con `hyphens: auto`.
  - La hoja pinta lo que da `getPageContent` (con secretos e incrustados) y mide cada bloque a su ancho. Índice con
    número de página y puntos guía; nota lateral flotando en su columna; statblock con el marco del tema.
  - **En escritorio ancho** (≥ 1500 px), el editor y la hoja lado a lado, sincronizados por bloque.
  - **Pruebas**: el paginador con alturas simuladas y una página grande; integración de los ajustes y de la vista de
    cada cuenta; e2e (activar, varias páginas sin que ningún bloque se salga, pie, índice, tema, volver a la sencilla y
    que se recuerde, con accesibilidad).
- **2026-10-30 — Módulo 1, tarea 24: imprimir y PDF.**
  - **Ruta de impresión** `/mundos/:worldId/imprimir/:pageId`: solo las páginas de la hoja, sin nada de la interfaz,
    con `@page` del papel elegido, cada página en su hoja y sin sombras. Las notas ocultas no salen nunca; los
    secretos, solo con «Incluir secretos».
  - **En la fila de la hoja**: «Incluir secretos», «Imprimir» (abre la ruta y el diálogo del navegador) y
    «Descargar PDF».
  - **PDF en el servidor** con `playwright-core` (Apache-2.0) y el Chromium de la imagen (`apk add chromium`, permiso
    de Enrique). Abre la ruta de impresión por dentro (`http://127.0.0.1:PUERTO`) con la cookie de quien lo pide,
    espera a que la hoja esté paginada (`data-sheet-ready`) y la imprime con su papel. De uno en uno. Sin Chromium o
    sin la web compilada, «Descargar PDF» dice que se use «Imprimir». El guardián de origen acepta también el origen
    interno (solo lo abre el propio servidor).
  - **Pruebas**: e2e con `page.pdf()` en la ruta de impresión (tantas páginas como la hoja y sin interfaz; secretos
    solo con la casilla; notas nunca) y el PDF del servidor (`%PDF`, nombre y páginas).
  - **Queda para Enrique**: la prueba a mano de imprimir en Chrome, Firefox y Safari (punto de control 6).
- **2026-10-30 — Módulo 1, tarea 25: a la escala de Eana.**
  - Prueba aparte (`CRISOL_ESCALA=1`, `apps/server/src/mcp/escala.integration.test.ts`): un mundo de 2.400 páginas
    con alias, etiquetas, secretos y enlaces cruzados (también a páginas que aún no existen), creado solo por el MCP
    con `crear_paginas` de 50 en 50.
  - **Números** (VPS, local): cada llamada de 50 páginas, mediana 2,2 s y máxima 2,4 s; ningún enlace sin resolver;
    `buscar_paginas` 149 ms y `ver_arbol` 100 ms. Al empezar eran 15 s por llamada.
  - **Lo que se cambió para llegar**:
    - los ids de las páginas se dan antes de crearlas, así que los enlaces de la tanda salen ya resueltos;
    - poner su página a lo que la esperaba no pasa por Hocuspocus si nadie tiene el documento abierto, y se escribe
      todo de una vez (`patchDocuments`);
    - indexar y rehacer los enlaces de la tanda, en una transacción cada cosa;
    - la posición de cada rama se pregunta una vez;
    - las propiedades van en el INSERT;
    - `resolveName` indexa cada lista de páginas una sola vez.
  - Las instrucciones del MCP y la descripción de `crear_paginas` explican cómo pasar una wiki entera (de 50 en 50,
    en cualquier orden, y al final `enlaces_pagina` con el mundo para ver lo que quede).
- **2026-10-30 — Módulo 1, tarea 26: cierre del módulo.** Construido entero; falta que Enrique lo revise en staging.
  - **Revisiones** (dos agentes): seguridad del servidor, y la interfaz con `web-design-guidelines`. No hay fugas entre
    mundos ni fallos de permisos.
  - **Arreglado de seguridad**:
    - una subida que no es el archivo en crudo da 415 y no deja nada abierto (dejaba descriptores abiertos);
    - Chromium arranca sin los secretos del servidor, no pide nada fuera del propio origen, tiene una cola con tope
      (2) y un plazo de 60 s, y se relanza si se cae;
    - los límites de subir, exportar y PDF van por la IP que manda Caddy (no por la del proxy);
    - las palabras de la búsqueda tienen de 3 a 64 letras (migración 0022);
    - las secciones van acotadas;
    - un documento que no se puede indexar no rompe la búsqueda.
  - **Arreglado de la interfaz**:
    - el botón de la imagen se nombra con su texto alternativo;
    - la hoja usa los colores claros en su papel;
    - las imágenes de la hoja se miden al llegar (la hoja y el PDF esperan a ellas);
    - el visor de PDF no pierde el foco y anuncia la carga;
    - los ajustes de la hoja cambian al momento y avisan si no se guardan;
    - la subida dice cuántas fallaron;
    - «Carta»;
    - la búsqueda no anuncia el total de antes.
  - **Rendimiento**: una página de unos 40 KB se abre lista para escribir en 748 ms (prueba e2e
    `rendimiento.spec.ts`, en el VPS; en la CI no se mide).
  - **Queda para Enrique** (infraestructura o producto, no se ha hecho):
    - Chromium en un contenedor aparte, sin secretos y con su sandbox (ahora va en el de la app, sin sandbox y con el
      entorno limpio);
    - una cuota de almacenamiento por organización;
    - quizá más memoria para la app si se sacan PDF grandes.
  - **Siguiente**: revisar con Enrique los criterios de éxito de la spec en staging, y la etapa de interfaz.
- **Pendientes de permiso de Enrique:**
  - Servicio de systemd para Foundry: ahora corre como proceso de la sesión y se para al cerrarla; se arranca con el
    comando de `research/foundry/entorno.md`.
- **D&D Beyond:**
  - Enrique inicia sesión él mismo en un Chromium del VPS con depuración solo en loopback (`--remote-debugging-port=9222`).
  - Desde VS Code reenvía el puerto 9222 (pestaña Ports), abre `chrome://inspect` en su Chrome, añade `localhost:9222`
    y pulsa *inspect*.
  - REA se conecta luego a esa sesión (`list_browser_targets` / `capture_browser_scenario` en modo `connect`).
  - Así se lanza el navegador. Va sin sandbox porque este Ubuntu no lo permite, como Playwright y REA:
    `xvfb-run -a -s "-screen 0 1920x1080x24" ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --no-sandbox
    --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir=$HOME/rea-workspace/chromium-ddb
    --no-first-run --window-size=1920,1080 https://www.dndbeyond.com/sign-in`.
  - Enrique entra con Google. El botón abre una ventana aparte, «Sign in - Google Accounts», que hay que abrir con su
    propio *inspect* en `chrome://inspect`. Funcionó el 2026-10-29.

Estados: pendiente · en curso · hecho · descartado.

| # | Módulo | Estado | REA principal |
|---|---|---|---|
| 0 | **Fundación**: monorepo, CI, despliegue, cuentas, organizaciones, mundos, campañas, roles, historial y deshacer, esqueleto del MCP | **hecho** (2026-10-29; Discord y Google, pospuestos) | Foundry: modelo de documentos y permisos; DDB: campañas e invitaciones |
| 1 | **Wiki**: páginas y subpáginas, editor de bloques, enlaces, menciones, vista previa, propiedades, secretos, búsqueda, marcadores, etiquetas, versiones, recursos y archivos, **hojas con estilo** (tipo Homebrewery, con PDF), exportación MD, sus herramientas MCP | construido (tareas 1 a 26 hechas); falta la revisión de Enrique en staging | Foundry: Journal; DDB: contenido y referencias; Homebrewery (MIT): formato de hoja y descarga |
| 2 | Tipos de página, plantillas y formularios nativos; consultas (en lugar de Dataview y Bases) | pendiente | Foundry: tipos de documento |
| 3 | Sistemas de reglas, fichas de personaje (creación, subida de nivel), dados y dados 3D | pendiente | DDB: creador y hoja; Foundry: dnd5e, DataModel e instalar y crear sistemas |
| 4 | Compendios, bestiario, statblocks, biblioteca | pendiente | Foundry: compendium packs; DDB: listados |
| 5 | Visibilidad por campaña: conocimiento de los jugadores, revelar, compartir | pendiente | Foundry: ownership |
| 6 | **Mesa**: escenas, rejilla, fichas, medir y plantillas, niebla, muros, puertas, luz, visión, iniciativa, instantáneas, encuentros, UVTT | pendiente | Foundry: canvas, visión y muros; DDB Maps |
| 7 | **Sala de jugadores**: presencia, chat y susurros, mostrar a jugadores, sonido, controles del máster | pendiente | Foundry: sockets y chat; DDB: game log |
| 8 | Calendario, clima, viajes, líneas temporales | pendiente | — |
| 9 | Mapas de mundo con pines y capas; pizarras | pendiente | DDB Maps |
| 10 | Otras herramientas: tableros, gráficos, grafo de relaciones, nombres, centro de actividad | pendiente | — |
| 11 | Pagos y planes del SaaS | pendiente | — |

Cada módulo nace con su API y sus herramientas MCP.

**Entre el 0 y el 1, fase de diseño** (decidido con Enrique, 2026-10-29). La interfaz del módulo 0 funciona y es
accesible, pero no tiene un diseño visual pensado. Antes de la wiki, que es lo más visual:
- Identidad (tipografía, paleta, tono).
- Kit de componentes.
- Repaso de las pantallas del 0.

Se hace con la skill `frontend-design` de Anthropic (Apache-2.0): plugin `frontend-design@claude-plugins-official`,
activado en el proyecto (`.claude/settings.json`).

De las de Vercel (`vercel-labs/agent-skills`, MIT) sirven cuatro, copiadas en `.claude/skills/` (origen y licencia en
su `README.md`):
- `web-design-guidelines`: revisar la interfaz contra sus Web Interface Guidelines.
- `react-best-practices` y `composition-patterns`: rendimiento y forma de los componentes de React.
- `react-view-transitions`: animaciones entre pantallas, más adelante.

Identidad elegida (2026-10-29): **Hoja**, la séptima del lienzo, pedida como «rollo dndbeyond». Del género se toma
el aire (cajas de hoja de personaje, títulos condensados en mayúsculas, rojo fuerte), nunca colores, letras ni piezas
de D&D Beyond. Oscuro o claro según el sistema, con el botón para cambiarlo.

Las de desplegar en Vercel y React Native no aplican. Desde entonces, cada módulo lleva un paso de diseño entre la spec
y el plan (ver `CLAUDE.md`).

## Para el repaso final de la interfaz

Lo que a Enrique no le convence (apuntarlo aquí según lo diga). Se repasa al acabar el módulo 1, no al final de la
app: el 2026-10-30 dijo «luego apuntaremos por donde vamos y nos dedicaremos a la UI, que es horrible».

- La interfaz en general, sin concretar aún: se verá con él al empezar esa etapa.

## Decisiones por módulo

### 0. Fundación (repaso con Enrique, 2026-10-29)

- **Para quién**: al principio solo Enrique (único máster) y sus jugadores de Fateforge. Nadie más hasta los pagos
  (módulo 11). Sin registro abierto: se entra por invitación.
- **Inquilinos**: el modelo de datos admite varias organizaciones desde el primer día, pero la interfaz solo maneja
  una. Una cuenta puede estar en varias organizaciones y campañas.
- **Roles**: el módulo 0 solo tiene **máster** y **jugador**. El rol se guarda en cada pertenencia para añadir más
  tarde co-máster y espectador sin migrar.
- **Invitaciones**: un **enlace por campaña** que el máster manda por WhatsApp o Discord. Al abrirlo, el jugador entra
  con Google, Discord o email + contraseña y queda en la campaña. Sin invitación por email, sin códigos y sin acceso de
  invitado.
- **Historial y deshacer**: cada cambio queda apuntado con quién (persona o IA), cuándo y antes/después, agrupado por
  operación; se deshace una operación entera. Historial 90 días; papelera 30 días. Versiones de página y el Ctrl+Z del
  editor llegan con la wiki (módulo 1).
- **MCP**: el máster conecta Claude por OAuth con su cuenta (sin Dex ni pasarela) y Claude actúa con sus permisos.
  Herramientas: ver mundos, campañas y miembros; crear mundo y campaña; generar enlace de invitación; ver historial y
  deshacer. Los tres modos de IA (solo lectura, asistente, copiloto) y la cola de aprobación ya funcionan.
- **Fuera del módulo 0**: co-máster, espectador, invitado, registro abierto, invitación por email, varias
  organizaciones en la interfaz, pagos, versiones de página, Claude de los jugadores, prompts/recursos/skills MCP.
- **Hecho cuando**: Enrique crea Eana y dos campañas; un jugador entra con el enlace y solo está en la suya; Claude
  crea una campaña desde claude.ai y Enrique la deshace; todo desplegado en `neo.crisol…` con la CI en verde.

### Ideas de Enrique para módulos siguientes (2026-10-29, para repasar en su entrevista)

- **Sistemas (módulo 3)**: al crear un mundo se elige su sistema, como en Foundry. Los sistemas se instalan antes y
  también se pueden crear, con una forma parecida a la de Foundry (un paquete con su manifiesto y su modelo de datos).
  - Toca lo ya hecho en el módulo 0: crear un mundo pedirá el sistema, y los mundos que ya existan tendrán uno por
    defecto.
  - Sala limpia: de Foundry se estudia cómo lo resuelve (manifiesto, DataModel, instalación, actualizaciones). Si nos
    conviene ser compatibles con su formato de sistemas se decide en la entrevista; su código no entra, ni los sistemas
    de su comunidad, que llevan cada uno su licencia y están escritos contra su API.
  - El Crisol actual ya guarda el sistema como datos (`.crisol/sistema.json`, con herramientas para crearlo, validarlo y
    probar tiradas): repasarlo en `docs/inventario.md` § 5.
- **Creador de personajes y hoja (módulo 3)**: de D&D Beyond, son lo fundamental (Enrique, 2026-10-29). En el módulo 3
  se estudian a fondo con REA: el paso a paso del creador, subir de nivel, la hoja en escritorio y en el móvil,
  tiradas desde la hoja, y cómo se ven y se gestionan los recursos y el inventario. Se estudian en la cuenta de
  Enrique, solo mirando. La sesión queda en el perfil del Chromium del VPS (`~/rea-workspace/chromium-ddb`); si ha
  caducado, Enrique vuelve a entrar como en «D&D Beyond», más arriba.
- **Hojas con estilo (módulo 1)**: que las páginas de la wiki tengan el formato de las hojas de rol (dos columnas,
  pergamino, statblocks, notas al margen) y se puedan descargar, al estilo de
  [Homebrewery](https://github.com/naturalcrit/homebrewery).
  - Homebrewery tiene licencia MIT: su código se puede leer directamente y aprovechar con su atribución. REA sirve para
    ver en la web cómo pagina e imprime.
  - Cuidado con su tema 5e: las fuentes y las imágenes llevan licencias propias (varias CC BY-SA, que `CONSTRAINTS.md`
    no admite) e imitan el aspecto de los libros de WotC. Para un producto de pago, un tema propio con ese aire,
    fuentes libres (OFL) y descarga en PDF y para imprimir.

### 1. Wiki (entrevista con Enrique, 2026-10-29)

- **Para qué**: la wiki completa del Crisol nuevo. No se usa de verdad hasta que la app esté terminada: mientras, Eana
  sigue en el Crisol actual y no se pasa nada.
- **Sin importador**: al migrar, Eana se pasa con Claude por el MCP. Las herramientas MCP de la wiki tienen que bastar
  para crear y editar páginas con subpáginas, propiedades, enlaces, secretos y archivos, y a buen ritmo (muchas
  páginas).
- **Entra todo lo de la wiki del Crisol actual** (`docs/inventario.md` § 2):
  - árbol de páginas y subpáginas, recolocar, pestañas, selector rápido, paleta de órdenes;
  - búsqueda, marcadores con grupos, etiquetas, enlaces entrantes, índice del documento;
  - menciones sin enlazar, vista previa al pasar el ratón, incrustados, migas de pan;
  - portada, título en línea, propiedades, candado de lectura;
  - editor de bloques con su menú «/»: texto, títulos, listas, casillas, cita, código, tabla, separador, secreto,
    callout, caja, enlace o página nueva, nota oculta, imagen;
  - versiones con restaurar, recursos y archivos, visor de PDF, exportar a Markdown.
- **Hojas con estilo**:
  - Cada página puede activar el formato de hoja de rol: dos columnas, aire de pergamino, statblocks y notas al margen.
  - Siempre hay una vista sencilla, más fácil de leer.
  - El máster elige por página si se ve como hoja, y quien lee puede volver a la sencilla.
  - Se descarga en PDF o se imprime.
  - Referencia: el repositorio de Homebrewery (MIT, código aprovechable con atribución). Tema propio con fuentes OFL;
    nada de su tema 5e.
- **Fuera del módulo 1**:
  - el importador;
  - editar en Markdown a mano: el texto vive en la base de datos y para eso está exportar;
  - los bloques de mapa, línea temporal y tirada (módulos 9, 8 y 3);
  - las consultas tipo Dataview y Bases (módulo 2);
  - que los jugadores lean la wiki: hasta el módulo 5 es solo del máster;
  - el pulido de la interfaz, que va al final.
- **Secretos**: se escriben ya y se ven marcados como secretos. Se guardan aparte desde el principio, para que el
  módulo 5 los proyecte por jugador sin rehacer nada (ADR-0003).
- **Hecho cuando**:
  - En staging, Enrique crea y edita páginas de prueba con todo lo anterior y las ve en las dos vistas.
  - Saca el PDF de una hoja.
  - Claude crea y edita desde claude.ai páginas con subpáginas, propiedades, enlaces y secretos.
