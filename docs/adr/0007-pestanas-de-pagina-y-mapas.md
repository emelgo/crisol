# ADR-0007: Pestañas en las páginas de la wiki; la primera, el mapa

Estado: aceptada (Enrique, 2026-11-02: «me vale así, ya iremos puliendo») · Fase 1 de traer Everlore a Crisol

## Contexto

Enrique hizo Everlore (`github.com/emelgo/everlore`, privado), una app al estilo de LegendKeeper: cada entrada de su
wiki tiene pestañas de distintos tipos (texto, mapa, pizarra, línea temporal, árbol familiar), una vista rápida de las
páginas enlazadas, un panel lateral con bloques y un grafo del mundo. Quiere eso en Crisol: «podemos reutilizar lo que
quieras o incluso mejorarlo». Cubre lo que el plan tenía para los módulos 8 (calendario y líneas temporales), 9 (mapas
y pizarras) y 10 (grafo), que se adelantan.

Everlore está hecho sobre el kit de Makerkit (de pago) y Supabase: de él solo se aprovecha el código de Enrique y las
ideas; sus librerías (Excalidraw, xyflow, dagre, d3-force, Orama) son MIT, ISC o Apache.

## Decisión

- **Dentro de la página de la wiki, no en una sección aparte.** Bajo el título, las pestañas de la página: «Texto» (el
  cuerpo de siempre, con su hoja), que no se guarda como pestaña y siempre va primero, y las que se añadan con «+».
  Así hay un solo árbol, una búsqueda, unos enlaces, un historial y una papelera; el pin de un mapa, un evento o una
  carta apuntan a una página, y la visibilidad para jugadores (módulo 5) irá por página.
- **Datos**: `page_tabs` (página, tipo, nombre, orden fraccionario como el árbol, oculta), con historial. Cada tipo, su
  tabla: el mapa en `maps` (la pestaña, la imagen —un archivo del mundo— con sus medidas y la escala) y sus pines en
  `map_pins` (coordenadas de 0 a 1, nombre, página enlazada, color, forma, variante, icono, cuándo se ve el nombre,
  oculto y bloqueado); las regiones, rutas y textos, en `map_elements` (geometría normalizada y estilo). Todo con
  `world_id` y en `operation()`, así que se deshace desde el historial.
- **El visor del mapa, el de Everlore** reescrito sobre lo nuestro: sin librería de mapas ni teselas; el escenario se
  mueve con `transform` directamente en el DOM durante el gesto, la rueda acerca hacia el cursor, y los pines guardan su
  tamaño en pantalla con una variable CSS. Las ocho formas de pin, las suyas.
- **Mejoras sobre Everlore**: una sola marca de «oculto» (allí había dos); mapas anidados por la página enlazada; la
  imagen es un archivo del mundo (sale en Archivos y se reutiliza); el MCP los ve.
- **Fases**: 1) pestañas y mapa; 2) vista rápida y panel lateral con bloques; 3) línea temporal y calendarios del mundo;
  4) pizarra y árbol familiar; 5) grafo. Cada una, con su ADR si decide algo nuevo, su prueba en local y su MCP.

## Alternativas descartadas

- **Mapas, líneas temporales y pizarras como secciones aparte** (en la barra del mundo): dos árboles que mantener y
  enlaces que cruzar.
- **Una librería de mapas (Leaflet, OpenLayers)**: Leaflet es BSD y valdría, pero para una imagen sin teselas el visor
  propio de Everlore ya resolvía lo que hace falta, con menos peso.
