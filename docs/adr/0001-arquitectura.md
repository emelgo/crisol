# ADR-0001: Arquitectura base del Crisol en la nube

Estado: aceptada (revisable con lo que enseñe el REA de cada módulo) · Fecha: 2026-10-29

## Contexto

El Crisol actual depende de Obsidian y Atlas (ver «Herencias» en `docs/inventario.md`). El nuevo es un SaaS
multiusuario que se venderá, solo web (PWA), con datos en base de datos y exportación a Markdown, desplegado primero en
Docker en el VPS y migrable a un proveedor cloud. Enrique dejó elegir la pila.

## Decisión

TypeScript de punta a punta. Es el idioma del Crisol actual, lo que permite portar piezas aisladas (dados, fórmulas,
sistemas), y es lo que usa Foundry. Todas las dependencias tienen licencia MIT, Apache o BSD.

| Pieza | Elección | Por qué |
|---|---|---|
| Monorepo | pnpm + Turborepo, Node 24 | Workspaces rápidos y caché de tareas |
| Calidad | Biome (formato + lint), Vitest, Playwright | Una sola herramienta configurable al estilo de la casa |
| Cliente | React 19 + Vite, TanStack Router/Query, zustand, i18next, PWA | Conocido; buena base para una SPA instalable |
| Editor | TipTap 3 + Yjs | Ya se usa TipTap; Yjs da edición simultánea |
| Mesa | PixiJS 8 | Ya se usa; WebGL rápido |
| Pizarras | Excalidraw | MIT, ya se usa |
| Servidor | Fastify + zod (contratos y OpenAPI) | Validación en el borde y documentación de la API |
| Tiempo real | WebSocket propio + Hocuspocus (Yjs) | Partida autoritativa + documentos colaborativos |
| Base de datos | Postgres 17 + Drizzle | Relacional, JSONB, FTS en español (`unaccent`, `pg_trgm`), pgvector más adelante |
| Caché/colas | Valkey + BullMQ | Valkey (BSD) en vez de Redis (AGPL desde la v8) |
| Archivos | Interfaz de almacenamiento: disco en el VPS, S3/R2 en la nube | Migrable sin tocar el código |
| Cuentas | Better Auth (email + contraseña, enlace mágico, Google/Discord, organizaciones, proveedor OAuth) | Cuentas propias; el mismo OAuth sirve al conector MCP |
| Correo | SMTP; Mailpit en desarrollo | |
| MCP | Dentro del servidor, Streamable HTTP en `/mcp` con OAuth | Las herramientas llaman a la misma capa de servicios que la API |
| Despliegue | Docker Compose en loopback + Caddy; CI en GitHub Actions | |

Principios:

- **Multiinquilino**: organización → mundos → campañas. Cada fila lleva su `world_id`. Los permisos se deciden en una
  capa de políticas única y probada. Roles: propietario, co-máster, jugador, espectador.
- **Partida autoritativa en el servidor**: el estado de la mesa vive en el servidor y cada cliente dibuja su vista. La
  visibilidad (niebla, secretos, notas del máster) se proyecta por usuario en el servidor: al cliente no le llega lo que
  no debe ver. Así se acaba la dependencia de la pestaña del máster.
- **Enlaces por ID**: renombrar no reescribe texto. Exportar a Markdown produce `[[enlaces]]`; el importador lee el
  formato del Crisol actual.
- **API primero**: cada módulo define su contrato zod, y de él salen la API, el cliente y las herramientas MCP.
- **Historial y deshacer** en el servidor para cualquier cambio (persona o IA), con modos de IA y cola de aprobación.

## Consecuencias

- Hay que reescribir la mesa para que funcione sin el navegador del máster. Es el módulo más caro y el que más se
  apoya en el REA de Foundry (visión, muros, niebla, sockets).
- Las sintaxis de plugins (Templater, Meta Bind, Dataview, Bases…) no se emulan: se sustituyen por funciones nativas.
  El importador convierte lo que se pueda.
- Postgres y Valkey suman unos 300–500 MB de RAM en el VPS.
