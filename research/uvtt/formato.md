# El formato Universal VTT (`.dd2vtt`, `.uvtt`, `.df2vtt`)

Módulo de Crisol: 6. Mesa · Fecha: 2026-11-07 · Versión estudiada: format 0.2 y 0.3 (el que escriben Dungeondraft,
DungeonFog, Arkenforge, Dungeon Alchemist y otros); importadores de Foundry (Universal Battlemap Importer 6.1.1),
Roll20, MapTool y Owlbear Rodeo

## Pregunta

Qué trae un mapa Universal VTT (UVTT) para que la mesa del módulo 6 lo abra con su imagen, rejilla, muros, puertas y
luces: cada campo y sus unidades, en qué se diferencian los programas que lo exportan, cuánto pesa un mapa normal, cómo
lo importan Foundry y otras mesas (y en qué se equivocan), qué licencia tiene el formato y dónde está escrito.

## Lo que hacen

### Qué es

Un solo archivo JSON con la imagen del mapa dentro (en base64) y la geometría que necesita una mesa con niebla: muros,
objetos que tapan, portales (puertas y ventanas), luces y la luz ambiental. Lo inventó Megasploot, el autor de
Wonderdraft y Dungeondraft, para exportar de Dungeondraft a cualquier mesa. Las tres extensiones son el mismo formato:
cada programa le pone la suya (`.dd2vtt` Dungeondraft y Dungeon Alchemist, `.df2vtt` DungeonFog, `.uvtt` Arkenforge y el
nombre neutro). Hay que leerlas igual y no fiarse de la extensión para saber quién lo hizo.

**Todas las posiciones y medidas van en casillas, no en píxeles.** Para pasar a píxeles de la imagen:
`(punto − map_origin) × pixels_per_grid`.

### Campos

| Campo | Tipo | Qué es |
|---|---|---|
| `format` | número | La versión: `0.2` o `0.3` (0.3 añade `objects_line_of_sight`). Se ven otras (`1.0` en conversores caseros). |
| `resolution.map_origin` | `{x, y}` | Casilla de la esquina superior izquierda de la imagen. Casi siempre `0,0`; **no** cuando se exporta un trozo del mapa (ver trampas). Puede ser fraccionario. |
| `resolution.map_size` | `{x, y}` | Ancho y alto del mapa en casillas. |
| `resolution.pixels_per_grid` | entero | Píxeles por casilla de la imagen embebida (70, 100, 128, 140, 150, 256…). |
| `line_of_sight` | lista de polilíneas | Muros: cada elemento es una lista de puntos `{x, y}` unidos; cada tramo tapa la vista y la luz. |
| `objects_line_of_sight` | lista de polilíneas | (0.3) Contornos de objetos marcados «Block Light» en Dungeondraft (árboles, columnas, estanterías). Sintácticamente igual que los muros; cada mesa lo interpreta a su manera. |
| `portals[]` | objetos | Puertas y ventanas: `position` (centro, en casillas), `bounds` (polilínea, en la práctica 2 puntos: los dos extremos), `rotation` (radianes del dibujo; no cambia `bounds`), `closed` (si tapa la vista y la luz), `freestanding` (si no está pegado a un muro). |
| `lights[]` | objetos | `position`, `range` (alcance en casillas), `intensity` (≥ 0, escala libre; Dungeondraft escribe de 1 a 3), `color` (ARGB en 8 cifras hex, alfa delante: `ffFFEBCF`), `shadows` (si los muros la cortan). |
| `environment.baked_lighting` | booleano | Si la luz ya está pintada en la imagen. |
| `environment.ambient_light` | ARGB hex | Color de la luz ambiental de toda la escena; si falta, no hay. |
| `image` | texto base64 | La imagen: PNG o WebP según la especificación; en la práctica también llega JPEG. |

Se pueden añadir campos propios (Arkenforge pone `software` y `creator`); los demás programas los ignoran. Los
esquemas JSON comunitarios dan por requeridos `format`, `resolution`, `environment` e `image`, y por opcionales (lista
vacía) los demás.

### Un ejemplo (propio, recortado, sin la imagen)

Una sala de 10 × 8 casillas con un muro en L, una columna, una puerta cerrada, una ventana y una antorcha:

```json
{
  "format": 0.3,
  "resolution": { "map_origin": { "x": 0, "y": 0 }, "map_size": { "x": 10, "y": 8 }, "pixels_per_grid": 128 },
  "line_of_sight": [[{ "x": 1, "y": 7 }, { "x": 1, "y": 1 }, { "x": 9, "y": 1 }]],
  "objects_line_of_sight": [[{ "x": 4, "y": 4 }, { "x": 5, "y": 4 }, { "x": 5, "y": 5 }, { "x": 4, "y": 5 }, { "x": 4, "y": 4 }]],
  "portals": [
    { "position": { "x": 3, "y": 1 }, "bounds": [{ "x": 2.5, "y": 1 }, { "x": 3.5, "y": 1 }], "rotation": 0, "closed": true, "freestanding": false },
    { "position": { "x": 1, "y": 4 }, "bounds": [{ "x": 1, "y": 3.5 }, { "x": 1, "y": 4.5 }], "rotation": 1.5708, "closed": false, "freestanding": false }
  ],
  "lights": [{ "position": { "x": 2, "y": 2 }, "range": 6, "intensity": 2.5, "color": "ffFFEBCF", "shadows": true }],
  "environment": { "baked_lighting": false, "ambient_light": "ff202030" },
  "image": "…"
}
```

### Quién lo exporta y qué cambia

| Programa | Extensión | Notas |
|---|---|---|
| Dungeondraft | `.dd2vtt` | El de referencia. Escribe 0.3 en lo reciente (0.2 en exportaciones viejas, que siguen circulando). PNG por defecto; WebP con un mod (*UVTT WebP Exporter*). Cuevas como polilíneas de cientos de puntos. Portal sin «Block Light» → `closed: false` (es una **ventana**, no una puerta abierta). `baked_lighting: true` y `ambient_light: ffffffff` en casi todos. Luces con intensidad 1–3. Cada nivel de un mapa, un archivo aparte. |
| DungeonFog | `.df2vtt` | Muros, puertas, ventanas y luces, pensado para Foundry. Mismo esquema. |
| Arkenforge Toolkit | `.uvtt` | Exporta e importa; añade `software` y `creator`. Su página es la descripción más completa del formato. |
| Dungeon Alchemist | `.dd2vtt` | Muros, puertas y luces estancos; las luces usan una de diez paletas (casi siempre amarillenta). |
| MapForge | las tres | Elige extensión al exportar. |
| AutoWall, conversores (DungeonScrawl, donjon, Foundry → UVTT) | `.uvtt`/`.dd2vtt` | Muros sacados por IA de una imagen o convertidos de otros formatos. Aquí aparecen las rarezas: `format: 1.0`, `pixels_per_grid` con decimales (85,33), tramos sueltos de dos puntos, imagen ausente o en JPEG. |

Hay una propuesta comunitaria de «UVTT v2» (2026, capas y entidades relacionales), sin adopción: ningún programa la
escribe.

### Tamaños típicos

Medidos en una colección de 64 mapas de Dungeondraft con licencia CC BY-SA 4.0 (`dnd-apps/vtt-maps`, ver enlaces) y en
archivos de prueba de otros repositorios, leídos solo como datos en una carpeta temporal, fuera del repo:

- **Peso**: de 0,4 a 93 MB; la mediana, unos 9–10 MB. La imagen es más del 99 % del archivo. Un 40 × 40 a 256 px por
  casilla es un PNG de 10.240 × 10.240 px: 93 MB. A 128 px por casilla y en WebP, un mapa de 99 × 46 casillas baja a
  10 MB (imagen de 12.672 × 5.888 px).
- **Muros**: interiores de 5 a ~450 tramos; cuevas y alcantarillas, hasta ~2.400 tramos en un mapa, con polilíneas de
  hasta 650 puntos. Mapas de exterior sin ninguno.
- **Portales**: de 0 a ~40. Siempre con 2 puntos en `bounds`; `freestanding: true` no apareció en ninguno.
- **Luces**: de 0 a ~50; alcances de 0,5 a 13 casillas.
- **Píxeles por casilla**: 128 y 256 en Dungeondraft (alta resolución); 70–150 en otros.
- La imagen medía siempre `map_size × pixels_per_grid`, pero hay herramientas que la recomprimen (o la cambian de
  formato) sin tocar el JSON.

### Cómo lo importan otras mesas

- **Foundry VTT**: el núcleo (14.369, comprobado en la instalación del VPS) no lo importa. Se hace con el módulo
  **Universal Battlemap Importer** (paquete `dd-import`, de Moo Man, **MIT**, 6.1.1 para Foundry 14). Convierte:
  - los muros en paredes, con un ajuste de «fidelidad» que salta puntos de las cuevas (menos paredes, más rendimiento)
    y un «desplazamiento» que separa las paredes del borde dibujado; empalma las polilíneas que comparten extremo;
  - los objetos, solo si se pide (los suma a los muros);
  - los portales cerrados en puertas y los abiertos en ventanas (dejan pasar vista y luz de cerca), salvo que se pida
    que todas se abran;
  - las luces en luces ambientales: tenue = alcance × distancia de la casilla, brillante = la mitad, opacidad =
    0,05 × intensidad, color sin el alfa. Ignora `shadows`, `ambient_light` y `baked_lighting`;
  - la imagen: la sube tal cual o la pasa a WebP (calidad 0,8) en el navegador, y la reduce si pasa de 11.000 px de lado
    o 11.000² de área (por debajo de 10 px por casilla, se niega);
  - descarta lo que cae fuera del recorte (guarda un tramo si al menos un extremo está dentro);
  - varios archivos como niveles de una escena (Foundry 14) o cosidos en una cuadrícula.
- **Roll20**: lo sube de forma oficial (muros, portales y luces, con la iluminación dinámica encendida; avisa de que
  depende de cómo exporte cada programa) y tiene un límite de 10 MB por imagen. Antes, un script comunitario (MIT, de
  pago Pro): objetos como barreras transparentes (frenan el paso, no la vista) o fuera; ventanas configurables;
  intensidad pasada a proporción de luz brillante (de 0,5 a 3: 1 da la mitad, 3 todo); color opcional; la imagen había
  que subirla aparte. Problemas que contaron: ventanas que llegaban como puertas y colores de luz que no se respetaban.
- **MapTool** (AGPL, solo para entender): lo importa de serie, pero solo acepta `format` 0.2 o 0.3. Objetos como muros
  de una cara o como «colina» (tapan a medias); portal abierto, muro desactivado; con la luz horneada, luces sin color;
  `shadows: false`, luz que atraviesa muros.
- **Owlbear Rodeo**: no de serie; con extensiones (Smoke & Spectre crea escena, obstáculos, puertas y luces; Scene
  Importer, GPL, para su niebla dinámica).
- **Fantasy Grounds Unity** (de serie desde la 4.4; antes `uvtt2fgu`, BSD-3), **EncounterPlus**, **D20Pro**,
  **Arkenforge**, **PlanarAlly** (MIT; suma muros y objetos) y **AboveVTT** (la extensión de mesa sobre D&D Beyond) lo
  leen también.

### Licencia y documentación

- El formato **no tiene licencia publicada ni especificación oficial**: es un formato de facto, abierto en la práctica
  (nadie reclama nada al leerlo o escribirlo) y se usa en programas comerciales y libres.
- Dónde está escrito:
  - la página de Arkenforge sobre los archivos Universal VTT (la tabla de campos más completa);
  - la guía comunitaria de Dungeondraft (*Dungeondraft Encyclopaedia*), solo a grandes rasgos;
  - dos esquemas comunitarios en GitHub, **sin licencia**: los JSON Schema de 0.2 y 0.3 de `kwvanderlinde/uvtt` (de un
    desarrollador de MapTool) y el libro de campos de `BringingFire/uvtt`;
  - los importadores con código abierto como referencia de interpretación: Foundry (MIT), el script de Roll20 (MIT),
    PlanarAlly (MIT), `uvtt2fgu` (BSD-3); MapTool y la extensión de Owlbear son copyleft (no se aprovechan).

### Archivos de ejemplo con licencia libre

- **`dnd-apps/vtt-maps`** en GitHub: 64 mapas de Dungeondraft (`.dd2vtt`, 0.3) bajo **CC BY-SA 4.0** (compartir igual:
  valen para pruebas locales y de rendimiento; no para meterlos en el repo ni darlos con Crisol). Cubren de 0,4 a 93 MB,
  interiores con puertas y luces, cuevas con muchas polilíneas y un recorte con `map_origin` distinto de cero
  («Red Tower - Base»).
- No se encontró ningún mapa UVTT en CC0 o CC BY; lo gratis de itch.io suele ser de uso personal o CC BY-NC-ND.
- Para las pruebas de Crisol lo limpio es **escribir los archivos a mano** (como el ejemplo de arriba) con cada rareza:
  origen fraccionario, recorte, ventana, intensidad 3, polilínea de 600 puntos, JPEG.

## Compromisos y límites

- **Gana**: es simple (un JSON plano), lo escribe casi todo editor de mapas y lo lee casi toda mesa. Medir en casillas
  hace que la geometría sobreviva si la imagen se reescala.
- **Imagen en base64 dentro del JSON**: un tercio más de peso, hay que leer el archivo entero para sacar nada, y un mapa
  de 90 MB es un `JSON.parse` de 90 MB (en el servidor, varias veces eso en memoria). Las imágenes pasan con facilidad
  de 8.192 o 16.384 px de lado, el límite de textura de muchas GPU.
- **Semántica floja**: `closed` mezcla dos cosas (en Dungeondraft es «tapa la luz»: puerta frente a ventana; otros lo
  leen como «está cerrada ahora»); no hay tipo de portal (puerta, ventana, secreta), ni puertas con llave o secretas, ni
  muros que solo tapan la vista o solo el paso, ni alturas, ni sonido.
- **`intensity` sin escala**: cada importador se inventa la suya (Foundry, opacidad 0,05 × i; Roll20, proporción de
  brillo de 0,5 a 3). No dice qué parte del alcance es luz brillante.
- **`objects_line_of_sight` sin decidir**: muro sólido (Foundry opcional, PlanarAlly), barrera transparente (Roll20) o
  muro de una cara/colina (MapTool).
- **Trampas que se ven en los archivos reales**:
  - recorte: al exportar una parte del mapa, `map_origin` no es 0 y **se quedan los muros de todo el nivel** (en «Red
    Tower», 481 de 584 puntos caen fuera de la imagen); hay que descartar lo de fuera sin abrir huecos en el borde;
  - polilíneas frente a tramos: unos escriben cadenas largas (cuevas de 650 puntos), otros cada tramo suelto; hay que
    empalmar extremos para no dejar rendijas en las esquinas y simplificar las cuevas;
  - `bounds` admite más de dos puntos (nadie lo hace, pero la especificación sí);
  - `freestanding` (puerta sin muro) apenas se usa: el portal es su propio tramo con o sin muro alrededor;
  - `format` distinto de 0.2/0.3, `pixels_per_grid` con decimales, imagen JPEG o ausente, colores de 6 cifras o con
    `#`: hay que tolerarlo (MapTool rechaza otras versiones; no conviene copiarlo);
  - `baked_lighting: true` casi siempre: si se encienden las luces del archivo sobre una imagen que ya las tiene, se
    ven dos veces. `ambient_light` casi siempre blanco: no sirve para saber si es de noche;
  - imagen recomprimida: `pixels_per_grid` deja de cuadrar con el ancho real; lo seguro es calcularlo del ancho de la
    imagen entre `map_size.x`.
- **Varios niveles**: cada planta es un archivo; enlazarlos (escaleras, niveles) queda fuera del formato.

## Qué nos llevamos a Crisol

### Lo que ya hace el importador del Crisol actual

`~/CrisolVTT/crisol/packages/mesa/src/modelo/compat/uvtt.ts` (234 líneas, puro, con pruebas en `uvtt.test.ts`):

- **Trata**: las tres extensiones; `map_origin` (también fraccionario, que pasa a desfase de la rejilla); `map_size`
  (hasta 4.096 casillas por lado); la imagen PNG, JPEG o WebP por su firma (quita un prefijo `data:`), con su tamaño
  leído de la cabecera; `line_of_sight` y `objects_line_of_sight` como muros sólidos, una cadena por polilínea; los
  portales por los dos primeros puntos de `bounds` y `closed`; las luces (`position`, `range`, `intensity`, `color` ARGB
  o RGB); `ambient_light` como luminancia; `baked_lighting` (luces escondidas y ambiente pleno). Límites: 150 MB,
  20.000 tramos, 2.000 luces, 10 px por casilla como mínimo. Cada fallo, una frase que dice por qué.
- **Calcula la casilla del ancho de la imagen** (`ancho / map_size.x`) en vez de `pixels_per_grid`: acierta con
  imágenes recomprimidas.
- **Ignora**: `format` (bien: tolera todo), `pixels_per_grid`, `portals.position`, `rotation`, `freestanding`, los
  puntos de `bounds` después del segundo, `shadows`, el color del ambiente (solo su brillo) y los campos propios.
- **Lo que haría distinto**:
  - `closed: false` lo trata como **puerta abierta**; en Dungeondraft es una **ventana** (deja pasar vista y luz, no el
    paso). Debe llegar como ventana;
  - la intensidad la recorta a 0–1, y Dungeondraft escribe 1–3: todas las luces salen iguales. Mejor normalizar
    respecto al máximo del archivo o pasarla a la proporción de luz brillante;
  - los objetos como muro sólido es lo razonable de serie, pero conviene marcarlos aparte para poder cambiarlos
    (un árbol que tapa la vista y no el paso);
  - descarta un tramo si cualquiera de sus extremos cae a más de una casilla fuera de la imagen: un muro largo que
    cruza el borde del recorte desaparece y abre un hueco. Mejor recortar el tramo contra el rectángulo;
  - no empalma extremos casi iguales ni simplifica las cuevas;
  - `shadows: false` debería dar una luz que no cortan los muros.

### Para el Crisol nuevo

- **El análisis es puro y se porta casi tal cual al servidor** (solo usa `atob`, que Node tiene): validar con un
  esquema (zod), tolerante con versiones y rarezas, con los límites y las frases de error de ahora.
- **El servidor saca la imagen y la guarda como archivo** del mundo (pasada a WebP y, si pasa de unos 8.192 px de lado,
  reducida o en teselas), y la escena guarda solo la geometría. Para no tener 90 MB de texto en memoria, leer el JSON en
  flujo y desviar el campo `image` a disco.
- **Geometría en casillas en el modelo** (como el formato) o en píxeles de la imagen guardada, pero una sola: así
  importar UVTT y escenas de Foundry da lo mismo.
- **Tipos de muro propios** que el formato no tiene: puerta, ventana, secreta, objeto (tapa vista, no paso); el máster
  los cambia después. El estado de cada puerta (abierta, cerrada, con llave) va en el estado de la campaña, no en la
  escena.
- **`baked_lighting` decide el modo de luz**: horneada → luces del archivo guardadas pero apagadas y ambiente pleno;
  sin hornear → luces encendidas y oscuridad según `ambient_light`.
- **Pruebas con archivos escritos a mano** para cada trampa, y una de rendimiento con un mapa grande de la colección
  CC BY-SA, en local y sin guardarlo en el repo.
- **Más adelante**: exportar una escena de Crisol a UVTT (el formato es sencillo, y hay módulos que lo hacen desde
  Foundry), e importar varias plantas de una vez.

## Enlaces

- Arkenforge, *Universal VTT Files*: <https://arkenforge.com/universal-vtt-files/>
- Dungeondraft Encyclopaedia, *Universal VTT*:
  <https://dungeondraft-encyclopaedia.gitbook.io/guide/final-steps/exporting-your-map/universal-vtt>
- Esquemas JSON 0.2 y 0.3: <https://github.com/kwvanderlinde/uvtt>
- Libro de campos: <https://github.com/BringingFire/uvtt>
- Universal Battlemap Importer (Foundry): <https://foundryvtt.com/packages/dd-import/> ·
  <https://github.com/moo-man/FVTT-DD-Import>
- Roll20, ayuda de UVTT: <https://help.roll20.net/hc/en-us/articles/41643201127831-Universal-Virtual-Tabletop-UVTT-Support> ·
  script comunitario: <https://github.com/Roll20/roll20-api-scripts/tree/master/UniversalVTTImporter>
- MapTool, importador: <https://github.com/RPTools/maptool/blob/develop/src/main/java/net/rptools/maptool/client/utilities/DungeonDraftImporter.java>
- Owlbear Rodeo: <https://www.czepeku.com/blog/how-to-use-uvtt-files-with-owlbear-rodeo> ·
  <https://github.com/Eppinguin/scene-importer>
- uvtt2fgu (Fantasy Grounds): <https://github.com/Imagix/uvtt2fgu>
- DungeonFog, anuncio del formato: <https://www.dungeonfog.com/news/campaigns-update/>
- Propuesta UVTT v2 (sin adopción): <https://github.com/TheGeolama/uvtt-v2-specification>
- Mapas CC BY-SA 4.0: <https://github.com/dnd-apps/vtt-maps>
- Foros: <https://forums.forge-vtt.com/t/player-gm-having-problems-upload-dd2tt-files-with-the-universal-importer-module/15457> ·
  <https://app.roll20.net/forum/permalink/11268197>
