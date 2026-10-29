# Módulos

Orden de trabajo y estado. Antes de empezar cada módulo se repasa con Enrique frente a `docs/inventario.md`: qué se
queda, qué se recorta y qué se descarta. Las decisiones se apuntan aquí.

## Dónde estamos

Actualiza esta sección al acabar cada sesión: es lo primero que lee la siguiente.

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
  - Plan aprobado: `tasks/plan.md` y 25 tareas en `tasks/todo.md`.
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
- **Siguiente paso: módulo 1**, en este orden, cada uno con su PR de documentación (rama corta → CI → merge):
  1. ~~ADR-0003, Yjs y secretos~~: hecho.
  2. ~~REA dirigido~~: hecho (Homebrewery, Foundry Journal y D&D Beyond).
  3. **Spec** `docs/specs/wiki.md` con `/spec` (skill `spec-driven-development`), para que Enrique la apruebe.
  4. **Diseño** con `frontend-design`: prototipos en el lienzo de claude.ai (el de las direcciones u otro nuevo) del
     árbol, la página en vista sencilla y en hoja, el editor y la búsqueda. Enrique los aprueba.
  5. `/plan` con tareas en `tasks/`, y luego `/build`, `/agent-skills:review` y `/ship`, como en el módulo 0.
- Queda una ventana pequeña en el tiempo real: lo que cambie entre la primera carga de una página y la conexión del
  canal no se ve hasta volver a la pestaña. Taparla costaría volver a pedirlo todo al conectar la primera vez.
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
| 1 | **Wiki**: páginas y subpáginas, editor de bloques, enlaces, menciones, vista previa, propiedades, secretos, búsqueda, marcadores, etiquetas, versiones, recursos y archivos, **hojas con estilo** (tipo Homebrewery, con PDF), exportación MD, sus herramientas MCP | en curso (entrevista hecha) | Foundry: Journal; DDB: contenido y referencias; Homebrewery (MIT): formato de hoja y descarga |
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

Lo que a Enrique no le convence y se deja para cuando la app esté terminada (apuntarlo aquí según lo diga):

- (de momento, sin concretar)

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
