# Tareas: revisión de la app (2026-11-11) y módulos 8, 9 y 10

Plan: `tasks/plan-revision.md`. Una tanda cada vez: se enseña en local, Enrique da el visto bueno, pruebas y a `main`.

## Pista de imágenes (en paralelo)

- [ ] Prompts de estilo: `docs/imagenes.md` § «Buscar el estilo» (cinco o seis estilos, las mismas dos escenas en
  cada uno). **Es lo primero**: Enrique genera las imágenes fuera mientras avanza la tanda 1.
- [ ] Enrique elige el estilo.
- [ ] Guía de estilo y el resto de prompts (fondos de Entrar, portada pública, ambiente de Inicio, portadas por defecto,
  pantallas vacías).
- [ ] Imágenes en `apps/web/public/`, fuera las 24 de ahora, y su origen en `docs/terceros.md`.

## Tanda 1 — Inicio: arreglos rápidos (rama `revision/tanda-1`)

- [ ] 1. Chispas y humo en el tema claro (colores como tokens con su versión clara).
- [ ] 2. Los iconos de la barra se van al ritmo al que llegan.
- [ ] 3. Recuadros «Nuevo…» con línea continua (mundo, campaña, plantilla, etiqueta).
- [ ] 4. Descripción con límite y contador (mundos y campañas).
- [ ] 5. Orden de la barra: Mundos, Plantillas, Etiquetas, Sistemas, Archivos; el tutorial, igual.
- [ ] Visto bueno de Enrique → impeccable (critique y audit) → pruebas → PR a `main` y staging.

## Tanda 2 — Árbol común, Archivos, Etiquetas y selector de archivos

- [ ] Archivos comunes: mover (prueba que falla primero) y el aviso a la vista.
- [ ] `components/tree/` (lógica de mover fuera del árbol de páginas, con pruebas).
- [ ] Archivos con el árbol común: fila raíz, clic que elige, flecha que pliega siempre.
- [ ] Etiquetas: `tags.position` y reordenar.
- [ ] Selector de archivos y la portada al crear un mundo.

## Tanda 3 — Plantillas

- [ ] `copyPage`: duplicar de una vez (portada, hoja, panel y pestañas).
- [ ] La plantilla como página-modelo (espacio oculto de la cuenta, ADR).
- [ ] Crear desde plantilla = duplicarla; «Desde plantilla» la última, también en «Pestaña nueva».
- [ ] Fuera las de serie (barrido antes).
- [ ] Carpetas de plantillas.
- [ ] Volver en el editor; fuera «Aplicar plantilla»; registro de tipos de pestaña.

## Tanda 4 — El mundo: la página y la hoja

- [ ] La columna izquierda no se esconde.
- [ ] El panel derecho, fijo y con su desplazamiento (también en la ventana de la Mesa).
- [ ] Ancho del texto, rayas de salto de lado a lado y «Página N» de la que se cierra.
- [ ] Nota lateral izquierda / derecha.
- [ ] Descargar e imprimir: con colores, blanco y negro o pergamino.
- [ ] Menú común; «Exportar» y «⋯» con él.

## Tanda 5 — Cristal, Entrar y la portada

- [ ] Lienzo «Crisol, con cristal» (se prepara desde la tanda 1).
- [ ] Superficies y fondo de ambiente; respaldo sin desenfoque donde falta; «Sin desenfoque» en Ajustes.
- [ ] Entrar y crear la cuenta; la portada pública.

## Tanda 6 — Sistemas: su espacio, sus portadas y sus libros

- [ ] Espacios de la barra declarados; el espacio del sistema y su vuelta.
- [ ] Icono y portada del sistema; libros con portada o color.
- [ ] El libro por dentro (tres columnas) y «Entrada nueva».
- [ ] Crear un sistema: con la IA, con el esqueleto, a mano.

## Tanda 7 — Libros de texto y el compendio desde el mundo

- [ ] Capítulos (ADR), su lector y sus herramientas MCP.
- [ ] Incrustar una entrada (con su prueba de fugas).
- [ ] «Entrada nueva del compendio» desde el mundo, en ventana.
- [ ] Tirar las acciones de una entrada; los dados salen de la wiki.

## Tanda 8 — El editor de sistemas a mano

- [ ] Estudio (Roliando, Roll20), lienzo, construcción.

## Tanda 9 — Repaso del MCP

## Después

- [ ] Módulo 9: pizarras y mapas con capas.
- [ ] Módulo 8 (mundo): calendarios y líneas temporales.
- [ ] Módulo 10 (mundo): grafo y árbol familiar, tableros, gráficos, nombres.
- [ ] Revisión de la campaña, con lo de los módulos 8 y 10 que es suyo.

## Encontrado de paso

Lo que sale sin estar en la lista: se avisa a Enrique y se arregla en su tanda.

- [ ] Archivos comunes: no se mueve ningún archivo, y el aviso solo lo oye un lector de pantalla (tanda 2).
- [ ] Cristal sin respaldo en seis piezas de la Mesa (tanda 5).
- [ ] `docs/diseno.md` dice que la barra derecha de la Mesa es opaca y es de cristal (tanda 5).
- [ ] Tutorial de Inicio: «Nueva campaña» colado entre Historial y Papelera (tanda 1).
- [ ] Menú móvil fuera de un mundo: solo «Mundos» (con la vista de la jugadora).
- [ ] «Página N» no sale tras un salto a mano; la nota lateral, siempre a la derecha al imprimir (tanda 4).
- [ ] «Duplicar» se deja portada, hoja y pestañas (tanda 3).
- [ ] Las acciones de una entrada del compendio no se tiran (tanda 7).
- [ ] Mapas: regiones, rutas y textos se guardan y no se pintan (módulo 9).
- [ ] Reemplazar un sistema subiendo otro: está en el servidor y no en la app (tanda 6).
- [ ] No hay menú común (tanda 4).
