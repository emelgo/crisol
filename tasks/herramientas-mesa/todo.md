# Tareas: herramientas-mesa

Spec: `docs/specs/herramientas-mesa.md` · ADR-0018 · Diseño: lienzo «Crisol: la mesa», tablero Herramientas (y la
plantilla y sus objetivos del tablero Combate). El servidor va antes que la web.

- [x] 1. El núcleo: medir (las tres reglas, hexagonal, caminos), plantillas y sus fichas de dentro, dibujo y goma, láser, imágenes sueltas, pines y widgets (`packages/tabletop`, portado de la mesa actual)
- [x] 2. La base de datos (migraciones 0059 y 0061: `scene_marks`, `campaign_widgets`, `scene_snapshots`, `campaign_tables.measure_on_screen`) y los contratos (marcas, plantillas, medir, widgets, instantáneas; la medida y el láser en vivo; las marcas y los widgets en la mesa y en la pantalla)
- [x] 3. El servidor: las acciones, la medida y el láser por el canal (filtrados por lo que ve el grupo), la proyección (sin lo del máster ni lo que cae en la niebla), volver a una instantánea con deshacer
- [x] 4. La IA: `medir`, `poner_plantilla`, `fichas_en_plantilla`, `ver_marcas`, `cambiar_marcas`, los widgets y las instantáneas
- [ ] 5. La web: la columna de herramientas (elegir, medir, plantilla, dibujar, texto, sellos, pin, láser) con sus atajos; medir con «la tele ve lo que mides»; dejar la plantilla y elegir sus fichas de dentro para dañarlas
- [ ] 6. La web: dibujos con goma, textos, sellos, pines e imágenes sueltas; los widgets en la mesa y en la tele; las instantáneas con su miniatura; la pantalla del máster (statblocks y nota)
- [ ] 7. E2E (medir un cono, dejarlo como plantilla, elegir las de dentro y dañarlas; un reloj en la tele; guardar una instantánea y volver), fugas, documentación y revisión
