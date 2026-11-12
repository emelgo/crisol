# ADR-0025: Los capítulos de los libros

Estado: aceptada (Enrique, 2026-11-11: aprobó el plan de la revisión, `tasks/plan-revision.md` § «Tanda 7»); se
construye en la tanda 7. Amplía el ADR-0021 (libros y el espacio de la campaña).

## Contexto

Un libro de un sistema (ADR-0021) es hoy una fuente de entradas del compendio: clases, conjuros, criaturas… Pero los
libros de rol son también **texto corrido**: cómo se juega, el capítulo de combate, la ambientación, una aventura. Ese
texto no cabe en una entrada (no es un conjuro ni una criatura) y hoy se queda fuera, o se mete a la fuerza en una
página de la wiki de un mundo, que no viaja con el sistema ni la leen las campañas de otros mundos.

En la revisión, Enrique pidió libros con capítulos que se lean como en D&D Beyond (`research/dndbeyond/
contenido-y-enlaces.md` § 2: el índice a la izquierda que sigue la lectura, anterior y siguiente, cuadros y tablas en
el texto, en el móvil un «Ir a…»).

## Decisión

1. **Una tabla propia, `system_chapters`**: cada capítulo es de un libro (el sistema y la clave del libro), con su
   título, su puesto entre los del libro y su texto en **Markdown**, el mismo que las páginas y las notas del jugador
   (Obsidian: títulos, listas, tablas, llamadas `> [!nota]`, enlaces `[[@Entrada]]` al compendio). Solo de los
   sistemas de la cuenta; los de serie no traen capítulos.
2. **Viajan con el sistema**: se exportan y se importan con su archivo, dentro de cada libro, y se copian al copiar el
   sistema. Borrar un libro se lleva sus capítulos.
3. **Se escriben con el editor de bloques**, como las notas del jugador (sin colaboración en vivo: un capítulo lo
   escribe una persona cada vez; si dos lo cambian a la vez, gana la versión que se tenía, como en el resto del sistema).
4. **Se leen en el libro**: el libro por dentro (tanda 6) gana una pestaña «Capítulos» junto a su índice de entradas.
   El lector: a la izquierda los capítulos del libro y, dentro del abierto, sus secciones (sus títulos), que **siguen la
   lectura**; anterior y siguiente; en el móvil, un «Ir a…» en lugar del índice. En la campaña, sus jugadores leen los
   capítulos de los libros que eligió la campaña (los mismos que su compendio), también en el móvil.
5. **Lo del máster no llega a los jugadores**: un bloque `> [!secreto]` de un capítulo se quita al servirlo a quien no
   dirige la campaña, como en las páginas. No hay «quién la conoce» por capítulo: un capítulo lo lee toda la campaña que
   tiene su libro.
6. **Herramientas MCP**: listar los capítulos de un libro, leer uno, crear o cambiar uno (con su versión), ordenarlos y
   borrar uno. Se deshacen desde el historial, como los demás cambios del sistema.

## Consecuencias

- Un sistema con su ambientación y sus reglas escritas se pasa entero (con la IA, desde un PDF de la biblioteca) y se
  lee en todas las campañas que lo usan, de cualquier mundo.
- Los capítulos no se buscan aún en la búsqueda del mundo ni se marcan como conocidos; si hace falta, otro ADR.
- La incrustación de entradas (`![[@Nombre]]`, tanda 7) funciona igual en un capítulo que en una página.
