# Tanda 8 — El editor de sistemas a mano

Rama `revision/tanda-8` (sale de `revision/tanda-7`). Plan general en `tasks/plan-revision.md` § «Tanda 8». Estudio en
`research/roliando/editor-de-sistemas.md` y `research/roll20/editor-de-hojas.md`. Lienzo aprobado (Enrique,
2026-11-12: «me fío de tu criterio»): https://claude.ai/artifact/RNhfpKmxY2iQ2Z7GfbcNAp, fuente en
`out/lienzo-editor/lienzo.html`. Base: el editor quitado en `b2a5d14` (sus piezas en `apps/web/src/systems/editor/`).

## Porciones

- [x] 1. **El armazón**: «Reglas» de un sistema propio abre el editor: los pasos a la izquierda (se puede saltar a
  cualquiera), el paso en el centro con «Siguiente: …», la ficha de ejemplo y la revisión a la derecha. Se guarda solo
  (con su versión) cuando no hay errores; con errores, «Sin guardar» y la revisión dice por qué. Los de serie, en
  lectura.
- [x] 2. **¿Qué tiene un personaje?**: los campos del personaje con palabras de mesa (una cifra, varias a la vez, algo
  que se gasta, una opción, un texto, algo que se calcula…; los demás en «Más»), cada uno con su «?» y un ejemplo;
  la ficha de ejemplo los gana al momento.
- [x] 3. **¿Cómo se tira?**: el dado de siempre y si se busca alto o bajo; críticos y ventaja plegados; las tiradas,
  con su fórmula leída en palabras debajo, sugerencias de campos y «Tirar una vez» con la ficha de ejemplo.
- [x] 4. **¿Qué se lleva?, ¿Cómo se ve la ficha?, ¿Cómo se crea?, ¿Qué trae el compendio?**: los tipos de objeto con
  sus campos; la hoja con sus bloques ordenables (nace con uno por campo); los pasos del creador; el compendio y sus
  libros (enlace a él).
- [x] 5. **Lo avanzado**: claves, idiomas, ajustes de campaña, bajar y subir el archivo. «Sistema nuevo → A mano»
  deja de decir «Pronto». docs/diseno.md y una nota al ADR-0015 (a mano también).
- [x] 6. Pruebas (unitarias y e2e), crítica y audit de impeccable, arreglos y la página de revisión.
