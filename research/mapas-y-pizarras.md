# Mapas con capas y pizarras: lo que nos llevamos

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-13 · Síntesis de `legendkeeper/mapas.md`,
`worldanvil/mapas.md`, `kanka/mapas.md`, `inkarnate/mapas.md`, `obsidian-leaflet/mapas.md` (con Campfire),
`ia-dibuja/mapas.md` y `excalidraw/pizarra.md`. Marco: `docs/intent/mapas-pizarras.md`.

## Lo que hemos visto

- **Nadie junta las tres cosas que pide Enrique** (capas con revelado por campaña, regla con días de viaje y una IA que
  dibuje). LegendKeeper es lo más cercano en dibujo y medida; World Anvil, en visibilidad por grupos; Kanka (explorador
  de 2026), en herramientas; ninguna tiene IA que trace, y varias la rechazan.
- **«Capa» significa cosas distintas**: en World Anvil, Kanka y Obsidian Leaflet es una imagen superpuesta; lo que
  agrupa marcadores es el «grupo». En LegendKeeper la capa es una carpeta anidable de elementos con su oculto. Nuestra
  capa es la de LegendKeeper.
- **Lo oculto no debe viajar**: LegendKeeper responde «no encontrado» a lo oculto; Kanka esconde un marcador si la
  página a la que lleva está oculta. Nadie avisa al revelar ni lo hace por grupo de juego.
- **Dibujar**: el mínimo que funciona es polígono, línea, texto (y pin), clic por vértice, doble clic para cerrar,
  Escape para cancelar, arrastrar vértices, añadir en un lado, quitar con botón derecho. Lo que más se pide: que las
  fronteras vecinas se peguen. Los estilos buenos son listas cerradas (relleno liso o rayado, borde liso, discontinuo o
  punteado, opacidad, nombre siempre/al pasar/nunca, rango de zoom).
- **Medir**: LegendKeeper calibra con dos puntos y una distancia, mide áreas y rutas, calcula caminos por la red de
  rutas con una velocidad, y deja medir a los jugadores. Kanka y Leaflet usan un factor escrito a mano (con quejas).
  World Anvil e Inkarnate no miden. Nadie da días con varias velocidades.
- **IA**: Anthropic avisa de que las coordenadas de Claude son aproximadas, que acierta más en **píxeles de la imagen
  que ve** que en coordenadas normalizadas, y que recortar la zona mejora la precisión. Hoy `ver_mapa` no da la imagen.
- **Pizarra**: Excalidraw 0.18.1 es MIT, funciona con React 19 y pesa unos 350 KB gz al abrirse. tldraw (5.x) **no
  vale**: su licencia exige clave de pago en producción. Las alternativas MIT son piezas sueltas (React Flow, Konva,
  Fabric, perfect-freehand), no pizarras hechas.

## Recomendaciones

1. **Capas y visibilidad.** Tabla nueva `map_layers` (mapa, nombre, orden, oculta, zoom mínimo opcional) y `layerId`
   más orden en `map_elements`. Capa oculta: no llega a ningún jugador. Capa a la vista: cada región, ruta o texto se
   ve si no está oculto o si la campaña lo sabe (el tipo `element` del conocimiento ya existe), igual que los pines; y
   una región enlazada a una página que no conocen sale sin nombre ni enlace. Aparte, «apagar» una capa en mi pantalla
   (también los jugadores), que es cosa de la vista y no se guarda en el servidor. Un elemento, una capa.
2. **Herramientas mínimas.** Región (polígono), ruta (línea), texto (con arco opcional) y los pines que ya hay; editar
   vértices como arriba; deshacer; ajuste a vértices cercanos con una tecla. Estilos cerrados como LegendKeeper. Fuera:
   curvas Bézier, pinceles, subcapas.
3. **Escala y regla.** Calibrar dibujando una raya («son 100 km»), que ya cabe en `maps` (`scaleLength/Value/Unit`).
   Velocidades por mapa (a pie, a caballo, en barco, en su unidad por día). Regla de tramos encadenados que se pega a
   pines y a vértices, y «medir esta ruta» entre dos de sus puntos; da distancia y días por cada velocidad. Los
   jugadores miden sobre lo que ven. La red de caminos con ruta más corta, más adelante.
4. **Formato para la IA.** Geometría como listas de puntos de 0 a 1 (`points`; región cerrada, ruta abierta, texto con
   un punto), en JSON propio (GeoJSON solo para exportar si algún día hace falta). Las herramientas de dibujar aceptan
   también píxeles referidos a una vista (`view`: el tamaño de la imagen que se le dio, o un recorte) y el servidor
   convierte. Una herramienta nueva da a la IA la **imagen del mapa** reducida a menos de 1.568 px de lado (o un recorte),
   con lo ya dibujado encima, para trazar y para comprobar. Las rutas aceptan pines como extremos. El servidor
   simplifica (Ramer-Douglas-Peucker), limita puntos y casa vértices con la región vecina cuando están muy cerca. La IA
   retoca reescribiendo el elemento entero con la versión leída; todo va al historial.
5. **Pizarra.** `@excalidraw/excalidraw` 0.18.1 (MIT; su aviso y el de sus fuentes a `docs/terceros.md`), cargado solo
   en la pestaña y con las fuentes servidas por nosotros. Un documento de Yjs por pizarra por el Hocuspocus que ya hay,
   con un enlace propio y pequeño (elementos por id, gana la versión más alta), sin depender de `y-excalidraw` (parado y
   sobre la 0.17). Imágenes como archivos del mundo, fuera de Yjs. Tarjetas de páginas como elementos con
   `customData` y enlace interno. La versión del jugador la arma el servidor (sin tarjetas de lo que no conoce, sus
   flechas ni enlaces ocultos) y le llega por la API en solo lectura; la misma para su IA.

## Dudas abiertas

- ¿Ocultar una capa es para todos los jugadores o también por campaña (revelar la capa de secretos solo a un grupo)?
- Una región enlazada a una página que la campaña no conoce: ¿no se ve, o se ve sin nombre?
- Fronteras compartidas: ¿basta con casar vértices cercanos al guardar, o hace falta topología de verdad?
- ¿Huecos en regiones (un lago dentro de un reino) y regiones de varias piezas (islas)?
- ¿Las velocidades son del mapa o de la campaña/sistema? ¿Distancias por mar distintas de las de tierra en una ruta?
- ¿Imágenes del mapa muy grandes (Eana) necesitan teselas como la Mesa para que la IA pueda pedir recortes nítidos?
- Excalidraw sin probar aún: abrir enlaces en modo vista, crear elementos en el servidor (`@excalidraw/element` en
  Node) para que la IA dibuje en la pizarra, licencias exactas de sus fuentes.
- World Anvil (guías tras comprobación antibots) y la edición de vértices de LegendKeeper quedaron sin confirmar.
