# Spec: vision (módulo 6)

Estado: **spec** (2026-11-07). Tercera capacidad del módulo 6 (`docs/specs/modulo-6.md`), después de `fichas`.
Entrevista: `docs/modulos.md` § «### 6. Mesa». ADR-0018 (puntos 4 a 7 y 12). Estudios:
`research/foundry/vision-muros-y-niebla.md` (muros, puertas, luces, visión, niebla, rendimiento) y
`research/uvtt/formato.md`; lo que se porta, `docs/mesa-crisol-actual.md` (§ 3: `vision.ts`, `luz.ts`,
`visionJugadores.ts`, `visionAlSoltar.ts`, `niebla.ts`, `movimiento.ts`; § 8, el rendimiento). Diseño: el lienzo
«Crisol: la mesa», tablero Visión.

## Objetivo

Que la pantalla de la tele enseñe **solo lo que ve el grupo**: la niebla se descubre sola con lo que ven las fichas
del grupo (con muros, puertas y luces) y el máster destapa o tapa a mano. **A la pantalla no le llega nada que el grupo
no vea**: lo calcula el servidor.

Para quién: el máster; la tele; la IA.

## Requisitos

### Muros, puertas y luces (de la escena, en el mundo)

- **Muros**, cada tramo con lo que tapa: la vista, la luz y el paso (y el sonido, para el módulo 7), cada uno con
  «nada», «limitado» (el primero deja pasar; el segundo no) o «del todo»; de un solo sentido si se quiere. Tipos ya
  hechos: muro, muro bajo (deja ver por encima), invisible (tapa el paso, no la vista), ventana (deja ver, no pasar),
  objeto (lo que trae un UVTT como «objetos que tapan»).
- **Puertas**: normales, **secretas** (para el grupo son muro hasta que el máster las abre; entonces se ve el hueco,
  nunca que era secreta) y **con llave**; cerradas o abiertas como se dibujaron.
- **Luces**: radio brillante y tenue (en pies), color, intensidad, ángulo (un cono), si las cortan los muros; y la
  **oscuridad** de la escena (de día a noche cerrada) con su luz ambiental. Oscuridad mágica: tapa la vista salvo a la
  vista verdadera o ciega.
- **El editor**, en la mesa del máster (tablero Visión): dibujar muros encadenados (clic a clic; Mayús pega a las
  esquinas de la rejilla), puertas y luces; elegir, mover sus extremos y borrar; cambiar el tipo. Lo que traen un UVTT
  y los mapas que dibuja la IA se pone en juego al abrir la escena (con «Poner los muros del mapa» si ya tenía otros).

### La visión de las fichas

- Cada ficha del grupo (los personajes de la campaña en la escena) ve: lo que alcanza su vista y está en su línea de
  visión (los muros la cortan), lo iluminado dentro de su línea de visión y, con visión en la oscuridad, hasta su
  alcance en penumbra. Los sentidos salen del personaje (su sistema dice dónde: un campo de sentidos o de visión en la
  oscuridad, en pies); sin ellos, vista normal.
- **Lo que ve el grupo** es la unión de lo que ven sus fichas, más lo destapado a mano, menos lo tapado a mano (que
  manda siempre).
- **Se recalcula al soltar una ficha** (también en las casillas de su camino, para explorar el pasillo), al abrir o
  cerrar una puerta, al cambiar una luz o la oscuridad, y al cambiar los muros.

### La niebla

- **Lo explorado** se va llenando solo con lo que ve el grupo y se queda (en gris en la tele). Es de cada campaña en
  cada escena. «Reiniciar la niebla», con aviso.
- **A mano**: destapar o tapar con pincel, rectángulo o lazo. Destapar deja la zona a la vista (con sus fichas no
  ocultas); tapar la vuelve a cubrir aunque las fichas la vean. Se deshacen.
- **Escena «sin visión automática»** (mapas sin muros): solo vale la de a mano. Una escena nueva sin muros nace así.
- **«Ver como el grupo»**: la mesa del máster enseña lo que ve la tele (y una lista de lo que el grupo no ve: fichas
  ocultas por la niebla, puertas secretas).

### Lo que recibe la pantalla (ADR-0018, punto 4)

- Lo explorado y lo que está a la vista (una máscara), las fichas que caen en lo visible y no están ocultas, las luces
  ya recortadas a lo visible, y **solo las teselas del mapa que tocan lo explorado o lo visible**.
- **El ajuste de la campaña** (Enrique, 2026-11-07): las teselas del borde, **enteras** (por defecto: asoma como mucho
  una tesela más allá) o **recortadas** en el servidor con la máscara (para jugar online).
- No le llegan muros, puertas (ni que existen), luces apagadas, fichas fuera de la vista ni el arrastre de una ficha que
  el grupo no ve.

### Las puertas y el paso, en el servidor

- El máster abre y cierra cualquier puerta (con un clic en la mesa). Las reglas para cuando los jugadores muevan su
  ficha (módulo 7), ya en el servidor: solo puertas visibles, no secretas, sin llave; mover a través de un muro se
  rechaza.

### La IA

- `ver_muros` (los de una escena), `cambiar_muros` (añadir, cambiar o quitar muros, puertas y luces), `abrir_puerta`,
  `niebla` (destapar o tapar un rectángulo o unas casillas, reiniciar), `ver_como_grupo` (qué ve el grupo: casillas a la
  vista y fichas que ve), `oscuridad` (la de la escena).

### Rendimiento (ADR-0018, punto 5)

- La visión se calcula en el servidor, en un hilo de trabajo, con un índice espacial de los muros y lo que no depende
  de las fichas (aristas, polígonos de las luces) guardado por campaña y escena. Al importar, se unen los segmentos
  colineales.
- **Presupuesto**: recalcular la vista del grupo (seis fichas, 2.500 segmentos, 20 luces) en menos de 100 ms en el p95,
  medido en `test:rendimiento` con su paso en la CI.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Lo explorado, una rejilla de bits** (unos 10 px por bit, comprimida, fuera del historial); la niebla a mano, una
   lista de operaciones (sí en el historial).
2. **El grupo son los personajes de la campaña en la escena**; las criaturas aliadas, con un ajuste en su ficha
   («Ve con el grupo»), más adelante.
3. **El estado de cada puerta es de la campaña**: abrirla en una no la abre en otra.
4. **Las luces del mapa horneadas** (un UVTT con la luz ya pintada) llegan apagadas y con la escena iluminada.
5. **La máscara viaja como imagen pequeña** (un bit por celda de niebla, comprimida) y la tele la suaviza al pintarla.

## Pruebas

- **Núcleo**: las de la mesa actual portadas (visión, luz, sentidos, niebla, movimiento) y las nuevas del índice
  espacial, la rejilla de bits y la unión de segmentos.
- **Integración**: la proyección de la pantalla con muros, puertas (secreta cerrada y abierta) y luces; lo explorado
  que se queda; destapar y tapar; reiniciar; el ajuste de las teselas (enteras y recortadas); las herramientas MCP.
- **Rendimiento**: el presupuesto de arriba.
- **Fugas** (la prueba que cada módulo amplía): a la pantalla no le llega ni un muro, ni una puerta secreta, ni una
  ficha fuera de la vista, ni una tesela sin explorar.
- **E2E**: una cripta con una puerta secreta: la tele no la ve; el grupo entra por la puerta normal y la sala se
  descubre; el máster abre la secreta y se ve el hueco.

## Fuera

La visión de cada jugador en su aparato (módulo 7; el cálculo ya es por «quién mira»); el sonido que los muros tapan
(módulo 7); niveles y pisos; la luz animada en la tele más allá de la de la mesa actual.
