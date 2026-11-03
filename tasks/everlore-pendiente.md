# Lo que falta de Everlore en Crisol (repaso del 2026-11-02)

Enrique: «estás omitiendo muchas cosas de Everlore». Repaso del código de Everlore frente a la wiki de Crisol. Las rutas
de Everlore, en su repo (`emelgo/everlore`, `apps/web/src/`); las de Crisol, en `apps/web/src/wiki/`. Sala limpia: de
Everlore solo la lógica de Enrique; nada de Makerkit (`@kit/ui`, `packages/ui/src/makerkit`, shadcn, billing…).

## Hecho en esta tanda

- [x] Menú del botón derecho en el árbol: subpágina, renombrar, duplicar, exportar, mover, ordenar, borrar
- [x] Panel de bloques (texto, imagen, barra, círculo, estrellas, fichas, subpáginas, etiqueta)
- [x] Asa de bloque con «Convertir en» por grupos e «Insertar debajo»; títulos del 1 al 6; caja con marco

## Árbol

- [ ] Plegar todo / desplegar todo (`entry-tree-row-menu.tsx:484-489`, `entry-tree.tsx:344-357`)
- [ ] El filtro del árbol también busca en el texto al momento (`entry-tree.tsx:383`)
- [ ] Páginas ocultas: «Ocultar» y la marca «Oculta»; visibilidad por página (con el módulo 5)

## Editor

- [ ] Burbuja de formato: «Más» con resaltado, subíndice, superíndice y quitar formato (`lore-bubble-menu.tsx:389-407`)
- [ ] Burbuja: convertir en texto normal o cita (`lore-bubble-menu.tsx:210`)
- [ ] «Página nueva» desde lo elegido, enlazándola (`lore-bubble-menu.tsx:334`)
- [ ] Columnas lado a lado (`/Layout`, `layout-columns.ts`)
- [ ] Bloque plegable (`/Expandir`, Details de TipTap, MIT)
- [ ] Incrustar YouTube, Spotify y tarjeta de enlace (`embed-blocks.tsx`)
- [ ] Medidores y estrellas también en el texto (`lore-commands.tsx:285-325`)
- [ ] Índices en el texto: por etiqueta, subpáginas, «mencionado en»; bloque de enlace (`collection-blocks.tsx`)
- [ ] Icono dentro del texto; el selector de iconos con pestaña de glifos (`icon-picker.tsx`)
- [ ] Tabla: fila encima y columna a la izquierda (`table-menu.tsx:117-138`)
- [ ] «Crear elemento» al crear una página desde un enlace: texto del enlace y dónde va (`element-inline.tsx:264-329`)

## Cabecera de la página

- [ ] Ajustes de la página: ver la portada, a todo lo ancho, cómo se desplaza el panel (`$entryId.tsx:1039-1107`)
- [ ] «Vaciar» la pestaña activa (`$entryId.tsx:1266`)

## Panel de la derecha

- [ ] Opciones de bloque: título sí/no, relleno, enlazar a una página, duplicar, «llevar al texto»; filtro en
      «Añadir bloque» (`panel-blocks-inner.tsx:468, 719-880`)
- [ ] Más bloques: semicírculo y aguja, YouTube, Spotify, tarjeta de mapa, etiquetas, alias, enlace
- [ ] Retrato con resumen (`entry-banner.tsx:288`)
- [ ] Propiedades y etiquetas, rehechas (Enrique: «se ve fatal cuando le damos»)

## Pestañas y mapas

- [ ] Más pestañas de texto, arrastrar para ordenarlas, ocultar una (`entry-tabs-bar.tsx`)
- [ ] Pizarra (Excalidraw, MIT), línea temporal y árbol familiar (`@xyflow` + dagre) — fases 3 y 4 del ADR-0007
- [ ] Mapa: menú del pin con el botón derecho, textos y regiones, pines según el zoom, agrupar pines, medir y escala

## Navegación

- [ ] Vista lateral editable de una página, que se abre desde mapas y líneas temporales (`entry-peek-panel.tsx`)
- [ ] Grafo del mundo (d3-force, MIT) — fase 5 del ADR-0007
