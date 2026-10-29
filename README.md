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
```

## Licencia

Propietaria (`UNLICENSED`): todos los derechos reservados.
