# Spec: la wiki se edita en el sitio

Parte del módulo 1 (wiki). Intención confirmada en `docs/intent/wiki-edicion.md`; prototipo «Crisol: wiki en el sitio»
(`out/prototipos/wiki-en-el-sitio.html`). Referencia de cómo lo hacía el Crisol antiguo, solo de consulta: título en
`note/TituloEnLinea.tsx`, propiedades en `note/Properties.tsx`, portada en `note/Portada.tsx`, guardado en
`note/useNoteFile.ts`.

## Objetivo

El máster abre una página y escribe. Nada pide «Editar», «Guardar», «Cancelar» ni «Renombrar»: el título, las
propiedades, el icono, la portada, el texto y los bloques de la hoja se cambian donde se ven y se guardan solos. La
hoja deja de ser una vista aparte que solo se lee: con la hoja puesta, se escribe encima del pergamino.

## Comportamiento

1. **Título**: es el propio encabezado (`h1` con su texto editable). Se confirma con Intro, flecha abajo en su final o
   al salir del campo; Intro y flecha abajo bajan al texto; Escape lo deja como estaba y baja al texto. Pegar saltos de
   línea los une. Vacío o igual: vuelve el de antes sin decir nada. Un error del servidor (nombre repetido) sale en una
   línea roja bajo el título y el foco se queda. Una página nueva abre con el título elegido para escribir encima.
   «Renombrar» desaparece de «Más».
2. **Cabecera**: las migas a la izquierda; a la derecha, iconos quietos: Marcar, Bloquear (Ctrl+E), Hoja y «⋯». En
   «⋯»: los ajustes de la hoja (papel, tema, numeración, pie, incluir secretos), Imprimir o sacar el PDF, Exportar y
   Borrar. Al acercarse al título salen «Icono» y «Portada» si no los tiene.
3. **Guardado**: un aviso discreto, abajo a la derecha: «Guardando…», «Guardado» o «No se pudo guardar». El texto sigue
   guardándose como hoy (Yjs, cada poco); el título y las propiedades, al confirmarse.
4. **Propiedades**: una tabla siempre editable bajo el título. Tocar un nombre o un valor lo edita; Intro o salir lo
   guarda, Escape lo deshace. Las listas y etiquetas son pastillas con su × y un campo para añadir (Intro o coma);
   las de páginas, con su buscador. El tipo se cambia desde el icono de la fila. «+ Propiedad» sale al acercarse, con
   las reservadas (Alias, Etiquetas, Resumen) a mano. Sin «Guardar» ni «Cancelar».
5. **Texto**: sin la barra de botones de encima («Secreto», «Nota oculta», «Bloque», «Buscar»): todo eso va en «/» y
   en Ctrl+F. Atajos de Markdown al empezar una línea; `> [!secreto] ` crea un secreto; «@» y «[[» enlazan una página.
   El texto vacío dice «Escribe, o pulsa «/» para insertar y «@» para enlazar una página».
6. **Hoja**: con la hoja puesta, el editor se ve sobre el pergamino del tema elegido, a dos columnas, con la letra de
   la hoja, y se sigue escribiendo encima (la criatura, la nota lateral y las tablas incluidas). Las páginas numeradas
   y el pie quedan para Imprimir y el PDF, que siguen saliendo de la misma hoja. En el móvil, a una columna.
7. **Bloqueada**: el candado pone todo en lectura (título y propiedades incluidos).

## Fuera

Lo que ven los jugadores (módulo 5); cambiar el formato de los datos, el contrato de la API o el MCP; el árbol, las
pestañas, los marcadores y la búsqueda.

## Pruebas

Unitarias del título (Intro, Escape, error), de las propiedades en el sitio y de la cabecera; las e2e de la wiki al
día (crear, renombrar en el sitio, propiedades sin «Guardar», la hoja editable) y @a11y en los dos temas y en el
móvil.

## Criterios de éxito

- Una página nueva con título, dos propiedades, etiquetas, un secreto, un enlace y, con la hoja, una criatura, se
  escribe de principio a fin sin pulsar «Guardar» ni abrir una ventana.
- En la cabecera no queda ningún botón con texto; en la página, ninguno de «Guardar» o «Cancelar».
- Las pruebas de la wiki pasan, también @a11y.
