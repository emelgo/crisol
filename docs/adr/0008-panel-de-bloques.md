# ADR-0008: El panel de la derecha de una página, con bloques

Estado: aceptada (Enrique, 2026-11-02: «la sidebar debe poder escribir cosas, mira esto de LegendKeeper, mira Everlore
como lo teníamos») · Fase 2 de traer Everlore a Crisol (ADR-0007)

## Contexto

En LegendKeeper y en Everlore, al lado del texto de cada página hay un panel con datos de toda la página: medidores
(«Amenazas de la campaña»), estrellas («Estado del grupo»), una imagen, etiquetas, texto corto. En Everlore era un
documento de TipTap con nodos propios guardado en una columna JSON. En Crisol el panel solo enseñaba propiedades,
enlaces, índice y versiones.

## Decisión

- **Una lista de bloques en `pages.panel`** (jsonb, migración 0031), validada por el contrato `panelBlock`: `text`
  (título y texto), `image` (un archivo del mundo y su pie), `meter` (barra o círculo, valor, máximo y color),
  `rating` (estrellas, de media en media), `tokens` (fichas que se marcan), `subpages` y `tagged` (las páginas con
  una etiqueta). Cada bloque, con su id corto.
- **Se guarda entera con `setPagePanel`**, que pasa por `operation()`: queda en el historial («cambió el panel de…») y
  se deshace como lo demás. El servidor comprueba los ids, que el valor no pase del máximo y que la imagen sea del
  mundo. La IA la lee en `leer_pagina` y la cambia con `cambiar_panel`.
- **En la interfaz**, los clics seguidos (+, −, estrellas, fichas) se juntan en un guardado y los guardados van en
  fila; mientras quede alguno, lo que llega de fuera no pisa lo de aquí.
- Sin edición en vivo (Yjs) para el panel: son datos cortos que cambian de vez en cuando; si dos personas lo tocan a
  la vez, gana el último.

## Alternativas descartadas

- **Un documento de Yjs más por página** (como el cuerpo): edición en vivo, pero con versiones y conversión a Markdown
  que el panel no necesita, y la IA tendría que escribir JSON del editor.
- **Propiedades con más tipos**: las propiedades son datos para buscar y filtrar; el panel es lo que se ve y se toca.
