# Crisol

Mundos de rol y mesa virtual en español, con IA, como servicio en la nube.

Proyecto privado en construcción. La reescritura va módulo a módulo; el estado está en `docs/modulos.md`, las decisiones
en `docs/adr/` y las normas de trabajo en `CLAUDE.md`.

## Comandos

Requiere Node 24 y pnpm 12.

```
pnpm install       # dependencias
pnpm lint          # formato y lint (Biome)
pnpm typecheck     # tipos (TypeScript 7, por paquete)
pnpm test          # pruebas (Vitest, por paquete)
pnpm licencias     # licencias frente a CONSTRAINTS.md
pnpm sala-limpia   # nada de apps/ ni packages/ toca research/
pnpm limites       # límites entre paquetes (dependency-cruiser)
pnpm test:coverage && pnpm cobertura-diff main   # cobertura de las líneas cambiadas
pnpm servicios     # Postgres, Valkey y Mailpit de desarrollo (Docker, solo loopback)
pnpm db:migrate    # migraciones en la base de desarrollo
pnpm dev           # servicios + servidor (8130) + web (Vite, 5173)
pnpm e2e           # web compilada + Playwright: e2e, prueba de fugas (@fugas) y axe (@a11y)
```

Copia `.env.example` a `.env` antes de `pnpm dev`.

## Qué hay

- `packages/contracts`: las acciones (entrada, salida y tipo). De ellas salen la API (`POST /api/actions/<nombre>`,
  OpenAPI en `/api/openapi.json`), el cliente de la web y las herramientas MCP.
- `packages/domain`: reglas puras (políticas, deshacer, papelera y retención, modos de IA).
- `packages/db`: esquema, migraciones y repositorios. Toda escritura de dominio pasa por `operation()` y queda en el
  historial.
- `apps/server`: Fastify con Better Auth, la API, el canal en tiempo real (`/api/realtime`), el MCP (`/mcp`) y la
  purga diaria (BullMQ).
- `apps/web`: la SPA (React, TanStack Router y Query).

## Conectar Claude

En claude.ai, añade un conector con la dirección `<PUBLIC_URL>/mcp` (la web la enseña en «IA», `/ia`). Claude entra
por OAuth con la cuenta del propietario (en el módulo 0, solo el propietario) y actúa con sus permisos. El modo de IA
(solo lectura, asistente o copiloto) decide qué espera tu aprobación en la cola de la web.

## Staging

`scripts/desplegar-staging.sh` despliega `origin/main` en el VPS: copia aparte en `~/crisol-staging`, imagen de
`Dockerfile`, `compose.prod.yaml` en loopback (puerto 8140) y Caddy delante.

Cuenta del propietario (una sola vez): `pnpm crisol arranque --org "Nombre"` en desarrollo, o en staging
`docker compose -p crisol-staging exec app node apps/server/src/cli/main.ts arranque --org "Nombre"`.

## Licencia

Propietaria (`UNLICENSED`): todos los derechos reservados.
