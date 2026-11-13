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
- [x] Imágenes en `apps/web/public/`, fuera las 24 de ahora, y su origen en `docs/terceros.md` (2026-11-12: los 12
  fondos de Entrar, la portada, el ambiente y los 8 bodegones de las pantallas vacías). Seis fondos, para rehacer con
  otra luz: `docs/imagenes-por-hacer.md`.
- [x] **Un paquete de iconos de fantasía de calidad** (Enrique, 2026-11-12: «cuando creas más oportuno»), para elegir
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
- [x] **impeccable audit** (15/20, Bueno): detector a cero en los seis archivos; axe sin fallos en Archivos con el foco,
  «Mover a…», «Etiquetar», la portada vacía y Etiquetas; sin desplazamiento lateral a 1024 px; en la lista solo entran
  en el tabulador los botones de la fila con el foco. Arreglado: la flecha de Etiquetas y la zona de la casilla de
  elegir, a 24 px (WCAG 2.5.8); el efecto del tabulador solo escribe lo que cambia. Queda (menor): las ventanas sueltas
  (confirmar, mover, etiquetar) siguen centradas, no ancladas arriba como las de ajustes.
- [x] Ventanas de ajustes compactas (Enrique, 2026-11-12: «no cabe y hay que hacer scroll»): letra 15 px, campos de 40 px,
  casillas de 36 px, «Otro emoji» como una casilla más; la de una carpeta cabe en 850 px de alto.

## Tanda 3 — Plantillas

- [x] `copyPage`: duplicar de una vez (portada, hoja, panel, texto con sus secretos y pestañas; cada tipo de pestaña con
  su forma de copiarse, `packages/db/src/repos/copy.ts`), MCP `duplicar_pagina`; «Duplicar» la usa.
- [x] Prototipo «Plantillas como páginas» (https://claude.ai/artifact/HEiducM87Qe3zxcnvYZm6M,
  `out/lienzo-plantillas/lienzo.html`): la lista (A1 como Archivos o A2 tarjetas), el editor como página, «Desde
  plantilla» en página y pestaña nuevas. Aprobado con la A1 («Me gusta», 2026-11-12).
- [x] La plantilla como página-modelo (mundo oculto de la cuenta, ADR-0024; migración 0078); el editor es la página.
- [x] Crear desde plantilla = duplicarla; «Desde plantilla» la última, también en «Pestaña nueva» (`addTemplateTabs`).
- [x] Fuera las de serie (barrido antes): migración 0077, que convierte en propias las que estén en uso.
- [x] Carpetas de plantillas (migración 0079), con la lista como Archivos.
- [x] Volver en el editor; fuera «Aplicar plantilla»; registro de tipos de pestaña.
- [x] Crítica (28/40) y audit de impeccable, con sus arreglos y lo que eligió Enrique.

## Tanda 4 — El mundo: la página y la hoja

- [x] La columna izquierda no se esconde.
- [x] El panel derecho, fijo y con su desplazamiento (también en la ventana de la Mesa).
- [x] Ancho del texto, rayas de salto de lado a lado y «Página N» de la que se cierra.
- [x] Nota lateral izquierda / derecha.
- [x] Descargar e imprimir: con colores, blanco y negro o pergamino.
- [x] Menú común; «Exportar» y «⋯» con él.
- [x] Crítica (29/40) y audit de impeccable, con sus arreglos (plan y decisiones en `tasks/tanda-4.md`).

## Tanda 5 — Cristal, Entrar y la portada

- [x] «Crisol, con cristal»: en lugar de lienzo, construido con capturas de antes y después (Enrique revisa las tandas
  juntas); plan en `tasks/tanda-5.md`.
- [x] Superficies y fondo de ambiente; respaldo sin desenfoque donde falta; «Sin desenfoque» en Ajustes.
- [x] Entrar (el recuadro de cristal) y la portada pública. Las imágenes nuevas de Entrar, cuando Enrique las genere.
- [x] Crítica (28/40) y audit (16/20) de impeccable, con sus arreglos.
- [x] Lo que Enrique vio en local (2026-11-12): el cristal no se notaba (fondo casi negro, sin desenfoque); ahora el
  fondo se reconoce y lo que enmarca desenfoca lo de detrás, con brillo arriba. De cristal también los cuadros, las
  ventanas, los menús, los campos y el botón principal. El fondo parpadeaba en cada cambio de vista y daba un destello
  al pasar por un mundo: arreglados. «Tuyos» fuera de Sistemas. Prompt del fondo de Mundos en `docs/imagenes.md`.
- [x] Plantillas (2026-11-12): «Plantilla nueva» abre el cuadro de «Página nueva» (tipo y nombre); el árbol del editor
  con carpetas, «Nueva carpeta» y el botón derecho (borrar, duplicar, ajustes; en una carpeta, crear dentro); «⋯» con
  las filas del menú; «Pestaña nueva» sin plantillas (fuera `addTemplateTabs` y su herramienta del MCP).

## Tanda 6 — Sistemas: su espacio, sus portadas y sus libros

- [x] Antes: el paquete de iconos de fantasía (ver «Pista de imágenes»): 337 de game-icons.net (CC BY 3.0), «gi:<id>»,
  con su buscador en el icono de una página y en los formularios, y `listar_iconos` en el MCP.
- [x] Espacios de la barra declarados; el espacio del sistema y su vuelta.
- [x] Icono y portada del sistema; libros con portada o color.
- [x] El libro por dentro y «Entrada nueva» (con el compendio de dos columnas; las tres, tras la revisión si hacen falta).
- [x] Crear un sistema: con la IA, con el esqueleto, a mano (el editor, en la tanda 8).
- [x] Crítica (24/40) y audit (15/20) de impeccable, con sus arreglos; capturas y página de revisión.

## Tanda 7 — Libros de texto y el compendio desde el mundo

- [ ] Capítulos (ADR), su lector y sus herramientas MCP.
- [ ] Incrustar una entrada (con su prueba de fugas).
- [ ] «Entrada nueva del compendio» desde el mundo, en ventana.
- [ ] Tirar las acciones de una entrada; los dados salen de la wiki.

## Tanda 8 — El editor de sistemas a mano

- [ ] Estudio (Roliando, Roll20), lienzo, construcción.

## Tanda 9 — Repaso del MCP

- [x] Las instrucciones, al día: el editor de sistemas a mano, los capítulos de los libros, la ficha incrustada
  `![[@Nombre]]`, sin «de serie» para lo que ya no viene con Crisol.
- [x] Una prueba que vigila que las instrucciones solo nombran herramientas que existen (y nada de lo quitado); la de
  integración, con el cliente oficial, comprueba la salida de `listar_sistemas` con su esquema y las instrucciones.
- [x] Las descripciones de los contratos, repasadas («de serie» solo donde lo es: «blank» y el contenedor «grupo»).
- [ ] Probarlo con el conector de claude.ai recién conectado (el de esta sesión guardaba las herramientas de antes de
  la tanda 6: `listar_sistemas` fallaba al validar `icon` y `cover`, y no veía `capitulos_libro`).

## Después
- [ ] **Registro de tiradas a la vista fuera de la Mesa** (Enrique, 2026-11-12: dirigir la sesión desde la página, sin la Mesa): un botón «Registro» en la barra mientras se está en una campaña o en su mundo, que abre el historial al lado de la página (hoy, desde el d20 → Historial).

- [ ] Módulo 9: pizarras y mapas con capas.
- [ ] Módulo 8 (mundo): calendarios y líneas temporales.
- [ ] Módulo 10 (mundo): grafo y árbol familiar, tableros, gráficos, nombres.
- [ ] Revisión de la campaña, con lo de los módulos 8 y 10 que es suyo.
- [ ] Un tráiler animado con HyperFrames para la portada pública (Enrique, 2026-11-12), con escenas de la app de verdad;
  quizá sustituye a las estampas. En los tutoriales se quedan los mensajes (se actualizan solos y se leen con lector de
  pantalla); como mucho, un clip corto en bucle en algún paso difícil de describir (arrastrar al mapa, la niebla). Al
  final de la revisión, con las pantallas quietas. Antes: su licencia y si pide instalar algo (ffmpeg) en el VPS.

## Encontrado de paso

Lo que sale sin estar en la lista: se avisa a Enrique y se arregla en su tanda.

- [x] Archivos comunes: no se mueve ningún archivo (arreglado en la tanda 2); el aviso a la vista, con la Archivos nueva.
- [x] Cristal sin respaldo en seis piezas de la Mesa (tanda 5: los tokens del cristal, casi opacos sin desenfoque).
- [x] `docs/diseno.md` dice que la barra derecha de la Mesa es opaca y es de cristal (tanda 5: corregido).
- [x] Tutorial de Inicio: «Nueva campaña» colado entre Historial y Papelera (tanda 1): ahora va tras «Nuevo mundo».
- [ ] Menú móvil fuera de un mundo: solo «Mundos» (con la vista de la jugadora).
- [x] «Página N» no sale tras un salto a mano; la nota lateral, siempre a la derecha al imprimir (tanda 4).
- [x] «Duplicar» se deja portada, hoja y pestañas (tanda 3: `copyPage`).
- [ ] Las acciones de una entrada del compendio no se tiran (tanda 7).
- [ ] Mapas: regiones, rutas y textos se guardan y no se pintan (módulo 9).
- [ ] Reemplazar un sistema subiendo otro: está en el servidor y no en la app (tanda 6).
- [x] No hay menú común (tanda 4).
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
- [x] Las transiciones de vista (entrar en un mundo o en una plantilla, cambiar de sección) no respetaban «movimiento
  reducido»: ahora, con él, un fundido breve sin desplazarse ni brasas (tanda 3, audit).
- [x] Al quitar el cuadro viejo de «Plantilla nueva», la web perdía copiar una plantilla (criterio 2 del módulo 2):
  ahora «⋯» → «Duplicar» en el editor (tanda 3).
- [ ] Los guiones locales de `e2e/.revision/` (fuera de git) siembran con las de serie (`template: 'pnj'`): si se usan,
  que creen antes sus plantillas.
- [x] El editor pinta «##» como h3 a propósito (el título es el h1): quien escriba sus apartados con «##» deja un hueco
  de títulos para los lectores de pantalla (tanda 4: cada título lleva su `aria-level` sin saltos; a la vista, igual).
- [x] A una columna, la nota lateral ni se emparejaba con su bloque (iba a lo ancho); y la app y la impresión emparejaban
  distinto una nota seguida de un cambio de columnas (tanda 4).
- [x] Algunas líneas del texto empezaban con un espacio (el `break-spaces` que trae el editor): ahora `pre-wrap`
  (tanda 4, crítica).
- [x] «⋯» no se alcanzaba con el teclado al pasar al menú flotante: el foco entra, las flechas recorren y Tab sale
  (tanda 4, crítica).
- [x] Imprimir una vez en «Pergamino» dejaba la página en esa letra (también para los jugadores) y una entrada en el
  Historial: el aspecto va ahora con cada impresión (tanda 4, crítica).
- [x] En la ventana de una página de la Mesa, la cabecera compacta dejaba leer el texto de detrás: opaca (tanda 4).
- [x] Las rayas de página estaban a 2,4:1 con el fondo y «Incluir secretos» en un rojo a 3:1: a 3:1 y en el rojo
  legible (tanda 4, audit).
- [ ] El creador de personajes, con la máquina cargada, se queda en «Guardando…» y no aplica las características (la
  e2e `personajes.spec.ts` falla así; también en `main`): una carrera que ya existía. Con la revisión de la campaña.
- [x] Las esperas de las e2e a que acaben las animaciones no contaban con las que van ligadas al desplazamiento (el pie
  de la barra, tanda 5), que no acaban nunca: ahora se las saltan.
- [ ] La hoja móvil de una etiqueta (`tags.tsx`) usa clases que no existen en el CSS (`files.sheet`…): ya fallaba
  antes; el móvil es solo de la jugadora y Etiquetas es del máster, así que es menor.
- [x] La API de desarrollo (8130) se quedó con el código de `main` tras el bisect del creador de personajes:
  /plantillas petaba («folders is not iterable»). Reiniciada en la rama buena (2026-11-12).
- [x] La zona de peligro se pintaba entera de rojo desde la tanda 5 (su CSS era del marco de antes, no del anillo).
- [x] «⋯» de una plantilla: sus ajustes se abrían dentro del menú, que se quedaba abierto detrás; y sus filas no tenían
  el aspecto del menú.
- [x] Durante las transiciones de vista el fondo de ambiente desaparecía (la captura de la raíz es siempre opaca): ahora
  viaja solo el contenido.
- [x] Al salir de un mundo, la transición salía rara (2026-11-12): el router cambia la dirección enseguida y monta lo
  nuevo dentro de la transición; el ancho de la página y la barra miraban la dirección, así que el mundo se recolocaba
  antes de su foto. Ahora miran la ruta montada (`shown-path.ts`). Además, al salir ya no hay viaje de la cabecera a la
  tarjeta (salía estirada y borrosa): el mundo se aleja mientras llega Mis mundos, sin hueco; sin desenfoque en las
  animaciones de página entera (iban a saltos).
- [x] Al entrar en un mundo, su portada (el fondo) se cargaba al acabar la transición: el fondo va aparte y se funde
  dentro de ella, y las portadas de Inicio se preparan de antemano.
- [x] «Plantillas» en la barra, con una plantilla abierta, vuelve con la misma animación que «‹ Plantillas».
- [x] Al quitar el crédito de los fondos se rompió el CSS de `backdrop.module.css` (Biome no lo vio; la compilación sí):
  arreglado el mismo día.
- [ ] Mover un capítulo con el libro abierto sin `?capitulo=`: el abierto pasa a ser el nuevo primero y el movido «se
  va». Que mover un capítulo lleve a él (lo vio el agente de pruebas, tanda 7).
- [ ] Editor de sistemas: la ficha de ejemplo, con la maqueta del paso 4 (cabecera, columnas, pestañas); ordenar
  arrastrando (seis puntos y Alt+flechas) como en las plantillas; el «?» con `useDismiss` (audit, tanda 8).
- [ ] **Las e2e en la CI** (PR #118, 2026-11-12, fusionado así con el visto bueno de Enrique): pasan 120 y fallan 4
  por tiempo agotado solo allí (bloques: el menú «Borrar»; dados:18 y herramientas: la página se queda bloqueada en
  la Mesa, axe no acaba y un botón nunca está «estable»; visión: tras reiniciar la niebla, el grupo sigue viendo).
  Ya iban sin desenfoque. Fallan a ratos desde el 2026-11-10. Trazas en el artefacto `trazas-e2e` de la CI.
- [ ] Módulo 9, lo que quedó de la crítica y el audit: dibujar y medir con el teclado (hoy, la forma, con ratón o la
  IA); ocultar los nombres del mapa por debajo de ~9 px en pantalla; «En barco», «—» si no hay agua (no se sabe);
  ¿modo «Editar» como en el lienzo o las herramientas siempre a la vista? (preguntar a Enrique); colores del mapa en
  tokens (`--map-ink`, `--map-halo`).
