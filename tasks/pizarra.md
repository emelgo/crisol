# Módulo 9 — La pizarra (plan)

Rama: la de los mapas, `modulo-9/mapas` (o una nueva sobre `main` cuando los mapas estén fusionados). Spec:
`docs/specs/pizarra.md`. Lienzo aprobado (Enrique, 2026-11-13: «Ok», con Excalidraw):
https://claude.ai/artifact/BWQWVbhsr7WqyUyLpBdh1J (fuente en `out/lienzo-pizarra/lienzo.html`, fuera de git).

Hoy: una pestaña de texto es un documento de Yjs aparte (`documents`, de tipo `tab`) que edita quien lleva la wiki por
el Hocuspocus (`apps/server/src/collab/server.ts`); un jugador no abre documentos: lee lo proyectado por el servidor.
La pizarra sigue el mismo camino. Todo en local (sin CI este mes: `[skip ci]`).

## Porciones

- [ ] 1. **La dependencia y su pestaña vacía**: `@excalidraw/excalidraw` 0.18.1 (MIT; comprobar licencia y la de sus
  fuentes; aviso en `docs/terceros.md`; fuentes servidas por Crisol con `EXCALIDRAW_ASSET_PATH`, no su CDN);
  `page_tabs.kind` gana `whiteboard` (migración) y su documento aparte; «Pizarra» en el «+» de las pestañas; el editor,
  cargado a demanda (`lazy`), en español y con el tema oscuro. Verifica: abrir una página sin pizarra no descarga
  Excalidraw (e2e mira las peticiones).
- [ ] 2. **Guardar en vivo**: el enlace Yjs ↔ escena (un `Y.Map` de elementos por id; gana la versión más alta, como
  `reconcileElements`; lápidas), por el Hocuspocus de la wiki; dos pestañas a la vez se ven al momento; deshacer de
  cada uno. Unitarias del enlace.
- [ ] 3. **Tarjetas de páginas e imágenes**: «Página…» en su barra y arrastrar desde el árbol ponen una tarjeta
  (`customData.pageId` y su enlace; se pinta con `renderEmbeddable` o un elemento propio) que sigue el título de su
  página y la abre al pulsarla; imágenes de los archivos del mundo (pegar o arrastrar las sube).
- [ ] 4. **La jugadora**: `getWhiteboard` proyecta la escena (sin tarjetas de páginas que no conoce, sin lo «Oculto»,
  sin las flechas atadas a lo quitado, sin archivos de fuera); la pestaña revelada se ve en solo lectura. Prueba de
  fugas.
- [ ] 5. **La IA**: `ver_pizarra` (en palabras) y `cambiar_pizarra` (tarjetas, notas, cajas y flechas en una rejilla
  sencilla; quitar); instrucciones.
- [ ] 6. **Cierre**: e2e (criterios de la spec), crítica y audit de impeccable, página de revisión, docs y memoria.
