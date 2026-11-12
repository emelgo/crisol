# Que una IA dibuje en un mapa (regiones, rutas y textos)

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-13 · Versión estudiada: documentación pública de
Anthropic (visión y coordenadas, noviembre de 2026), informes de Qwen3-VL y SimpleSeg (2025-2026) y servidores MCP de
mapas reales listados en directorios públicos

## Pregunta

Enrique quiere decir «dibuja los reinos de Eana y el camino real de A a B» y que la IA lo trace por el MCP sobre la
imagen del mapa; luego él retoca puntos. Tres cosas:

1. ¿Alguna app de mundos o de mapas lo hace ya?
2. ¿Qué formato de geometría es cómodo para que una IA conectada por MCP trace regiones y rutas sobre una imagen
   (coordenadas de 0 a 1 como los pines de Crisol, en píxeles, cuántos puntos, simplificación)?
3. ¿Cómo se retoca luego, a mano o pidiéndoselo otra vez a la IA?

**Cómo se leyó.** Solo web pública. Certeza: **[docs]** documentación oficial; **[paper]** artículo o informe técnico;
**[extracto]** página de terceros vista por el buscador; **[código Crisol]** lo que ya hay en este repositorio;
**[inferido]** deducido, sin comprobar.

## Lo que hacen

### 1. Nadie lo hace en las apps de mundos

- En las apps de mundos estudiadas para este módulo (LegendKeeper, World Anvil, Kanka, Inkarnate, Obsidian Leaflet;
  ver sus notas) no hay ninguna IA que dibuje regiones ni rutas como geometría editable. Lo que hay de IA en mapas de
  fantasía son **generadores de imagen**: pintan fronteras como píxeles, que no se pueden mover ni ocultar por
  separado [extracto].
- Lo más parecido sale de la cartografía real. Hay servidores MCP que dejan a un agente leer y mover los vértices de
  un polígono que también se edita con el ratón en el navegador (uno de cartografía de glaciares: leer, mover, añadir
  y quitar vértice), otros que abren un mapa donde el usuario dibuja y el agente cambia atributos, y otros que solo
  pintan GeoJSON que el modelo compone a partir de una descripción [extracto]. El patrón útil es el primero: **la
  misma geometría la tocan la persona y la IA**, por vértices, y cada cual ve lo que hizo el otro.
- Un desarrollador de un generador de reinos con IA cuenta en un foro que le fue mejor que el modelo **dirigiera** un
  sistema de rejilla (terreno por casillas) que pedirle polígonos directamente [extracto].

### 2. Lo que se sabe de cómo «ve» coordenadas un modelo

- **Anthropic** dice que las coordenadas y localizaciones que da Claude **son aproximadas** y hay que comprobarlas
  [docs]. Recomienda pedirle **píxeles absolutos** de la imagen que está viendo y normalizar después en el código:
  avisa de que va peor si se le piden coordenadas normalizadas (de 0 a 1000, por ejemplo) [docs].
- La imagen que ve el modelo **no es la original**: si pasa de un tope (en los modelos actuales, 2.576 px de lado
  largo y unos 4.800 parches de 28×28; en los anteriores, 1.568 px) se reduce manteniendo la proporción, y las
  coordenadas que devuelve son de la imagen reducida [docs]. Para que cuadren hay que mandarle una imagen ya reducida
  a un tamaño conocido, o reescalar sabiendo a qué tamaño la redujo [docs]. Para lo pequeño, recomienda **recortar la
  zona** y mandar el recorte, sumando luego el desplazamiento [docs].
- En otros modelos (Qwen3-VL) se entrenó con coordenadas normalizadas de 0 a 1000 [paper]; un trabajo de 2026
  (SimpleSeg) hace que un modelo trace contornos como secuencias de puntos normalizados y nota que el **sentido de
  giro** de los puntos importa para que el polígono salga válido [paper]. Un practicante cuenta que los polígonos
  pedidos a un modelo de visión salían distintos en llamadas idénticas y gastaban muchos más tokens que una caja o un
  punto [extracto]. Conclusión: un contorno trazado «a ojo» por la IA es un borrador, no un resultado final.
- En Crisol, hoy, la herramienta `ver_mapa` devuelve el enlace de la imagen y los pines, pero **no la imagen**: la IA
  conectada por MCP no ve el mapa [código Crisol]. Los pines van de 0 a 1 [código Crisol]. La tabla `map_elements` ya
  existe (tipo texto, región o ruta; geometría y estilo en JSON; oculto) y el conocimiento por campaña ya prevé el tipo
  «element» [código Crisol]. `dibujar_escena` de la Mesa ya recibe muros como polilíneas en píxeles del SVG
  [código Crisol].

### 3. Formatos de geometría a mano

| Formato | Qué es | Para la IA | Para Crisol |
|---|---|---|---|
| Lista de puntos `[[x,y],…]` | Polígono (cerrado implícito) o polilínea | Lo más fácil de escribir y de leer; pocas reglas | Encaja con los pines y con los muros de la Mesa |
| GeoJSON | Estándar de la cartografía (Polygon con anillos, LineString) | Lo conoce bien, pero arrastra lo de lon/lat, el anillo repetido al final y el sentido de giro | Útil solo para exportar o para librerías que lo pidan |
| Trazado SVG (`d`) | Comandos de dibujo con curvas | Lo escribe bien para dibujos libres, mal para editar vértice a vértice | Ya se usa en `dibujar_escena`; no para geometría editable |

- La **simplificación** de líneas (Ramer-Douglas-Peucker, Visvalingam) quita puntos que no cambian la forma más allá
  de una tolerancia; hay librerías pequeñas con licencia permisiva (simplify-js es BSD; varias variantes son MIT; la de
  Turf es MIT) [extracto]. El **suavizado** (cortar esquinas, curvas) es lo contrario: da aspecto de frontera natural
  a pocos puntos [inferido].
- Regiones vecinas que comparten frontera (dos reinos) dibujadas como polígonos sueltos dejan **huecos y solapes**: los
  formatos topológicos (TopoJSON) guardan el borde común una sola vez, pero complican la edición [inferido].

## Compromisos y límites

- **Precisión.** Seguir una costa o un río de la imagen al píxel no es realista; trazar «el reino del norte, entre las
  montañas y el río» con 15-40 puntos, sí, como borrador que el máster retoca [inferido, por lo de arriba].
- **Coordenadas normalizadas frente a píxeles.** Crisol guarda de 0 a 1 (no depende del tamaño de la imagen), pero
  la IA acierta más en píxeles de lo que ve [docs]. Si la herramienta acepta píxeles de una vista conocida y el
  servidor convierte, se tienen las dos cosas; si se le pide 0-1 directamente, sale peor y no se nota [inferido].
- **Ver o no ver.** Sin la imagen, la IA solo puede dibujar con lo que sepa del texto (la wiki, los pines como
  referencias: «de Puerto Gris a Valdemar»). Con la imagen, puede seguir lo pintado. Las dos sirven: con pines como
  anclas, la ruta sale bien aunque no vea [inferido].
- **Fronteras compartidas.** Si la IA dibuja cinco reinos por separado, se pisarán. O se acepta (y el relleno
  semitransparente lo disimula), o se le da un modo de «partir» una región o de pegar el borde a otra [inferido].
- **Volumen.** Una región con cientos de puntos gasta tokens al leerla y al escribirla, y cuesta retocarla a mano.
  Simplificar al guardar (con tolerancia relativa al tamaño del mapa) y poner un tope de puntos lo mantiene manejable
  [inferido].

## Qué nos llevamos a Crisol

1. **Formato:** cada elemento, una lista de puntos de 0 a 1 (`points`), con `closed` implícito por el tipo (región
   cerrada, ruta abierta, texto con un punto de anclaje, y si acaso dos para un texto que sigue una línea). Nada de
   GeoJSON en la API (si acaso al exportar). Es lo que ya prevé `map_elements` y lo que usan los pines.
2. **Que la IA vea el mapa:** una herramienta que devuelva la imagen del mapa reducida a un tamaño fijo y conocido
   (por debajo de 1.568 px de lado largo, para que valga en cualquier modelo), con sus medidas, y opcionalmente **una
   zona recortada** (un rectángulo de 0 a 1) para afinar. Opcional: la misma imagen con una rejilla fina y rótulos de
   coordenadas encima, y con los elementos ya dibujados, para que se oriente y compruebe lo que trazó [inferido].
3. **Escribir en píxeles de esa vista o en 0-1:** las herramientas de dibujar aceptan `points` en 0-1 y, además, un
   `view` (el ancho y alto de la imagen que se le dio, o el recorte) para mandar píxeles; el servidor convierte. Así se
   sigue el consejo de Anthropic sin cambiar lo guardado.
4. **Anclas con nombre:** que una ruta pueda decir «desde el pin X hasta el pin Y, pasando por…» y que el servidor
   ponga los extremos exactos; y que `ver_mapa` liste los elementos con su nombre y caja, para que la IA los cite.
5. **Simplificar y suavizar en el servidor:** al guardar, quitar puntos redundantes (RDP con tolerancia relativa) y
   tope de puntos por elemento; el suavizado, como estilo de dibujo (curva por los puntos), no como más puntos.
6. **Retocar:** a mano, arrastrar vértices, añadir uno en medio de un lado y quitar uno (lo mínimo). Por la IA,
   reescribir el elemento entero con sus puntos (como `cambiar_panel`), con la versión leída para no pisar al máster, y
   deshacer desde el historial como todo lo demás.
7. **Comprobar:** la IA debería poder pedir la imagen con lo que acaba de dibujar para revisarlo (un ida y vuelta),
   que es lo que Anthropic recomienda: comprobar a la vista antes de dar por bueno [docs].

## Fuentes

- https://platform.claude.com/docs/en/build-with-claude/vision (límites, resolución, «spatial reasoning»)
- https://platform.claude.com/docs/en/build-with-claude/vision-coordinates (píxeles absolutos, reducción, recorte)
- https://arxiv.org/pdf/2511.21631 (Qwen3-VL, coordenadas de 0 a 1000)
- https://arxiv.org/pdf/2601.19228 (SimpleSeg, contornos como secuencias de puntos)
- https://voxel51.com/blog/qwen38-max-visual-grounding-fiftyone (polígonos inconsistentes; extracto)
- https://glama.ai/mcp/servers/cw9step4kb y https://dev.to/mapbox/putting-a-live-map-inside-your-ai-agents-chat-mcp-apps-and-rendermaptool-mkm
  (servidores MCP de mapas; extractos)
- https://community.openai.com/t/ai-rpg-tabletop-generators-and-dnd-backstory-generator-litrpg-adventures-review/1255?page=5
  (generador de reinos sobre rejilla; extracto)
- https://mourner.github.io/simplify-js y https://www.jsdelivr.com/package/npm/poly-simplify (simplificación)
