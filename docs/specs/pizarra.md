# Spec: la pizarra (módulo 9)

Capacidad `pizarra` del módulo 9 (`docs/specs/modulo-9.md`). Intención: `docs/intent/mapas-pizarras.md`. Estudio:
`research/mapas-y-pizarras.md` y su nota de Excalidraw. Secundaria: Enrique casi no la usa; que sirva para preparar
tramas, quién es quién o el tablero de una investigación, sin convertirse en un programa de dibujo propio.

## Objetivo

Una pestaña «Pizarra» en una página: dibujo libre a mano alzada, cajas, flechas y textos (como Excalidraw), con
**tarjetas de páginas del mundo** que llevan a ellas e **imágenes del mundo**. La prepara el máster; los jugadores la
ven solo si la pestaña se les revela, en solo lectura y sin las tarjetas de lo que no conocen.

## Comportamiento

- **La pestaña**: «Pizarra» se añade como «Mapa» o «Tabla» (el «+» de las pestañas). Se abre a lo ancho, con
  «Ampliar» como el mapa. El editor se carga solo al abrirla (no pesa en lo demás).
- **Dibujar**: las herramientas de Excalidraw (seleccionar, mano alzada, rectángulo, elipse, rombo, flecha, línea,
  texto, goma), en español, con el tema oscuro de la app; sin las que sacan de Crisol (exportar a su web, colaborar en
  su sala, su biblioteca pública).
- **Tarjetas de páginas**: arrastrar una página del árbol a la pizarra (o «Página…» en su barra) pone una tarjeta con
  su icono, su título y su resumen; pulsarla abre la página. Si la página cambia de título, la tarjeta lo sigue. Si va a
  la papelera, la tarjeta sale «sin página».
- **Imágenes**: de los archivos del mundo (el selector de siempre) o pegadas/arrastradas (se suben al mundo). No se
  guardan dentro de la pizarra: van por su archivo.
- **Se guarda solo y en vivo**: dos pestañas (o dos másteres) a la vez ven lo del otro; deshacer es de cada uno.
- **La jugadora**: si la pestaña se le revela, la ve en solo lectura (mover y acercar); las tarjetas de páginas que su
  campaña no conoce no le llegan, ni lo que el máster marque como «Oculto» (un elemento puede llevar esa marca).
- **El historial**: crear y quitar la pestaña va al historial de Crisol; lo de dentro se deshace en la pizarra.

### IA (MCP)

- `ver_pizarra`: lo que hay, en palabras (tarjetas con su página, textos, cajas y flechas con lo que unen).
- `cambiar_pizarra`: añadir tarjetas de páginas, textos, cajas y flechas entre ellos (en una rejilla sencilla, sin
  coordenadas finas), y quitar lo que se diga. Para «hazme un tablero de la conspiración con estas páginas».

## Datos (propuesta)

- `page_tabs.kind` gana `whiteboard`; la escena va en un documento de Yjs propio de la pestaña (como una de texto), por
  el Hocuspocus de la wiki: un `Y.Map` de elementos por id (gana la versión más alta, como hace Excalidraw) y la vista
  aparte.
- Las tarjetas son elementos de Excalidraw con `customData: { pageId }` y su `link`; las imágenes, elementos `image`
  cuyo `fileId` es el de un archivo del mundo.
- La lectura de la jugadora la proyecta el servidor (como el texto de una página): sin tarjetas de páginas que no ve,
  sin lo oculto y sin `files` de fuera de su alcance.

## Licencias y terceros

`@excalidraw/excalidraw` 0.18.1 (MIT): su aviso en `docs/terceros.md`. Sus fuentes (Excalifont y otras, OFL según el
estudio): comprobarlo antes de servirlas desde Crisol (`EXCALIDRAW_ASSET_PATH`), no desde su CDN. tldraw, descartado
(su licencia pide clave en producción).

## Pruebas

- Unitarias: el enlace Yjs ↔ escena (fusionar por versión, lápidas), la proyección de la jugadora, las tarjetas.
- Integración: crear la pestaña, guardar y leer la escena, lo que recibe una jugadora (prueba de fugas), el MCP.
- E2E: el máster pone dos tarjetas y una flecha y dibuja a mano alzada; otra pestaña lo ve al momento; la jugadora la
  ve sin la tarjeta de lo que no conoce.

## Límites

- Siempre: lo de los jugadores lo filtra el servidor; la pizarra no carga si no se abre.
- Preguntar antes: añadir Excalidraw (dependencia nueva; MIT, comprobado) y servir sus fuentes.
- Nunca: que los jugadores escriban en ella (para eso, el diario del grupo); su colaboración o su almacenamiento en la
  nube.

## Criterios de éxito

1. El máster hace un tablero con cinco tarjetas de PNJ, flechas y notas a mano, y desde otro aparato se ve igual al
   momento.
2. La jugadora con la pestaña revelada lo ve sin la tarjeta de un PNJ que no conoce; ni por la web ni por el MCP le
   llega su título.
3. Abrir una página sin pizarra no descarga nada de Excalidraw.
