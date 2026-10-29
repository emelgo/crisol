# Módulos

Orden de trabajo y estado. Antes de empezar cada módulo se repasa con Enrique frente a `docs/inventario.md`: qué se
queda, qué se recorta y qué se descarta. Las decisiones se apuntan aquí.

## Dónde estamos

Actualiza esta sección al acabar cada sesión: es lo primero que lee la siguiente.

- **2026-10-29 — Fase 0 hecha.**
  - Repo, normas (`CLAUDE.md`, `CONSTRAINTS.md`), inventario, ADR-0001 y skills de agent-skills en el proyecto.
  - REA arreglado (navegador).
  - Foundry 14.369 instalado para el REA (`research/foundry/entorno.md`).
- **Siguiente paso: repaso del módulo 0 (Fundación) con Enrique**, con la skill `interview-me`, frente al inventario
  (sección «Cuentas y multiusuario» y la 14, IA/MCP). Preguntas abiertas:
  - Co-máster: ¿sí o no? Roles exactos.
  - Invitaciones: ¿enlace, email o código?
  - ¿Un jugador puede estar en varias campañas u organizaciones?
  - Alcance del historial y el deshacer.
  - Qué herramientas MCP mínimas entran en el módulo 0.
- **Después**, en este orden:
  1. REA dirigido: Foundry (modelo de documentos, permisos/ownership, usuarios, sockets) y D&D Beyond (campañas,
     invitaciones).
  2. `/spec` del módulo 0 en `docs/specs/fundacion.md`.
  3. `/plan` y `/build`. La primera porción es el monorepo con la CI, para que los PR tengan comprobaciones.
- **Pendientes de permiso de Enrique:**
  - Sitio de Caddy `neo.crisol.144-91-122-245.sslip.io` (cuando haya algo que desplegar).
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
