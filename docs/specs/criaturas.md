# Spec: criaturas (módulo 4)

Estado: **en marcha** (2026-11-06). Segunda capacidad del módulo 4 (`docs/specs/modulo-4.md`), después de
`compendio-mundo`. Entrevista: `docs/modulos.md` § «### 4. Compendio, criaturas y biblioteca» («en partida se debe
comportar como en Foundry o D&D Beyond»). Estudios: `research/foundry/criaturas-y-capas.md` § 2 y 3, propuestas 3 a
6; `research/dndbeyond/criaturas-y-grupo.md` § 1 a 3; y `research/foundry/compendio.md` propuesta 5.

## Objetivo

Que una criatura del compendio **se juegue**: tiene su hoja (su statblock, donde todo se tira) y desde la campaña se
**pone en juego**. Las genéricas, como copias numeradas («Goblin 1», «Goblin 2»), cada una con sus PG, que se quitan
al acabar; las únicas (el jefe de una banda), una sola, que conserva sus PG y sus usos de una sesión a otra. La página
de un PNJ en la wiki cuenta su historia y enlaza a su criatura. Los encuentros, la iniciativa y las fichas en el mapa
son del módulo 6, que usará estas mismas criaturas en juego.

Para quién: el máster en partida (en el ordenador y en el móvil); la IA, que pone criaturas en juego, tira por ellas y
les aplica daño.

## Mapa

| Id | Qué hace |
|---|---|
| `hoja-criatura` | La hoja de una criatura con los bloques de la hoja de personaje: cabecera (retrato, CA, PG, velocidad, VD), características con sus salvaciones, habilidades, sentidos, idiomas, resistencias e inmunidades, y sus rasgos y acciones agrupados por cómo se activan, cada uno con su tirada. La compone el sistema (`sheet` por tipo de actor); sin composición, una por defecto |
| `en-juego` | Poner en juego desde el compendio: cuántas (un número o una fórmula, «1d4+1») o una única; PG medios o tirados (ajuste de la campaña, y se puede cambiar al ponerla). Lo de la partida de cada una, aparte: solo lo que cambia (PG y temporales, usos, recargas, legendarias, estados y notas), con el historial y deshacer. «En juego», la lista del máster en la campaña: las copias juntas por su criatura, las únicas aparte; quitar las copias de una vez al acabar |
| `tirar` | Tirar desde su hoja a su nombre («Goblin 2 · Cimitarra»), al registro, oculto por defecto: ataques, daños, salvaciones con su CD, pruebas y habilidades; ventaja; recargas con su dado; gastar usos y legendarias; descansar |
| `aplicar` | Aplicar el daño (o la curación) de una tirada del registro a una o varias criaturas en juego o personajes, con nada, mitad, entero o doble por cada uno, y sus resistencias, inmunidades y vulnerabilidades |
| `wiki` | Enlazar una criatura desde una página (`[[@Goblin jefe]]`, y «@» o «[[» al escribir), con su tarjeta al pasar el ratón (y al tocar), y abrirla; la criatura dice qué páginas la enlazan |
| `ia` | Ver una criatura en juego, ponerla y quitarla, tirar por ella, aplicarle daño y descansar |

## Requisitos

- **La criatura en juego** apunta a su entrada del compendio (del sistema o del mundo) y guarda solo lo suyo: su nombre,
  si es única, y lo de la partida (la misma forma que `play` de un personaje). Su hoja es la entrada calculada con eso
  encima: si el máster cambia la entrada del mundo, las copias lo notan salvo en lo que ya tocaron.
- **Copias**: se numeran solas dentro de su criatura; quitar una o todas a la vez. **Únicas**: una por entrada y
  campaña; ponerla otra vez abre la que ya está. Una única puede volver al compendio (quitarla de juego) sin perder su
  entrada.
- **Los PG al ponerla**: los medios, o tirados con su fórmula en el servidor (uno por copia), según el ajuste de la
  campaña. En juego, «Tirar PG» y «Otro máximo» en cada una; los temporales, como en la hoja (el daño los gasta
  primero; un valor nuevo sustituye al de antes).
- **Lo vital, a la vista** en «En juego» y arriba de su hoja: CA, PG con dañar y curar, estados, y la marca de
  malherida (a la mitad de sus PG) y de fuera de combate (a 0).
- **La hoja de la criatura** reutiliza los bloques, el cálculo (`evaluate`), las tiradas (`tryRoll`, `tryAction`) y lo
  de la partida (`changeResource`, `spend`, `rest`) de la hoja de personaje: nada se calcula en la web.
- **Lo que hace la criatura en partida** sale de su mecánica (ADR-0012): sus acciones, recursos (usos por día,
  recargas, legendarias) y efectos. Lo que solo está en su texto se lee y se lleva a mano.
- **Hasta el módulo 5, solo el máster** ve las criaturas en juego y sus tiradas (ocultas por defecto); el registro dice
  a los jugadores lo que el máster enseñe.
- **Tiempo real**: lo que cambia en una criatura en juego llega al momento a quien la tenga abierta.
- **Todo con el teclado y en el móvil**, WCAG 2.1 AA; textos por i18n.

## Decisiones (propuestas de los estudios, por confirmar al ver las pantallas)

1. **Sin escena**: las criaturas en juego viven en la campaña, no en un mapa (en Foundry, en la escena); el módulo 6
   las pondrá en el mapa.
2. **Únicas por campaña**, no «enlazadas» como en Foundry: la wiki enlaza a la entrada, y en la campaña la entrada
   lleva a su única en juego si la hay.
3. **PG medios por defecto** (como en Foundry y D&D Beyond); tirarlos es el ajuste de la campaña.
4. **Las recargas se tiran al pulsar** («Recargar», con su dado), no solas al empezar el turno: eso llega con la
   iniciativa (módulo 6). Lo mismo reponer las legendarias.
5. **La hoja de criatura es del sistema** (`sheet` en cada tipo de actor); la del 5e de ejemplo, al estilo de su
   statblock.
6. **Copias numeradas al ponerlas en juego** («Goblin 1», «Goblin 2»), como Foundry; D&D Beyond las nombra con letras
   («Goblin A») y solo al empezar el combate. El número no se reutiliza mientras haya copias.
7. **El compendio es para leer**: la entrada no lleva estado ni tiradas a nombre de nadie; su botón es «Poner en
   juego» (D&D Beyond hace lo mismo). Lo que se tira es la criatura en juego.

## Construido (2026-11-06) y lo que queda

Construido en la rama `modulo-4/compendio` (`tasks/plan.md`, `tasks/todo.md`): el formato (la hoja de cada tipo de
actor, `roll` en un recurso y `damage` en el tipo; ampliación pequeña de ADR-0011), el motor (`creatureView`,
`startingPlay`, `nextNumbers`, `damageTaken` en `@crisol/systems`), la tabla `campaign_creatures` (migración 0044), las
acciones (poner en juego, la lista y la hoja, la partida, tirar, quitar y `applyRoll`), la web («Poner en juego» en el
compendio, «En juego» en la barra de la campaña, la hoja genérica, «Aplicar» en el registro), la IA y el enlace
`[[@Nombre]]` desde una página con su tarjeta. Queda para después:
- que la criatura diga qué páginas la enlazan, y el bloque «Criatura» en el panel de la página de un PNJ (lienzo,
  tablero Wiki);
- el ajuste de la campaña para los PG tirados de entrada (hoy se elige al ponerla en juego; por defecto, medios);
- los recursos propios de las criaturas que hoy solo están en su texto (las recargas y las legendarias del 5e de
  ejemplo no van en su mecánica): con la ampliación de la mecánica (`research/foundry/compendio.md`, propuesta 9).

## Pruebas

- `packages/systems`: la hoja de un tipo de actor (con y sin composición), lo de la partida de una criatura sobre su
  entrada, los PG tirados, aplicar daño con resistencias y multiplicadores.
- Servidor: poner en juego copias y únicas con permisos, numerarlas, tirar por ellas, aplicar daño a varias, quitar
  las copias, el estado entre sesiones, deshacer, el jugador que no ve nada.
- Web: la hoja de la criatura (tirar un ataque y su daño, gastar una legendaria, recargar), «En juego», aplicar desde
  el registro, el enlace en la wiki con su tarjeta.
- E2E: el máster pone en juego tres goblins y al jefe, tira la cimitarra del Goblin 2, aplica el daño de una Bola de
  fuego a los cuatro con mitad al jefe, quita las copias y el jefe sigue con sus PG al volver a entrar.

## Fuera

Los encuentros guardados con su dificultad y PX, la iniciativa y los turnos, las fichas en el mapa (módulo 6), las
criaturas que controla un jugador (compañeros y monturas) y lo que ven los jugadores de ellas (módulo 5).
