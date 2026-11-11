# Tanda 3: las plantillas como páginas (plan de construcción)

Prototipo aprobado por Enrique el 2026-11-12 («Me gusta»): https://claude.ai/artifact/HEiducM87Qe3zxcnvYZm6M
(`out/lienzo-plantillas/lienzo.html`), con la **A1** (la lista como Archivos) y las decisiones de su pie. ADR-0024.
Rama `revision/tanda-3`. Cada porción, con sus pruebas, en su commit; las casillas, aquí y en `tasks/todo-revision.md`.

## Hecho

- [x] **copyPage** (`packages/db/src/repos/copy.ts`, `apps/server/src/actions/copy-page.ts`): duplicar entera, de una
  vez; cada tipo de pestaña con su forma de copiarse. «Duplicar» de la web y MCP `duplicar_pagina`.

## Porciones

1. [x] **Barrido y fuera las de serie.** Una migración SQL (sin código que haya que mantener) convierte en propias de cada
   cuenta las de serie que estén en uso (páginas con `template` o `template_line`, tablas de un panel con `template`,
   plantillas propias copiadas de ellas): con **los mismos ids de campo**, su panel y su esqueleto, y un id nuevo que
   sustituye al legible («pnj») en páginas, paneles y linajes; así las tablas que se llenan solas dan lo mismo. Su
   contenido se saca ahora de `BUILT_IN_TEMPLATES` con un guion y se escribe en el SQL. Después se quita todo lo de las
   de serie: dominio, servidor, web (sección «De serie», «Copiar»), i18n, tutorial, MCP y pruebas. Hecho (migración
   0077 con su prueba; las de serie quedan como `EXAMPLE_TEMPLATES`, solo para las pruebas y la API falsa, y el
   servidor las siembra con `seedExampleTemplates`). `templateRef` sigue admitiendo un id legible (la API falsa los
   usa). Queda en el editor un `readOnly` muerto, que se va al rehacerlo (porción 5); las e2e de plantillas, en la 8.
2. [x] **El mundo oculto de cada cuenta** (`worlds.purpose = 'templates'`): se crea solo, la primera vez; no sale en Mis
   mundos, no admite campañas ni lo que sabe una campaña, y lo que se hace por mundo (búsqueda, papelera, exportar,
   historial del mundo) se lo salta, con su prueba.
3. [x] **Cada plantilla, una página de ese mundo** (`page_templates.page_id`): las que hay se convierten al abrirlas por
   primera vez (su esqueleto pasa a ser su texto; sus campos, las propiedades de la página; su panel, el de la página;
   su icono, un emoji). La plantilla se lee de su página (campos, panel, texto, pestañas); `page_templates` queda como
   su ficha (página, carpeta, orden, linaje). Lo que se suba al editarla va a los archivos comunes.
4. [x] **Crear desde una plantilla = copiarla** (`copyPage` a otro mundo, soltando lo que apunta a páginas concretas):
   `createPage`/`createPages` con `template` y las tablas que se llenan solas siguen igual (linaje en la página).
   Hecho (migración 0078): `createPage` con plantilla copia su página entera (con ids nuevos en el panel); `createPages`
   (la IA, en tanda) sigue con sus campos, panel y esqueleto, leídos de su página, sin sus pestañas. El icono de una
   plantilla es ya un emoji (los dibujos de antes se traducen, `templateEmoji`). La conversión de una de antes la hace el
   sistema al abrirla (`getTemplate`) o al escribir en ella; no se deshace.
5. [x] **El editor es la página** (`EntryView` en modo plantilla): portada, icono en el título, pestañas, panel con los
   campos que se definen (nombre y tipo), texto; sin «Quién la conoce», «Marcar» ni «Mencionado en»; «Plantillas»
   arriba a la izquierda para volver (con la transición al revés) y la marca «Plantilla» junto al título. A la
   izquierda, tus plantillas para saltar de una a otra. «Plantilla nueva» crea «Plantilla sin título» y la abre.
   Hecho: las pestañas llevan a la ruta de la plantilla (`TabTargetContext`); un emoji al principio del título pasa a
   ser su icono; «⋯» lleva sus ajustes (nombre, icono, borrarla); lo subido a su mundo va a los archivos comunes; su
   título no se repite con el de otra (`updatePage` lo comprueba) y avisa a las listas. Fuera el editor de esqueleto.
6. [x] **La lista como Archivos (A1)**: carpetas (`template_folders`, con color e icono como las de archivos), el árbol
   común (arrastrar, teclado, orden a mano), la vista previa a la izquierda (portada, icono, campos, pestañas, en
   cuántas páginas se usa), buscador; «Plantilla nueva» y «Nueva carpeta» fijos. Hecho (migración 0079): con las
   clases y los gestos de Archivos (sin elegir varias, que en plantillas no hace falta); en la ventana de una
   plantilla, «Carpeta»; la lista del editor, por carpetas («Sin carpeta» las sueltas).
7. **«Desde plantilla», la última y centrada** (tras una raya con «o») en «Página nueva» y en «Pestaña nueva»; en
   «Pestaña nueva» se eligen qué pestañas de la plantilla se añaden (todas, de entrada). Fuera «Aplicar plantilla» de
   «⋯». Registro único de tipos de pestaña (nombre, icono, si admite plantilla) para página nueva, pestaña nueva y la
   copia.
8. **Cerrar**: MCP de plantillas al día (sus instrucciones), e2e, impeccable (critique y audit), `tasks/probar.md`,
   «Dónde estamos».
