# ADR-0013: Los personajes como elecciones sobre el contenido, con los pasos de cada sistema

Estado: aceptada con la spec de `personajes` (Enrique, 2026-11-05: «ok») · `docs/specs/personajes.md`

## Contexto

Con `srd-5e`, el contenido de un sistema dice lo que concede cada cosa por nivel (`grants`) y `evaluate` calcula un
personaje a partir de lo que lleva. Falta el personaje en sí: dónde vive, quién lo ve, cómo se crea y se sube de nivel
y cómo se vuelve atrás. Enrique pidió (entrevista del 2026-11-05):
- un creador como el de D&D Beyond, con navegación libre y lo pendiente marcado, para cualquier sistema, con los pasos
  escritos en cada uno («si no, es un caos»);
- subir de nivel cambiando el nivel de la clase, con multiclase;
- versiones visibles y automáticas;
- que la IA haga un personaje entero con las mismas piezas.

Lo que dicen los estudios:
- **dnd5e (Foundry)** describe lo que se gana con nueve tipos de «avance», pero guarda lo elegido en la copia de la
  clase que lleva el personaje y escribe parte a pelo en él: lo que cambia el autor no llega, lo que llega de dos sitios
  falla, al bajar de nivel se pierde lo elegido y no hay versiones (`research/foundry/avances-y-tablas.md`);
- **D&D Beyond** no tiene asistente ni versiones: se cambia el nivel en el creador y se copia el personaje por si acaso
  (`research/dndbeyond/creador-y-hoja.md`);
- **el Crisol actual** tiene once tipos de paso, muchos nacidos solo para Eana, y escribe en la hoja al elegir
  (`docs/inventario-sistemas.md` § 4).

## Decisión

- **Las elecciones son la verdad; la hoja se calcula.** El personaje guarda sus datos base, sus elecciones (por
  contenido, paso y nivel) y el contenido que lleva **por referencia** (clave y edición), nunca una copia. La hoja es
  `evaluate` sobre eso. Bajar de nivel es quitar las elecciones de encima; si el contenido cambia, lo que no cuadra sale
  como pendiente.
- **Los pasos del creador son parte de cada sistema**, con un catálogo cerrado de tipos neutros (elegir del contenido,
  generar puntuaciones, escribir datos, elegir de una lista, tirar en una tabla, equipo inicial). Nada de un juego
  concreto en el motor: pericia, maestría o subclase son parámetros o concesiones del contenido.
- **Lo pendiente se calcula siempre**, de los pasos del sistema y de las concesiones del contenido elegido a su nivel: la
  misma lista de decisiones (con sus opciones válidas y el motivo de las que no valen) para la pantalla y para la IA. Lo
  que no tiene nada que decidir se aplica solo.
- **Requisitos como fórmulas** del sistema, con su motivo.
- **Versiones automáticas**: el personaje entero al terminar de crearlo y al confirmar cada subida, en su propia tabla;
  restaurar es un cambio más del historial.
- **Las tablas aleatorias, una pieza común**: datos del sistema o del mundo, tiradas en el servidor con su registro, y lo
  sacado por campaña.

## Consecuencias

- Un sistema nuevo trae su creador escribiendo datos, también si lo hace la IA; el formato y `formato_sistemas` crecen
  con la sección de los pasos.
- El motor de los pasos es puro y vive con `evaluate` en `packages/systems`: igual en el servidor y en la web, y con su
  ritmo medido.
- El contenido del 5e necesita datos nuevos para el creador: los requisitos de multiclase, el equipo inicial como
  opciones, cuántos conjuros por nivel y sus tablas aleatorias.
- Guardar el personaje por referencias obliga a resolverlas siempre (con la edición de la campaña) y a tratar lo que
  falta como pendiente, no como error.
- Las versiones ocupan espacio (el personaje entero, unas pocas por personaje): se guardan sin límite y se miden.
