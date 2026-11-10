# Spec: la sala (módulo 7)

Capacidad `sala` del módulo 7 (`docs/specs/modulo-7.md`). Intención: `docs/intent/sala-de-jugadores.md`. Estudio:
`research/foundry/sala-de-jugadores.md` § presencia y control.

## Objetivo

Que el máster sepa quién está en la partida y la controle desde la Mesa, tanto en la mesa (tele y móviles) como a
distancia. Todo lo que controla se comprueba en el servidor: en Foundry la pausa la frena solo el navegador del
jugador y echar a alguien no le corta la conexión.

**Historias**

- Como máster, en la Mesa veo quién está (jugadores, sus personajes, la Pantalla), quién tiene la pestaña a la vista y
  quién está en la campaña sin haber abierto la Mesa.
- Como máster, pauso la partida: a todos les sale «Pausa» (en la Pantalla, grande) y nadie más que yo puede mover,
  abrir puertas ni poner nada en la Mesa hasta que la quite. La pausa sigue si se reinicia el servidor.
- Como máster, elijo cómo mueven los jugadores: libre, en su turno o bloqueado (lo aplicará `mover-jugadores`; aquí se
  guarda, se enseña y se puede leer).
- Como máster, echo a alguien de la Mesa: se le cierra al momento en todos sus aparatos y no puede volver a entrar
  hasta que yo lo deje. Sigue siendo de la campaña (quitarlo del todo es lo de siempre, en la campaña).
- Como máster, cambio el enlace de invitación desde la Mesa, sin ir a la campaña.
- Como jugador, veo quién más está y, si me echan o hay pausa, me lo dice claro y corto.
- Como IA, leo la sala (quién está, pausa, modo) y pauso, cambio el modo, echo y dejo volver.

## Comportamiento

### Presencia

- Lo de ahora (`table/presence.ts`): cada conexión del canal de la mesa, con quién es, cómo mira (máster, Pantalla,
  jugador), desde cuándo, si tiene alguna pestaña a la vista y cuántas.
- Se añade: **su personaje** (los de la campaña que juega; el primero, con su retrato) y **su color** (el de sus dados,
  `diceColor`, o el que le toca por su id, como en el registro de tiradas).
- Se añade **«en la campaña»**: quien tiene abierto el espacio de la campaña (su Inicio, Libros, Personajes…) pero no
  la Mesa. Lo dice el canal general de tiempo real (`realtime`), que ya lleva la sesión: la web avisa de qué campaña
  tiene abierta. Se lista aparte («En la campaña») y sin pestañas.
- Lo ve cualquiera de la campaña (como ahora); cambia al momento (evento `changed: tablePresence`).

### Pausa

- Un estado de la mesa de cada campaña, **guardado** en `campaign_tables` (no va al historial: es de la sesión, como la
  escena presentada). La campaña no arranca en pausa.
- Solo el máster (del mundo o de la campaña) la pone y la quita (`table.manage`).
- Mientras dura, las acciones de la mesa de quien no es máster se rechazan en el servidor con un error claro («La
  partida está en pausa»): mover fichas, abrir y cerrar puertas, poner o quitar marcas. Hoy los jugadores aún no pueden
  hacer nada de eso (llega con `mover-jugadores`), así que la regla queda escrita y probada con una función de dominio
  que esa capacidad usará en cada acción.
- No bloquea: tirar dados, escribir en el registro, leer páginas, ni nada del máster.
- Se ve: en la Pantalla, un rótulo grande y sobrio sobre la escena; en la Mesa del jugador, una franja arriba; en la
  Mesa del máster, el botón encendido y una franja discreta (para que no se le olvide quitarla).

### Modo de movimiento

- `free` (libre), `turn` (en su turno), `locked` (bloqueado); por campaña, guardado en `campaign_tables`; por defecto,
  libre.
- Aquí: guardarlo, enseñarlo (al máster en sus controles; al jugador, una pista pequeña en su Mesa cuando no puede
  mover) y leerlo. La regla («en su turno, con combate, solo el dueño del combatiente activo; sin combate, libre») se
  escribe ya como función de dominio con sus pruebas, para `mover-jugadores`.

### Echar y dejar volver

- El máster echa a un jugador de la Mesa de la campaña: el servidor **cierra al momento** todas sus conexiones al canal
  de la mesa de esa campaña (con un código propio) y lo apunta en la lista de echados de la campaña
  (`campaign_tables`, guardada).
- Mientras esté en la lista, su `join` al canal de la mesa se rechaza con ese mismo código, y la web le enseña «El
  máster te ha sacado de la Mesa», sin reintentar. Sigue pudiendo abrir el espacio de la campaña (su ficha, sus libros):
  echar es de la Mesa, no de la campaña.
- El máster lo ve en su lista como «Fuera de la Mesa» con «Dejar volver», que lo quita de la lista; al jugador se le
  avisa por tiempo real y puede volver a entrar.
- No se puede echar al máster ni a uno mismo. Echar a la Pantalla no tiene sentido (es la sesión del máster): se puede
  cerrar desde «Pantalla» como ahora.

### Cambiar el enlace

- En los controles de la sala, el enlace de invitación con copiar, abrir o cerrar las invitaciones y «Enlace nuevo»
  (`getInvitation`, `setInvitationsOpen`, `regenerateInvitation`, que ya existen), con su confirmación.

### Dónde está en la interfaz

- **Máster, en la Mesa**: un control «Sala» en la barra de la Mesa con los retratos de quien está (como en una
  videollamada, apilados) y, al abrirlo, un panel con: la lista de presentes (en la Mesa / en la campaña / fuera), la
  pausa, el modo de movimiento y la invitación. Cada persona, con su menú: echar o dejar volver. El diseño exacto sale
  del lienzo (impeccable) y de las normas de `docs/diseno.md`.
- **Jugador, en su Mesa**: los retratos de quien está, sin controles; la franja de pausa y la pista de modo.
- **Pantalla**: el rótulo de pausa; nada de presencia (es la tele de la mesa).
- La sección Mesa del espacio de la campaña sigue enseñando quién está (ahora con personaje y color).

### IA (MCP)

| Herramienta | Qué hace |
|---|---|
| `ver_sala` | Quién está (en la Mesa, en la campaña, fuera), la pausa y el modo de movimiento |
| `pausar` | Pone o quita la pausa (`paused`) |
| `modo_movimiento` | Cambia el modo (`free`, `turn`, `locked`) |
| `echar_de_la_mesa` | Echa a un jugador de la Mesa (pide aprobación) |
| `dejar_volver` | Lo quita de los echados |

## Contratos (propuesta)

- `getTableRoom({ campaignId })` → `{ present: TablePresenceEntry[], inCampaign: {userId, name, color}[], kicked:
  {userId, name}[], paused, movement }` (sustituye a `getTablePresence`, que se queda como alias mientras la web cambia).
  `TablePresenceEntry` gana `color` y `character: { id, name, img } | null`.
- `setTableControls({ campaignId, paused?, movement? })` → `{ paused, movement }`, `table.manage`.
- `kickFromTable({ campaignId, userId })`, `allowBackToTable({ campaignId, userId })` → `{ ok: true }`, `table.manage`.
- Canal de la mesa: mensaje del servidor `{ type: 'controls', paused, movement }` (al entrar y al cambiar) y cierre
  con el código `4409` («echado»). Canal general: el cliente manda `{ type: 'campaignFocus', campaignId | null }`.
- Migración 0065: en `campaign_tables`, `paused boolean not null default false`, `movement text not null default
  'free'` (con su check) y `kicked text[] not null default '{}'`.
- Dominio (`packages/domain`): `tableActionAllowed({ role, paused, movement, combat, userId, tokenOwnerIds })` →
  `ok | 'paused' | 'locked' | 'notYourTurn'`, pura y probada aquí, usada en `mover-jugadores`.

## Pruebas

- Unitarias (dominio): la regla de pausa y modo en todas sus combinaciones (máster siempre puede; pausa gana a todo;
  bloqueado; en su turno con y sin combate; ficha asignada).
- Unitarias (servidor): la presencia con personaje, color y «en la campaña» (varias pestañas, salir, entrar).
- Integración (servidor, con la base): pausar y quitar la pausa (permiso: un jugador no puede; sobrevive a recargar la
  sala), cambiar el modo, echar (se cierran sus conexiones, el `join` se rechaza con 4409, otra campaña no se ve
  afectada) y dejar volver; `ver_sala` y las demás herramientas del MCP.
- Web (unitarias): el panel de la sala (presentes, pausa, modo, echar, invitación), la franja de pausa del jugador, el
  rótulo de la Pantalla, la pantalla de «te han sacado».
- e2e: el máster pausa y la jugadora (cuenta de prueba) ve la franja; el máster la echa, a ella se le cierra la Mesa y
  vuelve a entrar cuando la deja volver.
- Accesibilidad: el panel con teclado, los avisos de pausa y de expulsión en una región viva.

## Límites

- **Siempre**: comprobar en el servidor; textos cortos por i18n; seguir `docs/diseno.md`; pruebas antes de cada
  commit.
- **Preguntar antes**: nada fuera de lo de siempre (no hay dependencias nuevas).
- **Nunca**: que la interfaz sea la única que frena a un jugador; echar al máster.

## Criterios de éxito

1. Con la cuenta de jugadora en otro navegador, el máster ve su presencia con su personaje y su color, en la Mesa o en
   la campaña, y cambia al momento.
2. Con pausa, una acción de mesa de un jugador mandada a la API (no solo desde la interfaz) se rechaza; la Pantalla
   enseña «Pausa»; tras reiniciar el servidor, sigue en pausa.
3. Echar cierra la Mesa de la jugadora en menos de un segundo y no puede volver hasta «Dejar volver».
4. El modo se guarda, se lee por la API y el MCP, y la regla de dominio pasa sus pruebas.
5. Todo con su herramienta MCP y su entrada en el manual de la IA.

## Preguntas abiertas

Ninguna que bloquee: el aspecto del control «Sala» lo dirá el lienzo.
