# Tanda 4: el mundo, la página y la hoja (plan de construcción)

Lo que dijo Enrique (revisión del 2026-11-11, «Mundo»):

- «La barra derecha de las páginas debe tener tamaño fijo como la izquierda y que sea con scroll como se baja si ocupa
  más del tamaño normal. Y en la página dentro de la mesa también igual, scroll solo dentro de la columna.»
- «La parte en la que escribimos debe ocupar todo el ancho disponible, ahora mismo se corta, para que si es una columna
  la ocupe entera y si son dos ambas se repartan el espacio o si no es posible por el tamaño de la hoja al menos
  centrarlo; la línea de salto de página y columna debe ocupar todo el ancho y si hay un salto de página debe aparecer
  la página que hemos cerrado, es decir página 1 si es la página 1.»
- «Lo de nota lateral no funciona bien con lo de izquierda y derecha.»
- «Al descargar e imprimir que pida versión con los colores o en blanco y negro.»
- «La columna izquierda desaparece al darle al mundo, no debe, está fija.»
- «Al darle a exportar se despliega pero no es intuitivo y no parece un desplegable.»

Rama `revision/tanda-4` (sobre la 3, sin subir aún). Enrique revisa las tandas juntas: lo que cambia a la vista va con
capturas de antes y después (en `out/tanda-4/` y en una página para él al acabar). Cada porción, en su commit.

## Porciones

1. [x] **Las columnas de los lados, fijas.** Pulsar el mundo en la barra ya no recoge la izquierda (lleva a su portada;
   en lo estrecho abre el cajón). La derecha, del mismo alto que la izquierda (el que cabe en la ventana) y con su
   desplazamiento dentro. En la ventana de una página de la Mesa, cada columna con el suyo.
2. [x] **La hoja a todo el ancho**: centrada, crece hasta llenar la columna del centro (con un tope para que la letra no
   pase de un tamaño cómodo). Las rayas de salto de página (y las marcas de página) de lado a lado de la columna, y su
   rótulo dice la página que se cierra («Página 1»), también en un salto puesto a mano. Hecho: la letra crece hasta
   20 px (`MAX_SCALE`); a probar con Enrique si el tope le parece bien (con más, la letra se hace grande).
3. [ ] **La nota lateral, a su lado**: en la hoja, un recuadro estrecho a la izquierda o a la derecha de su columna con
   el texto siguiente alrededor, igual al escribir que al imprimir (hoy al imprimir va siempre a la derecha).
4. [ ] **Imprimir o descargar, preguntando cómo**: un cuadro con el aspecto («Con colores», nuevo; «Blanco y negro»;
   «Pergamino»), el papel, la numeración, el pie y los secretos, y «Imprimir» o «Descargar PDF». Recuerda lo elegido
   (en la página y como el de siempre para las demás).
5. [ ] **Un menú común** (flota sin que lo recorte nada, se cierra con Escape o pulsando fuera, devuelve el foco): «⋯»
   lo usa, y «Exportar» pasa a ser un desplegable de verdad, con su flecha, como «Versiones».
6. [ ] **Repaso**: Archivos del mundo (ya con el árbol común) y «Página nueva» / «Pestaña nueva» (tanda 3).
7. [ ] **Cerrar**: crítica y audit de impeccable, e2e de lo tocado, `tasks/probar.md`, las normas en `docs/diseno.md`,
   capturas de antes y después para Enrique y «Dónde estamos».
