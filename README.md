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
pnpm servicios     # Postgres, Valkey y Mailpit de desarrollo (Docker, solo loopback)
pnpm db:migrate    # migraciones en la base de desarrollo
pnpm dev           # servicios + servidor (8130) + web (Vite, 5173)
pnpm e2e           # web compilada + Playwright, con axe
```

Copia `.env.example` a `.env` antes de `pnpm dev`.

## Staging

`scripts/desplegar-staging.sh` despliega `origin/main` en el VPS: copia aparte en `~/crisol-staging`, imagen de
`Dockerfile`, `compose.prod.yaml` en loopback (puerto 8140) y Caddy delante.

## Licencia

Propietaria (`UNLICENSED`): todos los derechos reservados.
