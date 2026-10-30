# ADR-0006: Etiquetas de la cuenta, para páginas y archivos

Estado: aceptada (Enrique, 2026-10-30) · Se construye en la ronda de pulido 1 de la interfaz

## Contexto

Hasta ahora una etiqueta es un texto dentro de la propiedad `etiquetas` de una página, y cada mundo tiene su pantalla
«Etiquetas» con las que usan sus páginas. Los archivos no tienen. Enrique: «etiquetas para toda la cuenta, pero para
crearlas debería estar en la zona de Mundos», y que sirvan de filtro dentro de la wiki y de los archivos, sin pestaña
en la barra del mundo. Eana trae 2.165 páginas con etiquetas, muchas con jerarquía («lugar/ciudad»).

## Decisión

- **Un catálogo por cuenta** (su organización): las etiquetas que llevan sus páginas y sus archivos, más las de la
  tabla `tags`, que guarda las creadas a mano y el **color opcional** (de la paleta de los mundos). El nombre no se
  repite, sin mirar mayúsculas. Pasa por el historial, como todo.
- **Jerarquía por «/»**, como ahora: «lugar/ciudad» va dentro de «lugar», y filtrar por «lugar» incluye sus hijas. Una
  madre que nadie ha creado aparece igual en el árbol (sale de sus hijas).
- **Las páginas las siguen llevando en su propiedad `etiquetas`** (el Markdown, el MCP y la exportación no cambian). Los
  **archivos**, en `files.tags`.
- **Se eligen o se escriben**: una que no estaba aparece sola en el catálogo en cuanto algo la lleva (también desde la
  IA, por MCP), sin pasos aparte. Si deja de llevarla todo y no se creó a mano ni tiene color, deja de salir.
- **Renombrar** una etiqueta cambia todas las páginas y archivos que la llevan, con sus hijas; **borrarla** la quita de
  todos. Cada cosa es una sola operación del historial, que se deshace entera.
- **Dónde se ven**:
  - en la barra de **Mis mundos**, «**Etiquetas**»: el catálogo en árbol, con cuántas páginas y archivos lleva cada una;
    se crean, se renombran, se les pone color y se borran;
  - dentro de un mundo **no hay pestaña**: en la wiki se filtra por etiqueta al buscar, y las de una página llevan a esa
    búsqueda; en **Archivos**, un filtro por etiqueta y, en la ventana de un archivo, las suyas.
- **Permisos**: el catálogo lo gestiona quien administra la organización. Quien puede cambiar una página o un archivo
  puede ponerle etiquetas, también nuevas.
- **IA (MCP)**: `listar_etiquetas`, `crear_etiqueta`, `cambiar_etiqueta` (renombrar, color), `borrar_etiqueta` (pasa por la
  aprobación de borrar) y `etiquetar_archivo`.

## Alternativas descartadas

- **Etiquetas por mundo**, como hasta ahora: no sirven para los archivos comunes ni para ordenar entre mundos.
- **Solo elegirlas del catálogo**: más orden, pero obliga a crearlas antes y rompe la escritura libre de la IA y lo
  que trae Eana.
- **Una tabla de unión página–etiqueta**: más normalizada, pero el contenido de la página dejaría de llevar sus
  etiquetas y la exportación, el MCP y el importador tendrían que reconstruirlas.
