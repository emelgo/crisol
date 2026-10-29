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
- **2026-10-29 — Módulo 0 en curso: tareas 1 a 14 y 16 a 18 hechas** (PR #2 a #22). Staging en
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
  - Puntos de control 1 y 2 superados: Enrique tiene su cuenta de propietario en staging (organización
    «Fateforge», mundo «Eana») y conectó claude.ai (cliente CIMD `https://claude.ai/oauth/mcp-oauth-client-metadata`).
  - GitHub gratis no protege ramas privadas: se fusiona solo con los 4 check-runs del commit en verde, esperando con
    un bucle con tope (un runner colgado dejó `gh pr checks --watch` esperando sin fin; ahora hay timeout-minutes).
  - MIT-0 admitida en `CONSTRAINTS.md`.
  - Puertos: desarrollo 8130 (servidor), 5173 (Vite), 54330 (Postgres), 63790 (Valkey), 10250/8250 (Mailpit);
    e2e 8131; prueba del MCP 8132; staging 8140.
- **Siguiente paso: punto de control 3 con Enrique en staging** (criterios 2 y 3 de la spec, salvo entrar con
  Discord, que llega con la 15): crear una segunda campaña, abrir el enlace de una como jugador en otro navegador
  (o en privado), ver que solo está esa, ver el aviso «X ha entrado», regenerar el enlace y comprobar que el viejo
  ya no vale, cerrar las invitaciones y expulsar. Después: la **19** (ver el historial) o la **15** (Discord y
  Google) si Enrique ya tiene las apps OAuth y ha decidido el correo (preguntas 1 y 2 de la spec).
- **Antes del módulo 1**: ADR sobre Yjs y secretos. Yjs no puede proyectar por usuario, así que el contenido con otra
  visibilidad tiene que ir en documentos o subdocumentos aparte (ver la nota de sincronización de Foundry).
- **Pendientes de permiso de Enrique:**
  - Servicio de systemd para Foundry: ahora corre como proceso de la sesión y se para al cerrarla; se arranca con el
    comando de `research/foundry/entorno.md`.
- **D&D Beyond:**
  - Enrique inicia sesión él mismo en un Chromium del VPS con depuración solo en loopback (`--remote-debugging-port=9222`).
  - Desde VS Code reenvía el puerto 9222 (pestaña Ports), abre `chrome://inspect` en su Chrome, añade `localhost:9222`
    y pulsa *inspect*.
  - REA se conecta luego a esa sesión (`list_browser_targets` / `capture_browser_scenario` en modo `connect`).

Estados: pendiente · en curso · hecho · descartado.

| # | Módulo | Estado | REA principal |
|---|---|---|---|
| 0 | **Fundación**: monorepo, CI, despliegue, cuentas, organizaciones, mundos, campañas, roles, historial y deshacer, esqueleto del MCP | pendiente | Foundry: modelo de documentos y permisos; DDB: campañas e invitaciones |
| 1 | **Wiki**: páginas y subpáginas, editor de bloques, enlaces, menciones, vista previa, propiedades, secretos, búsqueda, marcadores, etiquetas, versiones, recursos y archivos, **importador de Eana**, exportación MD | pendiente | Foundry: Journal; DDB: contenido y referencias |
| 2 | Tipos de página, plantillas y formularios nativos; consultas (en lugar de Dataview y Bases) | pendiente | Foundry: tipos de documento |
| 3 | Sistemas de reglas, fichas de personaje (creación, subida de nivel), dados y dados 3D | pendiente | DDB: creador y hoja; Foundry: dnd5e y DataModel |
| 4 | Compendios, bestiario, statblocks, biblioteca | pendiente | Foundry: compendium packs; DDB: listados |
| 5 | Visibilidad por campaña: conocimiento de los jugadores, revelar, compartir | pendiente | Foundry: ownership |
| 6 | **Mesa**: escenas, rejilla, fichas, medir y plantillas, niebla, muros, puertas, luz, visión, iniciativa, instantáneas, encuentros, UVTT | pendiente | Foundry: canvas, visión y muros; DDB Maps |
| 7 | **Sala de jugadores**: presencia, chat y susurros, mostrar a jugadores, sonido, controles del máster | pendiente | Foundry: sockets y chat; DDB: game log |
| 8 | Calendario, clima, viajes, líneas temporales | pendiente | — |
| 9 | Mapas de mundo con pines y capas; pizarras | pendiente | DDB Maps |
| 10 | Otras herramientas: tableros, gráficos, grafo de relaciones, nombres, centro de actividad | pendiente | — |
| 11 | Pagos y planes del SaaS | pendiente | — |

Cada módulo nace con su API y sus herramientas MCP.

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
