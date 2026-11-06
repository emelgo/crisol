# Spec: grupo (módulo 4)

Estado: **construido** (2026-11-06, rama `modulo-4/grupo`; ver § «Construido»). Quinta capacidad del módulo 4 (`docs/specs/modulo-4.md`). Decisión de antes:
«Inventario del grupo, en la campaña: lo ven y cambian sus jugadores y el máster, y de él se pasan cosas a cada
personaje» (`docs/modulos.md` § 3, segunda parte de la entrevista). Estudios: `research/dndbeyond/criaturas-y-grupo.md`
§ 4 y propuestas 10 a 12; `research/foundry/criaturas-y-capas.md` § 4 y propuesta 7.

## Objetivo

Que la campaña tenga **lo que es de todos**: el botín, el carro, la bolsa común. Un inventario del grupo, con sus
contenedores y sus monedas, que ven y cambian el máster y los jugadores, y del que se **mueven** cosas a un personaje y
de vuelta (sin duplicarlas). Se ve en la hoja de cada personaje, junto a lo suyo («Mío | Del grupo»), como en D&D
Beyond, y en la campaña.

Para quién: los jugadores y el máster, en partida y entre sesiones; la IA, que reparte el botín.

## Requisitos

- **El inventario del grupo** es de la campaña: objetos del compendio (por su clave, del sistema o del mundo) o
  escritos a mano (un nombre y una nota), con su cantidad, en contenedores (uno de serie, «Del grupo»; se crean otros:
  «El carro», «La bolsa»), y las monedas del grupo (los campos de monedas que diga el sistema).
- **Mover**: de un personaje al grupo y del grupo a un personaje, toda la cantidad o parte; entre contenedores. Mover
  no duplica: sale de un sitio y entra en el otro en la misma operación (con historial y deshacer).
- **Las monedas**: pasar del grupo a un personaje y al revés; repartir a partes iguales entre los personajes (lo que
  sobra se queda en el grupo).
- **Equipar desde el grupo**: no; para equiparlo, se mueve al personaje (así sus efectos están en una sola hoja).
- **Quién**: todos los de la campaña lo ven y lo cambian; mover a un personaje lo puede hacer su dueño y el máster (un
  jugador da al grupo lo suyo y coge del grupo para el suyo). El máster puede mover y borrar cualquier cosa.
- **Sin atascos**: si se borra un personaje o su jugador deja la campaña, lo suyo no se pierde ni bloquea el grupo.
- **Dónde se ve**: en la hoja de cada personaje, «Mío | Del grupo» en el inventario; y en la campaña, «Grupo» en su
  barra, con todo junto. En tiempo real para todos.
- **La IA**: ver el inventario del grupo, añadir y quitar, mover a un personaje y repartir monedas.
- **Todo con el teclado y en el móvil**, WCAG 2.1 AA; textos por i18n.

## Decisiones (propuestas de los estudios, por confirmar al ver las pantallas)

1. **«Mover», no arrastrar** (Foundry copia al arrastrar y mueve con una tecla); arrastrar puede añadirse después.
2. **Sin PX del grupo** de momento (Foundry los lleva en su actor de grupo): no hay PX en el formato del sistema.
3. **Lo escrito a mano** no tiene mecánica: si se quiere que haga algo, se copia al compendio del mundo.

## Construido (2026-11-06)

Como se propuso, con estas precisiones al construirlo:
- **Qué campos**: los dice `party` en el sistema (`items`, `coins`); si no, el primer campo de objetos y el primer grupo
  de números enteros sin tope que se cambian jugando (el 5e: `inventario` y `monedas`). Sin monedas, el grupo no tiene.
- **Lo escrito a mano se queda en el grupo**: un personaje solo lleva lo del compendio.
- **Repartir es del máster**, porque cambia los personajes de todos; pasar monedas con un personaje, su dueño o el
  máster.
- **Los movimientos** salen en «Grupo» para todos los de la campaña (las últimas operaciones del grupo, con quién).
- **Con la IA**, mover, pasar monedas y repartir esperan al máster, como lo de los personajes.
- **Lo gastado viaja con el objeto** (una varita con cargas gastadas): se mueve entero y no se junta con lo igual, ni
  en el grupo ni en el personaje. Al mismo sitio no se mueve.
- **Los movimientos los ve toda la campaña**, con los nombres de los personajes y cuántas monedas: el botín es de
  todos (decidido al revisarlo; si molesta, se recorta para los jugadores).
- **Topes**: 100.000 de lo mismo y 1.000.000.000 de cada moneda; leer el grupo nunca falla aunque una hoja pase de ellos.

Queda: arrastrar (decisión 1), el peso de cada contenedor y la sintonía; y que una criatura o un PNJ del máster lleve
cosas del grupo.

## Pruebas

- `packages/systems`: mover (parte o todo, entre contenedores y con un personaje), repartir monedas.
- Servidor: los permisos (cada jugador, lo suyo y el grupo; el máster, todo), mover sin duplicar en una operación,
  deshacer, el personaje borrado, tiempo real.
- Web: «Mío | Del grupo» en la hoja, mover con su cantidad, las monedas, la vista del grupo en la campaña.
- E2E: la jugadora mueve una poción del grupo a su personaje, la usa, y el máster reparte 100 po entre tres.

## Fuera

Los PX y los encuentros (módulo 6), las tiendas y los precios, los contenedores con peso y carga del grupo y lo que el
máster esconde del botín (módulo 5).
