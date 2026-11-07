# Módulo 6: la mesa

Mapa de capacidades (2026-11-07), de la entrevista con Enrique (`docs/modulos.md` § «### 6. Mesa»). Cada capacidad
tiene su spec en `docs/specs/<id>.md` y su ciclo (diseño, plan, construcción y revisión), en este orden. La decisión de
fondo, en el ADR-0018. Los estudios: `research/foundry/vision-muros-y-niebla.md`,
`research/foundry/escenas-fichas-y-combate.md`, `research/dndbeyond/mapas.md` y `research/uvtt/formato.md`; lo que se
porta de la mesa del Crisol actual (código nuestro), en `docs/mesa-crisol-actual.md` y § «Lo que se porta».

| Id | Qué hace | Depende de |
|---|---|---|
| `escenas` | La pestaña «Escena» de una página (la del lugar): su imagen, su rejilla (cuadrada, hexagonal o sin rejilla, con su escala y su regla de diagonales) y alinearla con el mapa; la sala de mesa de cada campaña en el servidor (su estado, guardado); la mesa del máster (moverse, acercar, abrir una escena en la campaña); **la segunda ventana** (la pantalla de la tele), que pide al servidor la vista del grupo: presentar y ocultar (distinto de abrir), fundido y cámaras (seguir al máster, fija, encuadrar al grupo); un UVTT trae su imagen y su rejilla; la IA | — |
| `fichas` | Las fichas: cada una es un personaje o una criatura en juego (la hoja, los PG y los estados son los suyos, no una copia); ponerlas desde el panel de la mesa (los personajes de la campaña, el compendio, que las pone en juego, y los encuentros con su formación); tamaño real, rótulo corto y color de bando; moverlas (libre; Mayús pega a la rejilla); barras; estados con caducidad; ocultas; al pulsarla, su hoja y sus tiradas; en la pantalla, su estado en palabras; el creador de fichas (la imagen recortada en redondo); la IA | `escenas` |
| `vision` | El ajuste de la campaña: teselas enteras o recortadas en el borde de lo explorado; muros (de vista, de luz, bajos, de un sentido, invisibles), puertas (normales, secretas, cerradas con llave), luces y oscuridad de la escena, la visión de las fichas (en la oscuridad y otros sentidos); **la niebla**: lo explorado por cada campaña (lo que ven las fichas del grupo juntas) y la de a mano (destapar y tapar con pincel, rectángulo o lazo); el servidor calcula la vista y a la pantalla no le llega nada que el grupo no vea; el editor de muros y luces; un UVTT trae sus muros, puertas y luces; el rendimiento, medido; la IA | `fichas` |
| `combate` | La iniciativa (con la fórmula del sistema, desde la hoja o la mesa), rondas y turnos, bandos, saltar derrotados; la caducidad de los estados en el servidor al pasar turno; de quién es el turno, en la ficha y en la pantalla; aplicar daño o curar a varias fichas (las elegidas o las de dentro de una plantilla); acabar el combate (las genéricas se van, con su deshacer); la IA | `fichas` |
| `herramientas-mesa` | Medir (línea, círculo, cono, cuadrado; con puntos intermedios) y dejarlo como plantilla de área; dibujo, sellos, texto, puntero láser, imágenes y pines a páginas; widgets (contador, reloj de progreso, temporizador); instantáneas con miniatura; la pantalla del máster (los statblocks de la escena y una nota); atajos; la IA | `escenas` |
| `escenas-foundry` | Las escenas y aventuras de un zip de Foundry: la escena con su imagen, su rejilla, sus muros, puertas, luces y pines; sus fichas pasan a criaturas preparadas (del compendio del sistema o del mundo); reimportar sin duplicar | `vision` |

Orden: `escenas` → `fichas` → `vision` → `combate` → `herramientas-mesa` → `escenas-foundry`. Lo primero es poder
abrir un mapa en la tele; luego, ponerle fichas; luego, la niebla (lo que más cuesta y lo que más se nota); el combate
y las herramientas, después; Foundry, al final, porque se apoya en todo lo anterior.

**Estado (2026-11-07)**: entrevista hecha; estudios hechos; este mapa y el ADR-0018, en propuesta. Teselas del borde
de lo explorado: enteras o recortadas, un ajuste de cada campaña (Enrique; ADR-0018, punto 7). Los mapas que dibuja la
IA en SVG, en `escenas`.

## Lo que se da por hecho (propuesta de Claude, por confirmar al verla)

1. **La escena es una pestaña de la página del lugar** (ADR-0007): un solo árbol, una búsqueda, unos enlaces y un
   historial. «Escenas», en la mesa, es la lista de esas pestañas del mundo. Lo que es del mundo (preparación): la
   imagen, la rejilla, los muros, las puertas como se dibujaron, las luces, la oscuridad, los pines y las criaturas y
   encuentros preparados en su sitio.
2. **El estado es de cada campaña**: las fichas en el mapa, las puertas abiertas, la niebla (explorada y a mano), las
   plantillas, los dibujos y textos, el combate y las instantáneas. Dos campañas en la misma cripta no se ven.
3. **La ficha no guarda estado propio**: es dónde está (y cómo se ve: tamaño, rótulo, bando, oculta) un personaje o una
   criatura en juego (`campaign_creatures`). El daño baja la barra en la mesa, en la hoja y en «En juego» a la vez, y
   quitar una ficha del mapa no pierde nada. Lo que no tiene hoja (un carro, un altar) va como imagen o sello.
4. **El servidor manda** (ADR-0018): una sala de mesa por campaña en el servidor, con el estado en memoria y guardado
   en la base; cada cliente recibe su vista (el máster, todo; la pantalla, lo del grupo; más adelante, cada jugador, lo
   de su ficha). La visión se calcula en el servidor con el mismo núcleo que pinta el cliente.
5. **La niebla es del grupo**, por campaña y escena: lo explorado se llena solo con lo que ven las fichas del grupo
   (los personajes de la campaña en la escena); la de a mano destapa (se ve, con sus fichas no ocultas) o tapa (manda
   siempre, aunque las fichas lo vean). Una escena sin muros va «sin visión automática».
6. **La visión cambia al soltar la ficha**, no mientras se arrastra (como en la mesa actual, decisión de Enrique). El
   arrastre y el láser van en vivo por la sala y no se guardan.
7. **Las coordenadas**, en píxeles de la imagen del mapa (sin margen); la IA habla en casillas (columna y fila) y
   nombra las fichas por su rótulo («Lobo 2»).
8. **Los turnos y la caducidad, en el servidor**: en Foundry dependen del navegador del máster; aquí, de nadie.
9. **Al acabar el combate se van las genéricas** (módulo 4: «una copia por aparición, que se va al acabar»), en una
   operación que se deshace.
10. **Un encuentro** es del mundo: unas criaturas con su formación (posiciones relativas). Ponerlo en la mesa las pone
   en juego en la campaña y las coloca donde se suelta. No hay en Foundry ni en dnd5e; sí en la mesa actual.
11. **No hay biblioteca aparte**: el panel de la mesa reúne las escenas (pestañas), los encuentros, las criaturas del
    compendio, los personajes de la campaña y las imágenes (archivos del mundo). El creador de fichas recorta la imagen
    de una criatura o un personaje en redondo (la «ficha redonda» que quedó pendiente del módulo 4).
12. **La regla de diagonales**, la del sistema por defecto (en el 5e, todas iguales), y se cambia por escena.
13. **Los iconos de los estados**, propios o de Lucide (ISC): los de la mesa actual son CC BY 3.0, que el listón no
    admite.
14. **El rótulo corto y el color de bando** en cada ficha, para no confundir dos bandos (queja de Enrique en la mesa
    actual: las iniciales de las criaturas renombradas salían iguales).

## Lo que se porta de la mesa del Crisol actual

Notas completas en `docs/mesa-crisol-actual.md` (resumidas aquí).

- **Casi tal cual**, el núcleo (`packages/mesa/src/nucleo`, unas 3.400 líneas de TypeScript puro y unas 120 pruebas):
  rejilla cuadrada y hexagonal, medidas y tres reglas de diagonales, plantillas de área, muros que frenan, visión y
  línea de visión (muros de vista o de luz, bajos, de un sentido, puertas que abren su hueco), luz con caída, visión
  del grupo (en la oscuridad, ciega, vibraciones, oscuridad mágica), niebla a mano como operaciones, iniciativa,
  cámaras de la pantalla y alinear la rejilla con el mapa. También los comandos de `estado/comandos.ts` (ya separan lo
  del mundo de lo de la campaña), la formación de los encuentros y los widgets. Con identificadores en inglés, un
  esquema con nombres propios y una cabecera de origen.
- **Adaptar**: el importador UVTT (con las trampas de `research/uvtt/formato.md`, en el servidor y con la imagen en
  WebP); la proyección para jugadores, que hoy deja pasar todo y la esconde quien pinta; las capas de PixiJS; las
  órdenes de la IA, que pasan a herramientas MCP.
- **Rehacer**: el orquestador, la ventana de jugadores (conservando lo que hace), lo explorado (hoy un PNG del
  navegador; en el servidor, una máscara), la persistencia y el historial (a la base y sus operaciones), las
  herramientas de ratón y teclado, y la biblioteca.
- **Riesgo**: el cálculo de la visión crece con el cuadrado de los muros (una cueva de UVTT trae unos 2.400 tramos).
  Antes de construir encima: índice espacial, descartar por distancia, caché, y una prueba de rendimiento.
