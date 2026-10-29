# Tareas: Módulo 0 — Fundación

Plan: `tasks/plan.md` · Spec: `docs/specs/fundacion.md`. Cada tarea: rama corta → TDD → PR → merge con CI verde.
Comprobación local al acabar cada tarea: `pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm e2e` si toca interfaz).

## Fase 1: Plataforma

- [x] **1. Esqueleto del monorepo con sala limpia y licencias**
  - Acepta:
    - `pnpm install && pnpm lint && pnpm typecheck && pnpm test` en verde.
    - La prueba de sala limpia falla con un fichero de ejemplo que importa `research/`.
    - El script de licencias falla con un paquete GPL de ejemplo.
  - Comprueba: los comandos anteriores, con los dos casos de fallo cubiertos por pruebas.
  - Archivos:
    - `package.json`, `pnpm-workspace.yaml`, `turbo.json`.
    - `biome.json`, `tsconfig.base.json`.
    - `scripts/licencias.ts` (+ prueba), `scripts/sala-limpia.test.ts`.

- [x] **2. CI con todo el listón**
  - Acepta:
    - Un PR muestra: Biome, `tsc`, Vitest con cobertura, gitleaks, licencias, sala limpia, semgrep, osv-scanner y
      dependency-cruiser.
    - Las comprobaciones que avisan pasan a bloquear solas a partir del 2026-11-12.
    - Reglas de límites: el cliente no importa el servidor; el dominio no importa React ni Fastify; nada importa
      `research/`.
  - Comprueba: un PR de prueba con un fallo a propósito queda en rojo; quitándolo, en verde.
  - Archivos: `.github/workflows/ci.yml`, `.dependency-cruiser.cjs`, `scripts/cobertura-diff.ts`.
  - Pide a Enrique: proteger `main`.

- [x] **3. Servidor, base de datos y Compose de desarrollo**
  - Acepta:
    - `pnpm dev` levanta Postgres 17, Valkey y Mailpit (en loopback), y el servidor.
    - `GET /api/health` da 200 si Postgres y Valkey responden, y 503 si no.
    - La configuración se valida con zod al arrancar.
    - La primera migración activa `unaccent` y `pg_trgm`.
  - Comprueba: prueba de integración contra Postgres real, en local y en la CI (contenedores de servicio).
  - Archivos: `compose.yaml`, `apps/server/src/{app,config}.ts`, `packages/db/{drizzle.config.ts,src/client.ts}`,
    `.env.example`.

- [x] **4. Web mínima servida por el servidor, e2e y axe**
  - Acepta:
    - React + TanStack Router y Query + i18next (español) + temas claro y oscuro.
    - En producción la sirve el servidor, con vuelta al SPA.
    - La e2e abre `/` en los dos temas y axe no da fallos críticos ni graves.
  - Comprueba: `pnpm e2e` en local y en la CI.
  - Archivos: `apps/web/src/{main,router,i18n}.tsx`, `apps/web/src/estilos/tokens.css`, `apps/server/src/web.ts`,
    `e2e/inicio.spec.ts`.

- [x] **5. Imagen Docker y staging** — permiso de Caddy dado por Enrique el 2026-10-29
  - Acepta:
    - Imagen de varias etapas.
    - `compose.prod.yaml` con la app, Postgres y Valkey solo en loopback y con límites de memoria.
    - `scripts/desplegar-staging.sh` construye, migra, reinicia y comprueba `/api/health`.
    - El sitio de Caddy sirve `https://neo.crisol.144-91-122-245.sslip.io`.
  - Comprueba: `/api/health` desde fuera; `ss -ltnp` sin puertos nuevos expuestos; desplegar dos veces seguidas no
    rompe nada.
  - Archivos: `Dockerfile`, `compose.prod.yaml`, `scripts/desplegar-staging.sh`, sitio de Caddy (fuera del repo).

### Punto de control 1
- [ ] CI en verde; staging responde; Enrique lo ha visto.

## Fase 2: Cuentas

- [x] **6. Arranque y cuenta del propietario (servidor)** — el registro ya queda cerrado aquí (puerta en `auth/signup-gate.ts`)
  - Acepta:
    - Better Auth con Drizzle, sesiones en Postgres (30 días que se renuevan), cookies `HttpOnly`, `Secure` y
      `SameSite=Lax`, y límite de intentos.
    - `pnpm crisol arranque --org "…"` crea la organización y un enlace de un solo uso (hash, 24 h).
    - Con ese enlace se crea la cuenta y queda como `propietario`.
    - El enlace no sirve dos veces.
  - Comprueba: pruebas de integración (arranque, alta, reutilización rechazada, la sesión sobrevive a un reinicio).
  - Archivos: `packages/db/src/schema/{auth,organizaciones}.ts`, `apps/server/src/auth.ts`,
    `apps/server/src/cli/arranque.ts`.

- [x] **7. Entrar, salir y arranque en la web**
  - Acepta:
    - Páginas de entrar, de arranque y de perfil (nombre visible); botón de salir.
    - Errores claros y sin decir si el email existe.
  - Comprueba: e2e de arranque → crear cuenta → salir → entrar; axe.
  - Archivos: `apps/web/src/rutas/{entrar,arranque,perfil}.tsx`, `e2e/cuentas.spec.ts`.

- [x] **8. Registro cerrado: pase de alta** — la puerta se hizo en la tarea 6; el pase por cookie (alta social e invitaciones) va con las tareas 14 y 15
  - Acepta:
    - Un gancho de Better Auth rechaza crear usuarios sin un «pase de alta», una cookie firmada de vida corta que se
      pone al abrir un enlace válido (de arranque o de invitación).
    - Cubre el alta por email y la social.
  - Comprueba: una prueba por cada vía de alta, con y sin pase.
  - Archivos: `apps/server/src/auth/pase-de-alta.ts` (+ prueba), `apps/server/src/auth.ts`.
  - Antes: confirmar en la documentación de Better Auth que el gancho ve la petición también en el alta social (si no,
    alta social implícita desactivada).

## Fase 3: Inquilinos (con historial desde la primera escritura)

- [x] **9. Núcleo de escritura: políticas, operaciones y mundos**
  - Acepta:
    - `defineAction` en `contracts` y la ruta genérica `POST /api/actions/:name` con OpenAPI.
    - Tabla de capacidades → roles por ámbito en `domain`, y el actor cargado en cada petición.
    - `operation()` en `db`: transacción, cambios con antes y después, `version` y autoría en cada fila.
    - Acciones `createWorld` y `renameWorld`.
    - El arranque (tarea 6) pasa también por `operation()`: crea organización y pertenencia.
  - Comprueba:
    - Matriz de políticas (propietario, miembro, máster, jugador y ajeno × acción × misma u otra organización).
    - Crear un mundo da 1 operación con 2 cambios.
    - Un fallo a mitad no deja nada.
    - Ninguna escritura de Drizzle fuera de `db` (dependency-cruiser).
  - Archivos: `packages/contracts/src/{acciones,mundos}.ts`, `packages/domain/src/politicas.ts`,
    `packages/db/src/{operacion.ts,schema/mundos.ts}`, `apps/server/src/acciones.ts`.

- [ ] **10. Mundos en la interfaz**
  - Acepta: «Mis mundos» con crear y renombrar, desde un cliente tipado sacado de los contratos.
  - Comprueba: e2e + axe.
  - Archivos: `apps/web/src/{cliente.ts,rutas/mundos.tsx}`, `e2e/mundos.spec.ts`.

- [ ] **11. MCP con OAuth y `listar_mundos`, probado desde claude.ai**
  - Acepta:
    - Plugins `mcp`, `jwt` y `cimd` de Better Auth, con páginas de entrar y de consentimiento.
    - `/mcp` con Streamable HTTP; sin token responde 401 con los metadatos del recurso.
    - Solo el propietario puede autorizar.
    - La herramienta sale del contrato y pasa por la proyección.
  - Comprueba:
    - Prueba con un cliente del SDK (OAuth + herramienta).
    - Un no propietario recibe un rechazo.
    - **Enrique añade el conector en claude.ai y le pide los mundos.**
  - Archivos: `apps/server/src/mcp/{servidor,herramientas}.ts`, `apps/server/src/auth.ts`,
    `apps/web/src/rutas/consentimiento.tsx`.

### Punto de control 2
- [ ] Claude lista los mundos desde claude.ai; el historial registra cada escritura.

- [ ] **12. Campañas**
  - Acepta: `createCampaign` y `renameCampaign`; quien la crea queda como `master` en `campaign_members`; página del
    mundo con sus campañas.
  - Comprueba: políticas, integración y e2e.
  - Archivos: `packages/contracts/src/campanas.ts`, `packages/db/src/schema/campanas.ts`,
    `apps/server/src/servicios/campanas.ts`, `apps/web/src/rutas/mundo.tsx`.

- [ ] **13. Enlace de invitación: gestión**
  - Acepta:
    - Secreto de 256 bits y solo su hash en la base de datos, uno activo por campaña.
    - Ver el enlace, «Nuevo enlace» (con aviso) y abrir o cerrar las invitaciones.
    - La fecha y el número de entradas a la vista.
    - Un jugador no ve el enlace.
  - Comprueba: regenerar invalida el anterior; nada en claro en la base de datos; políticas.
  - Archivos: `packages/contracts/src/invitaciones.ts`, `packages/db/src/schema/invitaciones.ts`,
    `apps/server/src/servicios/invitaciones.ts`, `apps/web/src/rutas/campana.tsx`.

- [ ] **14. Unirse con el enlace**
  - Acepta:
    - `/unirse/:secreto` no cambia nada al abrirse (GET); vista previa genérica y `noindex`.
    - Confirmar es un POST.
    - Sin sesión: alta o entrada con pase y vuelta sola a la confirmación.
    - Si ya es miembro, a la campaña; si es el máster, aviso.
    - El mismo error para un enlace desconocido, anulado o cerrado, con límite de intentos.
  - Comprueba: e2e de jugador nuevo con email; un GET como el de un bot no une a nadie; enlace cerrado o regenerado.
  - Archivos: `apps/server/src/servicios/unirse.ts`, `apps/web/src/rutas/unirse.tsx`, `e2e/unirse.spec.ts`.

- [ ] **15. Discord y Google, vinculación de cuentas** — **necesita las apps OAuth de Enrique y las preguntas 1 y 2**
  - Acepta:
    - Cada proveedor se activa por `.env`.
    - Se vincula solo con emails verificados en los dos lados.
    - Se vuelve a la confirmación tras OAuth.
    - Aviso de navegador integrado con «Abrir en el navegador».
  - Comprueba: pruebas de las reglas de vinculación y de detección del navegador integrado; prueba manual en staging
    con Discord.
  - Archivos: `apps/server/src/auth.ts`, `apps/web/src/componentes/navegador-integrado.tsx` (+ prueba).

- [ ] **16. Miembros: ver, expulsar y salir**
  - Acepta:
    - El máster ve los miembros y expulsa; el jugador ve a sus compañeros y puede salir.
    - Si a alguien no le queda ninguna campaña en la organización, deja de ser miembro de ella.
  - Comprueba: políticas, integración y e2e.
  - Archivos: `packages/contracts/src/miembros.ts`, `apps/server/src/servicios/miembros.ts`,
    `apps/web/src/rutas/campana.tsx`.

- [ ] **17. Canal en tiempo real proyectado y revocación**
  - Acepta:
    - WebSocket por sesión, con un bus en el proceso; cada evento pasa la política de su destinatario.
    - Expulsar, salir o cambiar un rol cierra las suscripciones de esa cuenta en ese ámbito.
    - El máster recibe el aviso «X ha entrado» y el cliente invalida sus consultas.
  - Comprueba: un expulsado con el socket abierto deja de recibir y de poder escribir; aviso de entrada.
  - Archivos: `apps/server/src/tiempo-real.ts` (+ prueba), `apps/web/src/tiempo-real.ts`.

- [ ] **18. Prueba de fugas en la CI**
  - Acepta:
    - Un jugador captura las respuestas HTTP y los mensajes del WebSocket mientras el máster crea la campaña B,
      regenera enlaces y deshace.
    - No aparecen ni el nombre ni el id de B, ni secretos de enlace, ni el historial.
    - Un jugador no puede autorizar el MCP.
  - Comprueba: la prueba bloquea en la CI y falla si se mete una fuga a propósito.
  - Archivos: `e2e/fugas.spec.ts`, `.github/workflows/ci.yml`.

### Punto de control 3
- [ ] Criterios 2 y 3 de la spec, en staging.

## Fase 4: Historial

- [ ] **19. Ver el historial**
  - Acepta: lista de operaciones (quién, cuándo, por dónde, herramienta, resumen) por mundo para su máster y de toda
    la organización para el propietario, con paginación.
  - Comprueba: políticas (un jugador no lo ve), integración y e2e.
  - Archivos: `packages/contracts/src/historial.ts`, `apps/server/src/servicios/historial.ts`,
    `apps/web/src/rutas/historial.tsx`.

- [ ] **20. Deshacer una operación**
  - Acepta:
    - Aplica los cambios inversos como una operación nueva (que a su vez se puede deshacer).
    - Si hay conflicto de versión, no toca nada y dice qué operación posterior lo causó.
    - Pasa por la política con los permisos actuales.
  - Comprueba: pruebas de dominio (crear, renombrar, unir o expulsar, deshacer lo deshecho, conflicto) y e2e.
  - Archivos: `packages/domain/src/deshacer.ts` (+ prueba), `packages/db/src/operacion.ts`,
    `apps/web/src/rutas/historial.tsx`.

- [ ] **21. Papelera y purgas**
  - Acepta:
    - Borrar un mundo o una campaña es un borrado blando que desaparece de las vistas.
    - Papelera con «Restaurar» (la misma fila).
    - Trabajos diarios de BullMQ: purgar la papelera pasados 30 días y las operaciones pasados 90.
  - Comprueba: pruebas con reloj simulado; e2e de borrar y restaurar.
  - Archivos: `apps/server/src/servicios/papelera.ts`, `apps/server/src/trabajos/purgas.ts` (+ prueba),
    `apps/web/src/rutas/papelera.tsx`.

### Punto de control 4
- [ ] Criterios 5 y 6 de la spec.

## Fase 5: IA

- [ ] **22. Modos de IA y cola de aprobación (servidor)**
  - Acepta:
    - Modo por usuario (copiloto por defecto) y la decisión según modo y tipo de acción.
    - Aprobaciones en Postgres.
    - La herramienta espera 15 s y luego contesta «esperando la aprobación»; caduca a las 24 h.
    - Al aprobarse se ejecuta con la identidad del usuario y queda en el historial como hecho por la IA.
  - Comprueba: pruebas de cada modo × tipo, de espera, caducidad (reloj simulado), aprobar y rechazar.
  - Archivos: `packages/domain/src/modos-ia.ts`, `packages/db/src/schema/aprobaciones.ts`,
    `apps/server/src/mcp/aprobaciones.ts`.

- [ ] **23. Cola y ajustes de IA en la interfaz**
  - Acepta:
    - Ajustes de IA (modo y dirección del conector).
    - Cola siempre a mano cuando hay algo pendiente, en menos de 2 s y sin recargar, con el detalle.
    - Aprobar o rechazar.
  - Comprueba: e2e (una acción de la IA pendiente aparece; se aprueba y se hace) + axe.
  - Archivos: `apps/web/src/rutas/ajustes-ia.tsx`, `apps/web/src/componentes/cola-aprobacion.tsx`,
    `e2e/aprobaciones.spec.ts`.

- [ ] **24. Resto de herramientas MCP**
  - Acepta: `ver_campana`, `crear_mundo`, `crear_campana`, `enlace_invitacion`, `ver_historial`, `deshacer` y
    `pendientes`, sacadas de los contratos y con su tipo.
  - Comprueba: prueba con el cliente del SDK por herramienta × modo, y la proyección (lo que no se ve no sale).
  - Archivos: `apps/server/src/mcp/herramientas.ts`, `packages/contracts/src/*.ts`.

- [ ] **25. Cierre: criterios de éxito en staging, revisión y entrega**
  - Acepta:
    - Los 8 criterios de la spec recorridos con Enrique en staging (claude.ai real) y el LCP medido.
    - `/agent-skills:review` sin hallazgos altos.
    - `docs/modulos.md` al día.
  - Comprueba: lista de criterios marcada en este archivo.
  - Archivos: `docs/modulos.md`, `README.md`.

### Punto de control final
- [ ] Todos los criterios de éxito; módulo 0 marcado como hecho en `docs/modulos.md`.
