# ADR-0009: Plantillas de página, campos con id y tablas que se llenan solas

Estado: aceptada con la spec del módulo 2 (Enrique, 2026-11-03: «si») · `docs/specs/plantillas.md`

## Contexto

El módulo 2 trae plantillas (PNJ, Lugar, Facción… de serie, y las de la cuenta) y tablas en el panel del tipo
«Miembros: los PNJ cuya Facción es esta página». Enrique decidió que:
- la página sale de la plantilla y luego se cambia libremente;
- cambiar una plantilla no toca las páginas ya hechas;
- las páginas de una copia («PNJ de Eana») cuentan como de su original en las tablas;
- una plantilla se puede aplicar a una página ya hecha.

Los estudios (`research/`) dicen dónde falla esto en otros sitios:
- Kanka filtra por el nombre exacto del atributo;
- LegendKeeper casa por el texto de una etiqueta;
- Foundry no comprueba que exista lo enlazado y calcula las referencias inversas en cada cliente, con el mundo entero
  cargado.

Hoy una página tiene `properties` (jsonb, con tipo: texto, número, sí/no, lista y enlaces) y `panel` (bloques,
ADR-0008).

## Decisión

- **Los campos son propiedades con id.** Cada propiedad puede llevar un `fieldId`, el id del campo de la plantilla de
  la que salió: legible en las de serie (`faccion`) y corto y aleatorio en las propias. Copiar una plantilla conserva
  los ids. Las tablas casan por el id, así que renombrar un campo en una página no la saca de ninguna tabla.
- **La forma del campo vive en la página**: las opciones, los segmentos del reloj y las plantillas a las que apunta un
  enlace van en la propiedad. Por eso cambiar la plantilla no toca las páginas, y no hay migraciones de datos ni
  páginas apartadas por no cuadrar con su plantilla.
- **La página guarda su plantilla y su linaje**: `pages.template` (el id legible de una de serie o el uuid de una
  propia) y `pages.template_line` (esa y todas de las que viene, por ejemplo `[<PNJ de Eana>, pnj]`). Se fijan al
  crearla o al aplicarle una plantilla. Como el linaje va en la página, borrar una plantilla no cambia qué tablas ven
  sus páginas.
- **Las de serie, en el código** (`packages/domain`), con el mismo formato que las propias y sin fila en la base. **Las
  propias, en `page_templates`**, de la organización (como las etiquetas, ADR-0006): nombre, icono, `basedOn`, su
  linaje, campos, bloques del panel y esqueleto en Markdown. Pasan por `operation()`; borrar una es una operación que
  se deshace.
- **Las tablas se calculan en el servidor** al leer la página. La consulta busca, en el mundo y fuera de la papelera,
  las páginas cuyo linaje contiene la plantilla pedida y cuyas propiedades contienen ese `fieldId` con un enlace a la
  página. Lleva dos índices GIN: uno en `template_line` y otro en `properties` (`jsonb_path_ops`). La interfaz y la
  IA reciben la tabla ya hecha.
- **El servidor comprueba siempre los enlaces de los campos**: que la página exista y sea del mismo mundo. Al purgar
  una página, se quita de los campos que la apuntan.

## Alternativas descartadas

- **Tipos con esquema fijo que manda sobre la página** (como Foundry o los tipos del Crisol actual): cambiar el tipo
  obligaría a migrar o a apartar páginas, y Enrique quiere cambiar cada página libremente.
- **Casar las tablas por el nombre del campo**: es la trampa de Kanka. Renombrar «Facción» o escribir «Faccion» sin
  tilde dejaría la tabla vacía sin avisar.
- **Apuntar los enlaces de los campos en `page_links`**: esa tabla sale del texto y se rehace en cada guardado del
  cuerpo. Mezclar ahí los campos complica los dos caminos, y la consulta sobre `properties` basta con su índice.
- **Calcular las tablas en el cliente**: el cliente no tiene el mundo entero, y la IA tendría que repetir la cuenta.
- **Leer el linaje de `page_templates` en cada consulta**: es una tabla menos que mirar, pero al borrar «PNJ de Eana»
  sus páginas dejarían de salir en las tablas de PNJ.
