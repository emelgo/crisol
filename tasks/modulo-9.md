# Módulo 9 — Mapas con capas (plan)

Rama `modulo-9/mapas`. Spec: `docs/specs/mapas-capas.md`. Intención: `docs/intent/mapas-pizarras.md`. Estudio:
`research/mapas-y-pizarras.md`. Lienzo aprobado (Enrique, 2026-11-13: «está genial», con sus diez decisiones):
https://claude.ai/artifact/GM5TSzGsVXRx2Q1nkwDvbx (fuente en `out/lienzo-mapas/lienzo.html`, fuera de git).

Hoy: la pestaña «Mapa» (`apps/web/src/wiki/map/map-tab.tsx`, pintada a mano, sin librería) tiene imagen, escala y
pines; `map_elements` existe sin usar; el conocimiento ya admite `element`. Cada porción, vertical y con sus pruebas;
todo en local (sin CI este mes: `[skip ci]`).

## Porciones

- [x] 1. **Datos y contratos**: migración (`map_layers` con historial; `map_elements.layer_id` y `position`;
  `maps.speeds`), geometría y estilo con zod (puntos 0–1; región con piezas; ruta; texto con giro y arco; estilos en
  listas cerradas), repo y acciones (capas: crear, cambiar, ordenar, quitar; elementos: crear, cambiar, quitar),
  `getMap` con capas y elementos, y el filtro de la jugadora (capa oculta, elemento oculto o sin revelar, página que no
  conoce → sin nombre). Integración y la prueba de fugas.
  - Verifica: `pnpm --filter @crisol/server test` (maps, fugas), migración aplicada a la base local.
- [x] 2. **Pintar y las capas**: las regiones, rutas y textos sobre la imagen (SVG encima, con el mismo encuadre que
  los pines, que siguen arriba); el panel «Capas» (ver, apagar en mi pantalla —recordado en el aparato—; el máster:
  crear, renombrar, ordenar arrastrando, «Solo del máster»). Rendimiento: 50 regiones de 200 puntos sin tirones.
- [x] 3. **Dibujar y retocar**: la barra (seleccionar, pin, región, ruta, texto, medir; teclas V P R L T M), dibujar
  punto a punto (Intro o doble clic acaba, Esc cancela), arrastrar vértices, «+» en los lados, quitar con el botón
  derecho o Supr, mover la pieza, pegar a vértices y pines cercanos; el panel de lo seleccionado (nombre, página, capa,
  relleno, borde, nombre visible, oculta, quitar); Ctrl+Z mientras se edita.
- [x] 4. **Medir**: funciones puras (tramos, a lo largo de una ruta, días por velocidad), calibrar la escala con una raya,
  las velocidades en «Ajustes del mapa», la regla (pegándose a pines y vértices) y su recuadro; también la jugadora.
- [ ] 5. **Revelar y la jugadora**: en el panel, quién la conoce y «Revelar» (como los pines); la vista de la jugadora
  (sin edición, con medir y capas en su pantalla) y en el móvil.
- [ ] 6. **La IA**: `ver_mapa` con capas y elementos; `imagen_mapa` (la imagen reducida ≤ 1568 px con rejilla y lo
  dibujado; librería pura y MIT, p. ej. jimp: comprobar licencia y WebP; sharp no, por libvips LGPL); crear y cambiar
  capas y elementos en 0–1 o en píxeles de esa vista (el servidor convierte, simplifica, pega vértices y casa rutas con
  pines); medir; instrucciones. Lo de la IA entra animado (se forja) y se deshace entero.
- [ ] 7. **Cierre**: e2e (criterio 1 de la spec, accesibilidad), crítica y audit de impeccable con sus arreglos,
  página de revisión, `docs/modulos.md`, `tasks/probar.md` y memoria.
