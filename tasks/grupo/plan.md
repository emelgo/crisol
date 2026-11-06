# Plan: Módulo 4 — grupo

Estado: en marcha (2026-11-06). Spec: `docs/specs/grupo.md` · Diseño: lienzo «Crisol: compendio y criaturas», tablero
Grupo (`out/lienzo-compendio/project/Grupo.dc.html`) · Tareas: `tasks/todo.md`. Los planes anteriores, en
`tasks/<capacidad>/`.

## Cómo

- **Qué campos**: el inventario del personaje es su campo `items` que se cambia jugando, y las monedas, su grupo de
  números que se cambia jugando (el 5e: `inventario` y `monedas`). El sistema puede decirlos con `party` (`{ items,
  coins }`, ampliación pequeña de ADR-0011); si no, se deducen así. Sin campo de monedas, el grupo no tiene monedas.
- **El grupo**, una fila por campaña (`campaign_party`, con historial; migración 0047): sus contenedores (uno de
  serie, «Del grupo»), sus objetos (del compendio, por su clave y con su nombre guardado; o escritos a mano, con un
  nombre y una nota) con su cantidad y su contenedor, y sus monedas.
- **El motor** (`packages/systems/src/party.ts`): poner y sacar del grupo y de lo que lleva un personaje (parte o todo,
  juntando lo igual), mover monedas sin quedar en negativo y repartirlas a partes iguales (lo que sobra, al grupo).
- **Mover** es una sola operación con el grupo y el personaje (historial y deshacer). Lo escrito a mano se queda en el
  grupo (un personaje solo lleva lo del compendio). Un jugador mueve con su personaje; el máster, con cualquiera.
- **Web**: «Grupo» en la barra de la campaña (sus contenedores, sus monedas, mover y repartir) y, en la hoja, «Mío |
  Del grupo» en el inventario y «Mover» en cada cosa que lleva.
- **IA**: `ver_grupo`, `cambiar_grupo` y `mover_grupo` (objetos y monedas, y repartir).

## Puntos de control

1. Tras la tarea 3: mover por la API una poción del grupo a un personaje y de vuelta, y repartir monedas.
2. Tras la 6: verlo en la web, en la campaña y en la hoja.
