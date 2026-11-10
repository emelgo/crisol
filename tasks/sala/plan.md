# Plan: la sala (módulo 7)

Spec: `docs/specs/sala.md` · ADR-0022 · Lienzo «Sala de jugadores» (`out/lienzo-sala/`, por aprobar).
Rama: `modulo-7/sala` (sigue la tanda del módulo; el PR, al final, con la CI una vez).

## Orden (porciones verticales, cada una con sus pruebas)

1. **Dominio**: `tableActionAllowed` (pausa, modo, turno, fichas propias y asignadas) en `packages/domain`, pura.
2. **Servidor: controles**: migración 0065 (`paused`, `movement`, `kicked` en `campaign_tables`), repositorio,
   `setTableControls`, mensaje `controls` del canal de la mesa al entrar y al cambiar; MCP `pausar`, `modo_movimiento`.
3. **Servidor: echar**: `kickFromTable` / `allowBackToTable`, cierre 4409 de sus conexiones, `join` rechazado, aviso
   por tiempo real; MCP `echar_de_la_mesa`, `dejar_volver`.
4. **Servidor: presencia**: personaje y color en cada entrada; «en la campaña» por el canal general
   (`campaignFocus`); `getTableRoom` (presentes, en la campaña, echados, pausa, modo); MCP `ver_sala`.
5. **Web: el máster** (cuando se apruebe el lienzo): retratos en la barra de la escena, el panel de la sala, la franja
   de pausa; la sección Mesa de la campaña con personaje y color.
6. **Web: la jugadora y la Pantalla**: franja de pausa, pista de modo, «te han sacado de la Mesa»; rótulo de pausa en
   la Pantalla.
7. **Cierre**: tutorial guiado (paso de la sala), e2e (pausa y echar con la cuenta de jugadora) + axe, revisión,
   manual de la IA, `tasks/probar.md`.
