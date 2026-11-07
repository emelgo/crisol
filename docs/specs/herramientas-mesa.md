# Spec: herramientas-mesa (módulo 6)

Estado: **spec** (2026-11-07). Quinta capacidad del módulo 6 (`docs/specs/modulo-6.md`). Entrevista: `docs/modulos.md`
§ «### 6. Mesa» (lo que entra de la mesa actual). ADR-0018. Estudios: `research/foundry/escenas-fichas-y-combate.md`
(plantillas y regla de medir), `research/dndbeyond/mapas.md` (plantillas por tipo de daño); lo que se porta,
`docs/mesa-crisol-actual.md` (`medidas.ts`, `plantillas.ts`, `dibujo.ts`, `laser.ts`, `imagenes.ts`, `chinchetas.ts`,
`camaraJugadores.ts`, `sesion/instantaneas.ts`, los widgets). Diseño: el lienzo «Crisol: la mesa», tablero
Herramientas (y la plantilla y sus objetivos del tablero Combate).

## Objetivo

Las herramientas de la mesa actual que Enrique usa jugando: medir y dejar plantillas de área, dibujar y señalar, los
widgets, las instantáneas y la pantalla del máster.

## Requisitos

- **La columna de herramientas** a la izquierda del lienzo (como el lienzo): elegir, medir, plantilla, dibujar, texto,
  sellos, pin, láser; abajo, la pantalla del máster y las instantáneas. Atajos de teclado para cada una.
- **Medir**: línea con puntos intermedios (clic a clic), círculo, cono y cuadrado; la distancia en la unidad de la
  escena con su regla de diagonales (todas iguales, alternas o real), en cuadrada y hexagonal. Arrastrar una ficha
  enseña lo que recorre. **«La tele ve lo que mides»** (un interruptor): la medida en curso va en vivo a la pantalla.
- **Plantillas de área**: dejar la medida como plantilla (círculo, cono de 53°, línea con anchura, cuadrado), con su
  color o la trama de su tipo de daño; moverla y girarla; **las fichas de dentro** se marcan y se pueden elegir de una
  vez para aplicarles daño (lo de `combate`). Cada una se ve u oculta en la tele.
- **Dibujar** a mano alzada (con goma), **texto** y **sellos** (iconos propios o de Lucide; Kenney, CC0, si se
  quieren objetos) en el mapa; se ven en la tele salvo los marcados del máster.
- **Pines** en la mesa que llevan a páginas (los de los mapas de la wiki, aquí sobre la escena).
- **Puntero láser**: una estela que dura un momento, en vivo en la tele; no se guarda.
- **Imágenes sueltas** en el mapa (un archivo del mundo), con giro y tamaño.
- **Widgets** de la campaña: contador, reloj de progreso (segmentos) y temporizador; cada uno con su ojo para verse o
  no en la tele.
- **Instantáneas**: guardar el estado de la escena en la campaña (fichas, puertas, niebla, plantillas, dibujos) con su
  miniatura, y volver a una (con aviso: se deshace).
- **La pantalla del máster**: un cajón que sube desde abajo del mapa con los statblocks de las criaturas de la escena
  (sus ataques se tiran con un clic) y una nota de una página enlazada.
- **La IA**: medir entre dos casillas, poner y quitar plantillas (y decir qué fichas quedan dentro), widgets,
  instantáneas.

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Plantillas, dibujos, textos, sellos, pines e imágenes son de la campaña en la escena** (como las fichas), con
   historial; el láser y la medida en curso solo van en vivo.
2. **Los widgets son de la campaña**, no de la escena: siguen ahí al cambiar de mapa.
3. **Una instantánea guarda solo lo de la campaña en esa escena**, no la escena del mundo ni las criaturas en juego.

## Pruebas

- **Núcleo**: medidas (las tres reglas, hexagonal), las fichas de dentro de cada forma de plantilla.
- **Integración**: plantillas (y sus fichas de dentro), dibujos, widgets e instantáneas con deshacer; lo que la tele
  recibe (lo del máster, no); las herramientas MCP.
- **E2E**: medir un cono, dejarlo como plantilla, elegir las fichas de dentro y dañarlas; un reloj de progreso en la
  tele; guardar una instantánea y volver a ella.

## Fuera

La capa de clima (módulo 8); el sonido posicional (módulo 7); el generador de botín y los paquetes de colección.
