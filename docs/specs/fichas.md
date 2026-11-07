# Spec: fichas (módulo 6)

Estado: **spec** (2026-11-07). Segunda capacidad del módulo 6 (`docs/specs/modulo-6.md`), después de `escenas`.
Entrevista: `docs/modulos.md` § «### 6. Mesa». ADR-0018. Estudios: `research/foundry/escenas-fichas-y-combate.md`
(fichas enlazadas y no enlazadas, barras, estados con duración), `research/dndbeyond/mapas.md` (la ficha y la hoja van
y vuelven); lo que se porta, `docs/mesa-crisol-actual.md` (§ 3: `movimiento.ts`, `rebote.ts`, `asas.ts`). Diseño: el
lienzo «Crisol: la mesa», tableros Mesa, Pantalla y Combate (poner un encuentro).

## Objetivo

Que el máster ponga en el mapa a los personajes y a las criaturas en juego, y las mueva: **la ficha es el personaje o
la criatura** (Enrique: «como en foundry o dndbeyond»), no un dibujo suelto. El daño baja su barra en la mesa, en su
hoja y en «En juego» a la vez; en la tele, las criaturas enseñan su estado en palabras.

Para quién: el máster; la tele; la IA.

## Requisitos

### La ficha

- **Es una colocación**: dónde está, en una escena de una campaña, un personaje de la campaña o una criatura en juego, y
  cómo se ve: su tamaño (en casillas, el de su tamaño en el sistema; se cambia), su **rótulo corto** («G3», «Lía»;
  sale solo y se cambia), su **bando** (grupo, hostil o neutral; los personajes, grupo; las criaturas, hostil), si
  está oculta a los jugadores y el encuadre de su imagen.
- **Lo vital es del personaje o de la criatura**: los PG (la barra bajo la ficha), los estados y la hoja. Quitar una
  ficha del mapa no quita a nadie de juego ni pierde nada. Una criatura o un personaje tiene como mucho una ficha por
  escena; cada copia genérica ya es una criatura en juego distinta.
- **Su imagen**: el retrato del personaje o la imagen de la criatura, recortada en redondo; sin imagen, un disco con su
  inicial. El borde, del color de su bando (azul el grupo, naranja lo hostil, amarillo lo neutral: se distinguen
  también por la luz, no solo por el tono).

### Ponerlas

- Desde el panel de la mesa, arrastrando al mapa:
  - **Personajes**: los de la campaña.
  - **Criaturas**: el compendio de la campaña. Soltar una la pone en juego (una copia, o la única si lo es; con
    cantidad, varias copias juntas) y la coloca.
  - **En juego**: las que ya están en juego y no tienen ficha en esta escena.
  - **Encuentros**: los del mundo. Soltar uno pone en juego todas sus criaturas y las coloca en su formación.
- **Los encuentros** son del mundo: un nombre y sus criaturas (por su clave del compendio, con cuántas y si es la única)
  con su sitio relativo. Se crean desde el panel o eligiendo fichas en el mapa («Guardar como encuentro»). Si la campaña
  usa otro sistema, lo que no encuentra se salta y se dice.

### Moverlas

- **Arrastrar**, libre por defecto; con Mayús, pega a la rejilla (decisión de Enrique en la mesa actual). Varias a la vez
  (recuadro, o Mayús + clic). Las flechas mueven las elegidas una casilla.
- **El arrastre se ve en vivo en la tele** (salvo las ocultas) y se guarda al soltar, en una operación del historial:
  Ctrl+Z deshace el último movimiento.

### Al pulsarla

- **Su tarjeta** (como el lienzo): nombre, la barra de PG con dañar y curar, la CA, sus estados, «Abrir hoja», su
  tirada principal y «Ocultar». Doble clic abre su hoja en un panel al lado, sin salir de la mesa: la del personaje o la
  de la criatura, con todas sus tiradas.
- **Los estados**: ponerlos y quitarlos desde la tarjeta: los del sistema (las entradas de tipo estado de su compendio,
  si las tiene) o uno escrito a mano, con duración opcional en rondas (caducan con `combate`). Se guardan con lo de la
  partida del personaje o de la criatura, así que también salen en su hoja y en «En juego». Iconos propios o de Lucide.

### En la tele

- Las fichas no ocultas, con su nombre y su imagen; las criaturas, con su estado en palabras («Ilesa», «Herida»,
  «Malherida», «A punto de caer», como en el módulo 5) y sus estados a la vista; sin PG, CA ni hoja.
- **«Encuadrar al grupo»**: una cámara más de la pantalla, que enseña las fichas del grupo.

### La IA

- `ver_fichas` (las de una escena en una campaña, en casillas y con su rótulo), `poner_ficha` (un personaje, una
  criatura en juego o una del compendio, que pone en juego, en una casilla), `mover_fichas` (a casillas, por su
  rótulo), `cambiar_ficha` (rótulo, bando, tamaño, oculta), `quitar_ficha`, `poner_estado` y `quitar_estado`,
  `ver_encuentros`, `guardar_encuentro` y `poner_encuentro`.

### El servidor

- Las fichas, en filas por campaña y escena (en el historial); la proyección de la tele las filtra (ocultas fuera; de
  las criaturas, solo el estado en palabras). El arrastre en vivo va por el WebSocket de la mesa y no se guarda.
- Los estados con duración, en lo de la partida (`play.conditions`), con su caducidad para `combate`.
- La prueba de fugas: a la tele no le llegan ni las fichas ocultas (tampoco su arrastre), ni PG, ni CA.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Una ficha por personaje o criatura en cada escena**: las genéricas ya son una criatura por copia (módulo 4), así
   que no hace falta la ficha «no enlazada» de Foundry.
2. **Libre por defecto y Mayús pega a la rejilla**, como decidió Enrique en la mesa actual.
3. **El arrastre se ve en vivo en la tele**: en persona, los jugadores siguen el movimiento. Con `vision`, una ficha que
   entra o sale de la vista del grupo se decide al soltarla.
4. **Los estados van con el personaje o la criatura**, no con la ficha: así los ve la hoja, «En juego» y la tele igual,
   y no se pierden al quitar la ficha.
5. **Los encuentros, del mundo y por clave del compendio**: se preparan una vez y sirven a todas las campañas con ese
   sistema.

## Pruebas

- **Núcleo**: colocar y pegar a la rejilla según el tamaño (cuadrada y hexagonal), la formación de un encuentro, el
  rótulo corto.
- **Integración**: poner, mover (varias), quitar y deshacer; poner desde el compendio y desde un encuentro; los estados
  con duración; la proyección de la tele (ocultas fuera, el estado en palabras); el arrastre en vivo (no llega lo
  oculto); las herramientas MCP.
- **E2E**: poner a Lía y tres goblins de un encuentro, moverlos, dañar a uno desde su tarjeta y verlo «Herido» en la
  pantalla; ocultar uno y ver que desaparece de la pantalla.
- **Fugas**: lo de arriba, en la prueba de fugas.

## Fuera

La elevación, las auras y varias fichas por criatura; que los jugadores muevan su ficha (módulo 7); la visión y la
niebla (`vision`); los turnos y la caducidad al pasar turno (`combate`); medir (`herramientas-mesa`).
