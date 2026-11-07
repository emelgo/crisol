# La mesa del Crisol actual: qué se porta al Crisol nuevo y qué se rehace

Notas técnicas para el módulo 6 · 2026-11-07 · Código mirado: `~/CrisolVTT/crisol` rama `web`, commit `3f68f11`
(idéntico a `~/crisol-app` en `packages/mesa/src`). Solo lectura: no se ha tocado nada ni se han ejecutado sus pruebas.

Rutas abreviadas: `mesa/` = `~/CrisolVTT/crisol/packages/mesa/src/`, `tabletop/` =
`~/CrisolVTT/crisol/packages/tabletop/src/`.

## 0. En una línea

El **núcleo** (`mesa/nucleo`, `mesa/modelo`, `mesa/estado/comandos.ts`) es TypeScript puro, sin DOM ni PixiJS, con
~160 pruebas, y se puede llevar al Crisol nuevo casi entero (traduciendo identificadores al inglés). Todo lo demás
(`render`, `herramientas`, `sesion`, `puerto` y casi todo `tabletop`) supone que **la mesa vive en la pestaña del
máster** y guarda en archivos, y hay que rehacerlo: el servidor pasa a mandar y cada cliente pinta su vista.

## 1. Cómo está montada hoy (y por qué no vale tal cual)

- Una escena abierta es un `DocumentoMesa = { escena, partida }` en un store de zustand dentro del navegador del
  máster (`mesa/estado/crearMesa.ts`). Se cambia solo con **comandos serializables** (`mesa/estado/comandos.ts`) que
  aplica immer con parches; el historial (50 pasos) son esos parches (`mesa/estado/historial.ts`).
- Persistencia: un `Escritor` con espera de 500 ms escribe archivos por RPC (`mesa/estado/persistencia.ts`):
  lo del mundo en `<Nombre>.escena.json`; lo de la campaña en `<campaña>/.campaña/mesa/<idEscena>.json`; sin campaña,
  dentro de `preparacion` de la escena. El acceso a disco va por el puerto `MesaHost` (`mesa/puerto/MesaHost.ts`).
- Pinta con PixiJS 8 (`mesa/render/Lienzo.ts` y `render/capas/*`).
- **Ventana de jugadores**: `window.open` hija de la pestaña del máster con un `<canvas>` 2D al que se copia una
  textura que el propio PixiJS del máster renderiza aparte (`mesa/sesion/ventanaJugadores.ts` →
  `MesaCrisol.lienzoJugadores` → `render/VistaJugadores.ts`).
- **Sala online**: el núcleo (`apps/core-host/src/game/GameServer.ts`) pide al navegador del máster un fotograma WebP
  por jugador y cámara (`frameRequest` → `capturarJugadores` → `deliverFrame`, mensaje binario `fotograma`, 4 s de
  espera); el jugador solo pinta encima sus fichas y señales.
- **IA**: las herramientas MCP (`apps/core-host/src/mcp/tools/mesa.ts`) reenvían la orden a la interfaz
  (`mcp.mesa` → `mcp.mesaRespuesta`) y allí `MesaCrisol.ordenIa` la cumple con `sesion/ordenesIa.ts`. `docs/web.md`
  lo dice claro: «la pestaña del máster tiene que estar abierta».
- Sincronía PJ ↔ ficha: `tabletop/runtime/personajesEnMesa.ts` copia PG/CA de la hoja a la ficha de la mesa y al
  revés, con temporizadores, **en el navegador del máster** (la ficha de la mesa lleva su propia copia de recursos).

Es la herencia n.º 2 de `docs/inventario.md` § «Herencias…»: todo lo que no sea el núcleo puro arrastra esa idea.

## 2. Tamaño por módulo de `packages/mesa`

| Carpeta | Líneas (sin pruebas) | Pruebas (`it`) | DOM / PixiJS | Veredicto |
|---|---|---|---|---|
| `modelo/` (+ `compat/uvtt.ts`) | 741 | 10 | no (zod) | adaptar el esquema; portar `uvtt.ts` |
| `nucleo/` | 3.370 | ~120 | no (salvo `niebla.trazar`, que recibe un contexto 2D por interfaz) | **portar** |
| `estado/` | 857 | 13 | no (zustand, immer) | portar `comandos.ts`; rehacer store, historial y persistencia |
| `herramientas/` | 4.029 | 9 | sí (PixiJS, DOM) | rehacer sobre el cliente nuevo (reaprovechar ideas y atajos) |
| `render/` | 3.605 | 5 | sí (PixiJS 8, canvas 2D) | adaptar para el cliente (máster y pantalla) |
| `sesion/` | 1.924 | 8 | sí | rehacer; portar la lógica de `ordenesIa.ts` al servidor |
| `puerto/` | 98 | 0 | — | desaparece (lo sustituye la API) |

`packages/tabletop`: 39.371 líneas con 326 pruebas, de las que 6.167 son el shim de Obsidian (`tabletop/plataforma`),
4.058 el pegamento con Obsidian/Electron (`tabletop/runtime`) y 11.380 la biblioteca. Casi nada se lleva tal cual.

Guardas de procedencia: `mesa/sinCodigoAjeno.test.ts` y `tabletop/sinCodigoAjeno.test.ts` prohíben importar Atlas
VTT (AGPL-3.0, sustituido por este motor «en sala limpia», ver `docs/LICENCIAS.md`), el shim de Obsidian y `vendor/`.
Los comentarios citan documentos `sala-limpia/*.md` que ya no están en el disco y «tipos públicos» de Atlas
(`FogOperation`, `WallSegment`, `DiagonalRule`…), y las claves del formato de escena vienen de Atlas (`isHidden`,
`statblockPath`, `tokenSettings`, `showNameplates`, `unitDistanceOverride`, `activeBelowAmbient`…). El código es
nuestro; al portarlo conviene una cabecera «Portado de `packages/mesa/src/…` (Crisol actual, 3f68f11)» y diseñar el
esquema nuevo con nombres propios, sin arrastrar las claves de Atlas.

## 3. `nucleo/` archivo a archivo

Todos puros (solo importan entre sí, `../modelo` y, en `chinchetas.ts`, `@crisol/core/maps`; `idsDeReglas.ts` importa
`@crisol/systems/ids`). Valen igual en Node que en el navegador.

| Archivo | Qué hace | Pruebas | Notas para portar |
|---|---|---|---|
| `rejilla.ts` (368) | Cuadrada y hex (`hex-horizontal`/`hex-vertical`, axiales con redondeo cúbico), centro y celda de un punto, pasos entre celdas, vértices, huella y ajuste de fichas grandes (desvío en huellas pares), líneas y cruces visibles, numeración (`column-row`, `sequential`, `letter-number`), `enRejillaNueva` | en `nucleo.test.ts` (12) | Portar tal cual. Mínimo de casilla 10 px |
| `medidas.ts` | Reglas de diagonal `equidistant` (5e), `alternating` (5-10-5), `euclidean`; unidades; bandas («Cerca/Lejos»); escala propia de una escena (mapas de región); `escalaDeFichas` (criatura de 1,5 m en casillas de 2 m) | 5 | Portar. `MEDIDAS_POR_DEFECTO` (1,5 m) debe salir del sistema de la campaña |
| `plantillas.ts` | Línea, círculo, cono (53,13° por defecto) y cuadrado; casillas tocadas = centro dentro (regla 5e), también en hex | 5 | Portar. Faltan cilindro/emanación de 2024 si se quieren |
| `movimiento.ts` | Muros que frenan el arrastre (puertas abiertas dejan pasar, muros de un sentido), último punto libre | 6 | Portar (servidor: validar movimientos de jugadores cuando lleguen) |
| `vision.ts` | Polígono de visibilidad por barrido de rayos a los extremos de muro; canales `sight`/`light`; puertas abiertas; muros limitados (el 1.º deja pasar); de un sentido; cono; `seVe`; `conHuecosDePuertas` (la puerta abierta abre hueco en la pared dibujada debajo, con tolerancias) | 10 | Portar, **pero optimizar** (ver § 8) |
| `luz.ts` | Puertas con su estado de partida; luces vivas (emisión `bright`/`dim`/`color`/`intensity`/`angle`/`darkness`/`animation`, `activeBelowAmbient`, luces de las fichas); caída física `iluminacionA`, `luzPercibida`, `luzConVisionOscura`, `alcancePercibido`; animaciones (antorcha, vela, pulso, mágica); zonas de luz | 9 (`luzFisica`, `luzAnimada`) | Portar. Las animaciones son del cliente; `alcancePercibido` lo necesita el servidor para lo explorado |
| `rebote.ts` | Un rebote de luz en los muros (iluminación indirecta) | 2 | Solo cliente (estética) |
| `visionJugadores.ts` | Visión de las fichas del bando «jugadores» con visión: polígono, visión en la oscuridad (tenue), vista ciega/verdadera (plena), huella propia, sentir vibraciones, oscuridad mágica (tapa la vista salvo ciega/verdadera); por personaje (`nota`) o del grupo; `murosALaVista` | 9 | Portar: es lo que el servidor calcula para la pantalla. Reconoce sentidos por definición del sistema (`ReglasMesa.sentidos`) o por patrón del id |
| `visionAlSoltar.ts` | Mientras se arrastra, la vista, la luz y la vista de jugadores ven las fichas donde empezó el arrastre; cambian al soltar (siempre, decisión de Enrique) | 2 | Portar la idea: el servidor recibe el movimiento y recalcula al soltar, no durante el arrastre |
| `niebla.ts` | Niebla a mano como operaciones (`brush`/`lasso`/`rectangle`, pintar o borrar, `timestamp`, desplazamiento); orden; `tocaOperacion`; rectángulo pegado a la rejilla cuadrada; `trazar` a un contexto 2D | 4 | Portar; `trazar` sirve en el cliente y en un rasterizador propio del servidor |
| `iniciativa.ts` | Estado (`entries`, `currentIndex`, `round`, `isActive`, `config.autoSort`, `sides`) y acciones puras: añadir, valores, empezar (orden o por bandos), siguiente/anterior (salta a quien no actúa, cambia de ronda), quitar (pasa el turno), mover, modificador manual, renombrar, PNJ | 8 | Portar. `tirada()` usa su propio `NdS` con `Math.random`: en el nuevo, las tiradas van por `@crisol/dice` en el servidor y quedan en el registro |
| `proyeccion.ts` | Documento para los jugadores: quita fichas `isHidden`, chinchetas del máster, textos `gmOnly`, imágenes ocultas, nota del máster, botín, tiradas ocultas y cerrojos | 1 | Punto de partida, **insuficiente** para la regla nueva (§ 5) |
| `camaraJugadores.ts` | Cámara de la pantalla: `master`, `fija`, `ficha`, `grupo` (encuadre de las fichas del grupo con margen y mínimo de 8 casillas) | 4 | Portar |
| `camara.ts`, `asas.ts`, `laser.ts`, `dibujo.ts`, `imagenes.ts`, `chinchetas.ts`, `zonasLuz.ts`, `juntas.ts`, `sonidos.ts`, `clima.ts` | Cámara (zoom, trackpad, inercia), asas de giro/tamaño, estela del láser (700 ms), trazos y goma, imágenes sueltas con giro, iconos y numeración de chinchetas, edición de zonas de luz, juntas de muros, volumen posicional, partículas de clima | 2–6 cada uno | Portar los que entren (clima queda fuera, módulo 8; sonido, módulo 7) |
| `alineacion.ts`, `deteccion.ts`, `estiramiento.ts` | Alinear la cuadrícula con dos medidas o a ojo; **detectar la cuadrícula impresa** en la imagen (perfiles y autocorrelación; cuadrada y hex; puntúa cada candidata); estirar/girar el mapa ≤ 1,5× y ≤ 5° moviendo lo colocado con él | 5 + 5 | Portar. La detección necesita una imagen en grises que hoy saca el navegador (`render/imagenGris.ts`): puede seguir en el navegador del máster, es preparación y no estado de juego |

## 4. Modelo de datos actual

**Escena** (`mesa/modelo/escena.ts`, `crisol-escena` v2): `id` estable (nombre legible + 8 hex), `nombre`, `fondo`
(ruta de la imagen), `rejilla` (`type`, `size`, `offsetX/Y`, `enabled`, `visible`, `snapToGrid`, escala propia),
`iluminacion` (`enabled`, `tokenVision`, `exploredMemory`, colores de explorado/inexplorado, `ambientColor`),
colecciones por id: `muros` (`p1`, `p2`, `type` solid/door/secret-door, `blocks` sight/light, `limited`, `direction`,
`visible`, `chainId`), `luces` (`x`, `y`, `rotation`, `emission`, `hidden`, `activeBelowAmbient`), `zonasLuz`,
`chinchetas`, `textos`, `dibujos`, `audio`, `imagenes`; `ajustesFichas`, `widgets` (definiciones) y `preparacion`
(un `ContenidoPartida` con las fichas puestas de antemano). Todas las entidades son `looseObject`: se valida lo mínimo
y se conserva el resto.

**Estado de una campaña** (`mesa/modelo/partida.ts`, `crisol-partida` v3): `fichas`, `niebla` (operaciones),
`puertas` (`closed`, `locked` por id de muro), `luces` (`hidden` por id), `ambiente` (hora del día), `iniciativa`,
`tiradas`, `valoresWidgets`, `botin`, `notaMaster`, `notasFijadas`, `bloquesFijados`, `plantillas`, `clima`,
**`explorado`** (PNG en data URL, a ¼ de resolución, lado máx. 2048) y **`exploradoPor`** (un PNG por personaje).
La campaña copia la preparación la primera vez que guarda; «Volver al estado inicial» borra su archivo.

**Ficha** (en `partida.fichas`): `x`, `y` en píxeles del mapa; `imagePath`, `name`, `label`, `statblockPath` /
`statblockName`, `notePath`, `kind` (`character`), `side` (players/opponents; sin él, la que tiene visión es del
grupo), `size` (casillas por lado: ½, 1, 2, 3, 4…), `rotation`, `elevation`, `layer`, `isHidden`, `instanceNumber`,
`showRing`/`ringColor`/`showNameplate`, `resources` (`{clave: {current, max}}`, **copia** en la ficha), `conditions`,
`conditionValues`, `conditionRounds` (estados con caducidad), `targets`, `vision` (`enabled`, `range`, `angle`,
`senses[]`), `light` (emisión). Tipo laxo en `tabletop/mesa/tipos/varios.ts` (`MapToken`).

**Instantánea** (`mesa/modelo/instantanea.ts` + `mesa/sesion/instantaneas.ts`): `{escena, partida}` completos con
`creada`/`actualizada` y una miniatura de 320 px al lado; en la campaña (`.campaña/mesa/instantaneas/<escena>/`) o en
el mundo; restaurar es un paso de deshacer; se enlaza desde una nota con `[[Escena.escena.json#Nombre]]`.

**Encuentro** (biblioteca, `tabletop/mesa/encuentros/*`, `tabletop/mesa/biblioteca/datos/formato.ts`): recurso
`encounter` de una colección con las fichas y su **formación** (`formacion.ts`, puro: celdas respecto al ancla para
repetirla en la misma rejilla y pasos para llevarla a otra o a un mapa sin rejilla), guardado «desde el mapa» con el
estado de cada ficha. La biblioteca (`.crisol/biblioteca/collections/<id>/{tokens,maps,scenes,encounters,…}`) es un
almacén de archivos con su `library.json`; en el nuevo lo sustituyen la base de datos y el compendio del módulo 4.

**Widgets** (`tabletop/mesa/widgets/modelo.ts`, puro, con pruebas): contador (min/max), reloj de segmentos,
temporizador (cuenta atrás o adelante, `running.since`); definición en la escena, valor en la partida, visibles o no
para los jugadores.

**Comandos** (`mesa/estado/comandos.ts`): `fichas.añadir|mover|cambiar|quitar|capa`, `iniciativa`, `partida.poner`,
`escena.poner`, `documento.restaurar`, `mapa.estirar`, `dibujos.*`, `muros.*`, `puertas.poner`, `luces.encender`,
`niebla.añadir|quitar|mover|todo`, `objetos.*` (chinchetas, textos, luces, audio, zonas, imágenes),
`rutas.renombrar`. Cada uno lleva su **ámbito** (`mundo` o `partida`): es justo la separación «escena del mundo /
estado de cada campaña» que pide el módulo 6, y los comandos sirven igual para la interfaz, la IA y las pruebas.
Se puede portar el reductor puro (con immer o sin él) como validación y aplicación en el servidor.

## 5. Ventana y vista de jugadores

Lo que hace hoy y conviene conservar (`mesa/sesion/ventanaJugadores.ts`, `mesa/nucleo/camaraJugadores.ts`,
`mesa/herramientas/marcoJugadores.ts`):

- **Presentar ≠ abrir**: los jugadores siguen viendo la escena presentada aunque el máster abra otra; «Presentar»
  la cambia con un fundido de 450 ms (sin él con movimiento reducido); «Ocultar» deja la pantalla en negro.
- Cámara: seguir al máster (encajado entero), **fija** (congelar), **seguir a una ficha** o **encuadrar al grupo**;
  el máster ve en su mesa el marco «Jugadores» (moverlo por su pestaña, zoom por la esquina) y tiene «Traerla aquí»
  / «Ir a lo que ven».
- **Imagen encima** de la escena (un retrato, un documento) que los jugadores acercan, mueven y cierran.
- Láser y medida en curso del máster se ven encima de todo, sin guardarse (`mesa/sesion/senales.ts`).
- Ajustes locales de la vista: rejilla, barras, nombres (`VistaLocalJugadores`). Luces animadas a ~20 fps.
- Render (`render/VistaJugadores.ts`): niebla y oscuridad opacas, solo lo que ven las fichas del grupo, lo
  recordado en penumbra con tinte, visión en la oscuridad en grises, siluetas de lo que se nota por vibraciones,
  puertas como puertas (las secretas solo abiertas), muros `visible` solo si están a la vista. La niebla a mano va
  **encima de todo**, también de lo que ven las fichas.

Lo que **no** cumple la regla del módulo 6 («a la tele no le llega nada que el grupo no vea»): `proyectar()` deja
pasar todos los muros (también las puertas secretas cerradas y su posición), todas las fichas no ocultas aunque estén
fuera de la vista (el ocultarlas lo hace el render), las luces de todo el mapa, todas las operaciones de niebla, los
recursos de todas las fichas (el filtro `visibleJugadores` es del render) y la iniciativa de las fichas visibles con
su nombre. Hoy no importaba porque la ventana es hija de la pestaña del máster y a la sala solo le llegan imágenes.
En el nuevo hay que proyectar en el servidor de verdad: fichas dentro de la vista del grupo y no ocultas; puertas
secretas solo abiertas; sin muros salvo los `visible` a la vista; luces solo si alumbran algo visible; recursos según
el sistema y el estado en palabras («Herida», como el módulo 5); lo explorado y la vista actual ya calculados. Queda
por decidir si la imagen del mapa va entera (Foundry y D&D Beyond la mandan entera) o recortada por lo explorado.

`MemoriaExplorada` (`render/memoriaExplorada.ts`) calcula lo explorado con Canvas 2D (degradados radiales, `clip`,
`destination-in`) en el navegador del máster y lo guarda como PNG en la partida. En el servidor no hay canvas: o se
rehace como máscara binaria con un relleno de polígonos y círculos en TypeScript puro (luz percibida → disco de radio
`alcancePercibido` recortado por el polígono de la luz; ∩ polígonos de vista; ∪ visión en la oscuridad; − oscuridad
mágica; a ¼ de resolución y guardada comprimida), o se añade un canvas nativo (`@napi-rs/canvas`, MIT; evitar
`node-canvas` por Cairo). Lo primero es más sencillo y sin dependencias.

## 6. Órdenes de la IA (`mesa/sesion/ordenesIa.ts`, `apps/core-host/src/mcp/tools/mesa.ts`)

Lógica reutilizable como manejadores del servidor: posiciones en **casillas `[columna, fila]` desde 0** (como piensa
un máster; la huella de una ficha grande empieza arriba a la izquierda), fichas por id o por nombre con número
(«Lobo 2», error claro si hay varias), `ver_escena` como datos (fichas con casilla, tamaño, oculta, recursos; puertas
con secreta/abierta/cerrojo; luces; niebla resumida), `mover_fichas` (varias en un paso), `cambiar_fichas` (ocultar,
nombre, recursos sin pasar del máximo, tamaño conservando la casilla), `quitar_fichas`, `niebla` (rectángulo de
casillas o todo), `puerta`, `luz`, `turno` (empezar, siguiente, anterior, terminar, vaciar, añadir sin ficha); las de
varias partes van en un solo paso de deshacer. En el núcleo, además: `estado_mesa`, `listar_escenas`, `abrir_escena`,
`crear_escena`, `colocar_criaturas`, `anadir_iniciativa`, `biblioteca`, `colocar_de_biblioteca`, `instantaneas`,
`presentar_escena`. En el nuevo dejan de depender de una pestaña abierta: actúan sobre el estado en la base y el
servidor avisa a los clientes. Lección: **claves de esquema MCP solo en ASCII** (§ 9).

## 7. Importador UVTT (`mesa/modelo/compat/uvtt.ts`, 234 líneas, 4 pruebas)

Puro (usa `atob`, que hay en Node 24). Lee `.dd2vtt`/`.uvtt`/`.df2vtt` como datos no fiables con límites (150 MB,
20.000 tramos, 2.000 luces, 4.096 casillas por lado, casilla ≥ 10 px) y mensajes en español. Convierte:
`line_of_sight` y `objects_line_of_sight` → muros sólidos encadenados (`chainId`), los dos igual; `portals.bounds` →
puertas con `closed`; `lights` → luces con `dim = range × porCelda` y `bright = dim / 2`, intensidad recortada a 0–1,
color `AARRGGBB` → `#rrggbb`; `environment.ambient_light` → luminancia como luz ambiental; `baked_lighting` → luces
apagadas y ambiente 1; imagen PNG/JPEG/WebP por sus primeros bytes con su tamaño por la cabecera. La casilla sale de
ancho de imagen ÷ `map_size.x` (no mira `pixels_per_grid`); el desplazamiento, de `map_origin`. Descarta lo que cae a
más de una casilla fuera. **Ignora** `pixels_per_grid`, `portals.rotation`, `freestanding`, `lights.shadows` y no
distingue los objetos (en Foundry suelen ir como muros que solo tapan la vista o «terrain»). El pegamento
(`tabletop/mesa/biblioteca/importarUvtt.ts`) guarda la imagen en «Recursos» y la escena en «Escenas».

Para el servidor: portar `leerUvtt`/`escenaDeUvtt`, pero decodificar con `Buffer.from(…, 'base64')`, hacerlo en un
trabajo aparte (ya hay BullMQ) porque un archivo de 50–150 MB entero en memoria con `JSON.parse` + base64 pesa, y
convertir la imagen a WebP. Según `research/uvtt/formato.md`, además hay que corregir: en Dungeondraft
`closed: false` es una **ventana** (no una puerta abierta), su `intensity` va de 1 a 3 (al recortarla a 0–1 todas las
luces salen iguales), un tramo con un extremo fuera se descarta entero en lugar de recortarse (deja huecos en el
borde de los recortes, donde `map_origin` ≠ 0 y vienen los muros de todo el nivel) y no se empalman extremos ni se
simplifican las cuevas (polilíneas de hasta ~650 puntos).

## 8. Rendimiento y riesgos para hacerlo en el servidor

- `poligonoVisible` lanza 48 rayos más 3 por extremo de muro a menos de 1,5 radios, y cada rayo prueba **todos** los
  tramos: O(R·W) ≈ O(W²). En mapas reales de Dungeondraft hay hasta ~450 tramos en interiores y ~2.400 en cuevas
(`research/uvtt/formato.md`); con 2.000 tramos son ~12 millones de intersecciones por ficha; con 5 PJ y
  luces, cientos de ms en JS por recálculo, y el límite admite 20.000 tramos. Hacen falta: descartar tramos por la caja
  del radio, un índice espacial (rejilla de cubos o BVH), cachear por (posición, estado de puertas) y recalcular solo
  al soltar, al abrir una puerta o al cambiar una luz. `conHuecosDePuertas` es O(muros × puertas abiertas).
- No hay pruebas de rendimiento en la mesa. El Crisol nuevo ya mide así lo que lee un jugador
  (`pnpm --filter @crisol/server test:rendimiento`): conviene una igual para «mover una ficha → pantalla al día».
- Lo explorado como máscara: 2048² bytes = 4 MB sin comprimir por campaña y escena (y otra por personaje si se
  quiere la memoria por jugador para el online); guardar comprimido y fuera del historial, como hoy.
- Historial: el de la mesa son parches de immer en el cliente (50 pasos); el nuevo tiene `operations`/`changes` en la
  base. Un arrastre debe ser una operación (al soltar), no una por fotograma.
- Identificadores en español con «ñ» (`tamaño`, `añadir`, `campaña`) y comentarios que citan `sala-limpia/*.md`:
  el nuevo exige inglés. Portar = traducir nombres (mecánico) y quitar esas referencias.
- `erasableSyntaxOnly` del nuevo prohíbe propiedades en el constructor (`constructor(private readonly …)`): las usan
  `estado/persistencia.ts`, `sesion/instantaneas.ts` y varias capas de `render/`; el núcleo puro casi no tiene clases
  (`EscenaSostenida` sí, sin ese patrón).

## 9. Dependencias: actual frente a nuevo

| Pieza | Crisol actual | Crisol nuevo (`pnpm-workspace.yaml` catalog) | Nota |
|---|---|---|---|
| PixiJS | 8.21.0 (`packages/mesa`, `packages/tabletop`) | — | Añadirla en `apps/web` (MIT) si se pinta con ella |
| zustand | 5.0.3 | — | El nuevo usa TanStack Query + Yjs; no hace falta |
| immer | 11.1.18 (parches y deshacer) | — | Opcional en el servidor para los parches; o el modelo de `operations` |
| zod | 4.6.5 | ^4.6.7 | Compatible (`z.looseObject` es de zod 4) |
| TypeScript | 5.8.3 / 5.9.3, `moduleResolution: Bundler` | ^7.0.2, `NodeNext`, `erasableSyntaxOnly` | Ver § 8 |
| Vitest | 4.1.11 | ^5.0.5 | Las pruebas solo usan `describe/it/expect/vi` |
| React | 19.3.0 | ^19.3.1 | — |
| lucide-react | 1.55.0 | 1.57.0 | — |
| jszip | 3.10.1 (MIT o GPL, a elegir) | fflate ^0.8.3 | El nuevo ya abre zips de Foundry con fflate |
| three / cannon-es | 0.185.1 / — | 0.185.1 / 0.20.0 | Dados 3D, ya en el nuevo |
| Node | ≥ 24.11 | ≥ 24.13 | — |
| Iconos de estados y widgets | game-icons (CC BY 3.0) generados en `tabletop/mesa/widgets/dibujosIconos.ts` | lucide (ISC) | CC BY 3.0 no está en la lista de `CONSTRAINTS.md` (solo CC BY 4.0 para datos): no traerlos sin decidirlo |
| Pegatinas | 101 objetos de Kenney (CC0) | — | Se podrían traer (CC0) |

## 10. Lo que dijo o se quejó Enrique (y lo que enseña)

- **La mesa solo vive en la pestaña del máster** (`docs/inventario.md` § «Herencias», n.º 2; `docs/web.md`): la sala,
  la IA y la segunda pantalla dependen de que esté abierta. Es la razón del servidor autoritativo.
- **Informe de automejora** (`~/crisol-data/mundos/Eana/.crisol-dev/informe.md`, 1.551 líneas, casi todo de la hoja):
  - *Abierto (2026-10-29)*: «Las fichas de la mesa enseñan la inicial de la criatura, no la de su nombre». Matones de
    dos bandos renombrados se ven iguales («M», «CB», «G»). Pide la inicial del nombre de la ficha, un rótulo corto o
    el color del borde por bando, también desde `cambiar_fichas`.
  - *Hecho (2026-10-27)*: `cambiar_fichas` quedaba fuera de Claude Code porque su esquema tenía la clave `tamaño`
    («property key … does not match ^[a-zA-Z0-9_.-]{1,64}$»); también `cambiar_sistema` con `añadir`. Se añadió una
    prueba de claves ASCII. En el nuevo, desde el principio.
  - *Hecho*: colocar criaturas por nombre debe encontrar el bloque de estadísticas aunque esté en una subpágina.
  - *Hecho*: el sol del calendario «útil para la mesa (luz de día/noche)»: enlazar la luz ambiental con la hora.
- **Decisiones suyas que el código recoge** (commits `d3511bf`, `7b26080`, `4cc48c2`, `00e57a2`, `730fed3`):
  «visión al soltar» siempre; todo libre de entrada (medir, formas, niebla, fichas) y Mayús pega a la cuadrícula;
  «Alinear la cuadrícula» con un solo camino (la busca sola y, si no encaja, dos esquinas); puertas pegadas a la pared
  que abren su hueco; los jugadores ven las puertas y, si se quiere, los muros a la vista; fichas a tamaño real con la
  escala de la escena y tamaño de los PJ desde su hoja; barra solo con herramientas y «Más…» a la paleta; fuera las
  pegatinas de la barra; una ficha quitada sale también de la iniciativa; abrir una escena no se la enseña a los
  jugadores (Presentar/Ocultar); distancias en vivo con dos decimales; luz y visión de jugadores a media resolución.
- `docs/modulos.md` § «Lo que dijo Enrique al probar» y § «Historia» no tienen quejas de la mesa (son de la wiki).

## 11. Qué portar, qué adaptar y qué rehacer

**Portar casi tal cual** (traducir nombres, cabecera de origen, sus pruebas con ellos) a un paquete puro tipo
`packages/tabletop-core` que importen el servidor y la web:
`nucleo/rejilla`, `medidas`, `plantillas`, `movimiento`, `vision` (+ optimización), `luz`, `visionJugadores`,
`visionAlSoltar` (como regla), `niebla`, `iniciativa` (sin `tirada`), `camaraJugadores`, `camara`, `asas`, `laser`,
`dibujo`, `imagenes`, `chinchetas` (sin `@crisol/core/maps`), `zonasLuz`, `juntas`, `alineacion`, `deteccion`,
`estiramiento`; `modelo/compat/uvtt.ts`; `estado/comandos.ts` (el reductor y los ámbitos); de `tabletop`,
`encuentros/formacion.ts`, `widgets/modelo.ts` y `widgets/tiempo.ts`, y `sentidos/leerSentidos.ts` si hace falta
leer sentidos de texto (con el contenido estructurado del módulo 4 quizá no).

**Adaptar**: `proyeccion.ts` (más estricta, en el servidor, § 5); `render/capas/*` y `VistaJugadores.ts` para el
cliente PixiJS (el del máster y el de la pantalla), leyendo el modelo nuevo y la proyección del servidor;
`ordenesIa.ts` como herramientas MCP del servidor; el esquema de escena/estado/instantánea en Postgres (escena del
mundo enganchada a la página del lugar; estado por campaña; instantáneas como filas), con nombres propios.

**Rehacer**: `sesion/MesaCrisol.ts` (orquestador de 1.117 líneas atado a archivos, a PixiJS y a la ventana),
`ventanaJugadores.ts` (pasa a ser una ruta propia que pide su vista al servidor por WebSocket, manteniendo presentar,
ocultar, fundido, cámaras, imagen encima y congelar), `MemoriaExplorada` (máscara en el servidor), persistencia e
historial (`estado/persistencia.ts`, `historial.ts`, `crearMesa.ts`; el nuevo tiene base, `operations` y deshacer),
`herramientas/*` (las interacciones mandan comandos al servidor con aplicación optimista), `puerto/MesaHost.ts`, la
sincronía PJ ↔ ficha (`tabletop/runtime/personajesEnMesa.ts`: en el nuevo la ficha **es** el personaje o la criatura
en juego, `campaign_creatures`/`characters`, y no copia sus PG), la biblioteca de archivos (`tabletop/mesa/biblioteca`),
`tabletop/plataforma` y `tabletop/runtime` (shim de Obsidian, no se toca), la sala de fotogramas WebP de
`GameServer.ts`. Quedan fuera según la entrevista: botín (`tabletop/mesa/botin`), paquetes de colección
(`biblioteca/paquetes`, jszip), clima (`nucleo/clima.ts`, `CapaClima`) y el sonido posicional (módulo 7).

**Para decidir en la spec**: ¿la imagen del mapa va entera a la pantalla o recortada?; ¿lo explorado, solo del grupo
(basta para la tele) o también por personaje (para el online, como `exploradoPor`)?; cómo se combinan niebla a mano y
automática (hoy la manual tapa por encima de todo); coordenadas en píxeles de la imagen (como hoy y como Foundry) con
la IA hablando en casillas; qué hace la pantalla mientras el máster arrastra (hoy la vista de jugadores lee la escena
«sostenida» de `MesaCrisol.docDeLaLuz`: la ficha sigue donde empezó y salta al soltar, lo que encaja con un servidor
que solo recibe el movimiento al soltar); el rótulo corto o el color de bando de las fichas que pidió Enrique.
