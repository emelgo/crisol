# Skills del proyecto

- `impeccable` (https://github.com/pbakaus/impeccable, Paul Bakaus, Apache-2.0; skill 4.8.2, motor 0.1.21): diseñar y
  revisar la interfaz (Enrique, 2026-11-10: en cada módulo, `critique` y `audit` de lo que se toca, y aplicar mejoras).
  La instaló `npx impeccable install --providers=claude --scope=project` con sus agentes (`.claude/agents/impeccable-*`)
  y su vigilante (hooks en `.claude/settings.local.json`, fuera de git). Su motor (`scripts/bin/`, ~22 MB) no va a
  git: el lanzador lo descarga si falta. Para actualizarla: `npx impeccable update` y revisar el cambio.

Antes estaban aquí las de Vercel (`web-design-guidelines`, `react-best-practices`, `composition-patterns`,
`react-view-transitions`) y se usaba el plugin `frontend-design` de Anthropic: quitados el 2026-11-10, los sustituye
impeccable.
