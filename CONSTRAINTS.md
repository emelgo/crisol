# Listón de calidad

Revisado: 2026-10-29 con Enrique (prueba de fugas añadida con el módulo 0). Este archivo no se rebaja para que algo pase: cambiarlo exige su visto bueno en el PR.

## Suelo (siempre, bloquea)

- No se añaden supresiones: `@ts-ignore`, `@ts-expect-error` sin motivo, `biome-ignore` sin motivo, `as any` para
  callar al compilador.
- No hay stubs sin hacer (`throw new Error('Not implemented')`, `catch {}` vacío, `TODO` que oculte un fallo).
- No se saltan ni se borran pruebas (`.skip`, `.only`, aserciones quitadas) sin explicarlo en el commit.
- No hay secretos en el código ni en el historial.
- **Licencias**: ninguna dependencia de producción copyleft (GPL, LGPL, AGPL, SSPL, MPL, EUPL, CC BY-SA…). Las
  herramientas solo de desarrollo y pruebas, que no se distribuyen, pueden ser copyleft débil (MPL, LGPL), pero nunca
  GPL ni AGPL.
- **Sala limpia**: nada de `apps/` ni `packages/` importa ni lee `research/`.

## Con números

| Dimensión | Regla | Lo comprueba | Cuándo | Modo |
|---|---|---|---|---|
| Tipos | Cero errores | `tsc --noEmit` (por paquete, vía Turborepo) | Cada cambio, CI | Bloquea |
| Lint y formato | Cero errores con nuestra configuración | `biome check` | Cada cambio, CI | Bloquea |
| Pruebas | Todas en verde | `vitest run`, Playwright e2e | Al acabar cada tarea, CI | Bloquea |
| Secretos | Ninguno | `gitleaks` | CI | Bloquea |
| Licencias | Solo la lista permitida (MIT, ISC, BSD, Apache-2.0, 0BSD, CC0, Unlicense, BlueOak, CC BY 4.0 para datos) | script de licencias sobre `pnpm licenses list` | CI | Bloquea |
| Sala limpia | Sin imports de `research/` | prueba propia | CI | Bloquea |
| Fugas | Un jugador no recibe nada que no pueda ver (API, WebSocket, MCP) | prueba e2e de fugas, que cada módulo amplía | CI | Bloquea |
| Cobertura | ≥ 80 % de las líneas nuevas o cambiadas | `vitest --coverage` + diff | CI | Avisa hasta el 2026-11-12, luego bloquea |
| Seguridad: código | Ningún hallazgo alto | `semgrep` (reglas por defecto) | CI | Avisa hasta el 2026-11-12, luego bloquea |
| Seguridad: dependencias | Nada alto o crítico | `osv-scanner` | CI | Avisa hasta el 2026-11-12, luego bloquea |
| Accesibilidad | WCAG 2.1 AA: cero fallos críticos o graves | `@axe-core/playwright` en las e2e | CI (contra el Compose) | Avisa hasta el 2026-11-12, luego bloquea |
| Límites entre módulos | El cliente no importa el servidor; los paquetes de dominio no importan React ni Fastify; nada importa `research/` | `dependency-cruiser` | CI | Avisa hasta el 2026-11-12, luego bloquea |

## Trinquetes

Cuando un número mejora, el listón sube con él. Nunca se baja para que entre un cambio.

## Tiempo

Las comprobaciones locales al acabar una tarea deberían tardar menos de unos 90 s. La CI no tiene límite.
