# Spec: compendio-jugadores (módulo 5)

Estado: **en marcha** (2026-11-06). Cuarta capacidad del módulo 5 (`docs/specs/modulo-5.md`). Entrevista:
`docs/modulos.md` § «### 5. Visibilidad por campaña». ADR-0017. De antes: `docs/specs/compendio-mundo.md` y
`docs/specs/criaturas.md` (hasta ahora, lo del mundo y lo que está en juego, solo para el máster).

## Objetivo

Que los jugadores vean del compendio y de la partida **lo que deben**: el compendio del sistema, como un libro (salvo
lo que el máster oculte en su campaña); del compendio del mundo, solo lo que se les revela; y de las criaturas en
juego, su nombre, su imagen y **cómo están, en palabras**, sin sus PG ni su hoja.

Para quién: el jugador en su campaña; el máster, que decide; la IA de los dos.

## Requisitos

### El compendio del sistema

- El jugador lo ve entero, como hoy, con las fuentes que eligió la campaña.
- En los ajustes del compendio de la campaña, el máster **oculta a los jugadores un tipo o una sección** (por ejemplo,
  las criaturas, para que no lean el bestiario). Lo oculto no sale en su biblioteca, ni en la búsqueda, ni en
  `buscar_contenido` de su IA.
- Lo que un personaje ya lleva (un conjuro, un objeto) se le sigue viendo en su hoja aunque su tipo esté oculto: es
  suyo.

### El compendio del mundo

- Cada entrada del mundo es **del máster hasta que la revela** a la campaña o a unos personajes, como una página
  (`revelar`: con aviso y en «Lo que sabe el grupo»).
- Revelada, el jugador la ve en el compendio de su campaña, marcada «Del mundo», y la puede llevar en su personaje si
  el sistema lo deja (un objeto que encontró).

### Las criaturas en juego

- Al ponerlas en juego, **a la vista** (por defecto) u **ocultas**; se cambia después con un clic en «En juego».
- El jugador ve, en «En juego» de su campaña, las que están a la vista: su nombre («Goblin 2»), su imagen y su estado
  en palabras según sus PG: **«Ilesa»** (todos), **«Herida»** (por encima de la mitad), **«Malherida»** (la mitad o
  menos), **«A punto de caer»** (una cuarta parte o menos) y **«Fuera de combate»** (0). Ni sus PG, ni su CA, ni su
  hoja.
- Sus tiradas siguen ocultas salvo que el máster las enseñe (como hasta ahora). Aplicar daño desde una tirada de un
  jugador (`aplicar`) lo sigue haciendo el máster.
- Lo de las criaturas le llega en tiempo real, sin los números.

### La IA

- Del máster: `revelar` con una entrada del mundo; `cambiar_campana` oculta tipos o secciones; `poner_en_juego` con
  `hidden`.
- Del jugador: `buscar_contenido`, `leer_contenido` y `ver_en_juego` le dan solo lo suyo (las criaturas, con su
  estado en palabras).

## Decisiones (propuestas de los estudios, por confirmar al ver las pantallas)

1. **Los umbrales del estado** (arriba), como la marca de malherida al 50 % de D&D Beyond
   (`research/dndbeyond/criaturas-y-grupo.md`), con uno más fino para el final.
2. **Las criaturas, a la vista por defecto**: se ponen en juego cuando empieza el combate.

## Pruebas

- Servidor: el jugador no recibe los PG, la CA ni la hoja de una criatura (API, tiempo real, MCP); no ve las ocultas;
  no ve un tipo oculto del sistema; ve una entrada del mundo solo al revelársela.
- E2E: el máster pone dos goblins a la vista y un jefe oculto; el jugador ve «Goblin 1 · Herido» y no ve al jefe.
- La prueba de fugas, ampliada con el compendio y lo que está en juego.

## Fuera

- Las fichas en el mapa, la iniciativa y los encuentros (módulo 6).
- Que un jugador controle una criatura (un familiar, una montura): módulo 6.
