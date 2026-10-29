# Plan: Módulo 0 — Fundación

Spec: `docs/specs/fundacion.md` (aprobada) · ADR: 0001, 0002 · Tareas con detalle: `tasks/todo.md` · Fecha: 2026-10-29

## Resumen

Se construye en cinco fases, que siguen el mapa de capacidades de la spec. Cada tarea es una porción vertical
(datos, servicio, API, interfaz y pruebas) con su propia rama y su PR, que se fusiona con la CI en verde. Lo más
arriesgado va pronto: el núcleo de escritura (políticas e historial) y la conexión real de claude.ai por OAuth.

## Decisiones de construcción

- **Acciones como contrato único**:
  - Cada acción se declara una vez en `packages/contracts` con nombre, tipo (`leer`, `escribir`, `borrar` o
    `jugadores`), entrada y salida en zod.
  - De esa declaración salen la ruta `POST /api/acciones/<nombre>`, el cliente tipado de la web, la herramienta MCP y
    el OpenAPI.
  - Es estilo RPC, no REST: así casa uno a uno con el MCP.
- **Un único camino de escritura**:
  - Los servicios escriben solo con el `operation()` de `packages/db`. Cada operación abre una transacción, apunta los
    cambios (antes y después) y sube la versión y la autoría de cada fila.
  - dependency-cruiser prohíbe escribir con Drizzle fuera de `packages/db`.
  - Una prueba comprueba que cada tabla de dominio tiene historial.
  - Se descartan los disparadores de Postgres: la lógica quedaría en SQL y el deshacer genérico es más fácil de probar
    en TypeScript.
- **El deshacer detecta conflictos por versión**: cada fila de dominio lleva un `version` entero. Deshacer exige que
  la versión actual sea la que dejó la operación.
- **Revocar al momento**: el actor (sus pertenencias) se carga en cada petición, sin caché. Hay pocas filas y basta
  un índice.
- **Tiempo real**:
  - `@fastify/websocket` con un bus en el proceso.
  - Cada evento pasa por la política de su destinatario antes de salir.
  - Valkey se usará para varias instancias cuando hagan falta; de momento solo para BullMQ (purgas y caducidad de las
    aprobaciones).
- **La cola de aprobación vive en Postgres** (sobrevive a reinicios), no en memoria como en el Crisol actual. La
  espera de 15 s escucha el bus del proceso.
- **Interfaz**:
  - CSS Modules y variables CSS para los temas claro y oscuro.
  - **React Aria Components** (Adobe, Apache-2.0) para diálogos, menús, avisos y formularios accesibles, porque WCAG
    AA es parte del listón.
  - Sin Tailwind.
- **Pruebas con Postgres real**: en local, el del Compose (base `crisol_test`, se vacía entre pruebas); en la CI,
  contenedores de servicio de GitHub Actions.
- **Dependencias nuevas fuera del ADR-0001** (al aprobar el plan se aprueban también):
  - `@fastify/websocket` y `@fastify/static` (MIT).
  - `react-aria-components` (Apache-2.0).
  - `@axe-core/playwright` (MPL-2.0, solo en pruebas, permitido por `CONSTRAINTS.md`).
  - `dependency-cruiser` (MIT).
  - Better Auth 1.7.14 con `@better-auth/mcp` y `@better-auth/cimd` (MIT).
  - `@modelcontextprotocol/sdk` 1.32 (MIT).
- **Versiones de partida**:
  - Node 24, pnpm 12, Turborepo 2.11, TypeScript.
  - Fastify 5, zod 4, Drizzle 0.45, Postgres 17.
  - React 19, Vite 8, TanStack Router y Query, i18next 26.
  - Biome 2.6, Vitest 5, Playwright 1.64.

## Tareas

| # | Tarea | Fase | Depende de | Tamaño |
|---|---|---|---|---|
| 1 | Esqueleto del monorepo con sala limpia y licencias | Plataforma | — | M |
| 2 | CI con todo el listón | Plataforma | 1 | M |
| 3 | Servidor, base de datos y Compose de desarrollo | Plataforma | 2 | M |
| 4 | Web mínima servida por el servidor, e2e y axe | Plataforma | 3 | M |
| 5 | Imagen Docker y staging **[permiso: Caddy]** | Plataforma | 4 | M |
| 6 | Arranque y cuenta del propietario (servidor) | Cuentas | 3 | M |
| 7 | Entrar, salir y arranque en la web | Cuentas | 4, 6 | M |
| 8 | Registro cerrado: pase de alta | Cuentas | 6 | S |
| 9 | Núcleo de escritura: políticas, operaciones y mundos | Inquilinos | 6 | L |
| 10 | Mundos en la interfaz | Inquilinos | 7, 9 | S |
| 11 | MCP con OAuth y `listar_mundos`, probado desde claude.ai | IA | 5, 9 | M |
| 12 | Campañas | Inquilinos | 10 | M |
| 13 | Enlace de invitación: gestión | Inquilinos | 12 | M |
| 14 | Unirse con el enlace | Inquilinos | 8, 13 | M |
| 15 | Discord y Google, vinculación de cuentas **[Enrique: apps OAuth]** | Cuentas | 14 | M |
| 16 | Miembros: ver, expulsar y salir | Inquilinos | 14 | M |
| 17 | Canal en tiempo real proyectado y revocación | Inquilinos | 16 | M |
| 18 | Prueba de fugas en la CI | Inquilinos | 17 | S |
| 19 | Ver el historial | Historial | 12 | S |
| 20 | Deshacer una operación | Historial | 19 | M |
| 21 | Papelera y purgas | Historial | 20 | M |
| 22 | Modos de IA y cola de aprobación (servidor) | IA | 11, 17 | M |
| 23 | Cola y ajustes de IA en la interfaz | IA | 22 | M |
| 24 | Resto de herramientas MCP | IA | 21, 22 | M |
| 25 | Cierre: criterios de éxito en staging, revisión y entrega | — | todas | S |

**Puntos de control** (con Enrique):

- Tras la 5: plataforma desplegada.
- Tras la 11: Enrique conecta claude.ai.
- Tras la 18: criterios 2 y 3 de la spec.
- Tras la 21: criterios 5 y 6.
- Tras la 25: todos.

## Lo que necesito de Enrique y cuándo

| Cuándo | Qué |
|---|---|
| Tarea 2 | Permiso para proteger `main` en GitHub (no fusionar sin la CI en verde) |
| Tarea 5 | Permiso para el sitio de Caddy `neo.crisol.144-91-122-245.sslip.io` |
| Tarea 11 | Añadir el conector en claude.ai y probarlo |
| Tarea 15 | Crear la aplicación OAuth de Discord (y la de Google, si acepta `sslip.io`) y decidir el correo (preguntas 1 y 2 de la spec) |
| Tarea 25 | Recorrer los criterios de éxito en staging |

## Riesgos

| Riesgo | Impacto | Cómo lo atajamos |
|---|---|---|
| claude.ai no se entiende con el MCP de Better Auth (CIMD, versión del protocolo MCP) | Alto | Tarea 11 temprana y en staging real; si falla CIMD, se activa DCR, que también admite claude.ai |
| Una escritura se salta `operation()` y no queda en el historial | Alto | Un solo camino de escritura, regla de dependency-cruiser y prueba de cobertura por tabla |
| Fugas por algún canal (WebSocket, MCP, errores) | Alto | Proyección en un único sitio, prueba de fugas que bloquea la CI (tarea 18) y que crece con cada módulo |
| El gancho de alta de Better Auth no ve el pase en el alta social | Medio | Se comprueba con su documentación en la tarea 8; si no, alta social implícita desactivada y flujo explícito |
| Toma de cuenta previa al vincular por email | Medio | Solo se vincula si los dos emails están verificados; las cuentas de email y contraseña necesitan correo saliente (pregunta 1) |
| Google no acepta `sslip.io` | Medio | Discord y email primero; Google cuando haya dominio propio |
| Memoria del VPS (Postgres + Valkey + app) | Bajo | Unos 500 MB, con 5,4 GB libres; límites de memoria en el Compose |
