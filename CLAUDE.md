# Crisol

Mundos de rol y mesa virtual en español, con IA, como servicio en la nube (SaaS multiusuario). Es la reescritura desde
cero del Crisol actual (`~/crisol-app`, basado en Obsidian y Atlas), que sigue en uso hasta migrar. Habla siempre en
español con Enrique.

## Dónde mirar

- **Al empezar una sesión, lee `docs/modulos.md` § «Dónde estamos»**: dice qué se hizo y cuál es el siguiente paso.
  Al acabar, actualízalo.
- La memoria general del VPS (servicios, REA, Playwright, Dex, avisos MCP…) está en
  `~/.claude/projects/-home-admin/memory/` (índice en `MEMORY.md`); la de este proyecto apunta allí.
- `docs/modulos.md`: catálogo de módulos, orden y estado. Se va módulo a módulo y alguno puede descartarse.
- `docs/inventario.md`: todo lo que hace el Crisol actual. Antes de especificar un módulo, repásalo para no olvidar nada.
- `docs/adr/`: decisiones de arquitectura (empieza por `0001-arquitectura.md`). Una decisión nueva → un ADR nuevo.
- `docs/specs/<módulo>.md`: el PRD de cada módulo (skill `spec-driven-development`).
- `research/`: notas del REA de Foundry VTT y D&D Beyond. Lee `research/README.md` antes de escribir ahí.
- `CONSTRAINTS.md`: el listón de calidad. No se rebaja para que algo pase.
- El Crisol actual es solo de consulta: `~/crisol-app` (producción) y `~/CrisolVTT/crisol` (desarrollo).
  Contratos: `packages/protocol/src/{rpc,game}.ts`; MCP: `apps/core-host/src/mcp/server.ts`.

## Ciclo de cada módulo

Skills de agent-skills (plugin del proyecto): `interview-me` con Enrique frente al inventario → REA dirigido a las
preguntas del módulo → `/spec` → `/plan` → `/build` en porciones verticales con TDD → `/agent-skills:review` → `/ship`
a staging. Cada módulo nace con su API y sus herramientas MCP.

## Normas

- **Sala limpia**: Foundry y D&D Beyond se estudian para entender cómo resuelven los problemas, nunca para copiar. Ni
  código, ni textos, ni datos, ni imágenes suyos en el repo. Contenido de reglas: solo SRD (CC BY 4.0) o propio.
- Nada de dependencias con licencia copyleft (GPL, AGPL, SSPL…): Crisol se venderá. Comprueba la licencia antes de
  añadir una dependencia.
- Identificadores en inglés; textos de la interfaz en español por i18n, cortos y sin sobreexplicar. En la interfaz no
  salen «Obsidian», «Atlas», «Foundry» ni «D&D Beyond».
- Estilo: sin punto y coma, comillas simples, líneas largas (lo aplica Biome), comentarios breves en español.
- Git: rama corta por porción de trabajo → PR a `main` en `emelgo/crisol` (privado) → merge con la CI en verde.
  Commits pequeños, en español, cuando algo funciona, terminados en
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pide permiso antes de instalar paquetes del sistema, abrir puertos, tocar Caddy o crear servicios.
- No toques el Crisol actual ni sus datos (`~/crisol-app`, `~/CrisolVTT`, `~/crisol-data`): el importador trabaja
  sobre una copia en `datos-locales/` (fuera de git).
- Secretos solo en `.env` (fuera de git); `.env.example` documenta las variables.
