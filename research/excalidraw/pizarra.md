# La pizarra embebida: Excalidraw, tldraw y alternativas

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-12 · Versión estudiada: @excalidraw/excalidraw 0.18.1
(y tldraw 5.6.0, y-excalidraw 2.0.12, @xyflow/react 12.12.1, konva 10.9.1, fabric 7.4.0)

Solo web pública: npm, GitHub, documentación oficial y el tarball de npm de Excalidraw abierto en un directorio
temporal sin ejecutar nada. Certeza: [npm] registro de npm · [GitHub] repositorio, issues o releases · [docs]
documentación oficial · [tarball] medido o leído en el paquete publicado · [inferido] deducción nuestra.

## Pregunta

La pestaña «Pizarra» de una página (ver `docs/intent/mapas-pizarras.md`): dibujo libre al estilo Excalidraw, tarjetas
de páginas que llevan a ellas, imágenes del mundo y flechas. La prepara el máster; los jugadores la ven solo si se
revela, sin las tarjetas de lo que no conocen, y no escriben. Queríamos saber:

1. Si Excalidraw sirve como componente embebido en nuestra app (React 19.3, Vite 8, Yjs 13.6 con Hocuspocus 4.8):
   licencia, peso, guardado, elementos propios, solo lectura, colaboración y filtrado para jugadores.
2. Si tldraw cabe con la norma de licencias (nada copyleft ni que impida vender Crisol).
3. Qué alternativas MIT o Apache hay y cómo encajan.

## Lo que hacen

### Excalidraw como componente

**Licencia y versiones.** MIT, «Copyright (c) 2020 Excalidraw», tanto en el campo `license` de npm como en el LICENSE
del repositorio [npm] [GitHub]. El tarball de npm no trae el archivo LICENSE dentro [tarball]: habrá que copiar el
aviso a `docs/terceros.md`. La última estable es la 0.18.1 (20-04-2026), un parche de seguridad que solo actualiza
`@excalidraw/mermaid-to-excalidraw` por un XSS de Mermaid; la 0.18.0 es de marzo de 2025 [GitHub]. Desde entonces
salen a diario instantáneas `0.18.0-<commit>` con la etiqueta `next` (la última, del 12-11-2026) [npm]: el proyecto
está muy vivo (135 000 estrellas, empujes diarios), pero las versiones estables llegan muy de tarde en tarde. El
monorepo ya separa paquetes (`@excalidraw/element`, `common`, `math`, `utils`) que solo salen como instantáneas [npm].
Excalidraw+ (plus.excalidraw.com) es su producto de pago; la librería sigue siendo MIT [docs].

**React 19.** Las `peerDependencies` admiten React 17, 18 y 19 [npm], y el propio repositorio se desarrolla con React
19.0.0 [GitHub]. El único roce conocido: una dependencia vieja (`@radix-ui/react-tabs` 1.0.2) declara React ≤ 18 y npm
avisa de un conflicto de pares (issue #11500, abierta en junio de 2026; hay un PR, #11572, que sube Radix) [GitHub]. Es
un aviso, no un fallo, y pnpm por defecto no lo trata como error [inferido].

**Peso.** El paquete ocupa 31 MB comprimido y 47 MB descomprimido, porque trae las versiones de desarrollo y de
producción, los tipos, 55 idiomas y las fuentes [tarball]. Lo que de verdad carga el navegador al abrir el editor es
mucho menos: el punto de entrada de producción y su trozo principal suman unos 310 KB con gzip, más 23 KB de CSS y las
dependencias externas (Radix, Jotai, roughjs, perfect-freehand…); bundlephobia lo cifra en 1,1 MB minificado y
353 KB con gzip [tarball] [bundlephobia]. Todo lo demás se carga a demanda: cada idioma es un `import()` aparte (hay
`es-ES`), Mermaid solo al convertir un diagrama, y un trozo de 1,8 MB (unos 740 KB con gzip) con HarfBuzz y woff2 en
WebAssembly solo para recortar fuentes al exportar a SVG [tarball]. Las fuentes son 14 MB, de los que 13 MB son
Xiaolai (china, japonesa y coreana) partida en 209 trozos woff2 que solo se piden si se escribe en esos alfabetos; el
resto de familias pesa entre 20 y 85 KB cada una [tarball]. Por defecto las fuentes se descargan de un CDN (esm.run);
para servirlas nosotros se copian a una carpeta pública y se indica con `window.EXCALIDRAW_ASSET_PATH` [docs]. Las
licencias de las fuentes no vienen en el paquete [tarball]; las de Excalifont y Xiaolai suelen ser OFL [inferido].

**Cómo se guarda la escena.** Una escena es un JSON con tres partes: `elements` (array), `appState` (vista y
preferencias) y `files` (un mapa de identificador a imagen) [docs] [tarball]. Cada elemento lleva `id`, tipo, posición
y tamaño, estilo, `seed` para que el trazo «a mano» no cambie, `version` (sube en cada cambio), `versionNonce`
(aleatorio en cada cambio), `index` (índice fraccionario para el orden de apilado), `isDeleted` (las bajas son
lápidas), `groupIds`, `frameId`, `boundElements` (textos y flechas atados), `updated`, `link`, `locked` y un
`customData` libre [tarball]. Las imágenes son elementos `image` con un `fileId`; la imagen en sí va aparte en `files`
como `dataURL` con su tipo MIME [tarball]. `serializeAsJSON` tiene dos modos: «local», que limpia el `appState` para
exportar e incluye los `files`, y «database», que deja el `appState` mínimo y no incluye los `files`, pensado para
guardar las imágenes en otro sitio [GitHub]. `restore` y `restoreElements` rellenan lo que falte con valores por
defecto, reparan textos y flechas atados a elementos inexistentes (`repairBindings`) y normalizan los índices [docs].

**Elementos propios.** No hay tipos de elemento a medida; hay tres vías [docs] [tarball]:

- `customData` en cualquier elemento: un objeto nuestro que viaja con él, se guarda y sobrevive a copiar y pegar.
- `link` en cualquier elemento: sale un icono de enlace y, al pulsarlo, `onLinkOpen` recibe el elemento y el evento; si
  se llama a `preventDefault()`, la navegación la hace la app. `generateLinkForSelection` cambia los enlaces que genera
  Excalidraw para enlazar a elementos de la misma escena (función nueva de la 0.18).
- Elementos `embeddable`: un recuadro con un `link` que, por defecto, se pinta como un iframe. `validateEmbeddable`
  decide qué enlaces valen (true, lista de dominios, expresiones regulares o una función) y `renderEmbeddable` cambia
  el iframe por un componente React propio que recibe el elemento y el `appState`.

**Solo lectura.** `viewModeEnabled` fija el modo vista desde la app: se puede mover y hacer zoom, no editar [docs]. Con
`UIOptions` se quitan acciones del lienzo y herramientas (la de imagen, por ejemplo); `langCode` pone el idioma
[docs].

**Colaboración.** Excalidraw no trae servidor. Su app (excalidraw.com) usa un repetidor con Socket.IO (excalidraw-room,
MIT) que solo reenvía mensajes cifrados de extremo a extremo, y guarda la sala en Firebase con las imágenes aparte (de
hasta 4 MiB) [GitHub] [docs]. Cada cliente emite solo los elementos cuya versión cambió y, cada 20 s, la escena entera;
al recibir, fusiona por `id` con `reconcileElements`: gana la `version` más alta y, si empatan, el `versionNonce` más
bajo, salvo que el elemento local se esté editando o redimensionando en ese momento [GitHub]. Las lápidas se guardan
un día y luego se descartan [GitHub]. Los cambios remotos entran con `updateScene` y `CaptureUpdateAction.NEVER`, así
que no se mezclan con el deshacer local: desde la 0.18 el deshacer es por usuario y convive con la colaboración
[GitHub] [tarball]. `isCollaborating` y `onPointerUpdate` sirven para mostrar cursores ajenos [docs].

**El binding de Yjs.** `y-excalidraw` (MIT, Rahul Badenkal) guarda un `Y.Array` de `Y.Map`, uno por elemento con su
posición, y un `Y.Map` aparte para las imágenes; sincroniza cursores por *awareness* y trae su propio deshacer con
`Y.UndoManager` [GitHub]. La granularidad es el elemento entero, no cada propiedad, porque `onChange` de Excalidraw
entrega la escena completa sin diferencias [GitHub]. Madurez baja: 37 estrellas, 2.0.12 de diciembre de 2024, sin
pruebas, `peerDependency` en Excalidraw ^0.17.6 y dos issues abiertas de 2025-2026, una precisamente por errores al
poner `langCode` [GitHub] [npm]. Pesa unos 4 KB con gzip [bundlephobia].

### tldraw

La 5.6.0 (28-10-2026) es la última; admite React 18.2 y 19.2.1 o superior [npm]. Su licencia no es libre: en npm dice
«SEE LICENSE IN LICENSE.md» y GitHub la marca como no reconocida [npm] [GitHub]. La «tldraw license» permite usarlo,
modificarlo y empaquetarlo en desarrollo, pero **prohíbe el uso en producción** sin una clave; la clave se pasa al
componente, se valida en el cliente y el SDK incluye medidas para detectar el entorno, forzar la marca de agua y enviar
datos de uso durante la prueba [GitHub] [docs]. Hay tres claves: prueba gratuita de 100 días (una por empresa), licencia
comercial anual con precio a medida, y licencia «hobby» gratuita, discrecional, solo para proyectos no comerciales y
con la marca «made with tldraw» en el lienzo [docs]. Su sincronización (`@tldraw/sync`) va con la misma licencia
[inferido].

### Alternativas

- **React Flow (`@xyflow/react`)**, MIT, 12.12.1, unos 60 KB con gzip, React ≥ 17 [npm] [bundlephobia]. Es un editor
  de nodos y aristas, no de dibujo: los nodos son componentes React (perfecto para tarjetas de páginas) y el estado lo
  lleva la app, así que encaja con Yjs sin binding. El dibujo libre, el lazo y la goma de su sección «whiteboard» son
  ejemplos de pago (React Flow Pro) que usan perfect-freehand [docs].
- **Konva + react-konva**, MIT, konva 10.9.1 y react-konva 19.3.2 (pide React ≥ 19.3), unos 100 KB con gzip entre los
  dos [npm] [bundlephobia]. Un motor de lienzo 2D con formas, imágenes, transformador y eventos; la pizarra
  (herramientas, selección, flechas atadas, deshacer, guardado) habría que hacerla entera.
- **Fabric.js**, MIT, 7.4.0, unos 92 KB con gzip, sin dependencia de React [npm] [bundlephobia]. Parecido a Konva, con
  dibujo libre y serialización a JSON propios; se integra a mano en React.
- **perfect-freehand**, MIT, 1.2.3, 2 KB con gzip [npm] [bundlephobia]. Convierte puntos del puntero en un contorno de
  trazo con presión; lo usan Excalidraw y tldraw. Una pieza, no una pizarra.
- **Plait / Drawnix**, MIT [GitHub]. Plait (`@plait/core`, `@plait/draw` 0.94.1) es un marco de dibujo de PingCode con
  plugins y capas de vista para Angular y React; Drawnix (15 000 estrellas) es la app de pizarra hecha con él, con mapas
  mentales y diagramas. Drawnix no se publica en npm, su release es la v0.4.0 y la capa React de Plait está en
  prerelease (`@plait-board/react-board` 0.4.0-0) [npm] [GitHub]. Sin colaboración en tiempo real documentada.
- **BlockSuite** (el lienzo de AFFiNE), con licencia MPL-2.0 en el repositorio [GitHub]: copyleft débil por archivo y,
  además, un editor de documentos entero. Lo descartamos.

### Tabla comparativa

| Librería | Licencia | Versión | Peso (gzip) | React 19 | Colaboración | Solo lectura |
|---|---|---|---|---|---|---|
| @excalidraw/excalidraw | MIT | 0.18.1 (abr. 2026) | ~353 KB + a demanda | Sí (aviso de Radix) | Sin servidor; fusión por versión | `viewModeEnabled` |
| y-excalidraw | MIT | 2.0.12 (dic. 2024) | ~4 KB | Indiferente | Yjs por elemento | — |
| tldraw | Propia, no libre | 5.6.0 (oct. 2026) | ~552 KB | Sí (≥ 19.2.1) | `@tldraw/sync` (misma licencia) | Sí |
| @xyflow/react | MIT | 12.12.1 | ~60 KB | Sí | Estado propio, fácil con Yjs | Props de interacción |
| konva + react-konva | MIT | 10.9.1 / 19.3.2 | ~100 KB | Sí (≥ 19.3) | A mano | A mano |
| fabric | MIT | 7.4.0 | ~92 KB | No depende | A mano | A mano |
| perfect-freehand | MIT | 1.2.3 | ~2 KB | No depende | — | — |
| Plait / Drawnix | MIT | 0.94.1 / app | ~40 KB (`draw`) | Prerelease | No documentada | No documentado |

## Compromisos y límites

- **Excalidraw da casi todo hecho**: dibujo a mano alzada, formas, flechas que se atan, texto, imágenes con recorte,
  marcos, deshacer, buscar, idioma español y un formato abierto. A cambio es una caja con su propia interfaz: se puede
  recortar y retocar, pero no rehacer, y su estética «a mano» no se parece a la de Crisol [inferido].
- **Las estables llegan despacio** (una al año); vivir de instantáneas `next` es cambiar de API sin aviso [GitHub].
- **Peso**: ~350 KB con gzip no se pueden cargar en cada página de la wiki; solo al abrir la pestaña [inferido].
- **Las fuentes del CDN** sacan peticiones a un tercero y fallan sin red: conviene servirlas nosotros [docs].
- **La fusión de Excalidraw es por elemento entero**: si dos editan el mismo elemento a la vez, gana uno; para una
  pizarra que prepara un solo máster (más la IA) basta [inferido]. Yjs no añade nada a eso; lo que aporta es el
  transporte, la persistencia y que ya lo tenemos.
- **El estado de Yjs se sincroniza entero**: un jugador conectado al documento recibiría todo, también lo que no
  conoce. La versión del jugador no puede ser el documento de Yjs [inferido].
- **Imágenes en Yjs, no**: un `dataURL` de varias MB no cabe en el límite de 4 MB de estado y 1 MB por mensaje de
  nuestro Hocuspocus (`apps/server/src/collab/server.ts`) [inferido].
- **Los trazos a mano** guardan muchos puntos por elemento y las lápidas se acumulan; una pizarra muy usada crece
  [inferido].
- **Embeddables**: un componente React por tarjeta encima del lienzo es más rico, pero son nodos del DOM, no se
  exportan como imagen y en modo edición hay que activarlos para interactuar [inferido].
- **tldraw** choca con la norma: sin clave no hay producción, la clave gratuita es discrecional, no comercial y con
  marca de agua, y la de pago es anual. **No vale para Crisol.**
- **Las alternativas MIT** son piezas: con React Flow, Konva o Fabric la pizarra (herramientas, selección, flechas
  atadas, deshacer, exportar) es un proyecto propio de semanas; Plait/Drawnix aún no se puede embeber con garantías.

## Qué nos llevamos a Crisol

1. **Excalidraw 0.18.1 (MIT)**, fijado a la versión estable, cargado con `React.lazy` solo en la pestaña «Pizarra», con
   las fuentes servidas por nosotros (`EXCALIDRAW_ASSET_PATH`), `langCode` `es-ES` y `UIOptions` recortadas. Su aviso
   MIT y el de sus fuentes, a `docs/terceros.md`. tldraw, descartado por licencia.
2. **Un documento de Yjs aparte por pizarra**, como los de las pestañas de texto, por el Hocuspocus que ya tenemos.
   Binding propio pequeño, con y-excalidraw como referencia y no como dependencia: un `Y.Map` de elementos por `id` con
   el JSON entero; al cambiar, escribir solo los que subieron de `version`; al llegar cambios remotos, fusionarlos con
   `reconcileElements` y meterlos con `updateScene` y `CaptureUpdateAction.NEVER`. El orden va en `index` y el
   deshacer es el de Excalidraw. El servidor purga lápidas viejas al guardar.
3. **Imágenes como archivos del mundo**: el `files` de la escena no entra en Yjs; un mapa aparte guarda `fileId` →
   archivo del mundo, y el cliente lo descarga y lo añade con `addFiles`. Así se usan las imágenes que ya hay.
4. **Tarjetas de páginas** como elementos normales (un rectángulo con su texto, quizá con la imagen de la página) con
   `customData` que diga la página y `link` a su ruta interna; `onLinkOpen` con `preventDefault()` navega con nuestro
   router. El título se refresca al abrir desde la página, por si se renombró. Los embeddables con `renderEmbeddable`
   (y `validateEmbeddable` con una función que solo acepte rutas internas) quedan para una tarjeta rica, si hace falta.
5. **La versión del jugador se hace en el servidor**: a partir de la escena guardada se quitan las tarjetas de páginas
   que su campaña no conoce, su texto atado, las flechas atadas a ellas, los `link` a páginas ocultas en cualquier
   elemento y las imágenes que se queden sin uso; lo «solo del máster» se marca en `customData` y no sale nunca. Llega
   por la API como JSON (no por Yjs), se pinta con `viewModeEnabled` y se recarga con un aviso cuando cambia. La IA de
   un jugador lee esa misma versión.
6. **La IA dibuja por el MCP** con un esqueleto sencillo (tarjetas, flechas, textos, formas) que el servidor convierte
   en elementos mínimos; el cliente los completa con `restore`. Si `@excalidraw/element` puede crear elementos en Node,
   mejor: queda por probar.

Sin confirmar: si los enlaces se abren con un clic en modo vista o solo desde el icono; cómo se comportan los
embeddables en modo vista; si el binding funciona con la 0.18 tal cual; las licencias exactas de cada fuente; y si
`@excalidraw/element` se puede usar en el servidor.

## Fuentes

- https://www.npmjs.com/package/@excalidraw/excalidraw (y `npm view`, 12-11-2026)
- https://registry.npmjs.org/@excalidraw/excalidraw/-/excalidraw-0.18.1.tgz
- https://github.com/excalidraw/excalidraw/blob/master/LICENSE
- https://github.com/excalidraw/excalidraw/releases/tag/v0.18.1 y …/tag/v0.18.0
- https://github.com/excalidraw/excalidraw/issues/11500 y …/pull/11572
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/collab/Collab.tsx
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/app_constants.ts
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/json.ts y …/data/reconcile.ts
- https://github.com/excalidraw/excalidraw-room
- https://plus.excalidraw.com/docs/sdk/excalidraw/installation
- https://plus.excalidraw.com/docs/sdk/excalidraw/api/props y …/api/props/render-props
- https://plus.excalidraw.com/docs/sdk/excalidraw/api/utils, …/utils/restore y …/utils/export
- https://plus.excalidraw.com/blog/building-excalidraw-p2p-collaboration-feature
- https://github.com/RahulBadenkal/y-excalidraw (README, LICENSE, package.json, issues)
- https://github.com/tldraw/tldraw/blob/main/LICENSE.md
- https://tldraw.dev/community/license y https://tldraw.dev/pricing
- https://www.npmjs.com/package/tldraw
- https://reactflow.dev/examples/whiteboard/freehand-draw y https://reactflow.dev/learn/advanced-use/whiteboard
- https://github.com/xyflow/xyflow, https://github.com/konvajs/react-konva, https://github.com/fabricjs/fabric.js
- https://github.com/steveruizok/perfect-freehand
- https://github.com/plait-board/drawnix y https://github.com/worktile/plait
- https://github.com/toeverything/blocksuite
- https://bundlephobia.com (tamaños de cada paquete, 12-11-2026)
