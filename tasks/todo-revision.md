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
- [ ] **Un paquete de iconos de fantasía de calidad** (Enrique, 2026-11-12: «cuando creas más oportuno»), para elegir
  icono en vez de solo emoji: carpetas, páginas, sistemas y mundos. Momento: al empezar la tanda 6 (el icono del
  sistema), para que todos salgan del mismo paquete y del mismo selector (`IconChoices`, `wiki/icon.tsx`). Candidato:
  game-icons.net (SVG, miles de iconos de rol; CC BY 3.0, que pide atribución pero no es copyleft): comprobar la
  licencia antes, origen en `docs/terceros.md` y descargarlo en el repo (sin pedirlo a un servidor ajeno). Los emojis
  ya guardados siguen valiendo.

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
- [x] `pnpm e2e` entero (2026-11-12): 116 de la batería (las 2 que fallaron con la máquina cargada, etiquetas y
  rendimiento, pasan al repetirlas), 12 de fugas y 14 de accesibilidad.
- [ ] PR a `main` con `[skip ci]` y staging: cuando haya más tandas hechas (Enrique).
  `pnpm lint`, `typecheck` y `test` ya en verde salvo: `systems/ritmo.test.ts` (tiempos con la máquina cargada; repetir
  en calma) y `mcp.integration.test.ts` (el puerto 8132 lo ocupaba el servidor viejo de la revisión global, ya
  parado; repetir).

## Tanda 2 — Árbol común, Archivos, Etiquetas y selector de archivos

- [x] Archivos comunes: mover (prueba que falla primero). La comprobación de ámbito de `moveInto` creía «del mundo»
  cualquier carpeta de los comunes de Inicio (allí no hay carpeta «Comunes»); ahora usa `scopeAt`.
- [x] El «no se puede» a la vista: lo que no admite lo arrastrado sale apagado mientras se arrastra.
- [x] Prototipo de Archivos sin árbol a la izquierda (lienzo «Archivos sin árbol»,
  https://claude.ai/artifact/SNQuCPM644JuprjWvatqBA, `out/lienzo-archivos/`): **aprobado** por Enrique (2026-11-12),
  con el arrastre de las páginas del mundo; los archivos, por nombre.
- [x] `components/tree/moves.ts`: la lógica de mover, fuera del árbol de páginas y con sus pruebas (el árbol de
  páginas solo la importa).
- [x] Archivos con la lista que despliega, **solo en lista** (Enrique: «Archivos A»): pulsar despliega y elige, subir y
  crear a la elegida, arrastrar como las páginas (raya, resalte, despliegue al mantener, otro ámbito apagado), mover al
  momento, vista previa a la izquierda (también en Etiquetas). Fuera el árbol, las tarjetas y «Mover aquí».
- [x] Etiquetas con el teclado: flechas para moverse y Alt + flechas para recolocar (`keyboardMove`).
- [x] Archivos, tras probarla Enrique: al buscar, lo encontrado dentro de sus carpetas (el árbol hasta él); buscar por
  #etiqueta en el mismo buscador (fuera el desplegable); «Subir archivos» y «Nueva carpeta» con nombre fijo, en lo
  más alto, y en cada carpeta, al pasar el ratón, «Subir aquí» y «Carpeta dentro» (fuera la carpeta elegida).
- [x] Archivos en el orden que se quiera (Enrique: «no puedo recolocar dentro de una carpeta»): `position` en
  `files` y `file_folders` (migración 0075, aplicada en local), `moveFile`/`updateFolder` con `before`/`after`,
  `placeAmong` genérico (las etiquetas lo usan), al momento en la caché (`wiki/file-order.ts`); nota en el ADR-0005.
- [ ] Archivos con el teclado (Alt + flechas) y herramientas MCP para mover archivos y carpetas: si Enrique quiere.
- [x] Etiquetas: `tags.position` (migración 0074, nota en el ADR-0006), `moveTag` y MCP `mover_etiqueta`; se
  arrastran como las páginas del mundo: raya delante o detrás para ordenar, la fila resaltada para meterla dentro, y
  llevada a la izquierda sale de su madre. Fuera «Arriba del todo» (Enrique, 2026-11-12).
- [x] Mover sin retardo (Enrique, 2026-11-12: «hay un retardo de cuando lo muevo hasta que lo veo cambiado»):
  etiquetas, al momento en la lista cargada (`wiki/tag-order.ts`), con vuelta atrás si falla; páginas, también al
  meterla en una madre cuyas subpáginas no se tenían (se despliega ya con ella dentro).
- [x] Selector de archivos (`components/file-picker.tsx`): la lista de Archivos en una ventana, solo con el tipo pedido,
  con su buscador (nombre o #etiqueta) y lo encontrado dentro de sus carpetas; la lógica del árbol, común con Archivos
  (`wiki/file-tree.ts`). La portada (mundo, campaña y página, el mismo cuadro) con «Subir imagen» y «Elegir de tus
  archivos»; fuera las miniaturas sueltas y el desplegable viejo de la portada de página.
- [x] «Carpeta» en la ventana de un archivo y de una carpeta (Enrique, 2026-11-12: «pues hazlo»), con el movimiento al
  momento del arrastre (abre el camino hasta el destino y el foco vuelve a su engranaje). En Etiquetas, «Ninguna» en vez
  de «Ninguna (arriba del todo)».
- [x] Carpetas con color e icono (Enrique, 2026-11-12), migración 0076: color como el de un mundo, icono un emoji como el
  de una página; se ven en la lista, la vista previa, su ventana y el selector.
- [x] La casilla de elegir, en su propia columna a la izquierda de las filas (alineadas todas, sin sangría): no tapa el
  icono de una carpeta ni la imagen (Enrique, 2026-11-12; la esquina de la miniatura, probada antes, «horrible»).
- [x] **impeccable critique** (27/40, dual-agent; `.impeccable/critique/`). Arreglado: ventanas ancladas igual
  (`--dialog-top`) y sin cortarse en 1280×720; la barra de lo elegido tapa la de herramientas (la lista no se mueve) y
  borrar nombra lo que se borra; el fallo al mover se ve; el encuadre con su nombre visible y las teclas descritas (axe);
  la ventana de archivo con un solo «Guardar», al final (también las etiquetas); la almohadilla de la etiqueta con su
  color; botones de carpeta solo al pasar o con el teclado; «#etiqueta» sin resultados con su texto; Etiquetas busca sin
  tildes; buscadores sin autocompletar; el selector sin quitar animaciones; «Se usa» en la vista previa; textos sin uso.
- [x] De la crítica, lo que eligió Enrique (las tres recomendadas, 2026-11-12):
  - **Archivos con el teclado**, como Etiquetas (una parada del tabulador, flechas, Intro, Espacio, Alt + flechas, la
    vista previa con el foco) y **Mayús+clic** para elegir un tramo;
  - **lo elegido se mueve y se etiqueta** de una vez: acciones `moveFiles` y `addFileTags` (una operación cada una, se
    deshacen de una vez), con sus herramientas MCP `mover_archivos` y `etiquetar_archivos`;
  - **el hueco de la portada** sube una imagen al pulsarlo y admite soltar una;
  - **Etiquetas como Archivos**: plegables con su flecha (o derecha e izquierda) y la fila abre su ventana.
- [x] Ventanas de ajustes compactas (Enrique, 2026-11-12: «no cabe y hay que hacer scroll»): letra 15 px, campos de 40 px,
  casillas de 36 px, «Otro emoji» como una casilla más; la de una carpeta cabe en 850 px de alto.

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

- [ ] Antes: el paquete de iconos de fantasía (ver «Pista de imágenes»).
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

- [x] Archivos comunes: no se mueve ningún archivo (arreglado en la tanda 2); el aviso a la vista, con la Archivos nueva.
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
- [x] Al quitar el selector viejo de la portada de página, tres pruebas (mapa y escena) dependían de que él ya hubiera
  pedido los archivos del mundo: ahora esperan a que lleguen.
- [x] Mover a una carpeta dentro de otra cerrada (desde la ventana) no abría las de encima: no se veía adónde iba.
- [x] `FileName` tenía una ventana de ajustes que nadie abría (código muerto), fuera; y un import sin usar en el falso API.
- [ ] La hoja móvil de una etiqueta (`tags.tsx`) usa clases que no existen en el CSS (`files.sheet`…): ya fallaba
  antes; el móvil es solo de la jugadora y Etiquetas es del máster, así que es menor.
