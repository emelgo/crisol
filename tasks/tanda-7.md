# Tanda 7 — Libros de texto y el compendio desde el mundo

Rama `revision/tanda-7` (sale de `revision/tanda-6`). Plan general en `tasks/plan-revision.md` § «Tanda 7». Con
capturas de antes y después; Enrique revisa las tandas juntas.

## Porciones

- [x] 1. **Capítulos, por dentro** (ADR-0025): la tabla `system_chapters` (migración aplicada también a la base
  local), su repositorio, sus acciones (listar, leer, guardar con su versión, ordenar, borrar; deshacer), sus
  herramientas MCP, el archivo del sistema (exportar, importar, copiar) y sus pruebas.
- [x] 2. **El lector y el editor de capítulos**: la pestaña «Capítulos» en el libro por dentro; el índice que sigue la
  lectura, anterior y siguiente, el «Ir a…» del móvil; escribir con el editor de bloques; en la campaña, sus jugadores
  leen los capítulos de sus libros (sin los secretos).
- [x] 3. **Tirar las acciones de una entrada**: hoy se pintan como texto (`campaign/compendium.tsx`, «En juego»);
  ganan su botón y su acción en el servidor, al registro de la campaña.
- [x] 4. **Incrustar una entrada** en una página o un capítulo (`![[@Nombre]]`: su ficha), además del enlace; si el
  mundo tiene campañas con sistemas distintos, o ninguna, pregunta de cuál y lo recuerda. **Prueba de fugas**: una
  jugadora solo ve la ficha si su campaña ve esa entrada.
- [ ] 5. **«Entrada nueva del compendio» desde el mundo** («/» y al final de las sugerencias de `[[@`), en ventana
  flotante: el gestor de ventanas de la Mesa (`tabletop/windows.tsx`) pasa a `components/` y se monta en el mundo.
- [x] 6. **Los dados salen de la wiki**: dejar de ofrecer `dice:` → convertir los que haya a texto en código (al cargar
  y al restaurar versiones) → barrido → quitar el nodo (`packages/editor/src/nodes/dice-roll.ts`, su vista, i18n, MCP,
  pruebas).
- [ ] 7. Crítica y audit de impeccable, arreglos, capturas y la página de revisión.

## Encontrado de paso

- **Las barras del editor, tapadas** (desde el cristal del 12, `8ac298dc`; dos pruebas de `bloques.spec.ts` fallaban): la
  columna de la página desenfocaba lo de detrás en ella misma, y la barra de la tabla, al ensancharse, quedaba debajo
  del panel de la derecha. Ahora el cristal va en un `::before` y las barras de formato y de tabla flotan en el body,
  por encima de todo (z-index 2000, como el menú «/»). El menú del bloque (Ctrl+Alt+B) lee antes la selección del
  navegador, por si un clic aún no le había llegado al editor. Esa prueba va con «Sin desenfoque»: en Chromium sin GPU
  el cristal es tan caro que los menús nunca se quedan quietos.
- Las instrucciones del MCP nombraban `pestanas_desde_plantilla`, que se quitó en la tanda 3.
