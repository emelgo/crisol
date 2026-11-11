# Tareas: revisión de la app (2026-11-11) y módulos 8, 9 y 10

Plan: `tasks/plan-revision.md`. Una tanda cada vez: se enseña en local, Enrique da el visto bueno, pruebas y a `main`.

## Pista de imágenes (en paralelo)

- [x] Prompts de estilo: `docs/imagenes.md` § «Buscar el estilo» (seis variaciones de fantasía épica pintada, al estilo
  de Foundry VTT, Roliando o LegendKeeper; las mismas dos escenas en cada una). **Es lo primero**: Enrique genera las
  imágenes a mano con ChatGPT, en su cuenta, mientras avanza la tanda 1 (prompts en lenguaje natural, sin parámetros
  de otras herramientas; el tamaño y la proporción, dichos en la frase).
- [x] Enrique elige el estilo: **F**, pintura estilizada (su orden: F > A > C > D > B > E). Las de prueba, en
  `datos-locales/estilos/`.
- [x] Guía de estilo y el resto de prompts (fondos de Entrar, portada pública, ambiente de Inicio, pantallas vacías).
  Solo las de la app: las portadas de mundos, campañas, sistemas y libros son del usuario (Enrique, 2026-11-11).
- [ ] Imágenes en `apps/web/public/`, fuera las 24 de ahora, y su origen en `docs/terceros.md`.

## Documentos al empezar

- [x] `docs/diseno.md`: imágenes con prompt, cristal en toda la app, «Nuevo…» con línea continua, orden de la barra, el
  sistema con su espacio, tres maneras de crear un sistema, plantillas-modelo sin las de serie, tiradas fuera del texto.
- [x] `docs/modulos.md`: la tabla (7 hecho, la revisión en curso, 8 y 10 partidos en mundo y campaña) y el orden.
- [x] ADR-0023 (sin pagos) y ADR-0024 (plantillas como páginas-modelo). El del cristal y el fondo de ambiente espera
  al lienzo (tanda 5); el de los libros con capítulos, al estudio de 5etools (tanda 7).

## Tanda 1 — Inicio: arreglos rápidos (rama `revision/tanda-1`)

- [x] 1. Chispas y humo en el tema claro: colores como tokens `--fx-*` en `styles/tokens.css`, con su prueba de
  contraste (al quitar el tema claro, se quedan los del oscuro).
- [x] 2. Los iconos de la barra se van al ritmo al que llegan: al volver, el espejo de entrar (del último al primero,
  460 ms y 70 ms de paso; «Mundos» baja de la llama en 1,1 s cuando ya han subido, y la llama lo expulsa entonces).
- [x] 3. Recuadros «Nuevo…» con línea continua: `components/new-card.tsx` común (mundo, campaña, plantilla, sistema,
  personaje y etiqueta).
- [x] 4. Descripción con límite y contador (mundos y campañas): `Field` con `rows` (crece con lo escrito) y `counter`.
- [x] 5. Orden de la barra: Mundos, Plantillas, Etiquetas, Sistemas, Archivos; el tutorial, igual.
- [x] Revisión de Enrique en local (2026-11-11): fuera la pista «Sale en su tarjeta» (sobreexplica); la descripción
  se parte aunque no lleve espacios (se salía del panel lateral); las esquinas de «Nuevo…», dibujadas como el marco
  de las tarjetas (las diagonales no casaban); **solo tema oscuro** (fuera el claro, su botón, su elección en Ajustes y
  sus pruebas); las X de cerrar, con un círculo al pasar el ratón (en todas; las de la Mesa, con la campaña); el nombre
  de un mundo o una campaña se resalta con su color.
- [x] Visto bueno de Enrique («Seguimos», 2026-11-11).
- [x] impeccable: critique 29/40 y audit 15/20 (ficha en `.impeccable/critique/`). Arreglado: contorno con el color
  del mundo también en reposo (fallaba en la compilación por el orden del CSS: `--frame-line`), foco de «Nuevo…»,
  nombre resaltado con el teclado, filas del mismo alto, cuadro anclado arriba, `::placeholder` legible.
- [x] Enrique (2026-11-12): «Nuevo…» con la misma línea que las tarjetas; el mundo, con icono propio en la barra
  (`MountainSnow`).
- [x] Del audit: la barra en pantallas bajas (`scroll-padding` y fundido sobre el pie); una X común
  (`components/close.module.css`) en cuadros, ventanas, dados, «quién la conoce», el pin del mapa y los avisos (las de
  la Mesa, con la campaña; la de la columna de dados y los avisos de tirada siguen con sus grupos de botones); la
  cuenta en palabras para el lector de pantalla y el aviso al llegar al límite; colores forzados en el marco y en
  «Nuevo…»; `resize` donde no hay `field-sizing`; forja y ceniza de las tarjetas a tokens; los tiempos de la barra en
  un solo sitio, `--leave` que se limpia y la subida de cada icono medida (antes, a mano: «Archivos» acababa 17 px por
  encima de la llama).
- [ ] `pnpm e2e` entero (al quitar el tema claro cambiaron muchas) → PR a `main` con `[skip ci]` → staging.
  `pnpm lint`, `typecheck` y `test` ya en verde salvo: `systems/ritmo.test.ts` (tiempos con la máquina cargada; repetir
  en calma) y `mcp.integration.test.ts` (el puerto 8132 lo ocupaba el servidor viejo de la revisión global, ya
  parado; repetir).

## Tanda 2 — Árbol común, Archivos, Etiquetas y selector de archivos

- [ ] Archivos comunes: mover (prueba que falla primero) y el aviso a la vista.
- [ ] Prototipo de Archivos sin árbol a la izquierda: la lista del centro despliega las carpetas, se despliegan solas
  al mantener un archivo encima y la vista previa va a la izquierda (también en Etiquetas).
- [ ] `components/tree/` (lógica de mover fuera del árbol de páginas, con pruebas).
- [ ] Archivos con la lista que despliega (y fila «Todos» para lo más alto).
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
- [x] Tutorial de Inicio: «Nueva campaña» colado entre Historial y Papelera (tanda 1): ahora va tras «Nuevo mundo».
- [ ] Menú móvil fuera de un mundo: solo «Mundos» (con la vista de la jugadora).
- [ ] «Página N» no sale tras un salto a mano; la nota lateral, siempre a la derecha al imprimir (tanda 4).
- [ ] «Duplicar» se deja portada, hoja y pestañas (tanda 3).
- [ ] Las acciones de una entrada del compendio no se tiran (tanda 7).
- [ ] Mapas: regiones, rutas y textos se guardan y no se pintan (módulo 9).
- [ ] Reemplazar un sistema subiendo otro: está en el servidor y no en la app (tanda 6).
- [ ] No hay menú común (tanda 4).
- [x] Con 280 letras, la descripción estiraba la tarjeta hasta ocho líneas: en la tarjeta, tres como mucho (entera, en
  el panel de al lado); su pista ya no dice «una línea» (tanda 1).
- [x] «Personaje nuevo» (en la campaña) compartía el recuadro de las plantillas: también pasa a línea continua (tanda
  1; Enrique: «si algo se comparte lo cambias», y en la revisión de la campaña se verá).
- [x] Una descripción sin espacios (una sola palabra larga) se salía de la tarjeta y del panel lateral (tanda 1).
- [ ] Las X de las ventanas de la Mesa siguen con su estilo de botón de icono: con la revisión de la campaña.
