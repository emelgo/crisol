# Spec: los jugadores mueven sus fichas (módulo 7)

Capacidad `mover-jugadores` del módulo 7 (`docs/specs/modulo-7.md`). Se apoya en `sala` (pausa y modo) y en lo que
dejó preparado el módulo 6 (`apps/server/src/table/rules.ts`, `docs/specs/vision.md` § puertas). Estudio:
`research/foundry/sala-de-jugadores.md` § movimiento.

## Objetivo

Que cada jugador mueva desde su móvil o su PC su personaje y las fichas que el máster le asigne, y abra las puertas
que ve, sin que el máster tenga que hacerlo por él; todo comprobado en el servidor.

**Historias**

- Como jugador, en mi Mesa arrastro mi ficha; los demás (y la Pantalla) la ven moverse en vivo y la visión cambia al
  soltarla, como cuando la mueve el máster.
- Como jugador, no puedo atravesar un muro ni una puerta cerrada: la ficha se queda donde choca (y me dice por qué).
- Como jugador, abro o cierro una puerta normal que veo, sin llave, pulsándola.
- Como jugador, en combate, en mi turno pulso «Pasar turno».
- Como máster, asigno a un jugador una ficha más (un familiar, una montura, una invocación) y la mueve como la suya.
- Como máster, con «en su turno» solo mueve el dueño del combatiente activo; con «bloqueado» o con pausa, nadie.
- Como máster, veo quién mueve qué (el arrastre del jugador sale con su color).
- Como IA, asigno y quito fichas a un jugador.

## Comportamiento

- **Qué fichas mueve**: las de sus personajes en la campaña (`owner`) y las de criaturas en juego que el máster le
  asigne (`controlledBy`). Nada más.
- **Dónde**: en la escena presentada (la que ve el grupo; su Mesa ve lo de la Pantalla, `docs/specs/modulo-7.md` § 7).
- **Comprobación en el servidor**, en este orden: es suya → `tableActionAllowed` (pausa, modo, turno; de `sala`) → el
  camino (`moveAllowed`: ni muros ni puertas cerradas, también las secretas) → que el destino esté dentro del mapa.
  Rechazado: la ficha vuelve y sale un aviso corto («Hay un muro», «No es tu turno», «Pausa»).
- **El camino**: en línea recta del sitio de antes al de ahora; si se pega a la rejilla, como el máster (Mayús).
  Arrastrar a través de un muro deja la ficha en el último punto válido antes de él.
- **En vivo**: el arrastre del jugador va por el canal de la mesa (como el del máster), a los demás solo por donde el
  grupo ve.
- **Puertas**: `playerMayUseDoor` (normal, no secreta, sin llave, a la vista); la pausa también las bloquea.
- **Pasar turno**: solo el dueño del combatiente activo (o de una ficha asignada que sea la activa); el servidor lo
  comprueba (en Foundry cualquier jugador puede).
- **Tiradas desde la ficha**: lo de ahora (su hoja, sus tiradas), sin cambios.

### IA (MCP)

`asignar_ficha` y `quitar_ficha_asignada` (criatura en juego ↔ jugador). Mover sigue con `mover_fichas` (el máster o
la IA del máster).

## Contratos (propuesta)

- Migración: `campaign_creatures.controlled_by text[] not null default '{}'`.
- `moveTokens` acepta jugadores (hoy, `table.manage`): permiso nuevo `table.play` (miembros de la campaña) más las
  reglas de arriba; `toggleDoor` igual; `nextTurn` para el dueño del activo.
- `assignToken({ campaignId, creatureId, userIds })`.
- Canal de la mesa: el espectador `player` puede mandar `drag` (de sus fichas).
- La proyección del jugador marca cuáles puede mover (`mine: true`).

## Pruebas

- Unitarias: el orden de comprobaciones, el último punto válido antes de un muro.
- Integración: mover lo suyo sí y lo ajeno no; muro, puerta cerrada y secreta; pausa; bloqueado; en su turno (activo
  sí, otro no, sin combate sí); asignada; puertas; pasar turno; el arrastre en vivo solo por lo visible.
- Web: arrastrar en el móvil (táctil) y en el PC, la ficha que vuelve con su aviso, «Pasar turno».
- e2e: la jugadora mueve su ficha y la Pantalla la ve; con pausa no puede.

## Criterios de éxito

1. Ninguna llamada a la API mueve una ficha ajena ni cruza un muro.
2. Arrastrar en el móvil es fluido (60 imágenes por segundo en un móvil normal) y el resultado llega a la Pantalla en
   menos de medio segundo.
