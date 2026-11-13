# Módulos

Orden de trabajo y estado. Antes de empezar cada módulo se repasa con Enrique frente a `docs/inventario.md`: qué se
queda, qué se recorta y qué se descarta. Las decisiones se apuntan aquí.

## Dónde estamos

Actualiza esta sección al acabar cada sesión: es lo primero que lee la siguiente.

### Para retomar (2026-11-12, noche: tanda 9, repaso del MCP)

- Rama `revision/tanda-9` (sobre la 8), **desplegada en staging** para probar el conector (con la 8 dentro).
- Hecho: las instrucciones al día (editor de sistemas, capítulos, ficha incrustada, sin «de serie»), una prueba que
  vigila que solo nombren herramientas que existen, y la de integración con el cliente oficial (salida de
  `listar_sistemas` con su esquema). El conector de una sesión vieja guarda los esquemas de entonces: hay que
  reconectarlo en claude.ai (está en `tasks/probar.md`).
- **Siguiente**: su visto bueno de las tandas 8 y 9 → PR a `main`; luego los módulos 9, 8 y 10 (plan de la revisión).

### Para retomar (2026-11-12, noche: tanda 8, el editor de sistemas a mano, terminada en local)

- Rama `revision/tanda-8` (sobre la 7, sin subir), plan en `tasks/tanda-8.md`. Sin migraciones. Lienzo aprobado
  («me fío de tu criterio»): https://claude.ai/artifact/RNhfpKmxY2iQ2Z7GfbcNAp.
- Hecho: «Reglas» de un sistema abre el editor por pasos con preguntas de mesa (`apps/web/src/systems/editor/`): qué
  tiene un personaje, cómo se tira (con «Se lee:» y «Tirar una vez»), qué se lleva, la ficha, el creador, el compendio
  y lo avanzado; la ficha de ejemplo y la revisión a la derecha; se guarda solo (de uno en uno, con su versión, y al
  salir) si no hay errores; «Sistema nuevo → A mano».
- Crítica y audit de impeccable (P0–P3) con sus arreglos: la revisión siempre a la vista, nada de fórmulas en crudo,
  errores bajo su campo, foco y anuncios al añadir, quitar, mover y cambiar de paso, «Deshacer» sin perder lo de
  después. Quedan, menores: la ficha de ejemplo no sigue aún la maqueta del paso 4; arrastrar para ordenar.
- Pruebas: web 827, e2e `editor-sistemas` en verde. **Página de revisión**: https://claude.ai/artifact/EH91XXhfXA4xdgeoTF2DUj
- **Tandas 3 a 7 en `main` y en staging** (PR #118, 2026-11-12; migraciones hasta la 0080). La cobertura de lo
  cambiado subió a ~95 %; e2e sin desenfoque salvo portada y accesibilidad. En la CI fallan 4 e2e por tiempo agotado
  (solo allí); Enrique dijo fusionar igual: arreglo apuntado en `tasks/todo-revision.md`. `pnpm crisol quitar-dados`
  no se ha pasado en staging (las páginas se convierten solas al abrirlas).
- **Siguiente**: la tanda 9 del plan; la 8 irá a `main` con su visto bueno (o con la siguiente subida).

### Para retomar (2026-11-12, noche: tanda 7, libros de texto, terminada en local; falta su visto bueno)

- Rama `revision/tanda-7` (sobre la 6, sin subir), plan en `tasks/tanda-7.md` (7 porciones hechas). **Migración 0080**
  (`system_chapters`), ya aplicada a la base local. Al desplegar, opcional: `pnpm crisol quitar-dados`.
- Hecho: capítulos de los libros (ADR-0025, lector en `apps/web/src/books/`, MCP, viajan con el sistema, sin secretos
  para quien no dirige); tirar las acciones de una entrada (`rollContentAction`); la ficha incrustada `![[@Nombre]]`
  en una línea compacta que se despliega (resuelve desde la campaña, el sistema o el mundo; prueba de fugas); «Entrada
  nueva del compendio» desde el mundo en ventana flotante de cristal (`wiki/new-entry.tsx`); los dados salen de la
  wiki (texto en código; conversión en Yjs al abrir y barrido). Encontrado de paso: las barras del editor tapadas o
  descolocadas desde el cristal del 12.
- Pruebas: web 821; servidor (capítulos, tiradas de entradas, compendio, fugas, CLI) en verde; e2e capitulos,
  acciones-compendio, fichas-incrustadas, entrada-desde-mundo, dados, bloques, libros, sistemas, compendio y
  accesibilidad en verde.
- Crítica dual 25/36, detector sin hallazgos; arreglos aplicados.
- **Página de revisión**: https://claude.ai/artifact/LmGxerrRfELT7hqas2RfaW
- **Siguiente**: su visto bueno de las tandas 3 a 7 → subir a `main` y staging; luego la tanda 8 (el editor de
  sistemas a mano). Pendientes menores en `tasks/todo-revision.md`.

### Para retomar (2026-11-12, tarde: tanda 6, sistemas, terminada en local; falta su visto bueno)

- Rama `revision/tanda-6` (sobre la 5, sin subir), plan en `tasks/tanda-6.md` (7 porciones hechas). Sin migraciones.
- Lo que pidió Enrique al revisar en local (2026-11-12), hecho en la rama de la 5 antes de seguir: el cristal que se
  ve (fondo reconocible, desenfoque en lo que enmarca, cuadros/menús/campos/botón de cristal), el fondo sin parpadeo ni
  destellos (en las transiciones viaja solo el contenido; `shown-path.ts`: lo que se elige por la dirección mira la ruta
  montada), salir de un mundo sin el viaje raro de la cabecera, la zona de peligro, plantillas («Plantilla nueva» con
  el cuadro de «Página nueva», el árbol del editor con carpetas y botón derecho, «Pestaña nueva» sin plantillas),
  Sistemas sin «Tuyos».
- Tanda 6: iconos de rol (337 de game-icons.net, «gi:<id>», `listar_iconos`); los espacios de la barra
  (`components/spaces.ts`) y el espacio del sistema (su Inicio con portada e icono, Compendio, Reglas «pronto», Ajustes
  abajo, la llama vuelve a Sistemas); icono y portada del sistema y color o portada de cada libro; el compendio del
  sistema sin campaña (cuatro lecturas nuevas en el servidor) y el libro por dentro; «Sistema nuevo» con tres caminos.
- Imágenes de Enrique (estilo F) ya en la app: 12 fondos de Entrar, la portada, el ambiente y 8 bodegones (pantallas
  vacías en el centro y, con contenido, emblema junto al título). Las que faltan, en `docs/imagenes-por-hacer.md`.
- Pruebas: web 823; e2e de plantillas, sistemas, libros, compendio, mundos, inicio, wiki, accesibilidad, portada y hoja
  en verde (la de la biblioteca falló una vez con la máquina cargada; sola, pasa).
- Crítica 24/40 y audit 15/20, con sus arreglos (el libro por dentro con su índice por tipos, «Sistema nuevo» con
  caminos que se eligen, el fondo y el icono del sistema en todo su espacio, Reglas con lo que trae…).
- **Página de revisión** (tandas 3 a 6 y lo del 12): https://claude.ai/artifact/EVbQg5qCzBztdNv3U1WYht (versión 3).
- **Siguiente**: tanda 7 (libros de texto y el compendio desde el mundo: capítulos con su ADR, incrustar una entrada,
  «Entrada nueva» desde el mundo, tirar las acciones de una entrada, los dados fuera de la wiki). Pendiente menor: el
  ejemplo en cada problema de la comprobación de un sistema. Subir a `main` y staging con su visto bueno.

### Para retomar (2026-11-12, madrugada: tanda 5, cristal, Entrar y la portada, terminada en local; falta su visto bueno)

- Rama `revision/tanda-5` (sobre la 4, sin subir), plan en `tasks/tanda-5.md` (7 porciones hechas). Sin migraciones.
- Hecho: el fondo de ambiente (`components/ambient.tsx`: la portada del mundo, o la del que uno se para en Inicio,
  como miniatura ya difuminada y con tope de luz; quieto en las transiciones de vista); lo que enmarca de cristal sin
  backdrop-filter (`--surface-glass*`, rayas `--line-*`, el marco con `--cut-ring`); la página, una hoja casi opaca;
  ventanas y cuadros opacos por dentro; «Sin desenfoque» en Ajustes («Este aparato», `components/plain.ts`); el
  respaldo del cristal de la Mesa; Entrar con su recuadro de cristal; la portada nueva (imagen, «Entrar», «Tengo una
  invitación», tres estampas). Imágenes provisionales: el valle del ocaso (ambiente y portada); Entrar, las 24 de antes
  hasta que Enrique genere las suyas (`docs/imagenes.md`). Crítica 28/40 y audit 16/20 con sus arreglos.
- Pruebas: web 817; e2e de portada, accesibilidad, Archivos, mundos, Inicio, sesión, wiki, plantillas, sistemas,
  etiquetas, hoja e imágenes en verde. `personajes.spec.ts` falla a veces con la máquina cargada (también en `main`: una
  carrera del creador, apuntada para la revisión de la campaña).
- **Página de revisión** (tandas 3, 4 y 5): https://claude.ai/artifact/EVbQg5qCzBztdNv3U1WYht. Pruebas en
  `tasks/probar.md`.
- **Siguiente**: tanda 6 (sistemas: su espacio, portadas y libros). Primero, el paquete de iconos de fantasía
  (game-icons.net, CC BY 3.0: comprobar la licencia y apuntarlo en `docs/terceros.md`). Subir a `main` y staging con
  más tandas.

### Para retomar (2026-11-12, madrugada: tanda 4, la página y la hoja, terminada en local; falta su visto bueno)

- Rama `revision/tanda-4` (sobre la 3, sin subir), plan en `tasks/tanda-4.md` (las 7 porciones hechas, cada una en su
  commit). Sin migraciones.
- Hecho: el árbol fijo (pulsar el mundo lleva a su portada) y la columna derecha del alto de la ventana con su
  desplazamiento (crece al bajar; en la ventana de la Mesa, cada columna con el suyo y la cabecera opaca); la hoja a
  todo el ancho (letra hasta 20 px) con las rayas de página, de salto y de cambio de columnas de lado a lado y «Página
  N» de la que se cierra; la nota lateral a su lado con el texto alrededor, igual al imprimir (34 % / 42 %); «Imprimir
  o descargar» que pregunta el aspecto (con colores, nuevo; blanco y negro; pergamino), que va con cada impresión
  (`tema`) y se recuerda sin cambiar la página; Ctrl+P lo abre; el menú común (`components/menu.tsx`) con teclado, y
  «Exportar» como desplegable. Crítica 29/40 (`.impeccable/critique/`) y audit con sus arreglos; los títulos con
  `aria-level` sin saltos (encontrado de paso). Web 810, e2e de lo tocado en verde (hoja, wiki, exportar, editor,
  plantillas, versiones, imágenes, tablas del compendio, archivos en páginas).
- **Página de revisión para Enrique** con las capturas de las tandas 3 y 4 y las decisiones tomadas sin él:
  https://claude.ai/artifact/EVbQg5qCzBztdNv3U1WYht (capturas en `out/tanda-4/`). Pruebas en `tasks/probar.md`.
- **Siguiente**: tanda 5 (cristal, Entrar y la portada): empieza por su lienzo; las imágenes de la app (estilo F) las
  genera Enrique. Subir a `main` y staging con más tandas.

### Para retomar (2026-11-12, noche: tanda 3, las plantillas como páginas, terminada en local; falta su visto bueno)

- Rama `revision/tanda-3`, plan en `tasks/tanda-3.md` (las 8 porciones hechas, cada una en su commit). ADR-0024 con sus
  notas. Migraciones 0077 (las de serie en uso pasan a propias), 0078 (mundo oculto de plantillas) y 0079 (carpetas),
  aplicadas en local. Vite reiniciado con `--force`; la API se recargó sola.
- Hecho: el editor es la página (`EntryView` en modo plantilla); «Plantillas» como Archivos (árbol, carpetas con color
  e icono, crear dentro, arrastre y teclado, vista previa); «Plantilla nueva» crea y abre; «⋯» → «Duplicar» y
  «Ajustes»; «Desde plantilla» tras «o» en «Página nueva» y «Pestaña nueva» (`addTemplateTabs`); fuera «Aplicar
  plantilla»; MCP al día. Crítica de impeccable 28/40 (`.impeccable/critique/`) con sus arreglos y lo que eligió
  Enrique (campos y bloques plegados con seis puntos, marca «Plantilla» con color, campos como subtítulo); audit con
  el asa a 24 px y movimiento reducido en las transiciones de vista (encontrado de paso). e2e de plantillas (5) y las
  cercanas (36 + 24 + fugas) en verde; web 801, servidor de plantillas 13.
- Pruebas para Enrique en `tasks/probar.md` («Revisión, tanda 3»). **Siguiente**: su visto bueno a la tanda 3 en local
  → tanda 4 (el mundo: la página y la hoja). Subir a `main` y staging con más tandas (sin pasar la CI en cada PR). Los
  guiones locales de `e2e/.revision/` aún siembran con las de serie.

### Para retomar (2026-11-12, tarde: tanda 2 con la crítica de impeccable y lo que eligió Enrique; falta el audit)

- **Crítica** (27/40, dual-agent, `.impeccable/critique/`): lo claro, arreglado y en commit (`7e423af`). De lo que se
  preguntó, Enrique eligió las tres recomendadas y está hecho (sin commit aún al escribir esto): teclado de Archivos y
  Mayús+clic; mover y etiquetar lo elegido de una vez (`moveFiles`, `addFileTags`, MCP `mover_archivos` y
  `etiquetar_archivos`); el hueco de la portada que sube o recibe una imagen; Etiquetas plegables y la fila que abre su
  ventana. Normas en `docs/diseno.md`, nota en el ADR-0005, pruebas para Enrique en `tasks/probar.md`.
- Hecho y en commit: e2e de lo tocado (12 en verde), audit (15/20) con sus arreglos (tamaños de 24 px). **Siguiente**:
  el visto bueno de Enrique a la tanda 2 entera en local → tanda 3 (plantillas). Subir a `main` y staging, con más
  tandas (sin pasar la CI en cada PR).

### Para retomar (2026-11-12, mediodía: tanda 2 construida, en local; falta su visto bueno, impeccable y las e2e)

- **Tanda 2 entera en local** (rama `revision/tanda-2`): además de lo de abajo, el orden a mano de Archivos (migración
  0075), el **selector de archivos** (`components/file-picker.tsx`, con la lógica del árbol común en
  `wiki/file-tree.ts`) y **la portada** con «Subir imagen» y «Elegir de tus archivos» (el mismo cuadro para mundo,
  campaña y página; fuera el desplegable viejo de la portada de página).
- **Pedido por Enrique al probar** (2026-11-12): «Carpeta» en la ventana de un archivo y de una carpeta (en Etiquetas,
  «Dentro de: Ninguna»); **carpetas con color e icono** (migración 0076, aplicada en local; ADR-0005 con su nota);
  **ventanas de ajustes compactas** (letra 15 px, campos de 40 px, casillas de 36 px). Normas en `docs/diseno.md`.
- Pruebas: unitarias del selector, del árbol y de las ventanas; integración del color y el icono; e2e de la portada de
  página reescrita (en verde). Para Enrique, en `tasks/probar.md` («Revisión, tanda 2»).
- **Siguiente**: su visto bueno → impeccable (critique y audit) de Archivos, Etiquetas, el selector y la portada → e2e
  de lo tocado (archivos, etiquetas, mundos, imágenes, archivos-en-paginas) → commit. Opcionales sin respuesta:
  Alt+flechas en Archivos y herramientas MCP para mover archivos y carpetas. Subir a `main` y staging, con más tandas.

### Para retomar (2026-11-12, mañana: tanda 1 cerrada salvo subirla; tanda 2 en marcha, rama `revision/tanda-2`)

- **Tanda 1**: Enrique contestó las dos preguntas (sí a la línea de «Nuevo…» como las tarjetas; icono propio del
  mundo, `MountainSnow`) y se hizo todo lo del audit (X común `components/close.module.css`, la barra en pantallas
  bajas, cuenta en palabras, colores forzados, forja y ceniza a tokens, la subida de los iconos medida). `ritmo.test.ts`
  y el MCP con OAuth, en verde al repetirlos. La batería de e2e se lanzó (resultado, en el log de la sesión). **Subir a
  `main` y staging, cuando haya más tandas hechas** (Enrique).
- **Tanda 2** (rama `revision/tanda-2`, sobre la 1):
  - Archivos comunes ya mueve (fallaba la comprobación de ámbito fuera de los mundos).
  - `components/tree/moves.ts`: la lógica de mover, común y con pruebas; el árbol de páginas la importa.
  - Etiquetas ordenadas a mano: `tags.position` (migración 0074, aplicada en local), `moveTag`, MCP `mover_etiqueta`,
    y se arrastran **como las páginas del mundo** (raya delante o detrás, resalte dentro; sin «Arriba del todo», lo
    pidió Enrique).
  - **Archivos sin árbol**, aprobado y construido (solo lista): pulsar despliega; arrastrar como las páginas; mover al
    momento; vista previa a la izquierda (también en Etiquetas, que ya se ordena con el teclado); al buscar, lo
    encontrado dentro de sus carpetas; `#etiqueta` en el buscador; «Subir archivos» y «Nueva carpeta» fijos (en lo más
    alto) y, en cada carpeta, «Subir aquí» y «Carpeta dentro» al pasar el ratón.
  - Mover sin retardo (etiquetas y páginas, como pidió Enrique). Lo que parecía retardo tras eso era código viejo en
    su navegador: con Ctrl+Mayús+R, «se ve al instante».
  - **En marcha**: el orden a mano de archivos y carpetas dentro de su carpeta (Enrique: «no puedo recolocar dentro de
    una carpeta»), migración 0075, como el de las etiquetas.
- **Siguiente**: revisar y subir a la rama el orden de Archivos; luego el selector de archivos y la portada al crear un
  mundo (preguntado a Enrique si con prototipo o directo), y cerrar la tanda 2 (impeccable y pruebas).

### Para retomar (2026-11-12, madrugada: tanda 1 con visto bueno y revisada con impeccable; faltan e2e, PR y staging)

- **Rama `revision/tanda-1`** (sin subir). Casillas al día en `tasks/todo-revision.md`.
- **Imágenes**: Enrique eligió la **F** (pintura estilizada). Guía y los 22 prompts que faltan en `docs/imagenes.md`;
  las entrega en `datos-locales/imagenes/`. Solo las de la app (las portadas son del usuario).
- **Hecho**: documentos de arranque (normas, tabla de módulos, ADR-0023 sin pagos y ADR-0024 plantillas-modelo) y la
  **tanda 1** entera con lo que pidió Enrique al revisarla: **solo tema oscuro**, X de cerrar con círculo, nombre
  resaltado con el color del mundo, «Nuevo…» común de línea continua, descripción con cuenta y sin pista.
- **impeccable**: critique 29/40 y audit 15/20; lo claro, arreglado (ver las casillas). **Quedan dos preguntas para
  Enrique** (la línea de «Nuevo…» y el icono del mundo en la barra) y unos cuantos puntos del audit.
- **Siguiente**: lo que conteste Enrique y lo del audit → `pnpm e2e` entero → repetir `ritmo.test.ts` y el MCP con
  OAuth → PR a `main` con `[skip ci]` → staging (al final, dijo). Después, la tanda 2 empieza con un **prototipo de
  Archivos sin árbol a la izquierda** (decidido por Enrique; ver `docs/diseno.md` y el plan).
- **Local**: Enrique revisa por un túnel a `localhost:5173`; la API (8130) y el Vite (5173), desligados de la sesión
  (`setsid nohup`, registros en `datos-locales/*.log`). Parados los servidores viejos de la revisión global (5174 y
  8132). Ojo al parar procesos: el PID con `ss -ltnp` y su cwd (staging va en Docker con el mismo comando).
  `scripts/desplegar-staging.sh [rama]` despliega una rama local. Los subagentes pueden revisar la app con el
  servidor de las e2e (`node e2e/servidor.ts`, 8131; se siembra con una prueba que usa `freshOwner`); ojo: tras
  recompilar la web hay que reiniciarlo (sirve el `index.html` viejo).

### Para retomar (2026-11-11, tarde: plan de la revisión de Enrique, aprobado; sin empezar)

- **Enrique revisó la app** (portada, Entrar, Inicio, Sistemas y el mundo) y trajo unos cuarenta puntos. El plan,
  aprobado por él, está en **`tasks/plan-revision.md`** y sus casillas en **`tasks/todo-revision.md`**: nueve tandas
  (Inicio; árbol común, Archivos y Etiquetas; Plantillas; la página y la hoja; cristal, Entrar y la portada; Sistemas;
  libros de texto y compendio desde el mundo; editor de sistemas a mano; repaso del MCP) y, después, los módulos 9, 8
  y 10.
- **Cómo se trabaja**: una tanda cada vez, en local; Enrique da el visto bueno; pruebas y a `main`. Lo que se encuentre
  de paso (fallos o mejoras) se le avisa y se arregla en su tanda.
- **Decidido por Enrique**:
  - la campaña queda fuera, para una revisión propia;
  - **el módulo 11 (pagos) se descarta**: Crisol es una herramienta propia, gratuita y privada;
  - donde convenga una imagen, se le da el prompt y él la genera fuera (primero hay que encontrar el estilo);
  - el cristal de la Mesa se lleva a toda la app;
  - fuera las plantillas de serie; vuelve el editor de sistemas a mano; los dados salen de la wiki y van al compendio.
- **Sin empezar**: solo existe la rama `revision/tanda-1` con el plan y las casillas. Falta también lo de «Documentos
  que se tocan al empezar» del plan (`docs/diseno.md`, la tabla de módulos entera y los ADR nuevos).
- **Siguiente**: los prompts de estilo (`docs/imagenes.md`) y la tanda 1.

### Para retomar (2026-11-11: módulo 7 terminado, PR a `main` y staging)

- **Módulo 7 construido entero** (rama `modulo-7/sala`, migraciones 0065–0073): sala, registro (Chat / Tiradas /
  Todo), enseñar, mover fichas de la jugadora, notas del jugador, sonido sincronizado, sonidos del mapa y sonido de
  Foundry. Revisión con impeccable aplicada (lo claro) y e2e al día.
- **Queda para Enrique**: probar `tasks/probar.md`; decidir lo de la revisión que es suyo:
  - el recuadro de YouTube en el móvil;
  - borrar listas de sonido sin confirmación;
  - «Sin carpeta» como título;
  - los avisos y la cola de la IA quedan debajo de las ventanas modales (los ajustes de la campaña).
- **Pendientes menores**:
  - un solo buscador también para los encuentros en Actores;
  - mover a carpeta con el teclado;
  - el arrastre de la jugadora con su color en la Mesa del máster;
  - zips de mundo de Foundry (`world.json`);
  - el filtro de paso bajo al amortiguar.
- **Siguiente**: el módulo 8 (calendario, clima, viajes, líneas temporales), empezando por su entrevista; antes, el
  estudio de Roll20 y lo de los libros para leer, si Enrique quiere.

### Para retomar (2026-11-10, tarde: módulo 7 en marcha, rama `modulo-7/sala`)

- **Hecho**: entrevista (`docs/intent/sala-de-jugadores.md`), estudio (`research/foundry/sala-de-jugadores.md`,
  `research/foundry/sonido.md`, `research/dndbeyond/registro-de-partida.md`), mapa aprobado (`docs/specs/modulo-7.md`)
  con las specs de sus ocho capacidades, ADR-0022 (propuesta) y `apps/web/PRODUCT.md` para impeccable.
- **Lienzo «Sala de jugadores»** (https://claude.ai/artifact/VVATCB3eBjG3SbPNC8yUKz, `out/lienzo-sala/`), **por
  aprobar**, con 16 decisiones. Enrique ya cambió una: el zoom a la izquierda y el registro a su derecha.
- **`sala`, el servidor hecho** (`tasks/sala/`, tareas 1–4): `tableActionAllowed` (dominio), pausa y modo
  (migración 0065, `setTableControls`, en las vistas de la sala), echar y dejar volver (`kickFromTable`,
  `allowBackToTable`, cierre 4409), presencia con personaje, color, «en la campaña» (mensaje `focus` del canal general)
  y echados (`getTablePresence`, MCP `ver_sala`, `controles_sala`, `echar_de_la_mesa`, `dejar_volver`).
- **Hecho después** (Enrique probando en local): la web de la sala (retratos y pausa junto a la escena, panel con
  quién está, cómo mueven, echar e invitación), fuera la pestaña Campaña de la Mesa y borrar la campaña desde dentro,
  pestaña «Actores» con un buscador, cristal con fondo tenue detrás del mapa; **el registro** entero (servidor,
  migración 0066, MCP; la tira de cristal en la Mesa del máster y de la jugadora).
- **Luego, más ajustes de Enrique probando**: registro minimizado de inicio; otra escena se abre en pausa; cada
  escena recuerda su zoom y posición (en el aparato); «Vista de jugadores» en vez de «Pantalla»; anchos fijos arriba;
  «Escena nueva» en un cuadro con nombre y mapa; **carpetas en Actores** (migración 0067). Tras crear una migración,
  aplicarla en local; si el servidor de desarrollo no recarga, reiniciarlo (ver memoria `migrar-en-local`).
- **Hecho también**: registro con pestañas Chat / Tiradas (el historial de los dados, ya fuera de ellos) / Todo, el
  máster vacía y borra; encuentros en Actores; «te han sacado de la Mesa»; registro en el móvil; burbujas en la vista
  de jugadores; **`ensenar` entero** (migración 0068: página o imagen a todos, a unos o en la vista; la jugadora abre
  la imagen mientras siga en el registro; «Quitar»; «Abrir» desde el registro).
- **`mover-jugadores` hecho** (migración 0069, commits 83c8db7 y 971e8da): la jugadora arrastra lo que lleva (pausa,
  modo, turno, muros y puertas en el servidor; si no, vuelve con aviso), abre las puertas que ve, pasa su turno; el
  máster asigna criaturas («Lo lleva…», `asignar_ficha`). Pendiente menor: pintar el arrastre de la jugadora con su
  color en la Mesa del máster (el servidor ya manda `by`) y moverlas con el teclado.
- **`notas-jugador` y `sonido` hechos** (migraciones 0070 y 0071). El sonido: listas del mundo (`sound_playlists`,
  `sound_tracks`, con historial), lo que suena de cada campaña en `campaign_tables.sound`, el reloj del servidor que pasa
  de pista sin nadie (`apps/server/src/table/sound.ts`), mensajes `sound` y `time` por el canal de la mesa, la pestaña
  Sonido del máster, las barras junto a la pausa y la reproducción en la Mesa del máster, la de la jugadora y la vista de
  jugadores (`apps/web/src/sound/`); MCP `ver_sonido`, `poner_sonido`, `parar_sonido`, `volumen_sonido`,
  `crear_lista_sonido`, `cambiar_lista_sonido`. Falta probarlo en un navegador de verdad (`tasks/probar.md`).
- **`sonido-mapa` y `sonido-foundry` hechos** (migraciones 0072 y 0073). Sonidos del mapa: `scene_sounds` (del mundo,
  con historial) y su encendido por campaña en `scene_states.sounds`; la atenuación en `packages/tabletop/src/sound.ts`
  (coseno, frenan o amortiguan, el limitado deja pasar uno); la vista de jugadores y la Mesa del jugador reciben en
  `screen.sounds` los que suenan y en `soundWalls` los muros cerca; cada aparato calcula su volumen
  (`apps/web/src/sound/map-sounds.ts`: grupo, sus fichas o el centro de la vista del máster); la herramienta «Sonidos
  del mapa» (O); MCP `poner_sonido_escena`, `cambiar_sonido_escena`, `quitar_sonido_escena`. Foundry: listas de
  paquetes de listas, de aventuras y las que enlaza una escena, y los sonidos de sus escenas
  (`packages/systems/src/foundry/sound.ts`); la web sube antes los audios del zip y mide su duración; las pistas ganan
  la fuente «dirección» (`sound_tracks.url`); lo que falta va a `missingAudio`. **Queda**: los zips de un mundo
  (`world.json`, como en las escenas); el amortiguado es solo más bajo (sin filtro de paso bajo); la duración de las
  pistas de YouTube o de una dirección traídas se supone (5 min); el test `repos.test.ts` de miembros (campo `color`)
  ya fallaba antes.
- **Siguiente**: critique y audit con impeccable (también la herramienta y el panel de sonidos del mapa), e2e y PR.
  Capturas de la Mesa: `e2e/tests/zz-captura.spec.ts` (fuera de git).

### Para retomar (2026-11-10: tanda en `main` con el PR #116; se pasa al módulo 7)

- **En `main`** (PR #116): la campaña alrededor de la Mesa (ADR-0019), escenas sueltas (ADR-0020), el cristal, los dados
  nuevos y fluidos, el estudio de Roliando y Nivel20, y libros y el espacio de la campaña (ADR-0021). La CI de e2e tiene
  ahora más margen (la batería pasa de 30 min).
- **La interfaz, en pausa** por decisión de Enrique (2026-11-10: «dejamos la UI por ahora»). Lo que tiene que probar, en
  `tasks/probar.md`; la cuenta de jugadora de prueba en local, en `.env` (`LOCAL_PLAYER_*`).
- **Siguiente módulo: el 7, «Sala de jugadores»** (catálogo, abajo): presencia, chat y susurros, mostrar a jugadores,
  sonido (también los de un zip de Foundry) y controles del máster. Ya hay una parte: **quién está en la Mesa**
  (`apps/server/src/table/presence.ts`, `getTablePresence`, la sección Mesa de la campaña) y «enseñar una página». Empezar
  por el ciclo de siempre (CLAUDE.md): `interview-me` con Enrique frente a `docs/inventario.md`, estudio con
  craft-anything (Foundry: sockets y chat; DDB: game log), `/spec`, lienzo, `/plan`, `/build`.
- **Pendiente, un estudio de Roll20** (Enrique, 2026-11-10): para una revisión futura de la mesa y de todo lo que nos
  pueda aportar (con craft-anything y su web pública, como Foundry y D&D Beyond; notas en `research/roll20/`).
- **Pendiente, los libros para leer** (Enrique, 2026-11-10, para otro momento): añadir los libros de las fuentes que
  queramos y, además de sacar de ellos el compendio, **ver el libro maquetado** para leerlo y buscar en él, con
  **referencias cruzadas con el compendio** (de una entrada a su página del libro y del libro a la entrada).

### Para retomar (2026-11-10, noche: dados fluidos; siguiente, el lienzo de libros y del espacio de la campaña)

- **Estudio de Roliando y Nivel20** hecho (`research/roliando/`, `research/nivel20/`; informe en
  https://claude.ai/artifact/4uPvHP5VgzGfPLPWKCCc4Y). Enrique decidió que la campaña vuelva a tener su espacio propio,
  como el mundo, con la Mesa como una sección (`docs/diseno.md`); cambia parte del ADR-0019.
- **Dados fluidos** (commit «Dados más fluidos…»): caen en el clic con los dados que predice la fórmula
  (`dice/predict.ts`) y el resultado se les pone al llegar (`DiceScene.start` → `land`/`cancel`; `useTray().start`);
  la escena se carga y calienta en un rato libre dentro del mundo (`warm`); sin tarjeta gráfica, sin sombras ni
  antialias; 1,8 s como mucho en pantalla. Ojo: las e2e sirven `apps/web/dist`: tras tocar la web, `pnpm --filter
  @crisol/web build` antes de pasarlas sueltas.
- **Lienzo «Libros y campaña»** aprobado («está genial»): ADR-0021, spec `docs/specs/libros.md`, plan y tareas en
  `tasks/libros/`. Hechas las tareas 1–6: dominio (libros con más datos, `excluded`, lo pendiente), servidor (acciones
  de libros, pendientes de revisar, MCP, migración 0064, presencia en la Mesa) y web (el espacio de la campaña con su
  Inicio, la sección Mesa con personajes, quién está y «Abrir la Mesa» en otra pestaña, Libros de la campaña con
  «Elegir contenido» y la ficha de cada libro). Enrique cambió dos cosas por el camino (2026-11-10): la campaña se abre
  en la misma pestaña y la Mesa en otra; Personajes y Mesa, una sola sección.
- **Hechas las tareas 7–9 y casi toda la 10** (2026-11-10, noche): página de cada sistema con sus libros, «Libro
  nuevo» (IA desde PDF, archivo con `importBook`, vacío), ajustes del libro, revisión de lo que trae la IA, compendio por
  libro (con página) y creador con libros; tutoriales; la revisión de código (agente) y sus arreglos (commit e79cfa9).
  Enrique cambió además: la barra de la campaña lleva su nombre y no tiene Páginas; la «tele» es la pantalla de los
  jugadores («Pantalla»/«Cámara») y se abre desde la Mesa. Cuenta de jugadora de prueba en local: en `.env`
  (`LOCAL_PLAYER_*`), dentro de la campaña «dfgdfgd».
- **Siguiente paso**: volver a pasar las e2e que fallaban antes de los últimos arreglos (`libros`, `a11y`, `fugas`,
  `sistemas`; la tanda se cortó al cerrar la sesión) y luego `pnpm e2e` entero; con todo en verde, el PR a `main` con la
  CI una vez (cuando Enrique lo diga). Fuera de esto: el puerto 8132 lo ocupa otro proceso y tumba
  `mcp.integration.test.ts`.

### Para retomar (2026-11-10, tarde: escenas sueltas, ADR-0020)

- **Tras probar Enrique la campaña** (misma rama `docs/tras-revision`): pestaña «Campaña» con una sola voz, Escenas
  antes que Combate, los menús del editor por encima de las ventanas, cristal en la página en ventana y en la Mesa
  sin escena (el fondo de entrar), los fallos de la Mesa que se van solos, encuadrar sin lo que tapa la barra, los
  dados 3D suaves (interpolando, como el Crisol antiguo) y el servidor que ya no se queda colgado al reiniciarse.
- **Escenas sueltas (ADR-0020)**: Enrique eligió «como Foundry»: «Escena nueva» ya no crea página; `createScene`,
  `renameScene`, `deleteScene` (MCP `crear_escena`, `renombrar_escena`, `borrar_escena`), migración 0063 (`tab_id`
  opcional y `name`); permisos de la suelta por el mundo; su editor (mapa, rejilla) en una ventana de la Mesa
  (`tabletop/scene-window.tsx`, `SceneProvider`); menú de cada tarjeta (botón derecho o «⋯»).
- **Siguiente paso**: que pasen las e2e que quedan y la revisión; luego el PR con la CI una vez.


- **Hecho en la rama `docs/tras-revision`** desde la nota de abajo: el cristal (lienzo «La Mesa, con cristal»), la barra
  de la derecha flotando de cristal (plegada y desplegada, entera), la campaña sin la barra de la izquierda (como
  Foundry), la pestaña «Campaña» (nombre, jugadores y sus personajes, miembros, invitación), fuera la pestaña Tiradas y
  **los dados nuevos** (lienzo «Tirar dados», https://claude.ai/artifact/2foNpTU5ed1XGFkjTp2TAN, aprobado: «me
  gusta»): columna de dados sobre el d20, bandeja con lo juntado (modificador, ventaja, quién la ve, que se recuerda),
  escribir la tirada (se abre así la próxima vez), el resultado sobre el d20 cuando paran los dados, con «Otra vez», y
  el historial en una ventana de la Mesa (fuera, en una ficha junto al d20). Código en `apps/web/src/dice/`
  (`pool.ts`, `rack.tsx`, `notices.tsx`, `roll-parts.tsx`, `history.tsx`). Unitarias de la web en verde.
- **Siguiente paso**: terminar la tarea 13: que pasen todas las e2e (adaptadas a la campaña sin barra, a que las
  campañas se abren en otra pestaña y a los dados nuevos), la revisión y el PR con la CI una vez.
- Lo de «sistemas y libros» y lo pendiente apuntado siguen como en la nota de abajo.

### Para retomar (2026-11-09: la campaña alrededor de la Mesa, construida en local)

- **Rama `docs/tras-revision`** (sin PR, sin subir), con lo de antes (cuadros unificados, transiciones, etiquetas
  dentro de otras, fondos de las pantallas de cuenta, sin sistemas de serie, «Invitar», dados nuevos) y **la campaña
  alrededor de la Mesa** (ADR-0019; plan y tareas en `tasks/plan.md` y `tasks/todo.md`, 12 de 13 hechas): el máster
  abre en la Mesa con su barra de pestañas; páginas, compendio, libros y hojas en ventanas; «Enseñar a los jugadores»
  (`showPage`, MCP `ensenar_pagina`); quien juega abre en su ficha y tiene su Mesa (espectador `player`); «Del grupo» en
  la ficha con «Lo puso»; las campañas en otra pestaña; varias campañas por mundo y lo compartido, a la campaña desde
  la que se hace. Unitarias de la web (706) y de integración de lo tocado en el servidor, en verde.
- **Siguiente paso**: la tarea 13 (cierre): **actualizar los e2e** (muchos entran por las vistas viejas de la campaña,
  por «Invitar» junto al título y por la barra de antes; también los pendientes de invitar, unirse y sistemas), la
  revisión (`/agent-skills:review` y `web-design-guidelines`) y el PR con la CI una vez. Para mirarlo: el entorno de
  revisión (servidor 8132, web 5174, `e2e/.revision/`, cuentas `enrique@` y `lucia@revision.test`).
- **Lo siguiente que pidió Enrique (2026-11-10)**: **sistemas y libros**, como Roliando y Nivel20. El sistema son las
  reglas (fichas, campos, tiradas, tipos); los **libros** rellenan el compendio de su sistema (en el 5e, sus libros de
  D&D comprados y Fateforge, que es compatible; Daggerheart, en otro sistema). Al crear una campaña se elige el sistema
  y luego sus libros. Hoy los libros son las «fuentes» del sistema y la campaña ya las elige: falta **añadir un libro a
  un sistema que ya existe** (archivo, módulo de Foundry o la IA leyendo un PDF) y elegirlos por su nombre (con portada)
  al crear la campaña. Antes, estudiar Roliando y Nivel20 (craft-anything, con una cuenta de prueba en cada una: Enrique
  dijo que sí) y entrevista corta.
- Pendiente apuntado: «Archivar» la campaña; la escena en marcha bajo «Ir a la Mesa» en la ficha; la ficha rápida al
  pasar por una criatura del compendio.
- Dev: si una pantalla da «Ya no existe» o 500 con «relation … does not exist», faltan migraciones en la base de
  desarrollo: `pnpm db:migrate`.
- Dev: `node --watch` deja de ver un archivo que Biome reescribe (lo sustituye por uno nuevo): si el servidor de
  desarrollo no coge un cambio, `touch apps/server/src/main.ts` lo reinicia con todo lo último.

### Para retomar (2026-11-08, madrugada: lo siguiente, rehacer la campaña alrededor de la Mesa)

- **Rama `docs/tras-revision`** (sin PR, sin subir): tras el PR #115, los cuadros unificados, la transición de entrar en
  una plantilla y en una campaña, las etiquetas dentro de otras (arrastrar), el fondo de las pantallas de cuenta como en
  LegendKeeper (24 imágenes, `components/backdrop.tsx`), sin sistemas de serie, «Invitar» discreto y los dados con
  física nueva. Unitarias en verde; faltan e2e de invitar, sistemas y lo nuevo.
- **Decidido por Enrique (2026-11-08)** y apuntado en `docs/diseno.md`: la campaña se abre en la Mesa a pantalla completa,
  con barra de pestañas a la derecha como Foundry (Tiradas, Combate, Escenas, Personajes, Compendio, Páginas, Ajustes);
  páginas del mundo en ventanas sobre la Mesa; la jugadora abre en su ficha; el inventario del grupo, en la ficha (como
  D&D Beyond). El lienzo ya está («Campaña en la Mesa», https://claude.ai/artifact/1gY6Mun8KisrJ6d2fXGbLj;
  fuentes en `out/lienzo-campana/`, fuera de git). **Siguiente paso**: que Enrique lo apruebe y confirme las 14
  «Decisiones que tomé yo» del final; luego el plan y construirlo en porciones.
- Dev: si una pantalla da «Ya no existe» o 500 con «relation … does not exist», faltan migraciones en la base de
  desarrollo: `pnpm db:migrate`.

### Para retomar (2026-11-08, noche: las dos revisiones de la interfaz, en `main` y en staging)

- **PR #115, fusionado y desplegado en staging** (2026-11-08): las dos revisiones globales de la interfaz con todo lo
  arreglado, las normas nuevas en `docs/diseno.md` y las e2e al día. La CI pasó entera (la primera vez falló axe por
  el «20» del d20, que era texto SVG: ahora va con trazos). Detalle de cada revisión, abajo y en
  `tasks/revision-interfaz.md`.
- **Queda para Enrique**: G1 (mover archivos con teclado; propuesta, por ahora no), probar a mano los módulos 5 y 6
  (`tasks/probar.md`) y confirmar los ADR-0017 y ADR-0018.
- **Después**: el módulo 7 (la sala de jugadores), empezando por su entrevista. Esta rama `docs/tras-revision` (sin PR)
  solo lleva esta nota: que vaya con el PR siguiente.
- Las tandas largas (e2e, despliegue), con `setsid nohup … &` y un Monitor sobre su log: la sesión se cortó varias
  veces y paraba lo lanzado en segundo plano.

### Para retomar (2026-11-08, noche: segunda revisión de la interfaz, arreglada en local)

- **Hecho** (misma rama `docs/tras-modulo-6`, sin PR): una segunda pasada a todo con 137 capturas
  (`e2e/.revision/capturar2.ts` → `out/revision-2/`; las de antes de arreglar, en `out/revision-2-antes/`), cuatro
  revisores sobre las capturas y uno sobre el código. Lista y estado en `tasks/revision-interfaz.md` § «Segunda
  revisión»; página https://claude.ai/artifact/VtLsEti4wrCNvya9RsEbNT. Enrique aceptó las propuestas («Vamos») y está
  todo arreglado salvo tres menores anotados (2D13, 2D15, 2D16). Lo gordo: tutoriales uno a uno y en todas las páginas
  del mundo, la ficha de dados sin recordarse abierta, la tarjeta de la IA al lado de los dados, la tele siempre
  oscura, pestañas legibles, el historial en palabras, las criaturas del compendio calculadas, la Papelera alineada,
  Plantillas/Sistemas/Etiquetas con el esqueleto común, el móvil de la jugadora (el «?» arriba, menú con enlaces,
  hoja de dados como ventana, toques de 44 px). Normas nuevas en `docs/diseno.md`.
- **Pruebas** (Enrique: «ponlas al día»): las e2e al día y `pnpm e2e` en verde (116 + 12 de fugas + 18 de
  accesibilidad; G11 hecho); destaparon tres fallos, ya arreglados (la confirmación de «Nuevo enlace» recortada por
  su caja, ahora en un portal: `components/floating.tsx`; el campo de páginas que saltaba al pulsar debajo; dos
  nombres accesibles). `pnpm test`: 17 de 18 en verde; la de `systems` solo falla en `ritmo.test.ts` (tiempos de 20 ms)
  cuando corren todos los paquetes a la vez con el servidor de desarrollo encendido; sola pasa siempre. **Falta** el PR (con esta rama) y la CI una vez: cuando Enrique lo diga.
  Sigue G1. Las tandas largas, lanzadas con `setsid nohup` (la sesión se cortó dos veces y las paraba).

### Para retomar (2026-11-08, tarde: revisión global de la interfaz, arreglada en local)

- **Hecho** (rama `docs/tras-modulo-6`, sin PR; Enrique dijo «vamos»): la revisión de todas las pantallas y casi todos
  sus arreglos, en commits pequeños; la lista y su estado, en `tasks/revision-interfaz.md`, y en la página «Revisión de
  la interfaz» (https://claude.ai/artifact/GfPUrKjx5L2MbQbPYjbJv6) con capturas de antes y después. Lo gordo:
  - Todas las pantallas comparten un esqueleto (`components/screen.tsx`): el título siempre en el mismo sitio. Con
    sesión, toda vista va a lo ancho (`routes/root.tsx`).
  - La página que lee la jugadora, como la del mundo.
  - Los dados, en un botón flotante con forma de d20 (norma nueva de Enrique).
  - Arreglados los fallos: el máster veía secretos como revelados, la jugadora en la Mesa, 500 con SQL, tiradas al
    imprimir y el límite de peticiones que sacaba a «Entrar».
  - Accesibilidad: teclado, foco, contraste y zonas de toque.
- **Decidido por Enrique hoy**: el móvil solo para la vista de la jugadora; los dados, en el d20 flotante. Las dos, en
  `docs/diseno.md`.
- **Respondidas por Enrique** (F1–F5, G10, ya hechas): la jugadora ve a sus aliados en la campaña; el retrato,
  arriba del panel; fuera `/ia`, el móvil del máster y «Foundry» en la interfaz; las peticiones de la IA, rehechas
  como tarjetas sueltas. **Queda** G1 (mover archivos con teclado): propuesta, por ahora no.
- **Pruebas**: las unitarias de lo tocado, al día y en verde (la web entera: 681). **Faltan**: poner al día las e2e
  (lista en `tasks/revision-interfaz.md` § «Pruebas por poner al día»), ampliar `a11y.spec.ts` (G11), `pnpm test`
  entero y `pnpm e2e`; luego el PR (con esta rama) y la CI una vez. Solo cuando Enrique lo diga.
- **El entorno de la revisión** (para volver a capturar):
  - `node e2e/.revision/servidor.ts` (API en 8132, base `crisol_revision`; `REVISION_NUEVA=1` la rehace y luego
    `node e2e/.revision/sembrar.ts`).
  - Vite en 5174: `npx vite --config .revision/vite.config.ts` desde `apps/web`.
  - `node e2e/.revision/capturar.ts [filtro]` deja las capturas en `out/revision/`; las de antes de arreglar, en
    `out/revision/antes/`.
  - Esos archivos no van a git (`.git/info/exclude`). Las cuentas, en `tasks/revision-interfaz.md`.
- **Después**: que Enrique pruebe los módulos 5 y 6; luego, el módulo 7 (la sala de jugadores), empezando por su
  entrevista.

### Para retomar (2026-11-07, noche: módulo 6 en `main` y en staging)

- **PR #114, fusionado y desplegado en staging** (2026-11-07; migraciones hasta la 0062). El ciclo entero: entrevista (abajo, § «### 6.
  Mesa»), estudios, el mapa `docs/specs/modulo-6.md`, el ADR-0018 (propuesta), el lienzo «Crisol: la mesa»
  (https://claude.ai/artifact/N28X9vvVaqwXGUTKdZzDph) y las seis capacidades (`escenas`, `fichas`, `vision`, `combate`,
  `herramientas-mesa`, `escenas-foundry`), construidas de punta a punta; lo hecho y lo que queda de cada una, en su
  spec § «Construido». Qué probar: `tasks/probar.md` § «Módulo 6».
- **La revisión** (`tasks/revision-modulo-6.md`): las cuatro fugas graves y los seis «hay que arreglar», hechos con su
  prueba; la e2e `fugas.spec.ts` comprueba de punta a punta que la tele no recibe muros, la puerta secreta, fichas
  ocultas, marcas del máster ni teselas sin ver, y que un jugador no entra en la mesa. Quedan dos menores apuntados.
- **Todo en verde en local** antes de la CI (con `pnpm test:coverage --concurrency=3`; con todo a la vez, la sala
  limpia y «en escenas al azar» de `vision.test.ts` se pasan de 5 s por la carga). Cobertura de lo cambiado: 80,8 %
  (justo). El rendimiento: al soltar una ficha, p50 ~33 ms y p95 50–60 ms con la máquina libre; seis fichas por 30
  casillas, p95 108–158 ms con la máquina muy cargada (casi todo es guardar el movimiento): si falla en la CI, se
  optimiza `moveTokens`, no se toca el umbral.
- **La CI** pasó a la tercera: (1) la prueba de escenas al azar de la visión pasaba de 5 s con cobertura; al partirla
  salió un fallo real (faltaba el vértice donde un muro cruza el borde del radio), arreglado; (2) la e2e de herramientas
  se colgó 5 min en `networkidle` (no se reprodujo en local): las e2e de la mesa usan ahora `watchNetwork` de
  `e2e/tests/ayudas.ts`, que dice qué petición no acaba; (3) el trabajo de e2e ya no cabía en 20 min (tarda ~25): topes
  de 30 (e2e) y 25 (calidad) en `ci.yml`. Si vuelve a colgarse una e2e de la mesa, el error dice qué petición es.
- **Esta rama `docs/tras-modulo-6`** (sin PR) solo lleva esta nota y el «en staging» de `tasks/probar.md`: que vaya con
  el próximo PR.
- **Ojo con las e2e**: comparten servidor y base de datos; dos agentes corriéndolas a la vez se pisan.
- **Por decidir con Enrique**: confirmar el ADR-0018 y las decisiones tomadas sin él (un encuadre es centro y escala
  para una pantalla de referencia de 1920 px; «Subir» un mapa no lo guarda en Archivos; en combate, la ronda 0 es
  «antes de empezar» y la iniciativa escrita a uno de un grupo vale para todo el grupo; «Sentidos» en el creador del 5e
  de ejemplo; las criaturas preparadas de una escena de Foundry salen solas al abrirla una campaña; volver a una
  instantánea no toca lo explorado; cada spec lista las suyas).
- **Decidido por Enrique (2026-11-08)**: el máster de una campaña es siempre máster de su mundo. Ya se cumple (solo el
  máster del mundo crea campañas, `campaign.create`, y queda como su máster; ese papel no se traspasa), así que la mesa
  no necesita un caso aparte.
- **Lo siguiente (decidido por Enrique el 2026-11-08)**: parar y hacer una **revisión global de la interfaz** en un chat
  nuevo, antes del módulo 7. Cómo: recorrer todas las pantallas en el servidor de desarrollo (máster, jugadora, tele y
  móvil) con capturas; contrastarlas con `docs/diseno.md`, los lienzos aprobados y la skill `web-design-guidelines`;
  sacar una lista de hallazgos por gravedad (incoherencias entre módulos, estados vacíos y de error, textos, móvil,
  accesibilidad) y repasarla con Enrique antes de arreglar. Se pule en local para que lo vea al momento; pruebas, CI y
  despliegue solo al final, en un PR que lleve también esta rama.
- **Después**: que Enrique pruebe los módulos 5 y 6; luego, el módulo 7 (la sala de jugadores: presencia, chat, mostrar a jugadores,
  sonido; y lo que se dejó: que muevan sus fichas), empezando por su entrevista frente al inventario.

### Para retomar (2026-11-07: módulo 5 en `main` y en staging)

- **PR #112, fusionado y desplegado en staging** (2026-11-07; migraciones hasta la 0054). Las cinco capacidades del
  módulo 5 (`conocimiento`, `revelar`, `mapas-jugadores`, `compendio-jugadores`, `pagina-de-jugadores`): lo hecho y lo
  que queda de cada una, en su spec § «Construido»; el estado, en `docs/specs/modulo-5.md`. Qué probar:
  `tasks/probar.md` § «Módulo 5».
- **La CI** pasó a la cuarta: gitleaks tomaba por secreto una lista de claves del 5e (excepción estrecha en
  `.gitleaks.toml`) y dos e2e tenían carreras (`campanas.spec.ts` y el menú del bloque en `bloques.spec.ts`), ya
  arregladas. Las e2e de la CI no reintentan: si salen más pruebas intermitentes, hablarlo con Enrique antes de tocar
  nada (sería cambiar el listón).
- **El rendimiento de lo que lee un jugador** se mide solo (`pnpm --filter @crisol/server test:rendimiento`, su paso
  en la CI). Sola: p95 252 ms con 5.000 páginas.
- **Lo siguiente**: que Enrique pruebe el módulo 5 y confirme el ADR-0017 y las decisiones tomadas sin él (memoria
  `modulo-5`); luego, el módulo 6 (la mesa), empezando por su entrevista frente al inventario.
- Queda de la revisión de `revelar` (menor): «Cambiar a quién» desde «Lo que sabe el grupo», que el desplegable parta
  de la campaña que se mira, que los avisos se vayan al ocultar o deshacer, el número de novedades en el móvil.
- Una prueba de la web, `apps/web/src/wiki/sheet/paged.test.tsx` («las páginas se escalan…»), falló una vez en la
  suite entera y pasa sola: mirarla si vuelve.

### Para retomar (2026-11-06, noche: módulo 5 en marcha, `conocimiento` construido)

- **Rama `modulo-5/visibilidad`** (sin PR aún; sale de `modulo-4/cierre`, con sus commits de documentación).
- **Hecho del ciclo**: la entrevista (abajo, § «### 5. Visibilidad por campaña»); los estudios
  (`research/foundry/visibilidad-y-revelar.md` y `research/{legendkeeper,worldanvil,kanka}/visibilidad.md`); el mapa
  `docs/specs/modulo-5.md` con cinco capacidades (`conocimiento`, `revelar`, `mapas-jugadores`, `compendio-jugadores`,
  `pagina-de-jugadores`) y sus specs; el ADR-0017 (propuesta); el lienzo «Crisol: lo que ven los jugadores»
  (https://claude.ai/artifact/CGqGeV5o6R7gtkrR4zBLKf; fuentes en `out/lienzo-jugadores/`), mandado a Enrique con
  fotos, sin respuesta aún.
- **`conocimiento`, construido** (`tasks/plan.md`, `tasks/todo.md`; lo hecho, en `docs/specs/conocimiento.md` §
  «Construido»): el motor, la tabla (0051, ya en la base de desarrollo), `page.view` y la proyección, todas las vías de
  lectura y el tiempo real filtrados, la web del jugador y del máster, la IA (también la del jugador, que solo lee), la
  e2e `conocimiento.spec.ts`, las fugas al día y el rendimiento (p95 199 ms con 5.000 páginas). Revisión de código en
  marcha. Qué probar: `tasks/probar.md` § «Módulo 5».
- **Lo siguiente**: los arreglos de la revisión y `revelar` (plan en borrador en el scratchpad; se pasa a
  `tasks/plan.md`).
- Decisión cambiada tras los estudios: un enlace a lo oculto sale como uno sin resolver, con lo que se escribió (no
  «desconocido», ni el título de ahora); con texto propio, solo ese texto.
- La e2e sirve la web compilada: `pnpm --filter @crisol/web build` antes de correrla tras cambiar la web.

### Para retomar (2026-11-06, módulo 4 terminado y en staging; lo siguiente, el módulo 5)

- **Rama `modulo-4/compendio`** (sin PR aún). Entrevista con Enrique (abajo, § «### 4. Compendio, criaturas y
  biblioteca»); estudios `research/foundry/criaturas-y-capas.md` y `research/dndbeyond/criaturas-y-grupo.md`; el mapa
  `docs/specs/modulo-4.md` (con la medida del modelo de embeddings) y las specs de las seis capacidades; el lienzo
  «Crisol: compendio y criaturas» (https://claude.ai/artifact/DwT92fPMmt25Dd8XyhmHqy; fuentes en `out/lienzo-compendio/`),
  mandado a Enrique con fotos, sin respuesta aún.
- **`compendio-mundo`, construido y revisado** (`tasks/compendio-mundo/`): `world_content` (migración 0043), la unión
  de capas (`apps/server/src/actions/layers.ts`), copiar entre capas y el aviso del original con su huella, la web y la
  IA. Arreglado lo de la revisión (sobre todo: un jugador no añade a su personaje lo del mundo por su clave).
- **`criaturas`, construido** (`tasks/plan.md`, `tasks/todo.md`, las 9 tareas): el formato (`types[t].sheet`, `roll`,
  `damage`; anotado en `docs/specs/sistemas.md`), el motor (`packages/systems/src/creatures.ts`, `playedSheet`),
  `campaign_creatures` (migración 0044), las acciones (`apps/server/src/actions/creatures.ts`, con `applyRoll`), la web
  («Poner en juego», «En juego», la hoja genérica, «Aplicar» en el registro), la IA y el enlace `[[@Nombre]]` desde la
  wiki. E2E `criaturas.spec.ts` y sus fugas. Lo que queda, en `docs/specs/criaturas.md` § «Construido».
- **PR #110, en `main` y en staging** (2026-11-06; su CI pasó entera; migraciones hasta la 0044): `compendio-mundo` y
  `criaturas`. Enrique lo prueba con `tasks/probar.md` § «Módulo 4».
- **`imagenes`, construido** (rama `modulo-4/imagenes`, sin PR aún; `tasks/plan.md`, `tasks/todo.md`): `img` en el
  contenido y `system_images` (migración 0045, ya en la base de desarrollo); el mapa de arte y las licencias por los
  avisos del zip; `putSystemImages` y `/api/system-images`; el paso de las imágenes al traer de Foundry (el navegador
  saca del zip solo lo que hace falta, sin subirlo entero); verlas en el compendio y en «En juego». E2E
  `imagenes.spec.ts`. Queda: subir una imagen a una entrada propia desde su editor, la miniatura aparte (hoy la misma
  imagen, escalada) y la ficha redonda para la mesa (módulo 6). Planes en `tasks/imagenes/`.
- **`tablas-compendio`, construido** (rama `modulo-4/tablas`, sobre la de imágenes, sin PR aún; `tasks/plan.md`,
  `tasks/todo.md`): «Tabla» es un tipo de Crisol en todo sistema (`withTables`), con sus filas en `table` (migración
  0046, ya en la base de desarrollo); `rollContentTable` sin orden la tira con el motor de la wiki (`pickRows`: como en
  Foundry, salen todas las filas que abarcan el total), anidada hasta 5 niveles, y lo sacado va por campaña
  (`content_table_draws`, `resetContentTable`); los RollTable de Foundry llegan con sus filas (dnd5e real: 97 tablas,
  906 filas, sin errores ni avisos); la vista y el editor de filas en el compendio; la IA
  (`reiniciar_tabla_compendio`, `table` en `guardar_contenido`). E2E `tablas-compendio.spec.ts`. Las tablas de un
  sistema ya importado pasan a filas al volver a importarlo. Planes en `tasks/tablas-compendio/`.
- **`grupo`, construido** (rama `modulo-4/grupo`, sobre la de tablas, sin PR aún; `tasks/plan.md`, `tasks/todo.md`):
  `party` en el formato (o deducido), el motor (`packages/systems/src/party.ts`), `campaign_party` (migración 0047, con
  historial), las acciones (mover en una sola operación con el personaje y su resumen), la IA (`ver_grupo`,
  `cambiar_grupo`, `mover_en_grupo`, `monedas_grupo`), «Grupo» en la barra de la campaña y «Mío | Del grupo» en la hoja.
  E2E `grupo.spec.ts`. Planes en `tasks/grupo/`.
- **`biblioteca`, construido** (rama `modulo-4/biblioteca`, sobre la del grupo; `tasks/plan.md`, `tasks/todo.md`;
  ADR-0016 con el permiso de Enrique): el texto de los PDF con pdf.js en segundo plano (`file_texts`, `file_pages`,
  migración 0048), buscar en los libros y el visor en la página marcada («Biblioteca» en la barra de la campaña), y la
  búsqueda por significado: Postgres propio con pgvector (`docker/postgres`; `search_chunks`, migración 0049; el de
  desarrollo ya va con él), `multilingual-e5-small` en un hilo aparte (en desarrollo, en `datos-locales/modelos/`), la
  mezcla por rango y «También en las páginas». La imagen de la app pasa a Debian (el modelo nativo no carga en Alpine)
  con 1 GB. Cada servidor, su espacio de colas (`QUEUE_PREFIX`). E2E `biblioteca.spec.ts`.
- **PR #111, en `main` y en staging** (2026-11-06; su CI pasó entera): imágenes, tablas, grupo y biblioteca, con
  Postgres propio con pgvector (0.8.1), la app en Debian con el modelo y 1 GB, y las migraciones 0045 a 0050. Al
  arrancar, staging se puso a leer sus PDF y a calcular los vectores de la wiki. Planes en `tasks/<capacidad>/`.
- **Lo siguiente: el módulo 5.** Enrique probará todo cuando la app esté terminada (`tasks/probar.md`; del módulo 4,
  sobre todo la calidad de la búsqueda por significado con libros de verdad y «Descargar PDF» con el Chromium de
  Debian): no se espera a sus pruebas para seguir.
- Ojo: la API de desarrollo (`node --watch`) no siempre se recarga al añadir archivos; `touch apps/server/src/main.ts`.

### Antes (2026-11-06, módulo 3 terminado)

- **Crisol vacío (ADR-0015, PR #108)**: de serie solo «En blanco». El 5e con el SRD pasa a `packages/systems/src/examples/`
  (fixture de las pruebas; su archivo, con `pnpm sistema-5e`); las pruebas del servidor y las e2e lo importan. Lo que
  usaba el 5e de serie pasa a una copia en su cuenta con `pnpm crisol sistema-5e` (corrido en staging el 2026-11-06:
  una campaña).
- **Traer de Foundry (PR #108)**: en «Sistema nuevo», el .zip de un sistema o módulo de Foundry; se eligen sus
  compendios y el idioma de sus textos, se sube solo lo necesario (`apps/web/src/systems/foundry-zip.ts`) y el
  servidor lo convierte (`importFoundry`, `inspectFoundry`; lectura LevelDB/NeDB en `apps/server/src/foundry/`,
  conversión en `packages/systems/src/foundry/`, prueba con el dnd5e real: `node scripts/foundry/probar.ts`). Con los 8
  compendios de 2024 del dnd5e: 2.121 documentos, valida. **Pendiente**: la mecánica de dnd5e en lo importado (hoy van
  sus tiradas en el texto), los nombres de los campos (salen de su ruta: «Activation type») y el idioma de los tipos.
  **Aprovechar el resto del zip** (Enrique, 2026-11-06), hoy se descarta al subir: las imágenes de cada documento
  (`img` de objetos, conjuros y criaturas; retratos y fichas) van con el módulo 4; las escenas, los mapas, los tokens y
  los sonidos, con el 6 y el 7; el aspecto del sistema (colores, fuentes y fondos de su CSS, como tema de su hoja y su
  compendio), con la interfaz. **A tener en cuenta**:
  - Su CSS y su código no se reutilizan tal cual: van con sus plantillas de Foundry (Handlebars) y su JavaScript. Se
    saca de ellos lo que sirve (la paleta, las fuentes, las texturas) y se aplica a nuestra hoja por bloques.
  - Hoy `apps/web/src/systems/foundry-zip.ts` (`slimZip`) quita todo lo que no es manifiesto, idiomas o compendios, y
    `importFoundry` admite como mucho 30 MB (`FOUNDRY_ZIP_BYTES`). Para traer imágenes y escenas hará falta subir el zip
    entero (el dnd5e pesa 137 MB) por la subida de archivos (hasta 250 MB) y convertirlo desde ahí, en segundo plano.
  - Las rutas de las imágenes en los documentos (`img`, `systems/dnd5e/icons/…`) apuntan dentro del zip o a lo que
    trae Foundry de serie (`icons/…`, que no viene en el zip): estas últimas no se pueden traer.
  - La licencia de cada recurso: el código de dnd5e es MIT, pero sus imágenes y las de los módulos pueden tener otra
    (las de pago, solo para uso privado, ADR-0014); cada una, con su entrada en `docs/terceros.md`.
- **Cambiar el compendio en la app (PR #108)**: «Nueva entrada», «Editar» y «Borrar» en el compendio de la campaña,
  para el propietario de un sistema de la cuenta (`getCampaignCompendium.editable`; `entry-editor.tsx`).
- **El creador pregunta antes de quitar una clase (PR #107)**, como D&D Beyond.
- La IA hace sistemas enteros (hoja, creador, compendio): lo dicen las instrucciones del MCP; prueba en `tasks/probar.md`.

### Antes (2026-11-05)

- **`hoja`, en `main` y en staging (PR #102)**: lo de la partida (`packages/systems/src/play.ts`: solo lo marcado con
  `play` y los recursos, validado), la hoja por bloques en el formato (`sheet.ts`; la del 5e con inspiración,
  cansancio, salvaciones contra muerte y estados), tirar por un personaje (`rollForCharacter`, con ventaja y quién la
  ve), daño, usos y descansos en el servidor (`playCharacter`; el corto llena la magia de pacto), la ficha
  (`apps/web/src/characters/play-sheet.tsx`; los cambios parten de lo último guardado, así los clics seguidos se
  suman) y la IA (`tirar_por_personaje`, `partida_personaje`). Qué probar: `tasks/probar.md` § la hoja en partida.
- **Los dados para otros juegos, en `main` y en staging (PR #103, con la pasada de la CI del módulo)**:
  `dados(@competencia, 8)`, `@dados` en las franjas (`@dados[0] > @dados[1]`, `count(@dados, 6)`), listas por posición
  y modos que suman dados (`add: "1d6"`); en `docs/specs/sistemas.md` § tiradas. Probado con un juego propio en
  `packages/systems/src/otros-juegos.test.ts`; la prueba con la IA (un Daggerheart), en `tasks/probar.md`.
- **Uso privado (ADR-0014, 2026-11-05)**: el abogado de Enrique da el visto bueno y, de momento, Crisol es para él y
  sus jugadores; se puede usar código y datos de Foundry, dnd5e y D&D Beyond, con su origen en `docs/terceros.md`.
- **El compendio, como el de Foundry (PR #105)**: estudio en `research/foundry/compendio.md`; la biblioteca por
  edición, secciones y carpetas (`compendium` en el formato del sistema, `browseCampaignContent`), «En juego» con la
  mecánica en palabras (`mechanicsText`) y lo abierto en la dirección. Con él, el resto del pulido (el foco del
  creador, «Ficha | Creador» en la dirección, el borrador de una tabla). 
- **El contenido, cruzado con dnd5e (PR #106)** (Enrique, «me parece bien»: los textos, de los PDF; la mecánica, de
  dnd5e donde es mejor). `scripts/srd/dnd5e-exportar.ts` copia sus compendios a `datos-locales/dnd5e/` (fuera de git) y
  `comparar-dnd5e.ts` cruza nuestras criaturas con las suyas. Arreglado el extractor de criaturas (de 473 a 615 de 647
  iguales; de 131 etiquetas sin traducir a 26) y traída de dnd5e la mecánica de los objetos mágicos que el texto no da
  (de 15 a 157 con acciones). Del SRD no falta nada: lo que dnd5e tiene de más son variantes, invocaciones, personajes
  de ejemplo y algo que no es del SRD. 
- **Filtros y tablas que se tiran (PR #107)**: en la biblioteca del compendio, «Filtrar» en cada tipo
  (`compendium.types[tipo].filters`: los conjuros por escuela, clases, concentración y ritual; las criaturas por VD y
  tamaño; los objetos mágicos por rareza y sintonía; las armas por propiedades y maestría). Las tablas de dado del
  texto de un documento (la Bolsa de trucos, Confusión, las Fichas de pluma: 58) se tiran en la campaña desde el
  compendio (`rollContentTable`, MCP `tirar_tabla_compendio`) y lo que sale queda marcado. Arreglado el ritual de los
  conjuros de 2024. **Lo siguiente**: lo que queda de las criaturas (20 acciones, 26 etiquetas) y ampliar el formato
  de la mecánica (estados que imponen los conjuros, conjuros dentro de un perfil), con un ADR:
  `research/foundry/compendio.md` § propuestas. Pendiente de Enrique: si quitar una clase en el creador pregunta antes.
- **La CI del módulo 3 pasó entera en la PR #103** (calidad, seguridad, secretos, e2e y accesibilidad).
- **El pulido del módulo 3, primera tanda (PR #104)**: revisada su interfaz con las pautas y `docs/diseno.md`;
  hechos los tutoriales de cada vista (campaña, Personajes, el personaje, Compendio y Tabla), sin dobles clics, avisos
  de las tablas por i18n y lo demás de `tasks/todo.md` § Pulido del módulo 3; lo que queda está allí.
  **Lo siguiente**: que Enrique pruebe el módulo 3 (`tasks/probar.md`) y pulir su interfaz con él, en local
  (memoria «Pulir en local»); después, el módulo 4 en un chat nuevo. `foundry` espera al abogado.
- **`personajes`** (lo que fue la rama `modulo-3/personajes`). Hechos la entrevista, el estudio
  (`research/foundry/avances-y-tablas.md`), la spec aprobada (`docs/specs/personajes.md`) y su ADR-0013. **Prototipos
  publicados** en el lienzo «Crisol: personajes» de claude.ai (https://claude.ai/artifact/Hx1Hmo1feqo5iAu7MdQEpp;
  fuentes en `out/lienzo-personajes/`): la vista propia de la campaña con su barra y sus personajes, el creador (clase y
  subir de nivel, multiclase, características, elegir lo pendiente), las versiones, el compendio, las tablas aleatorias
  y el móvil. Enrique: «termina el módulo 3 de una vez» (2026-11-05) y «muy bien» a las fotos del compendio. Plan en
  `tasks/plan.md`, tareas en `tasks/todo.md`. **Hecha la fase 1** (tareas 1–3): la campaña en su propia vista (la
  barra cambia al entrar: su inicio, Compendio y Dados; la llama vuelve a Mis mundos) y su compendio (acciones
  `getCampaignCompendium`, `searchCampaignContent` y `getCampaignContent`, que lee cualquiera de la campaña; e2e
  `compendio.spec.ts`). Hechas también la tarea 4 (tablas `characters` y `character_versions`, migración 0041, y sus
  acciones con permisos: cada uno los suyos, el máster todos) y el motor (tarea 8: `packages/systems/src/builder.ts`,
  `buildCharacter`, `stepOptions`, `summarize` y `characterView`; los pasos del 5e en `examples/5e/system.ts`,
  `creation`, y `card` para la tarjeta). El servidor monta el estado del personaje y lo devuelve en `getCharacter` y
  `updateCharacter` (sin bajar el contenido al navegador). **Hechas las pantallas** (tareas 5, 6 y 11–13:
  `apps/web/src/characters/`: la lista, la página con «Ficha | Creador», el creador por pasos con el panel de
  elecciones, las características con sus cuatro métodos, la ficha mínima genérica y las versiones; e2e
  `personajes.spec.ts`). Hechos también: el 5e para el creador (requisitos de multiclase, mejora de característica,
  aumentos de los trasfondos de 2024; contenido regenerado), validar los pasos, las tablas aleatorias (pestaña
  «Tabla», migración 0042, `tablas.spec.ts`) y las herramientas MCP (`elegir_personaje`, `tirar_en_tabla`…).
  **Queda para después** (anotado): los PG tirados al subir (van por la media), el equipo inicial como paso, los
  conjuros conocidos o preparados en el creador y las tablas del SRD (los rasgos del acólito de 2014). **Lo
  siguiente**: el cierre de `personajes` (batería, revisión, PR y staging) y después `hoja`.
- **Sin editor de sistemas: PR #99, en `main` y en staging** (la CI del PR se canceló, todo verde en local). Ver más
  abajo, en el módulo 3; qué probar, en `tasks/probar.md` (punto de control 3 de `sistemas`).
- Servidor de desarrollo en marcha para Enrique: web en `localhost:5173`, API en `8130` (las dos se recargan solas).

### Para retomar (2026-11-05, módulo 3: `srd-5e` terminado, en `main` y en staging)

- **`srd-5e` terminado: PR #98, en `main` y en staging** (la CI pasó, con un arreglo de gitleaks). Hechas las tareas
  11 a 21 de `tasks/todo.md`:
  todo el contenido de los dos SRD (3170 documentos: estados, reglas, conjuros, objetos mágicos, criaturas, especies,
  trasfondos, dotes y las 12 clases, con su mecánica) y los personajes de referencia (96 contra las tablas del SRD y
  24 hechos a mano). Los scripts, en `scripts/srd/` (`node scripts/srd/extraer.ts` y `comprobar.ts`, con los PDF de
  `datos-locales/srd/`). Revisión de código hecha, con lo importante arreglado. **Pendiente de Enrique**: el punto de
  control 4 (`tasks/muestra-srd-5e.md`) y la prueba final en staging desde claude.ai (`tasks/probar.md`). **Lo
  siguiente**: `personajes` (el creador), que empieza por su entrevista (`interview-me`) con Enrique; lo que concede
  cada cosa por nivel ya va en los `grants` del contenido y `examples/5e/referencia.ts` monta un personaje como lo hará
  él.
- **Importar de Foundry (Enrique, 2026-11-05)**: «el importador debería coger eso [el compendio del zip del
  manifiesto del sistema]; si no, es trabajo extra cada vez que se añade un sistema». Va a la capacidad `foundry`
  (`docs/specs/modulo-3.md`: importar los datos de un sistema de Foundry filtrando por licencia, tras el abogado y su
  ADR). Para su entrevista: lo importa quien usa Crisol (no va en el repositorio); la licencia de cada paquete
  (código MIT no es contenido libre: el de pf2e es ORC/OGL, el de Daggerheart, su licencia de comunidad); los
  compendios de Foundry 11+ van en LevelDB (un lector, con su licencia comprobada); los textos y los valores se pueden
  traer igual para cualquier sistema, pero su automatización (los Active Effects de cada sistema) se traduce por
  sistema. El 5e de serie sale de los PDF por la sala limpia y por el texto oficial en español.
- Lo de antes de esta rama, abajo.

### Para retomar (2026-11-04, módulo 3: `srd-5e` en marcha, fase 1 hecha)

- **Ahora**: `sistemas` está terminado, en `main` y en staging (PR #96). **Lo siguiente es `srd-5e`** (el 5e de serie:
  un solo sistema con el SRD 5.1 y el 5.2 como fuentes que el máster activa en su campaña, en español y en inglés).
  Su ciclo empieza por la entrevista (`interview-me`) frente al inventario; antes de su spec, mirar si la editorial
  tiene una versión oficial en español con la misma licencia (`docs/specs/modulo-3.md`, punto 7). Pendiente de
  Enrique, sin bloquear: probar `sistemas` en staging (`tasks/probar.md`) y decidir si lo que la IA hace en copiloto y
  ven los jugadores pide aprobación (más abajo, «Queda para después»).
- **`srd-5e`, en marcha** (rama `modulo-3/srd-5e`): la entrevista, el estudio
  (`research/dndbeyond/contenido-5e-y-mecanica.md`), la spec (`docs/specs/srd-5e.md`) con el ADR-0012 y el diseño
  (fila 3 del lienzo «Crisol: sistemas»), aprobados. El plan, aprobado, en `tasks/plan.md` y `tasks/todo.md` (21
  tareas); el de `sistemas` pasó a `tasks/sistemas/`. Los cuatro PDF del SRD, en `datos-locales/srd/`.
- **Hecha la fase 1 (la mecánica) y su punto de control**, en el paquete puro (sin pasar aún por el servidor ni la web):
  el documento de contenido con su concepto, su mecánica y su página (`mechanics.ts`); los efectos al calcular, con su
  orden y su origen (`evaluate.ts`); los recursos, las tiradas por cada objeto y las acciones con su escalado
  (`actions.ts`); lo que se ve con las ediciones de la campaña y las referencias por concepto (`content.ts`, y
  `duplicates` en lo que elige la campaña); `@ajustes` en todas las fórmulas. Los casos difíciles, escritos a mano
  (`fixtures/dificiles.ts`), dan lo del SRD. Hechas también la tarea 5 (el 5e de serie en el catálogo, con
  `@portador`, los valores de cada elemento de un conjunto, `first()` y las listas con opciones) y la 6 (su contenido en
  `examples/5e/content/`, que solo lee el servidor; buscar y leer el contenido; copiar, bajar y subir con su mecánica,
  migración 0040, ya en la base de desarrollo). **Ahora**: la tarea 7 (`tasks/todo.md` dice lo hecho y lo que falta):
  hecha también: los scripts de `scripts/srd/` (`node scripts/srd/extraer.ts` y `comprobar.ts`, con los PDF), todo el
  equipo de las dos ediciones y el guerrero con el campeón (474 documentos). Hechas también la 9 (las ediciones en la
  campaña) y la 10 (la IA: buscar, leer, guardar y quitar el contenido con su mecánica, y probarlo). **Fases 1 y 2, en
  `main` y en staging** (PR #97, migración 0040; la CI pasó, con un arreglo de gitleaks: `.gitleaks.toml`). Enrique
  prueba el punto de control 2 (`tasks/probar.md`). **Lo siguiente**: la fase 3 en la misma rama (la tarea 11, los
  estados y el texto de las reglas; luego conjuros, objetos mágicos, criaturas, especies, trasfondos, dotes y clases).
- **Decidido por Enrique (2026-11-04): los sistemas se hacen con la IA** (`docs/diseno.md`). **Hecho (2026-11-05,
  PR #99, en `main` y en staging)**: fuera el editor de sistemas entero (también «Probar» y el enlace desde la campaña); en
  «Sistemas», la lista (cada uno abre su ventana: bajarlo, sus campañas y, si es tuyo, renombrarlo y borrarlo), subir
  de un archivo y bajar uno vacío, con el aviso de que los nuevos se hacen con la IA (también en las instrucciones del
  MCP).
  Por eso la tarea 8 de `srd-5e` («Probar» con el contenido) se quitó y probar el contenido va con la IA (tarea 10).
  Con el pulido del módulo 3, para otros juegos (Enrique, 2026-11-04: «¿se podrá adaptar a Daggerheart y otro TTRPG?»), lo que
  falta en los dados, que es general: el número de dados (o sus caras) sacado de un campo (`@competencia d8`, las
  reservas de Blades), leer cada dado de una tirada en sus franjas (Esperanza o Miedo: cuál de los dos d12 es mayor) y
  modos que añaden dados o grupos («el mayor de estos dos», la ventaja de +1d6). La prueba: una hoja de Daggerheart
  hecha por la IA. Su contenido no es CC BY (licencia de la comunidad de Darrington Press): traerlo de serie, solo si
  Enrique lo decide tras leer la licencia.
- **El servidor de desarrollo, en marcha** para que Enrique vea lo que se hace: la web en http://localhost:5173 (por
  túnel SSH: `ssh -L 5173:127.0.0.1:5173`), que pasa `/api` al servidor (8130); los dos se recargan solos.
- **El orden que pidió Enrique** (2026-11-04): terminar el módulo 3 en este mismo chat (`srd-5e`, `personajes`, `hoja`
  y `foundry`), después pulir la interfaz de todo lo del módulo 3 y, al acabar, el módulo 4 en un chat nuevo. Un chat
  cada vez: dos a la vez se pisarían la carpeta y las bases de datos de prueba.

- **`dados` está en `main` y en staging** (PR #95, migraciones 0037 y 0038): una sola pasada de la CI, en verde, y
  fusionada con `[skip ci]`. Enrique la prueba con `tasks/probar.md` (puntos de control 2 y 3, lo de las revisiones y
  el final), ya en staging.
- **La spec de `sistemas`, por aprobar**: `docs/specs/sistemas.md`, con el ADR-0011 (sistemas como datos, fórmulas
  propias calculadas en el servidor). Enrique respondió sus preguntas: el editor visual ya, un lenguaje de fórmulas
  nuevo con la forma de los de Foundry (`@des.mod`, los dados en la misma fórmula), la copia del catálogo no cambia
  sola y los pasos del creador van con `personajes` (cambiado también en el mapa del módulo). Lo que hace el Crisol actual con los sistemas,
  leído para ella, en `docs/inventario-sistemas.md`. Rama `modulo-3/sistemas`.
- **La spec está aprobada** («ok») y el ADR-0011, aceptado.
- **El diseño, aprobado** («ok»): el lienzo «Crisol: sistemas» en claude.ai (https://claude.ai/artifact/6pBhB7PhSaReB51W87vA8R;
  fuentes en `out/lienzo-sistemas`, fuera de git), con seis tableros: la lista, el editor con «Probar», el móvil, las
  tiradas, la campaña y los errores. Al diseñarlo se decidió que las claves del formato van en inglés y que los
  problemas se dicen por sus nombres («Personaje › Defensa › Fórmula»), con la ruta debajo.
- **El plan, aprobado** («ok»): `tasks/plan.md` y 13 tareas en `tasks/todo.md`, en cuatro fases (el paquete puro, el
  servidor, la interfaz y la IA), con lo arriesgado primero: el lenguaje de fórmulas y su ritmo. El plan de dados pasó
  a `tasks/dados/`.
- **Ahora**: `/build` tarea a tarea en la rama `modulo-3/sistemas`. Hechas las tareas 1 a 7:
  - el paquete puro `@crisol/systems`: el formato y su validación, el lenguaje de fórmulas, calcular un documento con su
    desglose y las tiradas del sistema;
  - el servidor: los sistemas de la cuenta (migración 0039; el documento en texto, que `jsonb` reordena las claves),
    bajar y subir con su contenido (rutas con más sitio que piden la sesión antes de leer), y la campaña con su sistema
    y sus críticos al tirar.

  Hechas también las tareas 8 a 12: «Sistemas» en Mis mundos, la elección en la campaña y el editor entero (General,
  los tipos con sus campos y sus fórmulas, «Probar» al lado, Tiradas, Dados, Fuentes, Ajustes de campaña y Avanzado,
  con el JSON validado al escribirlo y sus líneas marcadas). **Lo siguiente**: la tarea 13 (la IA y el cierre). Los
  puntos de control 3 y 4 ya se pueden probar en local (`tasks/probar.md`; la base de desarrollo tiene la migración
  0039). Queda para después: un editor visual para los subcampos de los conjuntos, grupos y listas de filas (hoy, en
  Avanzado).
- **Tarea 13, las herramientas de la IA, hechas**: `formato_sistemas` (la documentación del formato, que sale del
  esquema con dos ejemplos; también como recurso `crisol://sistemas/formato`), `listar_sistemas`, `ver_sistema`
  (entero o por partes), `crear_sistema`, `cambiar_sistema` (por rutas, todo o nada), `validar_sistema`,
  `probar_formula`, `probar_tirada` y `borrar_sistema`. Con un sistema de 2 MB por el MCP: validar ~0,3 s, crear y
  cambiar ~0,6 s.
- **Las revisiones (código, seguridad e interfaz), hechas y arregladas** lo importante:
  - seguridad: tres maneras de bloquear el servidor con una sola petición (la expansión de lo que se lleva, la
    sugerencia «¿Quizás…?» y copiar listas al calcular sin presupuesto), una expresión regular cuadrática, nombres
    heredados de JavaScript (`constructor`), `/mcp` leyendo 11 MB con un token falso, validar sin permiso, un máster
    viendo campañas de mundos ajenos, el tope de 50 con carreras y los jugadores recibiendo lo elegido del sistema;
  - código: fórmulas de un grupo o un conjunto dentro de un objeto con los campos equivocados, tiradas que validaban y
    no se podían tirar, «Probar» de la web distinto del servidor (ahora tira en el servidor con el borrador), el
    borrador que se perdía si otro cambiaba el sistema, claves repetidas que borraban otro campo;
  - interfaz: el título de la página, salir con cambios sin guardar pregunta, el recorrido del editor, los números y
    las opciones que se escriben tal cual, los problemas que no dependen del color, sin textos de ayuda fijos.
- **Queda para después** (apuntado, no bloquea):
  - (srd-5e, revisión) Deshacer la copia de un sistema con mucho contenido (el 5e: 3170 documentos) va fila a fila en
    `repos/undo.ts`: medirlo antes de producción y, si hace falta, por tandas como `insertMany`. Y en algún texto inglés
    se pierde el guion de una palabra partida a final de línea («selfexpression», «twohanded»).
  - **por decidir con Enrique**: lo que la IA hace en copiloto sin aprobación y ven los jugadores (tirar en público,
    cambiar el nombre o la descripción de la campaña) podría pedir aprobación, como «jugadores»: un sistema subido de
    fuera podría llevar instrucciones para la IA en sus textos;
  - la cola de aprobación guarda la entrada entera (un archivo de 10 MB): guardar un resumen;
  - ~~subir un archivo con miles de documentos los escribe uno a uno~~: hecho, por tandas (`insertMany`, PR #98);
  - la versión de la que sale una copia del catálogo es siempre 1 (hará falta con el 5e);
  - el editor visual de los subcampos de conjuntos, grupos y listas de filas, confirmar al quitar un tipo o una
    tirada, la barra de «Guardar» pegada a la vista, y la espera y el error al elegir el sistema de una campaña.
- **`sistemas` está en `main` y en staging** (PR #96, migración 0039; 2026-11-04). Dos pasadas de la CI: la
  primera falló por dos pruebas de axe que medían el contraste a medio fundido (en la CI, más lenta); ahora esperan a
  que acaben las animaciones (`settled` en `e2e/tests/ayudas.ts`). Fusionada con `[skip ci]`.
- **Lo siguiente**: que Enrique pruebe en staging (`tasks/probar.md`: puntos de control 3 y 4, y el final desde
  claude.ai) y decida lo de la IA en copiloto (arriba, «Queda para después»). Después, la siguiente capacidad del
  módulo 3 (`docs/specs/modulo-3.md`).
- **Ojo con el lint**: `biome check --write` arregla el formato pero los errores de lint se quedan; mirar siempre
  `pnpm lint` entero antes de guardar.
- **Prueba con un sistema de Foundry de verdad** (Enrique, 2026-11-04: «mete también […] daggerheart/2.12.5/system.json»):
  su manifiesto, bajado a la carpeta temporal (no al repositorio, por la sala limpia) y pasado por un script de prueba,
  cabe en el formato: sus 18 tipos de personaje y de objeto, y sus 13 paquetes de esos documentos. Para que cupieran,
  un paquete pasó a ser de una clase de documento (`document`) que mezcla tipos, como en Foundry. **Apuntado para
  `foundry`**:
  - sus claves en camelCase (`domainCard`) se pasan a las nuestras (`domain_card`);
  - sin sitio aún: los efectos activos (para nosotros, bonos), los subtipos de mensaje del chat (las tarjetas de las
    tiradas), el combate (módulo 6) y los paquetes de diario y de tablas (módulo 4);
  - el manifiesto no trae los campos de cada tipo (están en su código): para eso hay que leer sus modelos o sus datos.
- **Y con 60 sistemas de Foundry** (Enrique: «aquí tienes más para probar», de su lista de sistemas): los 50 de su
  primera página y 10 de los más usados (dnd5e, pf2e, swade, wfrp4e, CoC7, alienrpg, starwarsffg, cyberpunk-red-core,
  sfrpg y worldbuilding). Sus manifiestos, en la carpeta temporal y fuera del repositorio. **Caben los 60**, con dos
  arreglos al convertir: quitar los idiomas repetidos (pf2e los repite, un archivo por módulo) y no poner una
  descripción vacía. **Apuntado para `foundry`**:
  - 14 no declaran sus tipos en el manifiesto (los traen en `template.json`, como los de antes de la v11): el
    importador tiene que leer ese archivo también;
  - otras clases con subtipos, sin sitio aún: RegionBehavior (8), ActiveEffect (7), JournalEntryPage (7),
    ChatMessage (7), Combat (5), Combatant (2) y Card (2);
  - otros paquetes: de diario (55), de tablas (39), de macros (27: son código, nunca se importan), de efectos (9),
    de escenas (8), de aventuras (4) y de cartas (3);
  - idiomas: el formato solo trae español e inglés, y casi todos traen inglés; el alemán (35), el francés (26) y el
    portugués (20) van detrás. Si un día se importa uno que solo esté en otro idioma, se amplía. **Ritmo** (punto de control 1): un personaje de nivel 20 con 353 campos y 100 objetos, 5 ms de
  mediana (la spec pide menos de 20); validar un sistema de 1,85 MB, 71 ms (pide menos de 500).

### Para retomar (2026-11-04, módulo 3: dados)

- **El módulo 3 va por capacidades** (mapa aprobado en `docs/specs/modulo-3.md`): `dados` → `sistemas` → `srd-5e` →
  `personajes` → `hoja` → `foundry`. La entrevista entera y los estudios, en «### 3. Sistemas, fichas y dados», al
  final de este archivo.
- **`dados` está construida** en la rama `modulo-3/dados`: las 11 tareas de `tasks/dados/todo.md` (plan en `tasks/dados/plan.md`,
  spec `docs/specs/dados.md`, ADR-0010, diseño en el lienzo «Crisol: dados», aprobado):
  - el paquete puro `@crisol/dice` (la notación del Crisol actual, con sus límites);
  - las tiradas en el servidor, en `dice_rolls` (migración 0037, fuera del historial), con sus visibilidades, el aviso
    en vivo, el límite de 60 por minuto y `tryDice` (sin apuntar);
  - la ficha de dados (barra del mundo y campaña; en el móvil, hoja), su registro y el color de cada cuenta (0038);
  - los dados 3D (three y cannon-es, cargados aparte: la tirada se simula entera y se numera para que salga lo del
    servidor);
  - la tirada escrita en las páginas (`` `dice: 2d6+3 # Nombre` ``) y la IA (`tirar_dados`, `ver_tiradas`).
- **Ritmo**: tirar tarda 11 ms de mediana y 22 ms en el p95 en el servidor (20.000 tiradas en el registro). Por la API
  son unos 31 ms, casi todo lo de cualquier petición (la sesión y las pertenencias): **apuntado** para mirarlo en toda
  la app.
- **Las revisiones** (código y seguridad) están arregladas, cada cosa con su prueba:
  - «Repetir» no hace pública una tirada privada;
  - como mucho 500 dados por tirada, contando los que se repiten y los que explotan;
  - el límite por minuto, sin carreras (un cerrojo por persona); `tryDice`, con el suyo;
  - lo que se escribe en `` `dice: …` `` (comillas, «#», 50.000 espacios) no rompe nada;
  - los paréntesis no se pierden al guardar la fórmula;
  - las privadas no caen en la pantalla del máster ni se anuncian;
  - la física de los dados va en un worker (con 20 dados tardaba hasta 670 ms en la página);
  - la escena comparte formas y texturas, tiene un tope de 60 dados a la vista y lo suelta todo al cerrar la sesión.
- **Apuntado** de las revisiones, para cuando crezca:
  - cada aviso en vivo (también cada tirada) recorre a todas las personas conectadas y lee de la base las pertenencias
    de cada una para ver si le llega (así quitar a alguien es inmediato): con muchas mesas a la vez, apuntar a cada
    conexión en sus campañas y guardar las pertenencias hasta que cambien;
  - lo de cada petición (la sesión y las pertenencias, unos 20 ms) se podría guardar un momento en memoria.
- **Apuntado**: con toda la batería a la vez (`pnpm test:coverage`: ocho paquetes, cada uno con varios procesos, más
  Postgres, en los 6 núcleos del VPS), algunas pruebas de la web que tardan medio segundo pasan de los 3 s y fallan
  (el mapa, el canal en tiempo real). No es por los dados: prueba a prueba tardan lo mismo que en `main`. En local,
  `pnpm test:coverage --concurrency=3` pasa entera en 2 min 35 s.
- **Lo siguiente**: subir la tanda, pasar la CI una vez, fusionar y desplegar en staging; Enrique prueba los puntos de
  control de `tasks/probar.md` y los criterios de la spec. Después, la spec de `sistemas`.

### Para retomar (2026-11-04, noche: arreglos y módulo 3)

- **Lo que tiene que probar Enrique, en `tasks/probar.md`** («ve apuntando todas las cosas que tengo que probar»): el
  módulo 2 y lo que quedaba del 1, ya con los arreglos. Se mantiene al día: lo nuevo que haya que probar va ahí, y lo
  que diga, a su apartado «Lo que dijo».
- **El módulo 2 está en `main` y en staging** (PR #93; migraciones 0035 y 0036).
- **La tanda de arreglos, en la PR #94** (rama `tanda/arreglos-pruebas`): los puntos 1, 2, 3, 4, 6, 7 y 8 de «Lo que dijo
  Enrique al probar» (el 7, deshacer lo de la IA tras abrir la página, era el párrafo que el editor añadía al abrir:
  fuera el `trailingNode` de StarterKit; para seguir escribiendo está la línea de más), el aviso al borrar con los
  campos que apuntan a la página (lo pedía la spec del módulo 2) y los tres avisos de semgrep. Todo en verde en local.
- **El módulo 3 empezó**: la primera parte de la entrevista y los estudios de Foundry y D&D Beyond están en
  «### 3. Sistemas, fichas y dados», al final de este archivo. **Lo siguiente**: la segunda parte de la entrevista con
  sus 11 preguntas (la primera, si se sigue el orden del estudio de Foundry tras lo que dice de las licencias); después,
  la spec y el ADR de los sistemas y del aislamiento.
- **Apuntado**: el estudio de D&D Beyond abrió el perfil de Chromium de Enrique (`~/rea-workspace/chromium-ddb`) con una
  sonda propia por tubería, porque el permiso de abrir el puerto de depuración se denegó; el perfil quedó actualizado a
  Chromium 156. La prueba de la web `realtime.test.tsx` («se abre con la sesión…») falló una vez con todo a la vez por
  la carga; sola pasa.

### Para retomar (2026-11-03, módulo 2)

- **El módulo 2 (tipos de página y plantillas) está construido**: las 14 tareas de `tasks/plantillas/todo.md`, en la rama
  `modulo-2/campos` (PR #93). La spec es `docs/specs/plantillas.md`, el ADR-0009 y el diseño, el lienzo «Crisol:
  plantillas» (aprobados).
  - Campos con id y tipos nuevos (opciones, reloj, enlace a una sola página), con sus controles en el panel.
  - Seis plantillas de serie y las de la cuenta (`/plantillas` en Mis mundos, con su editor de campos, panel y texto).
  - «Desde plantilla» al crear una página o desde un enlace sin resolver; aplicar una plantilla a una página ya hecha.
  - Tablas que se llenan solas en el panel («Miembros», «Habitantes»…): p95 de 43 ms con 5.000 páginas.
  - MCP: `listar_plantillas`, `ver_plantilla`, `crear_plantilla`, `cambiar_plantilla`, `borrar_plantilla`; `crear_paginas`,
    `editar_pagina` y `buscar_paginas` con plantilla; `leer_pagina` con sus tablas.
  - Migraciones 0035 y 0036 (ya en la base de desarrollo).
- **La CI gasta cuota mensual** (Enrique, 2026-11-03): no se pasa en cada PR. Esta tanda sube junta y se pasa una vez;
  después, merge y staging.
- **Lo siguiente**: Enrique repasa en staging los criterios de éxito de la spec (también desde claude.ai, con la IA).
  Lo que diga, a `docs/diseno.md` si son normas de la interfaz.
- **Apuntado**: las pruebas de ritmo de la búsqueda (módulo 1) fallan a veces con todo a la vez en el VPS, por la carga;
  solas pasan. El ritmo de 50 páginas desde plantilla y el de las tablas, en la prueba de escala (`CRISOL_ESCALA=1`).

### Para retomar (2026-11-03, cierre de la interfaz)

- **La etapa de interfaz queda cerrada** («vamos a parar con la UI de momento, con lo que tenemos podremos diseñar los
  demás módulos»). Todo lo de las PR #88, #89, #90 y la prueba `interfaz/hoja-siempre` (que Enrique aprobó: «está
  quedando genial») va a `main` en una sola PR, con la CI de GitHub en verde. Lo hecho está en las entradas de abajo y en
  el historial de git; lo que falta de Everlore, en `tasks/everlore-pendiente.md`.
- **Cómo quedó la página**: toda página es una hoja; se escribe seguido y las páginas se calculan por detrás como al
  imprimir (una raya fina con «Página N»; el salto de página corta la página pero lo siguiente va justo debajo);
  columnas 1 o 2 desde «/» → Maquetación; pestañas de texto (otra página de texto con su documento) y de mapa, con color
  y menú (botón derecho); panel de bloques a la derecha; árbol con botón derecho y arrastre (a la izquierda, sale de su
  madre).
- **Lo siguiente** (en otra conversación): **el módulo 2** (tipos de página, plantillas, formularios y consultas) con
  su ciclo: `interview-me` frente al inventario, estudio con craft-anything, `/spec`… La mejora de la búsqueda (texto de los PDF y búsqueda
  por significado con pgvector) ya no va antes: Enrique la pasó al módulo 4, con la biblioteca (2026-11-03).
- **En staging** desde el 2026-11-03 (PR #91, migraciones 0029 a 0034).
- **Apuntado de las revisiones de esta tanda** (para cuando toque):
  - **Módulo 5 (jugadores)**: el servidor aún no aplica `hidden` (pestañas, pines): filtrar en `listPageTabs` y
    `getMap` y negar en `onAuthenticate` de colaboración los documentos de pestañas ocultas; pedir aprobación a la IA
    al revelar algo (`hidden` de true a false) y al vaciar el panel, no solo por el tipo de acción.
  - ~~La nota lateral, suelta en la hoja al escribir~~: hecho (2026-11-03), va con el bloque que la sigue, como al
    imprimir. Su alto se suma al del bloque (al imprimir flota a su lado): con notas largas, la marca «Página N» puede
    caer un poco antes que en el PDF.
  - ~~Ordenar A-Z con subpáginas en la papelera~~: hecho (2026-11-03), las de la papelera van detrás, cada una con su
    sitio.
  - La cobertura de lo cambiado (CONSTRAINTS.md, 80 %) bloquea desde el 2026-11-12.

### Para retomar (2026-11-03)

- **Ahora: traer Everlore a Crisol** (la app de Enrique al estilo de LegendKeeper). Propuesta aprobada («me vale así,
  ya iremos puliendo»): ADR-0007, pestañas dentro de las páginas de la wiki, por fases: 1) pestañas y mapa; 2) vista
  rápida y panel lateral con bloques; 3) línea temporal y calendarios; 4) pizarra y árbol familiar; 5) grafo.
- **Fase 1, primera tanda hecha** en la rama `mundo/pestanas-mapa` (sale de `interfaz/pulir-3`, PR #88 aún abierto):
  tablas `page_tabs`, `maps`, `map_pins` y `map_elements` (migración 0029, con historial); acciones y herramientas MCP
  (`ver_pestanas`, `crear_pestana`, `cambiar_pestana`, `borrar_pestana`, `ver_mapa`, `cambiar_mapa`, `poner_pin`,
  `cambiar_pin`, `quitar_pin`); la barra de pestañas y el visor (`apps/web/src/wiki/tabs/`, `apps/web/src/wiki/map/`)
  con pines, su panel, botón derecho y recorrido. Pruebas: `maps.integration.test.ts`, `map.test.ts` y
  `e2e/tests/mapas.spec.ts`.
- **Lo que falta de la fase 1**: dibujar en el mapa (regiones, rutas y textos: la tabla `map_elements` ya está),
  medir con la escala, el menú radial de Everlore, recolocar pestañas arrastrando y la marca de «oculto» en la
  interfaz (hoy solo por el MCP; servirá con los jugadores, módulo 5). Después, la fase 2.
- **Después, en `interfaz/barra-lateral`** (sale de `mundo/pestanas-mapa`; PR #90): campañas en Mis mundos (fuera de
  la barra); la barra de un mundo con su nombre y Archivos; sin la palabra «wiki»; **el mundo se abre en su portada**
  (como la Home de LegendKeeper: `worlds.home_page_id`, migración 0030, `getWorldHome` y `ensureWorldHome`); la página
  con **el esqueleto de Archivos** (columna central que llena el hueco entre las fichas, la ficha del árbol con buscador fijo a la izquierda y la del
  panel a la derecha, a la misma altura); y **el panel de la derecha con bloques** (fase 2 de Everlore, ADR-0008:
  `pages.panel`, migración 0031, `setPagePanel` y la herramienta `cambiar_panel`; `apps/web/src/wiki/panel-blocks.tsx`
  y `e2e/tests/panel.spec.ts`). Las normas, en `docs/diseno.md`.
- **Prueba en `interfaz/hoja-siempre`** (sale de PR #90; Enrique decide si se queda o se revierte): toda página es
  una hoja maquetada al escribir (una columna por defecto; el bloque «Una/Dos columnas» desde «/», grupo
  «Maquetación»), sin modo estricto de React (metía líneas vacías), **pestañas de texto** (`page_tabs.document_id` y
  documentos de tipo `tab`, migración 0032), pestañas que se recolocan y con botón secundario, y en el árbol
  **arrastrar a la izquierda saca la página de su madre** y lo movido se ve al instante. Falta, si la aprueba: pasarla
  a PR #90 y adaptar las e2e (botón «Hoja», índice, «La enlazan», versiones en el panel…).
- **También en la PR #90** (2026-11-02, tarde): «Página nueva» con cuadro de tipo, botón derecho en el árbol (con
  `sortPageChildren` y `ordenar_subpaginas`), menú «/» y «Convertir en» por desplegables, títulos del 1 al 6, línea de
  más bajo lo escrito, «Marcar» flotante, pestañas que se recolocan y propiedades como bloques del panel. Lo que aún
  falta de Everlore, en `tasks/everlore-pendiente.md`. Propuesta abierta: la hoja maquetada al escribir, sin texturas.
- **Pendiente que pidió Enrique**: Buscar y Marcadores como en Everlore, transiciones entre páginas de una vista
  (`tasks/interfaz.md`); de la fase 2 falta la vista rápida de las páginas enlazadas; plantillas, más adelante («ya
  las haremos»).
- Lo de antes sigue abajo (2026-10-30).

### Antes (2026-10-30)

- **El módulo 1 (wiki) está construido entero y en staging**: tareas 1 a 26, PR #52 a #70. Lo que hace cada tarea está
  en las entradas de abajo, del 2026-10-30.
- **Ahora mismo**: la **etapa de interfaz** tiene hecha la primera pasada entera: las 10 partes de
  `tasks/interfaz.md`, en staging (PR #77 a #84). Enrique: «cuando este lista la nueva UI ENTERA la revisaré e iremos
  puliendo». Va la **ronda de pulido 1**, pantalla a pantalla y en local. Su primera parte (armazón, cuentas, Mis
  mundos, archivos comunes con el ADR-0005, Inicio de un mundo y Campañas) está fusionada y en staging (PR #86). Se
  con la rama `interfaz/pulir-2` fusionada en `main` sin la CI de GitHub (2026-10-31: sin minutos y sin querer pagar; todo se prueba en local): el móvil (la llama y su menú), las etiquetas de la cuenta (ADR-0006) y los arreglos de Archivos de sus pruebas. Staging aún no lleva esta tanda (migración 0028). Después, en `interfaz/pulir-3`: **la wiki se edita en el sitio** (`docs/specs/wiki-edicion.md`), a falta de que Enrique la pruebe. Lo hecho y lo que falta están en `tasks/interfaz.md`, y sus normas en
  `docs/diseno.md`. GitHub Actions va justo de minutos: todo en verde en local antes de subir. Ya apuntado para pulir:
  - ~~la cola de la IA, en su propio panel~~ (hecho en la ronda 1: tarjetas flotantes);
  - marcar en la página lo que la IA quiere cambiar;
  - ~~menos botones en la barra del móvil~~ (hecho: huecos fijos y «Más»);
  - concretar qué ve mal de la hoja.

  Sus pruebas de los puntos 3 a 5 están en «Lo que dijo Enrique al probar». De ellas, los puntos 11 y 12 (la hoja) ya
  están arreglados, y el 7 (deshacer) tiene ya un aviso claro, pero falta reproducirlo con él. Le quedan por probar el
  punto 6 y el final.
- **Lo que tiene que probar**:
  1. **Punto 3**: el conector MCP de staging (`https://neo.crisol.144-91-122-245.sslip.io/mcp`) en claude.ai con su
     cuenta de propietario. Probar `crear_paginas` con secretos y `editar_pagina` sobre una página abierta.
  2. **Punto 4**: versiones, restaurar una y deshacer desde el historial.
  3. **Punto 5**: subir archivos, usarlos en páginas, abrir un PDF y buscar con erratas.
  4. **Punto 6**: el PDF de una hoja con statblock, nota lateral y tabla, e «Imprimir» en Chrome, Firefox y Safari.
  5. **Final**: los 10 criterios de éxito de `docs/specs/wiki.md`.
- **Decisiones pendientes de Enrique** (no se tocan sin su permiso):
  - Chromium para los PDF en un contenedor aparte, sin secretos y con sandbox (hoy va en el de la app, sin sandbox y
    con el entorno limpio);
  - una cuota de almacenamiento por organización (hoy no hay ninguna);
  - más memoria para la app (512 MB) si se sacan PDF grandes.
- **Para vigilar**: en la CI, en una máquina lenta, lo escrito nada más abrir una página quedó a veces delante del
  contenido. No se ha visto en local ni en staging; si pasa, mirar `editable` hasta `ready` en
  `apps/web/src/wiki/editor.tsx`.
- **El orden** (Enrique, 2026-10-30: «para seguir después de la edición de la UI»):
  1. la etapa de interfaz: primera pasada hecha (`tasks/interfaz.md`); falta la revisión de Enrique y pulir;
  2. arreglar el resto de lo que dijo de sus pruebas;
  3. cerrar el módulo 1 (que pruebe el punto 6 y el final; marcar sus puntos de control en `tasks/wiki/todo.md`);
  4. ~~antes del módulo 2, la búsqueda~~ → **pasada al módulo 4** (2026-11-03: «la mejora de búsqueda ponla donde
     corresponda para seguir con el módulo 2»). Lo que se decidió (pregunta de Enrique, 2026-10-30, con herramientas que propuso: qmd, basic-memory,
     probe, Meilisearch, pymupdf4llm). Primera respuesta: basic-memory y pymupdf4llm son AGPL (fuera); probe es para
     código; Meilisearch sería otro servicio y a esta escala basta Postgres; de qmd, la idea de buscar por significado,
     que se puede hacer en Postgres con pgvector. Propuesta: buscar dentro de los PDF (texto de cada página con pdf.js
     al subirlo, en la misma búsqueda, y el resultado abre el visor en esa página) y, si le compensa el coste de los
     embeddings, búsqueda por significado con pgvector. Los PDF escaneados (OCR) aparte;
     **Enrique lo aprobó**: «me gusta eso que dices de busqueda en PDF y que abra la pagina del pdf obviamente y lo
     de pgvector si ayuda también, quiero crear la mejor app». Antes de pgvector: pedirle permiso para cambiar la
     imagen de Postgres a `pgvector/pgvector` y elegir con él quién calcula los embeddings (un modelo propio en el
     servidor, gratis y privado pero con memoria; o una API, que cuesta y saca el texto fuera);
  5. empezar el módulo 2 con su ciclo (`interview-me` frente al inventario, estudio con craft-anything, spec…).
- **Lo que aún no tiene el módulo 1**, a propósito o para más adelante: importador (Eana se pasa por el MCP), los
  jugadores viendo la wiki (módulo 5), los datos de criatura del statblock (módulo 4), y la capa de texto del visor de
  PDF (hoy se lee con «Abrir aparte»).
- **La bitácora de la tirada**: `tasks/bitacora.md` (decisiones pequeñas, lecciones y lo que queda de cada tarea).

### Lo que dijo Enrique al probar

2026-10-30, en staging. Se arregla al volver de la etapa de interfaz, antes de cerrar el módulo.

**Punto 3 (Claude por el MCP)**: funciona. `crear_paginas` creó páginas anidadas con secretos, propiedades de todos los
tipos y enlaces entre ellas resueltos en la misma llamada. `editar_pagina` funcionó al añadir, por bloque y por sección,
y la búsqueda encuentra lo que está dentro de un secreto. Lo raro que vio Claude:

1. **El id de un secreto cambia al reemplazarlo por bloque** (`^s-6lkcs0i3` pasó a `^s-yy6zw8yy`). **Arreglar**: en el
   modo `block`, si lo nuevo es un solo bloque del mismo tipo, conserva el id del que reemplaza.
2. **La fecha de la página no cambia al escribir en el texto**: `updatedAt` y la versión de la fila solo cambian con
   los ajustes de la página. **Arreglar**: que la sesión de edición, o lo que escribe Claude, ponga al día `updated_at`
   de `pages`, sin subir `version` (`version` es la que mira deshacer).
3. **La búsqueda no dice en qué título está un secreto**: cada secreto es su documento y sus secciones no tienen
   título. **Arreglar**: dar a las secciones de un secreto el título de la sección del cuerpo donde está su bloque.
4. **Una nota oculta `%%…%%` de una línea vuelve en tres** al leerla. Es igual de válido, pero no es lo que se mandó.
   **Arreglar**: si la nota es un solo párrafo, escribirla en una línea.
5. **Aprobaciones**: crear y añadir terminaron enseguida, y las ediciones por bloque y por sección esperaron. Lo
   decide solo el modo de IA y el tipo de acción, y las cuatro son `editPage`, así que el modo cambió entre medias (a
   «asistente»). No es un fallo; si vuelve a pasar sin cambiar el modo, mirarlo.
6. **Un párrafo vacío al final de «Test»**, en una versión a nombre de Enrique (08:17:35), justo después de lo de
   Claude. Seguramente lo puso el editor al abrir. **Mirar** con el punto de «vigilar» de arriba (lo que escribe el
   editor al abrir).

**Puntos 3 y 4 (Enrique)**:

7. **Deshacer no funciona con las versiones** (las versiones se ven y salen en el historial). Hay que reproducirlo con
   él. Sospecha: el párrafo vacío del punto 6 crea una versión posterior a nombre suyo, y deshacer dice «alguien
   escribió después» y no toca nada (es lo que debe hacer si de verdad escribió alguien). **Arreglar**: que el editor
   no escriba nada solo al abrir; y que el mensaje del conflicto se vea claro.
8. **Buscar en la página no busca dentro de los secretos ni en los enlaces `[[…]]`**. Los secretos son otros editores
   y los enlaces son átomos sin texto. **Arreglar**: contar el texto que enseña cada enlace y buscar también en los
   editores de los secretos (cada uno resalta lo suyo; «n de m» suma los de todos).
9. **Exportar**: bien.

**Punto 5 (archivos y hoja)**:

10. **Los PDF de la pestaña de archivos se abren en otra pestaña del navegador** (es lo que hace «Abrir»). En una
    página se ven en el visor con «Ver aquí».
11. **En la hoja, dentro de la app, las notas laterales no quedan al lado del texto** (en la captura sale arriba, sola,
    y el texto de después no la rodea). Causa: cada bloque de la hoja va en su propia caja (`display: flow-root`, para
    medirlo), así que el texto de los bloques siguientes no rodea la nota. **Arreglar**: medir y pintar la nota lateral
    junto con el bloque siguiente, en la misma caja, para que lo rodee.
12. **Con la hoja al lado del editor, la página no cabe y se corta** (la hoja mide 794 px y el panel es más estrecho).
    **Arreglar**: escalar la hoja al ancho del panel (`zoom`), midiendo siempre a tamaño real.

**Punto 6 (PDF de una hoja e imprimir)** y **final**: pendientes de probar.

### Historia

- **2026-10-29 — Fase 0 hecha.**
  - Repo, normas (`CLAUDE.md`, `CONSTRAINTS.md`), inventario, ADR-0001 y skills de agent-skills en el proyecto.
  - REA arreglado (navegador).
  - Foundry 14.369 instalado para el REA (`research/foundry/entorno.md`).
- **2026-10-29 — Módulo 0 repasado, REA hecho, spec aprobada, plan escrito** (rama `fundacion/repaso-y-spec`).
  - Decisiones en «Decisiones por módulo» más abajo.
  - REA: `research/foundry/usuarios-y-permisos.md`, `research/foundry/sincronizacion-e-historial.md` y
    `research/dndbeyond/campanas-e-invitaciones.md`. Lo gordo: Foundry no proyecta nada por usuario (manda el mundo
    entero y oculta en la interfaz) y no tiene historial; D&D Beyond ata la pertenencia al personaje.
  - Spec `docs/specs/fundacion.md` **aprobada**; ADR-0002 (Better Auth solo para identidad; inquilinos e invitaciones
    en tablas propias); prueba de fugas añadida a `CONSTRAINTS.md`.
  - Plan aprobado: `tasks/fundacion/plan.md` y 25 tareas en `tasks/fundacion/todo.md` (archivados ahí al empezar el
    módulo 1).
- **2026-10-29 — Módulo 0 hecho: tareas 1 a 14 y 16 a 25** (PR #2 a #33). La 15 (Discord, Google y correo), pospuesta. Staging en
  https://neo.crisol.144-91-122-245.sslip.io (Compose `crisol-staging` en `~/crisol-staging`, puerto 8140; copia del
  Caddyfile en `/etc/caddy/Caddyfile.bak-20261029-104936-neo-crisol`). Desplegar tras cada merge:
  `scripts/desplegar-staging.sh` (con cerrojo).
  - Hecho: plataforma (1-5), cuentas con registro cerrado y arranque (6-8), núcleo de escritura con historial (9),
    mis mundos (10), conector MCP con OAuth 2.1 + CIMD y `listar_mundos` (11), campañas (12), enlace de invitación
    (13; el secreto se guarda cifrado además del hash para poder verlo siempre, decidido con Enrique) y unirse con
    el enlace (14; crear la cuenta une en la misma petición).
  - Miembros (16): verlos, expulsar (con «Expulsar y cambiar el enlace», porque el viejo aún le valdría) y dejar la
    campaña. Si a alguien no le queda nada en la organización y no es propietario, deja de ser miembro. Las
    operaciones de miembros, enlaces y entradas ya llevan su mundo en el historial.
  - Tiempo real (17): `/api/realtime`, un WebSocket por pestaña (origen y sesión comprobados antes de aceptarlo).
    Cada evento se decide con las pertenencias de ese momento y solo avisa de qué cambió; los datos se piden por la
    API. Expulsar o salir manda `revoked`. El máster ve «X ha entrado» con «Expulsar» a mano.
  - Fugas (18): `e2e/tests/fugas.spec.ts` (`@fugas`), paso propio de la CI que bloquea; falla si se mete una fuga
    por la API o por el WebSocket. Destapó que una jugadora podía forzar el permiso OAuth: ahora se le niega (hook
    de Better Auth) y `/mcp` lo sigue mirando en cada petición. «Deshacer» entra en la prueba con la tarea 20.
  - Punto de control 3 superado (salvo entrar con Discord, que llega con la 15). Lo que vio Enrique, arreglado en el
    PR #23: volver a una ventana ya visible no refrescaba (TanStack Query 5 solo mira `visibilitychange`; ahora
    también `focus`), y una pestaña abierta antes de un despliegue seguía con la web vieja. Ahora el canal saluda con
    la versión de la web (su script de entrada) y, si no coincide, sale «Hay una versión nueva» con «Recargar».
  - Historial (19): `listHistory`, de un mundo para su máster y de toda la organización para el propietario, por
    páginas (cursor: la última operación vista). La web pone la frase de cada acción con i18n y se pone al día con
    cualquier aviso del canal.
  - Deshacer (20): `undoOperation` aplica lo inverso como una operación nueva, enlazada a la original y a su vez
    deshacible. La lógica pura (qué fila ya no está como la dejó la operación, los pasos inversos) está en
    `packages/domain/src/undo.ts`; `packages/db/src/repos/undo.ts` la aplica con las filas bloqueadas y mira en el
    catálogo de Postgres si quitar algo se llevaría filas que dependen de ello, o si volver a poner una fila chocaría
    con otra igual. En cualquier conflicto no toca nada y dice qué operación posterior lo impide. Deshacer deja la
    versión de antes, así que tras deshacer lo posterior se puede deshacer lo anterior. El contador de entradas del
    enlace ya no pasa por el historial (si no, cada entrada impediría deshacer las anteriores). Lo del sistema no se
    deshace. Enrique probó el historial en staging: funciona.
  - Papelera (21): borrar un mundo o una campaña marca `deleted_at` (la misma fila; deshacerlo o restaurarla la deja
    como estaba). Lo de la papelera no cuenta en ninguna consulta de lo que ve una cuenta (pertenencias, listas,
    enlace de invitación). Papelera del mundo (su máster) y de la organización (el propietario, también mundos).
    Purga diaria a las 4:00 de Madrid con BullMQ 6.3.15 (`apps/server/src/jobs/purges.ts`): lo de más de 30 días en
    la papelera y las operaciones de más de 90; quien se queda sin nada deja de ser miembro. `msgpackr-extract`
    (acelerador nativo opcional) no ejecuta su script de instalación.
  - Modos de IA y cola (22): modo por cuenta (`ai_settings`; copiloto si no hay fila) y la decisión por modo × tipo
    de acción en `packages/domain/src/ai-modes.ts`. Lo que espera va a `approvals` (Postgres, fuera del historial):
    `apps/server/src/mcp/approvals.ts` lo apunta con los nombres de lo que toca (solo si la cuenta lo ve), avisa por
    el canal y espera hasta 15 s escuchando el bus del proceso (una conexión más de la cuenta en el hub); si no hay
    decisión, contesta `PENDING_APPROVAL`. `approve` lo hace con la cuenta y sus permisos de ahora, como hecho por la
    IA con su herramienta; si ya no se puede, queda `failed` con el código. Aprobar, rechazar y cambiar el modo solo
    desde la interfaz (`UI_ONLY`). Las herramientas que no son de leer no anuncian `outputSchema` (pueden contestar
    «esperando»). La caducidad (24 h) se decide con la hora, no se guarda; la purga diaria se lleva las peticiones de
    más de 90 días.
  - Herramientas MCP (24, antes que la 23): `listar_mundos` (mundos con sus campañas), `ver_campana`, `crear_mundo`,
    `crear_campana`, `enlace_invitacion` (sin `change`, leer; con `regenerate`, `open` o `close`, la acción de
    jugadores), `ver_historial`, `deshacer` y `pendientes`. `MCP_TOOLS` en `apps/server/src/mcp/tools.ts`: cada una es
    una acción del contrato o una ruta a varias. Probadas con el cliente del SDK: cada herramienta en cada modo, el
    criterio 4 (crear sin preguntar, regenerar espera y al aprobarlo se hace) y la proyección (lo de otra
    organización da `NOT_FOUND` y no entra en la cola).
  - Cola y ajustes de IA en la web (23): la cola (`components/approval-queue.tsx`) está en el marco de todas las
    páginas y solo se ve si hay algo pendiente; aparece sola con el aviso `changed approvals`. Cada petición dice en
    una frase lo que Claude quiere (`summaries.ts`: las mismas frases que el historial, por hacer), con su detalle,
    «Aprobar» y «Rechazar». Ajustes en `/ia` (enlace «IA» en la cabecera, solo para el propietario): la dirección del
    conector, el modo y cómo acabaron las últimas peticiones. La e2e (`e2e/tests/aprobaciones.spec.ts`) conecta
    «Claude» por OAuth con la ayuda `connectClaude` y llama al MCP sin cookies, como claude.ai; la prueba de fugas
    comprueba que la cola del máster no le llega a la jugadora.
  - Enrique probó en staging los criterios 4 a 6 con claude.ai: «funciona perfecto». Pidió un historial más claro
    al deshacer (PR #30: lo deshecho, tachado; deshacer un deshacer es «Rehacer» y se cuenta «rehízo»; un solo botón
    por cadena). Decidió que el máster sí puede deshacer que alguien saliera de su campaña (PR #32).
  - Cierre (25), lo hecho:
    - LCP de `/entrar` en staging, mediana de 5 cargas en frío: 0,27 s en escritorio y 1,9 s en móvil con 4G lenta y
      CPU ×4 (medido desde el VPS).
    - Tres revisiones: seguridad, servidor y web. Lo de seguridad y servidor, arreglado en el PR #31 (ver su
      descripción). Lo de la web, en el PR #33. Lo alto era que al salir la caché seguía a la vista de la siguiente
      cuenta: ahora `account/scope.tsx` la vacía y vuelve a montar la web. También:
      - Una sola región viva (`components/announcer.tsx`).
      - Foco en confirmaciones y tras navegar, con un título por pantalla (`page-title.tsx`).
      - `BusyButton` en vez de `disabled`.
      - Bordes de los campos a 3:1.
      - La sesión acabada lleva a entrar.
      - «Entras como…» al unirse.
      - El dominio del cliente en la pantalla de permiso.
      - Errores de carga con «Reintentar».
    - De paso salió un fallo del canal: un aviso que llegaba mientras se pedía algo por primera vez se perdía. Ahora se
      cancela lo que está en vuelo y se vuelve a pedir. Las e2e de Claude usan `fetch` y esperan al saludo del canal
      (`gotoLive` en `e2e/tests/ayudas.ts`).
    - Testing Library espera hasta 3 s (`test-setup.ts`): con todos los paquetes a la vez, 1 s no siempre bastaba.
  - Discord, Google y el correo (tarea 15), **pospuestos** por Enrique: de momento solo email y contraseña. Sin correo
    no hay «recuperar la contraseña»; las variables están comentadas en `.env.example`.
  - Puntos de control 1 y 2 superados: Enrique tiene su cuenta de propietario en staging (organización
    «Fateforge», mundo «Eana») y conectó claude.ai (cliente CIMD `https://claude.ai/oauth/mcp-oauth-client-metadata`).
  - GitHub gratis no protege ramas privadas: se fusiona solo con los 4 check-runs del commit en verde, esperando con
    un bucle con tope (un runner colgado dejó `gh pr checks --watch` esperando sin fin; ahora hay timeout-minutes).
  - MIT-0 admitida en `CONSTRAINTS.md`.
  - Puertos: desarrollo 8130 (servidor), 5173 (Vite), 54330 (Postgres), 63790 (Valkey), 10250/8250 (Mailpit);
    e2e 8131; prueba del MCP 8132; staging 8140.
- **2026-10-29 — Fase de diseño empezada** (ver «Entre el 0 y el 1» más abajo). Skills listas: `frontend-design`
  como plugin del proyecto (estaba en el marketplace oficial ya añadido) y las cuatro de Vercel en `.claude/skills/`.
  - Enrique desechó el aspecto del Crisol actual. Siete direcciones en un lienzo privado de claude.ai
    (https://claude.ai/artifact/1vbb4SGJvuqKQniFZ2acyG; fuentes en `out/lienzo-diseno/`, fuera de git): Imprenta,
    Fragua, Baraja, Cianotipia, Bosque, Grimorio y Hoja. Eligió **Hoja** («es más rol»): interfaz de hoja de
    personaje, solo el aire del género (sala limpia).
  - Identidad aplicada a la web (PR #35): Barlow y Barlow Condensed servidas desde Crisol (OFL-1.1, admitida solo
    para tipografías de `@fontsource`), tokens en `apps/web/src/styles/tokens.css` con sus contrastes probados,
    barra oscura, cajas con las esquinas cortadas (`--cut`), rótulos en rojo, botones condensados. Lo de Claude, en
    azul.
  - Barra de secciones y franja (PR #36):
    - En la barra de arriba van «Mis mundos» y, para el propietario, «Historial», «Papelera» e «IA». La sección
      actual va marcada.
    - El mundo y la campaña llevan una franja (`components/banner.tsx`) con su papel y sus casillas: campañas;
      jugadores; y, para el máster, cuántos han entrado. Comparte las consultas con los paneles de abajo.
    - Los enlaces del mundo se llaman «Historial de Eana» y «Papelera de Eana».
  - Repaso (PR #37):
    - El marco de la hoja es una pieza (`components/frame.module.css`, con `composes`).
    - La invitación lleva su franja, la portada es una portada y el permiso de Claude va en su caja.
    - Revisión con `web-design-guidelines`, con lo que salió arreglado: «Saltar al contenido», `theme-color`, el
      email sin corrector, `autocomplete` en los nombres, `touch-action` y títulos largos que no desbordan.
  - Lo que pidió Enrique al verlo:
    - El saludo de la portada, en la letra de los títulos.
    - La cuenta, en un desplegable (PR #38): el nombre abre una caja con el email, «Perfil» y «Cerrar sesión», con
      la letra de las secciones. Se cierra con Escape, al pulsar fuera o al salir con el tabulador
      (`components/account-menu.tsx`).
    - Las pruebas cierran sesión con `signOut()` (en `testing.ts` y en `e2e/tests/ayudas.ts`).
  - **Fase de diseño cerrada** con «Hoja». Enrique: «de la UI faltan cosas que no me convencen, pero lo abarcamos
    todo cuando tengamos la app terminada». El pulido visual queda para el final; si señala algo concreto, se apunta
    en «Para el repaso final de la interfaz», más abajo.
- **2026-10-29 — Módulo 1 (wiki): entrevista hecha** y confirmada por Enrique («vamos»). Las decisiones están en
  «Decisiones por módulo» § 1, más abajo. Lo gordo:
  - **No hay importador**: Eana se pasará con Claude por el MCP cuando la app esté terminada. Por eso las herramientas
    MCP de la wiki tienen que bastar para crearlo todo.
  - Las **hojas con estilo** (tipo Homebrewery) entran.
  - Sin editor de Markdown a mano.
  - La wiki es solo del máster hasta el módulo 5.
- **2026-10-29 — Módulo 1: ADR-0003 escrito** (`docs/adr/0003-paginas-yjs-y-secretos.md`).
  - La página es una fila con historial, como en el módulo 0. Solo el cuerpo es Yjs.
  - Cada secreto y cada nota oculta es su propio documento de Yjs; el cuerpo solo lleva su id.
  - Hocuspocus 4 va dentro del servidor, en `/api/collab`, con permiso por documento.
  - Guardar es fusionar, y nada vuelve atrás sobrescribiendo: restaurar, deshacer y lo de Claude son cambios hacia
    delante.
  - Los cambios se agrupan en sesiones de edición. Cada una es una operación sobre `page_bodies` y una versión de la
    página, y se deshace como en el módulo 0.
  - Claude escribe en el mismo Markdown de Obsidian que se exporta, con ids de bloque, y su cambio entra en vivo en la
    página abierta.
  - Lo más arriesgado es el editor anidado de los secretos, y es lo primero que se prueba en el plan.
- **2026-10-29 — Módulo 1: REA hecho.** Tres notas, cada una con sus preguntas para la spec al final.
  - `research/homebrewery/hojas-y-pdf.md` (Homebrewery 3.24.2):
    - Pagina a mano, con hojas de tamaño fijo, y lo que no cabe se corta sin avisar. Propuesta: paginar solo, bloque a
      bloque, con saltos opcionales y aviso.
    - Su PDF es la impresión del navegador.
    - Sus fuentes (CC BY-SA) y sus imágenes (sin licencia) no entran. De su código MIT se aprovecha lo de paginar e
      imprimir, con atribución.
    - Bloques de hoja propuestos: salto de página y de columna, statblock, nota lateral, ancho e índice. Dos temas
      propios, Pergamino y Neutro.
  - `research/foundry/journal.md`:
    - Sin subpáginas: carpetas → entrada → páginas planas.
    - Guarda HTML libre, con enlaces por id. No tiene entrantes ni vista previa, y lo borrado deja enlaces rotos sin
      avisar.
    - Los secretos van dentro del HTML y se escapan por la red, por la búsqueda y por los incrustados. Revelar es para
      todos a la vez. Confirma el ADR-0003.
    - Archivos sin sesión y «mostrar a los jugadores» sin comprobar en el servidor: los dos fallos que no repetiremos.
  - `research/dndbeyond/contenido-y-enlaces.md`:
    - Cada enlace lleva su tipo, con vista previa rápida (200–500 ms) pero solo con ratón: no sale con el teclado ni en
      el móvil.
    - Las anclas salen del texto del encabezado. El lector es de una columna, sin PDF.
    - La búsqueda llega a las secciones de los libros.
    - No hay wiki ni secretos por bloque.
  - `research/README.md` admite Homebrewery como fuente: su código, MIT, se puede aprovechar con atribución.
- **2026-10-29 — Módulo 1: spec aprobada** por Enrique («vamos»), con las cuatro propuestas (`docs/specs/wiki.md`).
  - Nueve capacidades: `paginas`, `editor`, `markdown`, `enlaces`, `versiones`, `archivos`, `busqueda`, `hojas` e
    `ia`.
  - Lo más arriesgado va primero: el editor anidado de los secretos.
  - Dimensionada con Eana, contada sin abrirla: 2.384 páginas, la mediana de 1,3 KB y 99 archivos (710 MB, casi todos
    PDF, el mayor de 204 MB).
  - Decidido:
    - los archivos los sube Enrique y Claude los enlaza;
    - el PDF, imprimiendo desde el navegador;
    - la hoja se pagina sola;
    - los tipos de propiedad.
- **2026-10-29 — Módulo 1: diseño aprobado** por Enrique («me parece bien»). Es el lienzo «Crisol: wiki»
  (https://claude.ai/artifact/Wvxy8bDfxQLDwcVHbsDLQv; fuentes en `out/lienzo-wiki/`, fuera de git). Tiene cinco
  tablas:
  - la página en vista sencilla;
  - el editor;
  - la hoja;
  - la búsqueda con Ctrl+K;
  - el móvil.

  En la hoja, la letra del texto (Alegreya) es una propuesta para el repaso final.
- **2026-10-29 — Módulo 1: plan aprobado** por Enrique («si, vamos»): `tasks/plan.md` y 26 tareas en `tasks/todo.md`.
  - El plan del módulo 0 está ahora en `tasks/fundacion/`.
  - Hay nueve fases y seis puntos de control. Lo arriesgado va pronto: Yjs en el servidor (6), el editor anidado de
    los secretos (8, con su punto de control) y Claude escribiendo en una página abierta (11).
- **Siguiente paso: módulo 1**, en este orden, cada uno con su PR de documentación (rama corta → CI → merge):
  1. ~~ADR-0003, Yjs y secretos~~: hecho.
  2. ~~REA dirigido~~: hecho (Homebrewery, Foundry Journal y D&D Beyond).
  3. ~~Spec~~: aprobada.
  4. ~~Diseño~~: aprobado.
  5. ~~`/plan`~~: aprobado.
  6. **`/build` tarea a tarea** (`tasks/todo.md`), con `/agent-skills:review` y `/ship`, como en el módulo 0. Hechas de
     la 1 a la 17. **Puntos de control 1 y 2 pasados** (2026-10-30, «todo funciona de momento»): el editor anidado se
     queda. **Sigue la 18** (archivos del mundo), y así hasta acabar el módulo (bitácora: `tasks/bitacora.md`).
  7. **Al acabar el módulo 1, la interfaz** (decisión de Enrique, 2026-10-30): se apunta por dónde vamos y se
     dedica una etapa a la interfaz antes del módulo 2. Ver «Para el repaso final de la interfaz».
- **2026-10-29 — Módulo 1, tarea 1: páginas y árbol en la API.**
  - La tabla `pages` tiene historial y su orden es una clave fraccionaria (`packages/domain/src/order.ts`, collation
    "C"). Mover solo escribe la fila que se mueve.
  - Hay nuevas acciones `createPage`, `updatePage`, `movePage`, `getPage` (con la ruta), `listPageChildren` y
    `listPageTree`.
  - Permisos `page.read` y `page.write`: el máster del mundo y el propietario de la organización. La organización sale
    de la fila del mundo, nunca de lo que diga quien pide.
  - El aviso `changed pages` solo llega a quien ve la wiki.
  - Herramientas MCP `ver_arbol` y `mover_pagina`; en la cola salen los títulos de las páginas.
  - `@fugas` amplía la prueba: la jugadora no recibe nada de la wiki. Se comprobó que falla si el aviso llegara a
    todos los del mundo.
- **2026-10-29 — Módulo 1, tarea 2: el árbol en la web.** Desplegada la 1 en staging (health 200, sin errores).
  - Rutas `/mundos/:worldId/wiki` y `/mundos/:worldId/wiki/:pageId` (`apps/web/src/wiki/`). En la wiki, el `main` es
    más ancho (90rem).
  - El árbol sigue el patrón ARIA de árbol de navegación:
    - las filas son enlaces con `role="treeitem"`, con su nivel y su posición;
    - hay una sola parada del tabulador;
    - las flechas se mueven, despliegan y pliegan; Inicio y Fin van al principio y al final;
    - Alt y las flechas recolocan;
    - también se recoloca arrastrando: el cuarto de arriba pone delante, el de abajo detrás y el centro dentro.
  - La flecha de desplegar es un dibujo dentro de la fila: un botón entre las filas no lo admite axe
    (`aria-required-children`).
  - Cada rama se pide al desplegarla, y la rama de la página abierta se despliega sola.
  - Con más de 300 filas visibles, solo se pintan las que se ven (`@tanstack/react-virtual` 3.14).
  - «Página nueva» y «Nueva subpágina» crean con «Sin título» y abren el título con el texto elegido, para escribir
    encima (`?nuevo=true`). Se renombra en el sitio, y Escape cancela.
  - Hay migas de pan y la lista de subpáginas.
  - En el móvil, el árbol va en un cajón: el foco entra al abrirlo y vuelve a «Páginas» al cerrarlo.
  - Desde el mundo hay un enlace «Wiki de Eana».
  - Hay e2e de crear, renombrar, recolocar con el teclado y arrastrando, y recargar. Otra comprueba el cajón, y otra
    pasa axe en los dos temas y en el móvil.
- **2026-10-29 — Módulo 1, tarea 3: propiedades, alias, etiquetas e icono.** Desplegada la 2 en staging (health 200,
  sin errores).
  - Las propiedades son de tipo texto, número, sí/no, lista o páginas, en el orden que elige el máster
    (`setPageProperties`).
    - Las reglas, en `packages/domain/src/properties.ts`: el nombre no se repite (sin mirar mayúsculas), y `alias` y
      `etiquetas` son listas y `resumen` es texto. Una etiqueta no lleva espacios y usa «/» para la jerarquía.
    - Las de tipo páginas solo enlazan páginas de la misma wiki, fuera de la papelera.
    - En el historial queda qué propiedades cambiaron, y deshacer las devuelve.
  - El icono es un emoji (`updatePage` con `icon`). Se elige entre 16 habituales o se escribe cualquier otro, y se
    quita con null. La caja sigue el patrón de despliegue del menú de la cuenta.
  - Hay un panel de etiquetas (`/mundos/:worldId/etiquetas`, `listTags`): cada madre cuenta también las páginas de sus
    hijas. Pulsar una etiqueta para buscar llega con la búsqueda (tarea 20).
  - El editor de propiedades:
    - tiene un botón para añadir cada reservada, y se sube, se baja y se quita;
    - un número que no lo es no se guarda, y lo dice;
    - las de tipo páginas se eligen por el título, con los títulos de `listPageTree` hasta 6 niveles, hasta que lleguen
      los enlaces (tarea 13).
  - Los desplegables y las áreas de texto de los formularios tienen ya el estilo de los campos.
- **2026-10-29 — Módulo 1, tarea 4: papelera de páginas.** Desplegada la 3 en staging (health 200, sin errores).
  - `deletePage` manda a la papelera la página y las subpáginas que no lo estaban, todas en una operación y con el
    mismo momento. MCP: `borrar_pagina`, de tipo `delete`.
  - `restorePage` las devuelve juntas: las que se borraron antes por su cuenta se quedan en la papelera. Mientras la
    madre siga en la papelera no se restaura (`PARENT_IN_TRASH`).
  - En la papelera sale solo la página de arriba de cada borrado, con cuántas subpáginas se fueron con ella.
  - La purga de 30 días se lleva las páginas con sus subpáginas (clave ajena en cascada).
  - En la web, «Borrar» pide confirmar y vuelve a la madre (o a la portada de la wiki). Lo de la papelera se restaura
    desde la del mundo.
  - De paso se arregló un fallo que venía de la tarea 1: pedir una página que no existe o que está en la papelera daba
    500 en vez de 404, porque se buscaba el mundo con un id vacío.
- **2026-10-29 — Módulo 1, tarea 5: pestañas, marcadores y anterior/siguiente.** Desplegada la 4 en staging (health
  200, sin errores).
  - Las preferencias de cada cuenta en cada wiki (`wiki_preferences`) no van al historial: `getWikiPreferences`,
    `setWikiTabs` y `setBookmarks`. Salen con los títulos de ahora, y lo que está en la papelera no sale (vuelve si se
    restaura).
  - Se adelantó a esta tarea el cambio de `dependentRow` que el plan dejaba para la 6: ahora mira solo
    `TRACKED_TABLES`. Si no, las preferencias impedían deshacer la creación de un mundo.
  - Pestañas:
    - cada página que se abre entra, y quedan 8 sin fijar como mucho; las fijadas van delante y no se cierran;
    - se ven en el acto y se guardan en fila, y solo cuenta la respuesta del último guardado;
    - en el móvil, las abiertas van en el cajón del árbol.
  - Marcadores por grupos, junto al árbol. El primero va de un clic a «Marcadores»; después se elige el grupo o se
    crea otro. «Quitar el marcador» la quita de todos.
  - Anterior y siguiente entre hermanas, al pie de la página. El índice del documento llega con el cuerpo (fase 2).
- **2026-10-29 — Módulo 1, tarea 6: documentos de Yjs en el servidor.** Desplegada la 5 en staging (health 200, sin
  errores).
  - Por el camino, una prueba del módulo 0 fallaba al azar (1 vez de cada 64) en la CI del PR #48: la del cifrado
    alterado de los enlaces no siempre alteraba el carácter. Arreglada.
  - Hocuspocus 4.8 corre dentro del servidor (`apps/server/src/collab/`), en `/api/collab`.
    - Comprueba el origen y la sesión, como el canal, y la vuelve a mirar cada minuto.
    - Un WebSocket por pestaña lleva todos sus documentos; hay que pasarle a mano los mensajes, los pong y el cierre.
  - El cuerpo de una página es el documento `page:<id>`. Al abrir cada documento se comprueban `page.read` y
    `page.write` con las pertenencias de ese momento; sin escritura, se abre en solo lectura.
  - La tabla `documents` (sin historial; migración 0011) guarda el estado de Yjs. Hay un solo cuerpo por página, y las
    filas de tipo `secret` y `note` llegarán en la tarea 8.
    - Guardar es fusionar (`Y.mergeUpdates`) con la fila bloqueada, unos 2 s después del último cambio y como mucho a
      los 10 s.
    - Si el estado pasa de 4 MB no se guarda, y se cierran sus conexiones.
  - Un mensaje de más de 1 MB corta la conexión. El tope del WebSocket pasó de 1 KB a 1 MB, así que el canal en tiempo
    real ahora corta él mismo lo que pase de 1 KB.
  - Al mandar una página a la papelera (con sus subpáginas) o un mundo, se cierran sus documentos abiertos y ya no se
    vuelven a abrir.
  - Las pruebas de integración usan clientes reales de Hocuspocus en Node: el WebSocket de Node manda la cookie y el
    origen, sin dependencias nuevas.
    - Dos pestañas convergen, lo guardado vuelve, y guardar fusiona con lo de fuera.
    - Una jugadora no abre ningún documento, ni tampoco un nombre desconocido o una conexión desde otro origen.
    - Se cierra al ir a la papelera, y cortan los límites.
  - `@fugas` en el navegador llegará con el editor (tarea 7): con el máster escribiendo, a la jugadora no le debe llegar
    nada.
- **2026-10-29 — Módulo 1, tarea 7: el editor en la web.** Desplegada la 6 en staging (health 200, sin errores).
  - `packages/editor` es el esquema del editor, sin React (dependency-cruiser lo comprueba). Usa TipTap 3.32.1, con
    todos sus paquetes en la misma versión exacta. Por ahora lleva la base: texto, títulos, listas, casillas, cita,
    código, separador y las marcas; los enlaces llegan en la tarea 13.
    - Los títulos del cuerpo van del 1 al 3 y se pintan como `h2` a `h4`, porque el `h1` es el título de la página. Al
      pegar se leen al revés, para que copiar dentro del editor no cambie su nivel.
    - La etiqueta de las casillas la pasa la web ya traducida («Por hacer: …»); la de TipTap sale en inglés.
  - En la web, `App` recibe un `collab` (en `main.tsx`, `createCollabClient()`); sin él, que es lo que pasa en las
    pruebas de componentes, el cuerpo no se abre.
    - La wiki abre un WebSocket por pestaña (`CollabSocket`), y cada página abre su `page:<id>` con un proveedor de
      Hocuspocus enganchado a ese socket.
    - Los cursores de otras cuentas llevan su nombre y su color.
    - Sin conexión sale «Sin conexión: se guardará al volver.».
  - El candado va en `updatePage` con `locked`: pone el editor en lectura sin volver a abrir el documento, y el
    historial lo cuenta.
  - E2e:
    - lo escrito sigue al recargar;
    - dos pestañas convergen;
    - sin red se sigue escribiendo y llega al volver (con `routeWebSocket`: `setOffline` no corta un WebSocket abierto);
    - el candado.
  - `@fugas`: con el máster escribiendo en el cuerpo, a la jugadora no le llega ni una palabra.
- **2026-10-30 — Módulo 1, tarea 8: secretos y notas ocultas (el riesgo).** Desplegada la 7 en staging (health 200,
  sin errores; `/api/collab` funciona a través de Caddy).
  - En el esquema, los nodos `secret` y `note` son bloques sin contenido que solo guardan el id de su documento
    (`packages/editor/src/separate.ts`). Dentro de un secreto no hay otros (`nested`).
  - En el servidor, cada uno es su propio documento de Yjs, `doc:<id>` (fila `documents` de tipo `secret` o `note`).
    - Al abrirlo se comprueba el permiso de su página; en el módulo 5 tendrá el suyo propio.
    - Al borrar la página se cierran también sus secretos.
  - `createPageDocument` crea el documento vacío, o la copia de otro (`copyOf`) si se puede leer el original. No va al
    historial: lo cuenta la sesión de edición del cuerpo.
  - En la web (`apps/web/src/wiki/separate.tsx`):
    - **Vista**: cada bloque es un editor anidado conectado a su documento por el mismo WebSocket.
    - **Insertar**: los botones «Secreto» y «Nota oculta» de la barra hacen secreto lo elegido (su contenido pasa al
      documento nuevo) o insertan uno vacío.
    - **Deshacer el bloque**: «Convertir en texto normal» devuelve el contenido al cuerpo.
    - **Copiar**: pegar un secreto crea una copia; la hace la pestaña que pegó. Mover arrastrando no copia.
    - **Teclado**: con las flechas se llega al bloque, Intro entra, las flechas salen por sus bordes y Escape vuelve
      al cuerpo con el bloque elegido.
    - **Ctrl+Z** va por documento.
    - Los rótulos de los cursores ajenos van ocultos a los lectores de pantalla: van dentro del texto.
  - Tokens `--color-secret*` con sus contrastes probados.
  - Pruebas:
    - de integración, el texto de un secreto nunca está en el estado guardado del cuerpo; dos secretos y otra pestaña
      escribiendo a la vez convergen; copiar; una jugadora no abre ningún secreto;
    - e2e, todo lo anterior en el navegador, con la base de datos mirada desde la prueba;
    - `@fugas` y a11y, con un secreto.
  - **Fallo encontrado y arreglado**: al escribir en el cuerpo justo después de dar el nombre a una página nueva,
    cuando se guardaba el nombre el foco saltaba al título y a «Renombrar», y lo que se tecleaba se perdía. Ahora las
    ayudas que devuelven el foco (`useReturnFocus` y el foco al título tras navegar) solo lo hacen si se había perdido
    (`focusIsLost`).
- Queda una ventana pequeña en el tiempo real: lo que cambie entre la primera carga de una página y la conexión del
  canal no se ve hasta volver a la pestaña. Taparla costaría volver a pedirlo todo al conectar la primera vez.
- **2026-10-30 — Módulo 1, tarea 9: todos los bloques y marcas.** Enrique pasó los puntos de control 1 y 2. Antes de
  irse a dormir pidió acabar el módulo sin parar. Dio permiso para:
  - las extensiones MIT de TipTap y `@floating-ui/dom`;
  - el volumen «archivos»;
  - Chromium en el contenedor para «Descargar PDF», en la tarea 24.

  Hecho:
  - **Esquema** (`packages/editor`):
    - tablas (`@tiptap/extension-table`);
    - recuadros (`callout`, de los tipos `note`, `tip`, `warning`, `danger` y `read-aloud`) y la caja (`box`);
    - el enlace externo, que solo admite http, https y mailto (`isExternalUrl`);
    - ids de bloque (`@tiptap/extension-unique-id`): 8 letras o cifras, en `data-id`. Los documentos de antes reciben
      los suyos al abrirse (`fillMissingIds`), y lo duplicado se copia sin ids (`withoutBlockIds`).
  - **Vistas**: la opción `separate` de `editorExtensions` pasa a ser `view` (las vistas de React de la web:
    `apps/web/src/wiki/views.ts`).
  - **Web**:
    - **Menú «/»** (`slash-menu.tsx`, con `@tiptap/suggestion`): grupos «Texto», «Recuadros» y «Del máster», según el
      lienzo. Filtra sin tildes, y el texto guarda el foco con `aria-activedescendant`. Va también dentro de los
      secretos, sin «Del máster».
    - **Barra de formato y barra de la tabla** (`bubble-menu.tsx`): se llega con Alt+F10 y se recorren con las flechas.
    - **Asa y menú del bloque** (`drag-handle.tsx`): convertir, duplicar, subir, bajar y borrar. El menú se abre
      también desde «Bloque» en la barra: así vale con el teclado y en el móvil. El asa se fija con la meta
      `lockDragHandle` de su plugin, porque los comandos son de la extensión y aquí no está.
  - **Tokens** de los recuadros (`--color-tip`, `--color-warning`, `--color-danger` y `--color-read-aloud*`), con sus
    contrastes probados.
  - **Pruebas**:
    - del esquema, con pegar HTML sucio en happy-dom (`pasteHTML`);
    - del catálogo de bloques;
    - e2e en `e2e/tests/bloques.spec.ts`: el menú «/» con el teclado, los atajos, la barra de formato y los enlaces,
      el menú del bloque, arrastrar, los ids al recargar, pegar HTML, y el menú dentro de un secreto;
    - a11y de los menús abiertos.
  - **Queda para la tarea 13**: «Enlace a página» en el menú «/» y la propuesta de enlazar en la barra de formato.
- **2026-10-30 — Módulo 1, tarea 10: el Markdown, de ida y vuelta** (`packages/editor/src/markdown`, entrada propia
  `@crisol/editor/markdown`, para que la web no cargue marked).
  - **Propiedades** (`frontmatter.ts`): un YAML pequeño hecho a mano para los cinco tipos (sin dependencia nueva).
    - Las páginas enlazadas se escriben `"[[Título]]"`; al leer vuelven sus títulos, que resuelve el servidor.
    - Lo que no entiende lo dice con su línea (`FrontmatterError`).
  - **Formas propias** (`syntax.ts`), declaradas en cada nodo (`markdownTokenizer`, `parseMarkdown` y
    `renderMarkdown`):
    - los recuadros `> [!nota|consejo|aviso|peligro|leer]`. También se leen los de Obsidian en inglés y el título tras
      el tipo;
    - la caja, `> [!caja]`;
    - el secreto, `> [!secreto]`;
    - la nota oculta, entre `%%` en su línea, o `%%texto%%`.
  - **Una página** (`page.ts`): `pageToMarkdown` y `pageFromMarkdown`.
    - Ids solo de primer nivel y solo si se piden: ` ^id` al final del párrafo o el título, `^id` en su línea en lo
      demás, y `^s-id` en los secretos.
    - Al leer se apartan lo de dentro de los secretos y las notas ocultas, con su id de bloque. Un secreto dentro de
      otro se deshace.
    - Se quitan los enlaces que no son http, https o mailto.
    - En el servidor no hay DOM: el HTML suelto queda como texto y no se ejecuta.
    - Si no hay propiedades y el cuerpo empieza por `---`, se escribe un YAML vacío.
  - **Prueba de ida y vuelta**: un cuerpo con todos los nodos y marcas del esquema. Falla si el esquema gana uno que la
    prueba no lleva.
  - **Límite conocido**: dos listas seguidas sin nada entre ellas se leen como una sola (pasa igual en Obsidian), salvo
    si se escriben con sus ids.
- **2026-10-30 — Módulo 1, tarea 11: Claude lee y escribe páginas.**
  - **Acciones y herramientas MCP** (`apps/server/src/actions/page-content.ts`):
    - `readPage` → `leer_pagina`: la página en Markdown, con los secretos dentro y los ids si se piden.
    - `createPages` → `crear_paginas`: hasta 50 en una operación. Van anidadas por `key` y `parent` (plano: sin
      esquemas recursivos en MCP).
    - `editPage` → `editar_pagina`: título, icono, propiedades y cuerpo, con `append`, `replace` (con su YAML),
      `block` o `section`.
  - **Propiedades de páginas**: se resuelven por título, alias o id, sin mayúsculas. Si no aparece, da
    `PAGE_NOT_FOUND`; si hay varias, `AMBIGUOUS_PAGE` con las candidatas. `InvalidRequestError` lleva ahora su
    `detail`, que la IA lee.
  - **En vivo** (`apps/server/src/wiki/content.ts`):
    - el cuerpo se cambia por `openDirectConnection` de Hocuspocus, con la diferencia justa (`updateYFragment`);
    - el servidor avisa con un mensaje sin estado de los bloques que cambió, y la web los resalta (`ai-highlight.ts`,
      con una decoración);
    - ese aviso puede llegar antes que el cambio, porque Hocuspocus junta los cambios al final de la vuelta, así que
      los ids esperan a que lleguen sus bloques;
    - a los lectores de pantalla se les dice «Claude ha cambiado la página».
  - **Secretos**:
    - un `> [!secreto]` nuevo crea su documento;
    - uno con el `^s-id` de un secreto de la página cambia ese mismo documento;
    - su texto nunca entra en el cuerpo, y lo comprueban las pruebas.
  - **Huella de partida**: la hora de la petición (`ctx.requestedAt`, al aprobar).
    - Si el cuerpo se guardó después, la respuesta dice `changedSinceRequest`.
    - Si el bloque o la sección ya no están, `failed` con `BLOCK_NOT_FOUND` o `SECTION_NOT_FOUND`.
  - **Al cambiar un bloque**, lo nuevo se queda con su id si no trae otro, así que los enlaces a él siguen valiendo.
  - **Arreglado en deshacer** (`staleChange`): una operación que toca una fila dos veces (crear una página y luego darle
    sus propiedades) se mira como quedó al final.
  - **Arreglado en el servidor**: al cerrarse guarda los documentos abiertos antes de salir (`collab.close()`). La CI
    daba un *deadlock* entre pruebas, y en producción se podía perder lo último escrito al reiniciar.
  - **El cuerpo aún no se deshace**: la operación queda en el historial, pero deshacerla solo toca la fila de la
    página. Se podrá deshacer con las versiones (tareas 16 y 17).
  - **Arreglado un ciclo** entre `markdown/syntax.ts` y `nodes/callout.ts`, que entró con la 10: los tipos de recuadro
    van ahora en `nodes/callout-kinds.ts`.
  - **Pruebas**:
    - integración: crear, leer, cambiar, secretos, errores sin dejar nada a medias, candidatas y permisos;
    - en vivo, con un cliente de Hocuspocus;
    - MCP: cada herramienta en cada modo, y la aprobación que falla o se aplica sobre lo de ahora;
    - fugas entre organizaciones;
    - e2e `claude-wiki.spec.ts`: Claude cambia una sección de la página abierta y se ve sin recargar.
- **2026-10-30 — Módulo 1, tarea 12: exportar.**
  - **Ruta** `POST /api/export`. No es una acción porque contesta con bytes: `application/zip` con su nombre en
    `content-disposition`, y como mucho 10 por minuto. Su entrada, `exportInput`, va en `packages/contracts`.
  - **`apps/server/src/wiki/export.ts`**:
    - **Rutas** dentro del .zip con el árbol de todo el mundo:
      - una página con hijas es `Título/Título.md`;
      - nombres saneados (`fileName`);
      - « (2)» entre hermanas que se llaman igual.
    - **Una rama** sale desde su carpeta; una página sola, su nota.
    - **Enlaces de las propiedades**: el título si es único en el mundo; si no, su ruta en el .zip.
    - **Cuerpos y secretos**: se cargan de una vez (`documentsWithState`); los que están abiertos, del documento
      vivo.
    - **Comprimido** con `fflate` (MIT, aprobado en el plan).
  - **Web** (`apps/web/src/wiki/export.tsx`):
    - «Exportar» en la página, que con subpáginas pregunta «Solo esta página» o «Con sus subpáginas»;
    - «Exportar la wiki» en «Más de la wiki»;
    - la descarga, con `api.exportWiki` y un enlace temporal; «Descargado: …» a los lectores de pantalla.
  - **Pruebas**:
    - integración: el mundo entero con carpetas, y cada archivo igual a lo que da `readPage`; rama, página sola,
      nombres raros, títulos repetidos y permisos;
    - e2e `exportar.spec.ts`: la descarga real, desabriendo el .zip;
    - `@fugas`: la jugadora no exporta ni usa `readPage`, `editPage` ni `createPages`.
  - **Queda para la 19**: los archivos, en `_archivos/`.
- **2026-10-30 — Módulo 1, tarea 13: enlaces por id, sin resolver y rotos.**
  - **Nodo `pageLink`** (`packages/editor/src/nodes/page-link.ts`): en línea y atómico, con `pageId`, `title`,
    `anchor` y `label`. En Markdown, `[[Título#Sección|texto]]`; al escribir lleva el título de ahora (o la ruta si se
    repite). `![[…]]` se queda como texto hasta la tarea 15.
  - **Dominio** (`packages/domain/src/links.ts`):
    - `resolveName`: por título o alias, o por una ruta «A/B»;
    - `searchNames`: por prefijo, palabra o contenido, y con erratas (Levenshtein contra el principio del nombre y de
      cada palabra, con una letra más o menos).
  - **Tabla `page_links`** (migración 0012). Se rehace con cada guardado de Hocuspocus (`onStored`, en
    `apps/server/src/wiki/links.ts`) y al crear páginas.
  - **Resolución sola** (`resolvePending`): al crear, renombrar, restaurar o dar un alias, los enlaces que esperaban
    ese nombre se resuelven en la tabla y en el texto (conexión directa).
  - **Claude**: sus `[[…]]` se resuelven al escribir. Con varias posibles, `AMBIGUOUS_PAGE` y las rutas. En una tanda,
    se pueden enlazar entre ellas en cualquier orden.
  - **Web** (`apps/web/src/wiki/page-links.tsx`):
    - **Lista de páginas**: `listPageNames`, en caché bajo `['pages', mundo]`, así que se pone al día con los avisos.
    - **Vista del enlace**, con tres estados:
      - bien;
      - «por crear»: pulsarlo la crea;
      - roto (en la papelera): «Restaurar».
    - **Intro** sobre un enlace elegido lo sigue.
    - **`[[`** sugiere y ofrece «Crear página «X»». Va también dentro de los secretos.
    - **«Enlazar con «X»»** en la barra de formato.
  - **Arreglado de paso**: `propertiesOf` pasa a `wiki/properties.ts`, para no hacer un ciclo.
  - **Pruebas**:
    - dominio (resolver y erratas) y Markdown (ida y vuelta con `pageLink`);
    - integración: en cualquier orden, en una tanda, alias, ambiguos con ruta, y papelera;
    - e2e `enlaces.spec.ts`, con a11y.
  - **Arreglado después, en la 14**: un enlace que solo llevaba el nombre se resolvía en `page_links` pero no en el
    texto. Ahora se le pone también ahí: al crear páginas, y tras cada guardado en una conexión directa aparte.
- **2026-10-30 — Módulo 1, tarea 14: entrantes, menciones y aviso al borrar.**
  - **Texto plano de cada documento**: `documents.text` (migración 0013) y `plainText`, en
    `packages/editor/src/text.ts`.
    - Se guarda con cada guardado y al crear páginas.
    - Lo que no lo tiene aún se rellena al buscar menciones.
    - Lo usará también la búsqueda (tarea 20).
  - **Acciones** (`apps/server/src/actions/links.ts`):
    - **`getPageLinks`**:
      - entrantes, con el trozo del bloque que enlaza y si sale de un secreto;
      - salientes, con su estado;
      - menciones sin enlazar: título o alias como palabra entera (`findName`), en páginas que no la enlazan.
    - **`listUnresolvedLinks`**: los sin resolver del mundo.
    - **`linkMention`**: «Enlazar» cambia la primera mención por un enlace, con su texto si no es el título.
  - **MCP `enlaces_pagina`**: con `pageId`, los de la página; con `worldId`, los sin resolver del mundo.
  - **Web**:
    - la sección «Enlaces» bajo el cuerpo (`backlinks.tsx`), con «La enlazan» y «La nombran sin enlazar», y
      «Enlazar»;
    - al borrar, «La enlazan N páginas: sus enlaces se verán rotos».
    - Su sitio a la derecha queda para la etapa de interfaz.
  - **Pruebas**:
    - integración: entrantes con su trozo y desde un secreto, salientes en sus tres estados, menciones con alias y sin
      falsos «Maela Varnes», «Enlazar» y los sin resolver;
    - MCP en cada modo;
    - e2e del panel y del aviso;
    - `@fugas` con las acciones nuevas.
- **2026-10-30 — Módulo 1, tarea 15: vista previa e incrustados.**
  - **Nodo `pageEmbed`** (`packages/editor/src/nodes/page-embed.ts`): un bloque, `![[Título#Sección]]` en su línea.
    Cuenta como enlace en `page_links` y se resuelve igual.
  - **`getPageContent`** (`apps/server/src/actions/preview.ts`):
    - la página (título, ruta, icono y resumen) y sus bloques, o los de una sección o un bloque (`^id`);
    - los secretos van con lo suyo (es la proyección del máster);
    - los incrustados de dentro se abren hasta 3 niveles, con `cycle` o `tooDeep` si no;
    - en la vista previa, los 4 primeros bloques con texto.
  - **Aviso nuevo del canal**, `pageContent`, tras cada guardado. La web vacía la caché de su contenido y de sus
    enlaces.
  - **Web**:
    - un pintor de JSON a React en solo lectura (`content.tsx`), sin editor ni Yjs; sus títulos no son encabezados;
    - **vista previa** (`preview.tsx`, en `PageLinkView`):
      - con el ratón, a los 300 ms;
      - con el teclado, al elegir el enlace con las flechas; Tab entra en ella y Escape la cierra y vuelve al texto;
      - en el móvil, un toque abre una hoja abajo con «Abrir página»;
    - **vista del incrustado** (`embed.tsx`);
    - **`![[`** en las sugerencias incrusta, y `#Sección` lleva el ancla;
    - **grupo «Wiki» en el menú «/»**: «Enlace a página» e «Incrustar página».
  - **Pruebas**:
    - integración: vista previa con resumen, sección y bloque; tres niveles y ciclo; un jugador no la ve;
    - componentes: la vista previa con Escape y en el móvil;
    - e2e `vista-previa.spec.ts`: ratón, teclado, incrustado que se pone al día, `![[`, móvil y a11y;
    - `@fugas` de `getPageContent`.
- **2026-10-30 — Módulo 1, tarea 16: sesiones de edición en el historial.**
  - **Tablas** (migración 0014):
    - `page_bodies`, en `TRACKED_TABLES`, una por página: su versión y su huella;
    - `page_versions`;
    - `snapshots`: el estado de un documento por su huella, compartido entre versiones;
    - `version_documents`.
    - En `changes` solo entran ids y huellas, nunca el texto.
  - **Huella de la página** (`apps/server/src/wiki/versions.ts`): sha256 del JSON del cuerpo y sus secretos, sin los
    ids de bloque ni el `pageId` de los enlaces. Así resolver un enlace solo, o poner ids, no da versiones falsas.
  - **Sesiones** (`apps/server/src/collab/sessions.ts`), en memoria por página y cuenta:
    - se abren con el primer cambio (`onChange`; las conexiones directas del servidor, no);
    - se cierran por inactividad (3 min), a los 15 min, al irse su última conexión, antes de una operación del
      servidor o al parar;
    - al cerrarse, lo vivo se guarda y se apunta `editPage` con su versión (`versionsRepo.recordEdit`). Si la huella
      no cambió, nada.
  - **Claude** (`editPage`): cierra antes las sesiones. Su cambio y su versión van en una sola operación, con título y
    propiedades. `createPages` deja la primera versión de cada página en la misma operación.
  - **Deshacer**: cierra antes las sesiones de las páginas cuyo `page_bodies` toca. Después aplica hacia delante la
    versión que queda (`applyVersion`, por conexión directa); si alguien escribió después, conflicto con quién.
  - **Recuperación**: al cargar el cuerpo sin sesiones abiertas, si lo guardado no es su última versión, se cierra a
    nombre del último que escribió.
  - **Dos cuentas a la vez**: la primera sesión que se cierra lleva lo de las dos; la otra no apunta nada si ya no hay
    nada nuevo. Nada se pierde; la autoría es aproximada en ese caso.
  - **Pruebas** (`sessions.integration.test.ts`):
    - agrupar y cerrar por inactividad;
    - dos cuentas y Claude a la vez, sin perder nada;
    - deshacer lo de Claude con un editor abierto, sin que vuelva lo viejo;
    - conflicto con quién;
    - recuperación tras parar.
- **2026-10-30 — Módulo 1, tarea 17: versiones de página.**
  - **Acciones** (`apps/server/src/actions/versions.ts`):
    - `listPageVersions`: quién (persona o Claude), cuándo y cuál es la de ahora;
    - `getPageVersion`: en solo lectura, con los secretos de esa versión;
    - `restorePageVersion`: cierra antes las sesiones, aplica la versión hacia delante y apunta `restoreVersion` con
      una versión nueva. Se deshace como lo demás.
  - **MCP**: `versiones_pagina` y `restaurar_version`.
  - **Purga** (en la diaria, `trashRepo.purge`): las versiones de más de 90 días, salvo:
    - las 40 últimas de cada página;
    - la de ahora;
    - las que nombra alguna operación que sigue en el historial.
    - Los estados que ya no usa ninguna versión, también se van.
    - `applyVersion` no vacía nada si la versión ya no está.
  - **Web** (`versions.tsx`): la sección «Versiones», que se abre, con «Ver» y «Restaurar». La frase del historial es
    «restauró una versión de «X»».
  - **Pruebas**:
    - integración: lista, ver con secretos, restaurar y deshacerlo; purgar con el reloj simulado (43 → 40);
      permisos;
    - MCP en cada modo;
    - e2e `versiones.spec.ts`;
    - `@fugas`.
- **2026-10-30 — Módulo 1, tarea 18: archivos del mundo** (migración 0015).
  - **Tabla `files`**, con historial: nombre único en el mundo (sin mayúsculas; si se repite, «nombre (2).ext»), tipo
    (`image`, `pdf` u `other`), tamaño, huella y clave del almacenamiento. Reemplazar pone una clave nueva: deshacer
    vuelve a los bytes de antes. Los bytes no van al historial.
  - **Almacenamiento** (`apps/server/src/files/storage.ts`): disco en `DATA_DIR/archivos`, claves `mundo/uuid`. En
    staging, el volumen «archivos» (`/data/archivos`, del usuario node).
  - **Rutas** (`files/routes.ts`):
    - `POST /api/files?worldId&name` y `PUT /api/files/:id`: el cuerpo es el archivo, en streaming, hasta 250 MB
      (`MAX_FILE_BYTES` en `@crisol/domain`). Si pasa, 413 sin romper la petición y sin dejar nada.
    - El tipo sale de los primeros bytes (`sniff`): PNG, JPEG, GIF, WebP, AVIF, PDF y SVG; lo demás, «otro», que se
      sirve como descarga. Un .png que es HTML no pasa por imagen.
    - `GET /api/files/:id`: con sesión y `page.read`; `private, no-cache` con ETag (la huella), `nosniff`, Range (para
      el visor de PDF) y, al SVG, la CSP `sandbox; default-src 'none'`.
  - **Acciones**: `listFiles`, `renameFile`, `deleteFile` y `restoreFile`; en la papelera del mundo salen los archivos.
    MCP: `listar_archivos`. Aviso en tiempo real `files`.
  - **Purga**: la fila, a los 30 días en la papelera; los bytes, cuando ya no los nombra ni una fila ni el historial (y
    nunca los escritos hace menos de un día: una subida a medias).
  - **Web** (`apps/web/src/wiki/files.tsx`, enlace «Archivos» en la wiki): subir varios o una carpeta, con botón o
    arrastrando, tres a la vez con su barra; carpetas por tipo; abrir, renombrar, reemplazar y borrar.
  - **Pruebas**: integración (límite con y sin tamaño dicho, permisos, Range, SVG, reemplazar y deshacer, papelera,
    purga), componentes, e2e `archivos.spec.ts` con accesibilidad y `@fugas` de los archivos.
  - **Queda para la 19**: el aviso «lo usan N páginas» al borrar, cuando las páginas usen archivos.
- **2026-10-30 — Módulo 1, tarea 19a: imágenes y archivos en las páginas** (migración 0016).
  - **Bloque `fileEmbed`**: una imagen (ancho, texto alternativo, pie y caja de luz), un PDF (por su página) u otro
    archivo. En Markdown, como Obsidian: `![[mapa.png|Texto alternativo|300]]`, `![[libro.pdf#page=12]]` y el pie en
    la línea siguiente, en cursiva. Se sabe que es archivo por la extensión (`.md` es una nota).
  - **`file_embeds`**: qué archivos usa cada documento, rehecha con cada guardado (como `page_links`). Lo que nombra un
    archivo que aún no está se resuelve solo al subirlo, renombrarlo o restaurarlo, también en el texto. Lo que escribe
    Claude con `![[…]]` se resuelve al momento. Renombrar no rompe nada: se enseña y se exporta el nombre de ahora.
  - **Al borrar un archivo** se avisa si lo usan páginas (`usedBy` en `listFiles`).
  - **Editor**: «Imagen o archivo» en «/» (lo sube), `![[` propone también los archivos, pegar o soltar archivos los
    sube y los pone ahí, y en un archivo que falta, «Subirlo».
  - Los nombres de archivo no llevan `[ ] | # ^`: al subir se cambian por «-».
  - **Pruebas**: Markdown de ida y vuelta, integración (resolver al subir, renombrar, Claude, papelera) y e2e
    `archivos-en-paginas.spec.ts` (con «/», pegar, «Subirlo», `![[` y accesibilidad).
- **2026-10-30 — Módulo 1, tarea 19b: visor de PDF, portada y archivos al exportar** (migración 0017).
  - **Visor de PDF** (`apps/web/src/wiki/pdf-viewer.tsx`, `pdfjs-dist`, Apache-2.0): antes enseña el nombre y el
    tamaño; pdf.js se carga al pulsar «Ver aquí» y pide los bytes a trozos (Range), así que un libro grande se abre
    por la página que toque sin bajarlo entero. Anterior, ir a una página y siguiente; abre por `#page=N`.
  - **Portada**: una imagen del mundo de cabecera con su punto de encuadre (`pages.cover`). Se elige de las del mundo
    o se sube, se encuadra con dos deslizadores y se quita; se puede deshacer y cuenta como uso del archivo. La vista
    previa la enseña pequeña. No va al Markdown (como el icono).
  - **Exportar** lleva `_archivos/`: todos los del mundo, o los que usan las páginas exportadas. El .zip se manda a
    trozos, sin cargarlo en memoria.
  - **Pruebas**: integración (exportar con archivos, portada) y e2e (PDF por la página 3 con pdf.js cargado solo al
    abrirlo; portada con el teclado y accesibilidad).
- **2026-10-30 — Módulo 1, tarea 20: búsqueda en español** (migraciones 0018 a 0020).
  - **Postgres**: `unaccent`, `pg_trgm` y `fuzzystrmatch`, y la configuración `es_unaccent` (español sin tildes).
    Cada documento se indexa por secciones (`search_sections`, lo de debajo de cada título) con cada guardado; cada
    página, por su título y sus propiedades (`pages.search_tsv`, generada). Lo de antes se indexa al buscar.
  - **Erratas**: `search_words` (las palabras de cada mundo, por triggers). Cada palabra buscada se amplía con las
    parecidas (trigramas y `levenshtein` ≤ 1, o ≤ 2 desde 6 letras) y la última, por su principio: «dargón» encuentra
    «Dragón» y «drag», también.
  - **Resultados** por página (el título pesa más), con hasta tres secciones con su extracto (lo encontrado entre
    `**`), lo de un secreto marcado, por etiqueta (con sus hijas) y por rama, de 20 en 20. Acción `searchWiki` y MCP
    `buscar_paginas`.
  - **Web**: `/mundos/:worldId/buscar?q&etiqueta&rama&pagina` y la caja de buscar en el lateral de la wiki.
  - El historial deja fuera las columnas generadas (la de búsqueda de `pages`).
  - **Pruebas**: integración («dragon», «DRAGONES», «dargón», «drag», secciones y secretos, etiqueta y rama, papelera,
    indexar lo de antes, paginada, permisos) y rendimiento con 5.000 páginas (p95 192 ms en local; < 300 exigido);
    componentes, e2e `buscar.spec.ts` con accesibilidad y `@fugas`.
- **2026-10-30 — Módulo 1, tarea 21: selector rápido, órdenes y buscar en la página.**
  - **Ctrl+K** (o Cmd+K) en cualquier pantalla de la wiki: un diálogo con combobox (ARIA). Vacío, las páginas
    recientes (las pestañas abiertas); al escribir, a los 250 ms, títulos y alias con erratas (hasta 8) y «Ver todos
    los resultados». Escape lo cierra y el foco vuelve a donde estaba.
  - **«>»** al principio: la paleta de órdenes (página nueva, buscar, archivos, etiquetas, historial y papelera).
  - **Buscar en la página**: botón encima del texto (y Ctrl+Alt+F; Ctrl+F sigue siendo del navegador). Resalta sin
    tildes ni mayúsculas, dice «n de m», Intro va a la siguiente y Mayús+Intro a la anterior. Lo de dentro de los
    secretos no entra.
  - **Pruebas**: componentes (teclado y foco), unidad de las coincidencias y e2e `selector.spec.ts` con accesibilidad.
- **2026-10-30 — Módulo 1, tarea 22: bloques de hoja.**
  - Salto de página y de columna, statblock, nota lateral (izquierda o derecha), «a lo ancho» (atributo del recuadro,
    la caja y el statblock, o un contenedor para varios bloques) e índice de contenidos. En Markdown, la tabla de la
    spec: `<div class="salto-pagina"></div>`, `> [!statblock]`, `> [!lateral|izquierda]`, `> [!ancho]`, `|ancho`,
    `> [!indice]`.
  - En la vista sencilla, discretos (los saltos solo se ven al editar). Grupo «Hoja» en el menú «/».
  - **Pruebas**: Markdown de ida y vuelta con todos y e2e `hoja.spec.ts` (con «/» y desde Markdown, con
    accesibilidad).
- **2026-10-30 — Módulo 1, tarea 23: vista de hoja** (migración 0021).
  - **«Hoja»** en las acciones de la página la activa, con sus ajustes en una fila: papel (A4 o Letter), tema
    (Pergamino, con Alegreya y una textura propia de gradientes, o Neutro), numerar y desde qué número, y pie con el
    título. Va al historial («puso «X» como hoja»).
  - **Quien lee** puede volver a la vista sencilla, y se recuerda por cuenta y página (`wiki_preferences.simple_pages`,
    acción `setPageView`). En pantallas estrechas se abre la sencilla, con «Ver la hoja».
  - **Paginación** por bloques en `@crisol/domain` (`paginate`): dos columnas (la primera se llena antes), los saltos
    fuerzan, un título va con su bloque siguiente, antes de un bloque a lo ancho se equilibran las columnas, y lo que
    no cabe ni en una página vacía va igual y la página lo avisa. Guionado en español con `hyphens: auto`.
  - La hoja pinta lo que da `getPageContent` (con secretos e incrustados) y mide cada bloque a su ancho. Índice con
    número de página y puntos guía; nota lateral flotando en su columna; statblock con el marco del tema.
  - **En escritorio ancho** (≥ 1500 px), el editor y la hoja lado a lado, sincronizados por bloque.
  - **Pruebas**: el paginador con alturas simuladas y una página grande; integración de los ajustes y de la vista de
    cada cuenta; e2e (activar, varias páginas sin que ningún bloque se salga, pie, índice, tema, volver a la sencilla y
    que se recuerde, con accesibilidad).
- **2026-10-30 — Módulo 1, tarea 24: imprimir y PDF.**
  - **Ruta de impresión** `/mundos/:worldId/imprimir/:pageId`: solo las páginas de la hoja, sin nada de la interfaz,
    con `@page` del papel elegido, cada página en su hoja y sin sombras. Las notas ocultas no salen nunca; los
    secretos, solo con «Incluir secretos».
  - **En la fila de la hoja**: «Incluir secretos», «Imprimir» (abre la ruta y el diálogo del navegador) y
    «Descargar PDF».
  - **PDF en el servidor** con `playwright-core` (Apache-2.0) y el Chromium de la imagen (`apk add chromium`, permiso
    de Enrique). Abre la ruta de impresión por dentro (`http://127.0.0.1:PUERTO`) con la cookie de quien lo pide,
    espera a que la hoja esté paginada (`data-sheet-ready`) y la imprime con su papel. De uno en uno. Sin Chromium o
    sin la web compilada, «Descargar PDF» dice que se use «Imprimir». El guardián de origen acepta también el origen
    interno (solo lo abre el propio servidor).
  - **Pruebas**: e2e con `page.pdf()` en la ruta de impresión (tantas páginas como la hoja y sin interfaz; secretos
    solo con la casilla; notas nunca) y el PDF del servidor (`%PDF`, nombre y páginas).
  - **Queda para Enrique**: la prueba a mano de imprimir en Chrome, Firefox y Safari (punto de control 6).
- **2026-10-30 — Módulo 1, tarea 25: a la escala de Eana.**
  - Prueba aparte (`CRISOL_ESCALA=1`, `apps/server/src/mcp/escala.integration.test.ts`): un mundo de 2.400 páginas
    con alias, etiquetas, secretos y enlaces cruzados (también a páginas que aún no existen), creado solo por el MCP
    con `crear_paginas` de 50 en 50.
  - **Números** (VPS, local): cada llamada de 50 páginas, mediana 2,2 s y máxima 2,4 s; ningún enlace sin resolver;
    `buscar_paginas` 149 ms y `ver_arbol` 100 ms. Al empezar eran 15 s por llamada.
  - **Lo que se cambió para llegar**:
    - los ids de las páginas se dan antes de crearlas, así que los enlaces de la tanda salen ya resueltos;
    - poner su página a lo que la esperaba no pasa por Hocuspocus si nadie tiene el documento abierto, y se escribe
      todo de una vez (`patchDocuments`);
    - indexar y rehacer los enlaces de la tanda, en una transacción cada cosa;
    - la posición de cada rama se pregunta una vez;
    - las propiedades van en el INSERT;
    - `resolveName` indexa cada lista de páginas una sola vez.
  - Las instrucciones del MCP y la descripción de `crear_paginas` explican cómo pasar una wiki entera (de 50 en 50,
    en cualquier orden, y al final `enlaces_pagina` con el mundo para ver lo que quede).
- **2026-10-30 — Módulo 1, tarea 26: cierre del módulo.** Construido entero; falta que Enrique lo revise en staging.
  - **Revisiones** (dos agentes): seguridad del servidor, y la interfaz con `web-design-guidelines`. No hay fugas entre
    mundos ni fallos de permisos.
  - **Arreglado de seguridad**:
    - una subida que no es el archivo en crudo da 415 y no deja nada abierto (dejaba descriptores abiertos);
    - Chromium arranca sin los secretos del servidor, no pide nada fuera del propio origen, tiene una cola con tope
      (2) y un plazo de 60 s, y se relanza si se cae;
    - los límites de subir, exportar y PDF van por la IP que manda Caddy (no por la del proxy);
    - las palabras de la búsqueda tienen de 3 a 64 letras (migración 0022);
    - las secciones van acotadas;
    - un documento que no se puede indexar no rompe la búsqueda.
  - **Arreglado de la interfaz**:
    - el botón de la imagen se nombra con su texto alternativo;
    - la hoja usa los colores claros en su papel;
    - las imágenes de la hoja se miden al llegar (la hoja y el PDF esperan a ellas);
    - el visor de PDF no pierde el foco y anuncia la carga;
    - los ajustes de la hoja cambian al momento y avisan si no se guardan;
    - la subida dice cuántas fallaron;
    - «Carta»;
    - la búsqueda no anuncia el total de antes.
  - **Rendimiento**: una página de unos 40 KB se abre lista para escribir en 748 ms (prueba e2e
    `rendimiento.spec.ts`, en el VPS; en la CI no se mide).
  - **Queda para Enrique** (infraestructura o producto, no se ha hecho):
    - Chromium en un contenedor aparte, sin secretos y con su sandbox (ahora va en el de la app, sin sandbox y con el
      entorno limpio);
    - una cuota de almacenamiento por organización;
    - quizá más memoria para la app si se sacan PDF grandes.
  - **Siguiente**: revisar con Enrique los criterios de éxito de la spec en staging, y la etapa de interfaz.
- **Pendientes de permiso de Enrique:**
  - Servicio de systemd para Foundry: ahora corre como proceso de la sesión y se para al cerrarla; se arranca con el
    comando de `research/foundry/entorno.md`.
- **D&D Beyond:**
  - Enrique inicia sesión él mismo en un Chromium del VPS con depuración solo en loopback (`--remote-debugging-port=9222`).
  - Desde VS Code reenvía el puerto 9222 (pestaña Ports), abre `chrome://inspect` en su Chrome, añade `localhost:9222`
    y pulsa *inspect*.
  - El estudio se conectaba luego a esa sesión con REA; desde el 2026-11-03 REA ya no se usa y se hace con
    craft-anything (falta ver cómo se engancha a esta sesión).
  - Antes con REA: `list_browser_targets` / `capture_browser_scenario` en modo `connect`.
  - Así se lanza el navegador. Va sin sandbox porque este Ubuntu no lo permite, como Playwright y REA:
    `xvfb-run -a -s "-screen 0 1920x1080x24" ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --no-sandbox
    --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir=$HOME/rea-workspace/chromium-ddb
    --no-first-run --window-size=1920,1080 https://www.dndbeyond.com/sign-in`.
  - Enrique entra con Google. El botón abre una ventana aparte, «Sign in - Google Accounts», que hay que abrir con su
    propio *inspect* en `chrome://inspect`. Funcionó el 2026-10-29.

Estados: pendiente · en curso · hecho · descartado.

| # | Módulo | Estado | Estudio principal (craft-anything) |
|---|---|---|---|
| 0 | **Fundación**: monorepo, CI, despliegue, cuentas, organizaciones, mundos, campañas, roles, historial y deshacer, esqueleto del MCP | **hecho** (2026-10-29; Discord y Google, pospuestos) | Foundry: modelo de documentos y permisos; DDB: campañas e invitaciones |
| 1 | **Wiki**: páginas y subpáginas, editor de bloques, enlaces, menciones, vista previa, propiedades, secretos, búsqueda, marcadores, etiquetas, versiones, recursos y archivos, **hojas con estilo** (tipo Homebrewery, con PDF), exportación MD, sus herramientas MCP | construido (tareas 1 a 26 hechas); falta la revisión de Enrique en staging | Foundry: Journal; DDB: contenido y referencias; Homebrewery (MIT): formato de hoja y descarga |
| 2 | **Tipos de página y plantillas**: «Desde plantilla» (de serie y propias), campos en el panel, tablas que se llenan solas (en lugar de Dataview) | construido (tareas 1 a 14, 2026-11-03); falta la revisión de Enrique en staging | Foundry: tipos de documento; Kanka, LegendKeeper y World Anvil (web pública) |
| 3 | Sistemas de reglas, fichas de personaje (creación, subida de nivel), dados y dados 3D | **hecho** (2026-11-06, PR #95 a #108; Crisol vacío, ADR-0015); falta que Enrique lo pruebe (`tasks/probar.md`) | DDB: creador y hoja; Foundry: dnd5e, DataModel e instalar y crear sistemas |
| 4 | Compendios (aparte de la wiki del mundo y **como los de Foundry**: antes, estudio a fondo con craft-anything), bestiario, statblocks, biblioteca; **las imágenes de lo traído de Foundry** (las de cada documento del zip); **buscar dentro de los PDF** (texto de cada página con pdf.js; el resultado abre el visor en esa página) **y por significado** (pgvector; antes, permiso para la imagen de Postgres y elegir quién calcula los embeddings) | **hecho** (2026-11-06, PR #110 y #111; `docs/specs/modulo-4.md`); falta que Enrique lo pruebe (`tasks/probar.md`) | Foundry: compendium packs; DDB: listados |
| 5 | Visibilidad por campaña: conocimiento de los jugadores, revelar, compartir | **hecho** (2026-11-07, PR #112, en staging) | Foundry: ownership |
| 6 | **Mesa**: escenas, rejilla, fichas, medir y plantillas, niebla, muros, puertas, luz, visión, iniciativa, instantáneas, encuentros, UVTT; **las escenas, mapas y tokens de un zip de Foundry** | **hecho** (2026-11-07, PR #114, en staging) | Foundry: canvas, visión y muros; DDB Maps |
| 7 | **Sala de jugadores**: presencia, chat y susurros, mostrar a jugadores, sonido (también **los de un zip de Foundry**), controles del máster | **hecho** (2026-11-11, PR #117, en staging); falta que Enrique lo pruebe y confirme el ADR-0022 | Foundry: sockets y chat; DDB: game log |
| R | **Revisión de la app** (2026-11-11): nueve tandas (`tasks/plan-revision.md`); la campaña, aparte | **en curso** (tanda 1) | Roliando y Roll20 (editor de sistemas); 5etools (libros) |
| 9 | **Pizarras y mapas con capas**: la pizarra como pestaña; regiones, rutas, textos y capas en los mapas, escala y medir | pendiente (el primero tras la revisión) | DDB Maps |
| 8 · mundo | **Calendarios y líneas temporales**: calendarios del mundo con su editor, eventos y la línea temporal como pestaña | pendiente (tras el 9) | — |
| 10 · mundo | **Herramientas del mundo**: grafo de relaciones y árbol familiar, tableros, gráficos, generador de nombres | pendiente (tras el 8) | — |
| 8 · campaña | El «hoy» de cada campaña, el clima y los viajes | pendiente (con la revisión de la campaña) | — |
| 10 · campaña | El centro de actividad y la pantalla del máster | pendiente (con la revisión de la campaña) | — |
| 11 | Pagos y planes del SaaS | **descartado** (Enrique, 2026-11-11: herramienta propia, gratuita y de uso privado; ADR-0023) | — |

Cada módulo nace con su API y sus herramientas MCP.

**Orden desde el 2026-11-11** (Enrique): primero la revisión de la app (R), una tanda cada vez; después los módulos 9,
8 y 10 en lo que es del mundo, que nacen sobre el registro de tipos de pestaña, las plantillas-modelo (ADR-0024) y el
cristal. Lo de la campaña de los módulos 8 y 10 va con la revisión de la campaña, más adelante. El 11 se descarta
(ADR-0023).

**Entre el 0 y el 1, fase de diseño** (decidido con Enrique, 2026-10-29). La interfaz del módulo 0 funciona y es
accesible, pero no tiene un diseño visual pensado. Antes de la wiki, que es lo más visual:
- Identidad (tipografía, paleta, tono).
- Kit de componentes.
- Repaso de las pantallas del 0.

Se hizo con la skill `frontend-design` de Anthropic y con cuatro de Vercel (`web-design-guidelines`,
`react-best-practices`, `composition-patterns`, `react-view-transitions`). **Desde el 2026-11-10 las sustituye
impeccable** (`.claude/skills/impeccable`, Apache-2.0; ver `CLAUDE.md`), que además revisa la interfaz en cada módulo.

Identidad elegida (2026-10-29): **Hoja**, la séptima del lienzo, pedida como «rollo dndbeyond». Del género se toma
el aire (cajas de hoja de personaje, títulos condensados en mayúsculas, rojo fuerte), nunca colores, letras ni piezas
de D&D Beyond. Oscuro o claro según el sistema, con el botón para cambiarlo.

Desde entonces, cada módulo lleva un paso de diseño entre la spec
y el plan (ver `CLAUDE.md`).

## Para el repaso final de la interfaz

Lo que a Enrique no le convence (apuntarlo aquí según lo diga). Se repasa al acabar el módulo 1, no al final de la
app: el 2026-10-30 dijo «luego apuntaremos por donde vamos y nos dedicaremos a la UI, que es horrible».

- **El aspecto de un sistema traído de Foundry** (2026-11-06): sacar de su CSS sus colores, fuentes y fondos como tema
  de su hoja y su compendio (no su CSS tal cual).

- **2026-10-30, al empezar la etapa**: «No me gusta casi nada de la interfaz actual, es horrible y no se entiende nada!!
  […] el crisol antiguo era más bonito y profesional, la nuestra parece una app de ia. Me refiero a la interfaz en
  general, hay cosas del nuevo que me gustan como las formas de los recuadros, pero en general parece una app de IA.
  […] quiero una combinacion de ambas app, con lo mejor de cada una».
  - **Cambia lo de «el actual, deséchalo»** (fase de diseño, 2026-10-29): el Crisol antiguo vuelve a ser referencia de
    aspecto. Es código propio de Enrique, así que la sala limpia no lo impide; lo que sí sigue fuera es cualquier cosa
    copiada de otros productos.
  - **Del nuevo le gusta**: la forma de los recuadros (las esquinas cortadas, `--cut`).
  - **Del antiguo** (tema en `~/crisol-app/packages/ui/src/theme.css`, solo de consulta): grises neutros, oscuro por
    defecto, Roboto en minúscula normal, cada nivel de título con su color, el rojo solo en lo importante y un espacio
    de trabajo con barra lateral de iconos, paneles a los lados y barra de estado.
  - **Primera lectura de Claude, por confirmar con él**: lo que hace que el nuevo «parezca de IA» es que todo va en
    mayúsculas condensadas (Barlow Condensed en títulos, botones, pestañas y rótulos); filas de botones con borde para
    cada acción (la cabecera de la página, «Secreto», «Nota oculta», «Bloque», «Buscar en la página» sobre el texto);
    textos de ayuda fijos en pantalla («Arrastra para recolocar…»); y poca jerarquía entre lo principal y lo
    secundario. «No se entiende nada» apunta a lo mismo: demasiadas acciones a la vista, todas con el mismo peso.
- **Lienzo «Crisol: interfaz»** (claude.ai, privado: https://claude.ai/artifact/QLHQADLdZSnTn5uzTubqf7; fuentes en
  `out/lienzo-interfaz/`, fuera de git). Primera ronda, la página y el editor: «Me gusta mucho más que el actual, al
  menos a grandes rasgos». Segunda ronda, el resto de pantallas: entrar, mis mundos, buscar y Ctrl+K, la hoja (sola o
  con el editor, con la nota lateral rodeada por el texto), la IA y sus aprobaciones, historial (con el aviso claro
  cuando no se puede deshacer) y papelera, y el móvil.
- **Segunda ronda** (2026-10-30): «Lo demás me gusta bastante, como primera aproximacion me gusta mucho, luego ya
  iremos puliendo». Pidió:
  - **Mundos**: «que puedan configurarse con un icono en el recuadro para cambiarle el nombre, la portada y lo que
    creas oportuno, las lineas que has puesto no me gustan». En el lienzo: botón de ajustes en la tarjeta (nombre,
    descripción, portada o un color, icono, exportar y borrar) y sin las líneas de adorno. **Es nuevo en el servidor**:
    hoy un mundo solo tiene nombre.
  - **«IA», no «Claude»**: «esto debe poder conectarse a cualquier IA, así que mejor usar IA no?». En la interfaz se
    dice «IA» («La IA quiere…», «Conectar una IA», «En tu app de IA, añade un conector MCP…»); el nombre de la app
    conectada, solo donde se ve qué está conectado. Hay que cambiar los textos de `apps/web/src/i18n.ts`
    (`approvals`, `ai`).
  - **La hoja «se ve mal»**, «no sé si es solo porque es el boceto»: por concretar con él.

## Decisiones por módulo

### 0. Fundación (repaso con Enrique, 2026-10-29)

- **Para quién**: al principio solo Enrique (único máster) y sus jugadores de Fateforge. Nadie más hasta los pagos
  (módulo 11). Sin registro abierto: se entra por invitación.
- **Inquilinos**: el modelo de datos admite varias organizaciones desde el primer día, pero la interfaz solo maneja
  una. Una cuenta puede estar en varias organizaciones y campañas.
- **Roles**: el módulo 0 solo tiene **máster** y **jugador**. El rol se guarda en cada pertenencia para añadir más
  tarde co-máster y espectador sin migrar.
- **Invitaciones**: un **enlace por campaña** que el máster manda por WhatsApp o Discord. Al abrirlo, el jugador entra
  con Google, Discord o email + contraseña y queda en la campaña. Sin invitación por email, sin códigos y sin acceso de
  invitado.
- **Historial y deshacer**: cada cambio queda apuntado con quién (persona o IA), cuándo y antes/después, agrupado por
  operación; se deshace una operación entera. Historial 90 días; papelera 30 días. Versiones de página y el Ctrl+Z del
  editor llegan con la wiki (módulo 1).
- **MCP**: el máster conecta Claude por OAuth con su cuenta (sin Dex ni pasarela) y Claude actúa con sus permisos.
  Herramientas: ver mundos, campañas y miembros; crear mundo y campaña; generar enlace de invitación; ver historial y
  deshacer. Los tres modos de IA (solo lectura, asistente, copiloto) y la cola de aprobación ya funcionan.
- **Fuera del módulo 0**: co-máster, espectador, invitado, registro abierto, invitación por email, varias
  organizaciones en la interfaz, pagos, versiones de página, Claude de los jugadores, prompts/recursos/skills MCP.
- **Hecho cuando**: Enrique crea Eana y dos campañas; un jugador entra con el enlace y solo está en la suya; Claude
  crea una campaña desde claude.ai y Enrique la deshace; todo desplegado en `neo.crisol…` con la CI en verde.

### Ideas de Enrique para módulos siguientes (2026-10-29, para repasar en su entrevista)

- **Sistemas (módulo 3)**: los sistemas se instalan antes y también se pueden crear, con una forma parecida a la de
  Foundry (un paquete con su manifiesto y su modelo de datos).
  - **El sistema es de la campaña, no del mundo** (Enrique, 2026-10-30, cambia la idea anterior de elegirlo al crear
    el mundo): «los mundos no necesitarán sistema al crearse pero las campañas sí, así un máster puede decidir jugar
    una campaña en su mundo con D&D y otra con Daggerheart». Crear un mundo sigue sin pedir sistema; crear una campaña
    lo pedirá, y las campañas que ya existan tendrán uno por defecto.
  - Sala limpia: de Foundry se estudia cómo lo resuelve (manifiesto, DataModel, instalación, actualizaciones). Si nos
    conviene ser compatibles con su formato de sistemas se decide en la entrevista; su código no entra, ni los sistemas
    de su comunidad, que llevan cada uno su licencia y están escritos contra su API.
  - El Crisol actual ya guarda el sistema como datos (`.crisol/sistema.json`, con herramientas para crearlo, validarlo y
    probar tiradas): repasarlo en `docs/inventario.md` § 5.
- **Creador de personajes y hoja (módulo 3)**: de D&D Beyond, son lo fundamental (Enrique, 2026-10-29). En el módulo 3
  se estudian a fondo con craft-anything: el paso a paso del creador, subir de nivel, la hoja en escritorio y en el móvil,
  tiradas desde la hoja, y cómo se ven y se gestionan los recursos y el inventario. Se estudian en la cuenta de
  Enrique, solo mirando. La sesión queda en el perfil del Chromium del VPS (`~/rea-workspace/chromium-ddb`); si ha
  caducado, Enrique vuelve a entrar como en «D&D Beyond», más arriba.
- **Hojas con estilo (módulo 1)**: que las páginas de la wiki tengan el formato de las hojas de rol (dos columnas,
  pergamino, statblocks, notas al margen) y se puedan descargar, al estilo de
  [Homebrewery](https://github.com/naturalcrit/homebrewery).
  - Homebrewery tiene licencia MIT: su código se puede leer directamente y aprovechar con su atribución. craft-anything sirve para
    ver en la web cómo pagina e imprime.
  - Cuidado con su tema 5e: las fuentes y las imágenes llevan licencias propias (varias CC BY-SA, que `CONSTRAINTS.md`
    no admite) e imitan el aspecto de los libros de WotC. Para un producto de pago, un tema propio con ese aire,
    fuentes libres (OFL) y descarga en PDF y para imprimir.

- **Registro público desde la landing** (2026-10-30, al pulir la interfaz). Enrique: «si alguien llega a nuestra futura
  landing page y le da a registrarse […] ¿como se puede saber la organizacion antes del registro? ¿Tiene sentido una
  organización? Cada usuario tendrá su cuenta y en el momento del registro como en una serie de pasos eligirá si es
  jugador o master o ambas cosas». Enrique aceptó la propuesta («Vale»): ADR-0004.
  - la organización se queda por debajo, sin verse: cada cuenta nueva tiene su espacio (donde van el plan y la cuota);
    más adelante, grupos opcionales (club, tienda, asociación con varios másteres);
  - registro en pasos:
    1. la cuenta, con verificación del email y aceptar condiciones;
    2. «¿qué vas a hacer?» (dirigir, jugar o las dos), como preferencia y no como permiso;
    3. primeros pasos: el primer mundo, o pegar el enlace de invitación;
  - con el módulo 11 (pagos y planes), con su ADR. La pantalla de arranque es la de instalar; la del registro
    reutiliza sus campos (`NewAccountFields`).
- **Módulos que se añaden a la app, como en Foundry** (2026-10-30): que aparezcan en la portada. Idea a medio plazo;
  ejecutar código de terceros en un SaaS pide aislarlo, permisos y versiones. Se decide con su ADR, junto a los
  sistemas del módulo 3.

### 1. Wiki (entrevista con Enrique, 2026-10-29)

- **Para qué**: la wiki completa del Crisol nuevo. No se usa de verdad hasta que la app esté terminada: mientras, Eana
  sigue en el Crisol actual y no se pasa nada.
- **Sin importador**: al migrar, Eana se pasa con Claude por el MCP. Las herramientas MCP de la wiki tienen que bastar
  para crear y editar páginas con subpáginas, propiedades, enlaces, secretos y archivos, y a buen ritmo (muchas
  páginas).
- **Entra todo lo de la wiki del Crisol actual** (`docs/inventario.md` § 2):
  - árbol de páginas y subpáginas, recolocar, pestañas, selector rápido, paleta de órdenes;
  - búsqueda, marcadores con grupos, etiquetas, enlaces entrantes, índice del documento;
  - menciones sin enlazar, vista previa al pasar el ratón, incrustados, migas de pan;
  - portada, título en línea, propiedades, candado de lectura;
  - editor de bloques con su menú «/»: texto, títulos, listas, casillas, cita, código, tabla, separador, secreto,
    callout, caja, enlace o página nueva, nota oculta, imagen;
  - versiones con restaurar, recursos y archivos, visor de PDF, exportar a Markdown.
- **Hojas con estilo**:
  - Cada página puede activar el formato de hoja de rol: dos columnas, aire de pergamino, statblocks y notas al margen.
  - Siempre hay una vista sencilla, más fácil de leer.
  - El máster elige por página si se ve como hoja, y quien lee puede volver a la sencilla.
  - Se descarga en PDF o se imprime.
  - Referencia: el repositorio de Homebrewery (MIT, código aprovechable con atribución). Tema propio con fuentes OFL;
    nada de su tema 5e.
- **Fuera del módulo 1**:
  - el importador;
  - editar en Markdown a mano: el texto vive en la base de datos y para eso está exportar;
  - los bloques de mapa, línea temporal y tirada (módulos 9, 8 y 3);
  - las consultas tipo Dataview y Bases (módulo 2);
  - que los jugadores lean la wiki: hasta el módulo 5 es solo del máster;
  - el pulido de la interfaz, que va al final.
- **Secretos**: se escriben ya y se ven marcados como secretos. Se guardan aparte desde el principio, para que el
  módulo 5 los proyecte por jugador sin rehacer nada (ADR-0003).
- **Hecho cuando**:
  - En staging, Enrique crea y edita páginas de prueba con todo lo anterior y las ve en las dos vistas.
  - Saca el PDF de una hoja.
  - Claude crea y edita desde claude.ai páginas con subpáginas, propiedades, enlaces y secretos.

### 2. Tipos de página y plantillas (entrevista con Enrique, 2026-11-03)

- **Para qué**: que las páginas del mundo tengan tipo (PNJ, Lugar, Facción…) con sus campos, y que las tablas que hoy
  hace Dataview («los PNJ de esta facción», «lo que lleva este PNJ») salgan solas. En Eana hay unas 570 páginas con
  tipo (PNJ, lugares, objetos, facciones y frentes, además de las reglas) y 45 tablas de Dataview, casi todas de ese
  estilo: las páginas de un tipo cuyo campo apunta a la página en la que se está.
- **«Desde plantilla»** en «Página nueva», junto a Texto, Mapa, Pizarra, Línea temporal y Árbol. La página sale con
  sus campos en el panel de la derecha y sus apartados en el texto (un PNJ: Especie, Rol, Facción y Lugar en el panel;
  Quién es, Cómo interpretarlo y Ganchos en el texto). Sin pestañas.
- **La página recuerda de qué plantilla salió** («es un PNJ») y después se edita libremente: se quitan o se añaden
  campos y apartados. Lo que no se toca es el esqueleto de la plantilla.
- **Plantillas de serie** (fijas, no se editan): PNJ, Lugar, Facción, Objeto, Misión y Sesión.
- **Plantillas propias**: de toda la cuenta (como las etiquetas), hechas desde cero o copiando una de serie. Estas sí se
  editan; cambiarlas no toca las páginas ya hechas. «Frente» será la primera, desde cero, para probarlo.
- **Tablas que se llenan solas**: bloques del panel («Miembros», «Habitantes», «Lugares dentro», «Lleva encima») que
  vienen en la plantilla o se añaden a mano con desplegables («páginas de tipo [PNJ] cuyo [Lugar] es esta página»).
  Sin lenguaje de consultas.
- **Campos** (propuesta de Claude, sin objeciones): texto, número, opciones, enlace a una página (de un tipo o de
  cualquiera), varios enlaces, reloj de segmentos y casilla.
- **La IA**, por el MCP: crear páginas desde plantilla, crear plantillas propias y leer esas tablas.
- **Fuera del módulo 2**:
  - el compendio (reglas, conjuros, criaturas, dotes): va aparte de la wiki del mundo, en el módulo 4, y tiene que
    funcionar como el de Foundry; antes, un estudio a fondo con craft-anything;
  - PJ y tablas aleatorias (módulo 3, con las fichas y los dados);
  - formularios (Enrique: «no me interesa») y un lenguaje de consultas como Dataview o Bases;
  - que cambiar una plantilla cambie las páginas ya hechas;
  - lo que ven los jugadores de esas tablas (módulo 5).
- **Hecho cuando**: Enrique crea un PNJ desde plantilla, le pone su facción y sale solo en «Miembros» de la facción;
  hace «Frente» desde cero y la usa; la IA hace lo mismo desde claude.ai.

### 3. Sistemas, fichas y dados (entrevista con Enrique, 2026-11-04, primera parte)

Preguntas con propuesta; lo que eligió:

- **El contenido del creador** (clases, especies, trasfondos, dotes, conjuros): **lo trae cada sistema**, como en
  Foundry, con el del SRD como datos. El módulo 4 añade las pantallas del compendio y el contenido propio (las clases
  de Fateforge, por ejemplo).
- **De serie, 5e 2014 y 5e 2024** (SRD 5.1 y SRD 5.2, CC BY 4.0). Fateforge parte de la de 2014.
- **Compatibles con los sistemas de Foundry, también su código**: instalar un sistema de Foundry tal cual, con sus
  hojas y su automatización. Se le avisó del coste (rehacer buena parte de su API en el navegador y aislar ese código) y
  de que la licencia puede no permitirlo, y lo eligió igualmente. Antes de la spec:
  - el estudio mide qué parte de la API de Foundry usa un sistema real (dnd5e) para dar el tamaño;
  - se comprueba qué permiten las licencias: la de Foundry, la de cada sistema y el uso de su nombre (en la interfaz
    no sale);
  - un ADR nuevo: cómo se aísla el código de terceros en un SaaS (otro origen, sin acceso a la sesión ni a otros
    mundos) y cómo encaja con los sistemas propios, que son datos.
  - Propuesta de orden: primero los sistemas propios como datos con la forma de los de Foundry (manifiesto, tipos y
    campos), que hacen falta igual para los de serie; luego la capa que ejecuta su código.
- **La hoja de un PJ la llevan su jugador y el máster**: el jugador crea su PJ con el creador y lleva su hoja; el
  máster ve y cambia todas. La wiki sigue siendo solo del máster hasta el módulo 5.
- **Las tiradas las ve toda la campaña**: dados 3D y un historial de tiradas de la campaña en vivo; el máster ve las
  de sus jugadores y puede tirar en oculto. El chat y los susurros, con la sala (módulo 7).
- **La hoja, por bloques**: cada sistema compone la suya con bloques, como el diseño de hoja del Crisol actual; los de
  5e traen una al estilo de D&D Beyond, con el aspecto de Crisol.
- **Pendiente de preguntar**: las tablas aleatorias (pasaron del módulo 2 a este), subir de nivel y el creador paso a
  paso con detalle (tras el estudio de D&D Beyond), e importar los PJ de Eana (por el MCP, como todo lo demás).

#### `personajes` (entrevista con Enrique, 2026-11-05)

Lo que quiere (confirmado con un «sí»):

- **Quién crea**: los tres. Sus jugadores (cada uno los suyos), él como máster (ve y cambia todos) y la IA por el MCP,
  que tiene que poder hacer un personaje entero con las mismas piezas que la pantalla.
- **Para cualquier sistema**: el motor del creador es común y **los pasos se escriben para cada sistema**, como parte
  de él («si no, es un caos»). Los del 5e van de serie; los de los demás los escribe la IA al hacer el sistema.
- **El creador, como el de D&D Beyond**: pasos con navegación libre, lo pendiente marcado con (!), y lo que hay que
  elegir lo dicen el contenido y lo que concede (clase, especie, trasfondo, dotes, subclase, conjuros). Las
  características, con matriz estándar, compra por puntos, 4d6 y manual.
- **Subir de nivel, también como en D&D Beyond**: sin un asistente aparte, cambiando el nivel de la clase y eligiendo
  lo que toca en el nivel nuevo, con multiclase (y el motivo cuando una clase no se puede tomar).
- **Versiones, visibles y automáticas**: una al terminar de crearlo y otra en cada subida de nivel («Nivel 5»), que se
  ven y se restauran desde la ficha. Sin versiones a mano.
- **Tablas aleatorias, como pieza común**: datos que se tiran en el servidor con su registro; las usa el creador
  (rasgos de personalidad, bagatelas) y sobre todo el máster (desde la wiki o la IA: `tirar_en_tabla`). Sus pantallas
  del compendio y sus colecciones, en el módulo 4.
- **Los PJ de Eana, al final**: Enrique hará el sistema de Fateforge y los pasará él con la IA. En `personajes`, solo
  que la IA pueda hacer un personaje entero por el MCP.
- **Hecho cuando**: un jugador hace su PJ de 5e de nivel 1 y lo sube a 5 con multiclase; la IA crea uno entero desde
  claude.ai; Enrique vuelve a una versión anterior desde la ficha.
- **Fuera**: la hoja y tirar desde ella (`hoja`); las pantallas del compendio (módulo 4); los PJ de Eana; versiones a
  mano.

Lo que dice el estudio de Foundry (`research/foundry/avances-y-tablas.md`, 2026-11-05): dnd5e describe lo que se gana
en cada nivel con nueve tipos de «avance», guarda lo elegido en la copia de la clase que lleva el personaje y escribe
parte a pelo en él (con fallos conocidos cuando algo llega de dos sitios); no tiene creador, ni versiones, ni genera
características, y al bajar de nivel pierde lo elegido. Para Crisol: pasos de tipos neutros (sin nada de 5e) escritos
por sistema; las elecciones son la verdad y la hoja se calcula de ellas; el personaje apunta al contenido en vez de
copiarlo; la lista de pasos se calcula siempre (eso da la navegación libre con (!)); un borrador en el servidor que se
confirma de una vez con su versión; la IA recibe la misma lista de decisiones pendientes; las tablas aleatorias, con el
modelo de Foundry pero tiradas en el servidor, con su registro y lo sacado por campaña.

#### Lo que dicen los estudios (2026-11-04, con craft-anything)

Notas: `research/foundry/sistemas-y-su-api.md` y `research/dndbeyond/creador-y-hoja.md`.

- **Foundry, para instalar sus sistemas «tal cual»**: un sistema corre entero en el navegador; dnd5e usa unos 490
  miembros de la API de Foundry (unos 375 para abrir una hoja y tirar desde ella) y hereda 66 de sus clases, cuyo
  comportamiento habría que imitar; cada versión de Foundry cambia cientos de puntos. Se aislaría en un iframe de otro
  dominio, sin red, con un puente al servidor de Crisol (que pone los permisos, el azar de las tiradas y el historial).
- **Licencias** (no es asesoría legal): su EULA prohíbe publicar código de Foundry, así que solo cabe una API propia
  escrita en sala limpia. El código de dnd5e es MIT y su texto, SRD, pero sus fichas de criaturas, su arte y varios
  iconos solo valen dentro de Foundry; en otros sistemas pasa igual o su contenido prohíbe cobrar (PF1 y CoC7, GPL).
  Hay que preguntar a un abogado: la directiva 2009/24 (interoperabilidad), la marca y la ley del EULA.
- **Orden que propone el estudio**: 1) sistemas propios como datos con la forma del manifiesto de Foundry; 2) a la vez,
  el abogado y el ADR del aislamiento; 3) importar los datos de un sistema de Foundry, filtrando por licencia; 4) un
  prototipo en el que dnd5e abre una hoja solo para leer, para medir y decidir si se sigue; 5) editar y tirar; 6) el
  resto; 7) un segundo sistema (PF2e) antes de abrirlo a la comunidad.
- **D&D Beyond**:
  - el creador: una portada de preferencias y cinco pasos libres (clase, trasfondo, especie, características,
    equipo), con lo pendiente marcado;
  - subir de nivel es cambiar un número, sin asistente ni deshacer;
  - la hoja: seis zonas y una caja con pestañas; todo número tira con un clic, y el registro de la campaña lleva el
    desglose;
  - el inventario, con contenedores, carga, sintonía, monedas y uno común del grupo.

#### Para la segunda parte de la entrevista (con propuesta)

1. **Foundry**, con lo que dice el estudio de licencias: ¿seguimos el orden del estudio, con los sistemas propios
   primero y la capa de Foundry tras el abogado y el prototipo? *Propuesta: sí.*
2. **Personaje a medias**: ¿un borrador que no sale en la lista hasta estar listo, o un personaje «a medias» como en
   D&D Beyond? *Propuesta: el borrador.*
3. **Subir de nivel**: ¿con un asistente paso a paso? ¿Sube el jugador solo o con el visto bueno del máster?
   *Propuesta: asistente; sube el jugador y el máster lo ve en el historial y lo puede deshacer.*
4. **Versiones del personaje** para volver atrás. *Propuesta: sí, como las de las páginas.*
5. **Mezclar 2014 y 2024** en un personaje. *Propuesta: no; cada edición es su sistema.*
6. **Tiradas privadas**: «solo para mí» y «solo al máster». *Propuesta: las dos; el máster ve también las «solo para
   mí»*.
7. **La ventaja**, cuando la hoja la conoce: ¿la propone sola? *Propuesta: la propone, y se puede quitar.*
8. **Quién compone la hoja**: ¿solo el sistema, o también el máster? *Propuesta: el sistema; el máster, copiando el
   sistema para hacer el suyo.*
9. **Métodos de características**: estándar, compra por puntos, tiradas y a mano, eligiendo el máster cuáles valen.
10. **Inventario del grupo** compartido. *Propuesta: sí, en la campaña.*
11. **Tablas aleatorias** (pasaron del módulo 2): ¿un bloque de la wiki que se tira con los dados? *Propuesta: sí.*

#### Segunda parte de la entrevista (2026-11-04)

- **Foundry: el orden del estudio**. Primero, los sistemas de Crisol como datos con la forma de los de Foundry; a la
  vez, la consulta al abogado; luego, importar sus datos filtrando por licencia, y un prototipo en el que dnd5e solo
  abre una hoja para leerla. Con eso se decide si se sigue con la capa que ejecuta su código.
- **Personaje a medias, como en D&D Beyond**: sale en la lista desde el principio, marcado como incompleto.
- **Subir de nivel cambiando el número** de la clase en el creador, y eligiendo lo que aparece (como D&D Beyond).
- **Versiones del personaje, como las de las páginas**: cada cambio queda en el historial y se ven y restauran las
  anteriores.
- **2014 y 2024 se mezclan, como en D&D Beyond** (cambia lo de la primera parte): un solo sistema 5e con las dos como
  fuentes (SRD 5.1 y SRD 5.2) que el máster activa en su campaña.
- **Tiradas privadas**: «solo para mí» y «solo al máster»; el máster ve también las «solo para mí» y puede tirar en
  oculto.
- **La ventaja, propuesta**: si la hoja sabe que la hay, la tirada sale con ella marcada, dice por qué y se quita con un
  clic.
- **La hoja la componen el sistema y también el máster**: el máster recoloca los bloques de la hoja en su campaña sin
  copiar el sistema.
- **Características**: los cuatro métodos (valores estándar, compra por puntos, tiradas y a mano), y el máster elige
  cuáles valen en su campaña.
- **Inventario del grupo, en la campaña**: lo ven y cambian sus jugadores y el máster, y de él se pasan cosas a cada
  personaje.
- **Las tablas aleatorias, con el compendio (módulo 4)**, como en Foundry.
- **Las preferencias, de cada personaje** (PG fijos o tirados, carga, privacidad…), como en D&D Beyond.
- **El contenido del SRD, en español y en inglés**, y cada campaña elige. La traducción al español es nuestra (con la
  IA y revisada), con su atribución y los términos habituales; si la editorial tiene una versión oficial en español con
  la misma licencia, se parte de ella (la hay: ver `srd-5e`, abajo).
- **Quién instala un sistema**: Crisol trae un catálogo de sistemas revisados (los de serie y, más adelante, los
  importados de Foundry cuya licencia lo permita), y cada máster puede crear o subir el suyo para su cuenta.

#### `srd-5e` (entrevista con Enrique, 2026-11-04)

- **Hay SRD oficial en español de las dos ediciones**, con licencia Creative Commons: el 5.1 y el 5.2.1 (traducido en
  diciembre de 2025), en la página del SRD de D&D Beyond. Se parte de ellos: no hace falta traducirlo con la IA.
- **Todo el SRD, «como en D&D Beyond»**: las reglas que calculan el personaje y todo el contenido de las dos ediciones
  (clases y subclases, especies, trasfondos, dotes, conjuros, equipo, objetos mágicos, criaturas, estados y el texto de
  las reglas), en español y en inglés.
- **Todo automatizado**: cada cosa lleva su mecánica (un conjuro, su ataque o su salvación y su daño por nivel; un
  arma, su ataque y su daño; un objeto, sus bonos y su sintonía; un rasgo, sus usos y su descanso), y la hoja calcula y
  tira sola. Lo muy complejo (Forma salvaje, Polimorfar, Deseo) va como texto y se lleva a mano, como en D&D Beyond.
- **Preparado para todo el 5e oficial**: Enrique quiere un marketplace y negociar con Wizards para vender sus libros en
  la app. El modelo tiene que valer para lo que no está en el SRD; cada cosa dice de qué libro sale y con qué licencia
  (y, más adelante, qué cuentas lo tienen).
- **Sin pantallas nuevas en `srd-5e`**: el 5e sale en «Sistemas» como uno de serie y se prueba en «Probar» (un guerrero
  de nivel 5 con su equipo da su CA, su ataque y sus PG con el desglose) y por la IA. Buscar y leer el contenido, con el
  compendio del módulo 4.
- **Las dos ediciones en una campaña, como en D&D Beyond**: lo que está en las dos sale con su fuente y lo de 2014 como
  «Legado»; la campaña activa o desactiva cada edición, esconde lo legado o deja solo lo más nuevo de lo repetido; las
  reglas generales que cambian (el agotamiento, la sorpresa…) las decide un ajuste de la campaña. Antes de la spec, se
  mira en D&D Beyond cómo lo hace.
- **Hecho cuando**: todo lo de los dos SRD está dentro (contado por categorías) en los dos idiomas; unos personajes de
  referencia (cada clase, en los niveles 1, 5, 11 y 20, en las dos ediciones) dan lo que dicen las reglas; el guerrero
  de «Probar»; la IA consulta un conjuro y prueba su tirada; y las opciones de las ediciones en la campaña.
- **Límites**: sala limpia (el contenido sale solo de los PDF oficiales del SRD, nada de D&D Beyond ni de Foundry), la
  atribución CC BY 4.0 de cada uno y sin la marca «D&D» en la interfaz.
- **Fuera de `srd-5e`**: el compendio (módulo 4), el creador y la hoja (`personajes`, `hoja`), el marketplace y los
  libros que no son SRD (solo el modelo preparado), el contenido de Fateforge (módulo 4) e importar de Foundry.

### 4. Compendio, criaturas y biblioteca (entrevista con Enrique, 2026-11-06)

- **Para cualquier mundo y cualquier sistema** (Enrique: «te centras mucho en eana pero será uno de los muchos mundos
  que jugaré igual que fateforge uno de los muchos sistemas»). Eana y Fateforge, como mucho, de ejemplo.
- **Los PDF, no tan importantes** («tampoco me parece super importante lo de pdf»), pero entran («ok, entra todo»).
- **La wiki cuenta la historia; el statblock está en el compendio**: la página de un PNJ enlaza a su criatura del
  compendio. «En partida se debe comportar como en Foundry o D&D Beyond».
- **Tres capas de compendio**: la del sistema, la de la cuenta (para todos sus mundos) y **la del mundo**, como los
  compendios de mundo de Foundry. Lo del mundo se hace para un sistema y solo sale en las campañas que lo usan; si se
  quiere en otro mundo, se copia a la cuenta. (Hoy lo que se añade en la app va al sistema de la cuenta.)
- **Las criaturas en juego, como en Foundry o D&D Beyond**: cada criatura tiene su hoja con sus acciones para tirar;
  desde la campaña se pone en juego. Las genéricas, una copia por aparición (tres goblins, cada uno con sus PG, que se
  van al acabar); las únicas (el jefe), la misma siempre, con sus PG y sus usos de una sesión a otra.
- **Entra todo lo apuntado**: las imágenes de lo traído de Foundry, las tablas aleatorias en el compendio (las de
  Foundry y las propias, para tirar), el inventario del grupo en la campaña y la biblioteca de PDF (buscar dentro y
  abrir en la página; buscar por significado).
- **Búsqueda por significado**: pgvector (permiso para cambiar la imagen de Postgres en desarrollo, la CI y staging;
  la propuesta, una propia sobre la `postgres:17-alpine` de hoy, en `docs/specs/biblioteca.md`) y **un modelo propio
  en el VPS** («modelo propio si puede correr en el vps»); si no
  cabe, se le vuelve a preguntar.
- **Hecho cuando**: un máster copia una criatura del sistema al compendio de su mundo, la cambia y la enlaza desde la
  página de un PNJ; pone en juego tres copias y una única, tira sus ataques y les baja los PG, y la única los conserva
  en la sesión siguiente; trae un sistema de Foundry con sus imágenes y sus tablas; sube un PDF, busca una palabra y se
  abre en esa página; la IA hace todo esto por el MCP.
- **Límites**: nada copyleft; lo de pago traído de Foundry, solo para uso privado (ADR-0014).
- **Fuera**: los encuentros, la iniciativa y las fichas en el mapa (módulo 6); las escenas y los sonidos de un zip de
  Foundry (6 y 7); el OCR de los PDF escaneados; el aspecto del sistema traído de Foundry (con la interfaz); lo que ven
  los jugadores (módulo 5): hasta entonces, el compendio del mundo y lo que está en juego solo los ve el máster.

### 5. Visibilidad por campaña (entrevista con Enrique, 2026-11-06)

- **El conocimiento va por campaña, con excepciones por personaje** («esto solo lo sabe la pícara»), como en el Crisol
  actual. Al empezar, una campaña sabe lo que el mundo marca como conocido, nada, o lo mismo que otra campaña.
- **Los jugadores leen; no escriben** en este módulo. Como mucho, el máster deja editar una página concreta (el diario
  del grupo). Las notas personales, el diario y el chat, con la sala de jugadores (módulo 7).
- **Las piezas**:
  - la página entera: una nueva es solo del máster; las subpáginas heredan de su padre, con herencia viva (cambia el
    padre, cambian ellas; se ve de dónde viene) y excepciones en cualquiera;
  - los secretos (`> [!secreto]`) de una página visible, cada uno por separado;
  - las pestañas y los pines de un mapa, cada uno por separado (como «descubierto» en el Crisol actual);
  - los campos y bloques del panel, con una marca de «solo máster», sin revelarlos uno a uno (para eso, el secreto).
- **Revelar en partida**: «Revelar» en el secreto, la página o el pin, a toda la campaña o a unos personajes; dentro
  de una campaña, en esa; fuera, se elige (un mundo puede tener varias). Los jugadores reciben un aviso («Nuevo: …») y
  lo revelado sale marcado como nuevo hasta que lo abren. «Lo que sabe el grupo», por campaña, para repasarlo,
  deshacerlo u ocultarlo otra vez. «Ver como jugador»: la página como la ve un personaje, sin cambiar de cuenta.
- **El compendio y las criaturas**:
  - el del sistema lo ven entero, como un libro; el máster oculta en una campaña un tipo o una sección (el bestiario);
  - el del mundo es del máster hasta que revela una entrada, como una página (el objeto que encontraron);
  - las criaturas en juego se ven con su nombre, su imagen y su estado en palabras («Ilesa», «Herida», «Malherida»,
    «A punto de caer»), sin PG ni hoja; sus tiradas siguen ocultas salvo que el máster las enseñe.
- **La IA**: la del máster revela, oculta y mira como jugador; revelar pide aprobación en copiloto (no se puede
  «des-saber»). Un jugador conecta la suya y solo lee lo que ve él.
- **Límite**: el servidor filtra todo (API, búsqueda, enlaces, vista previa, exportar, la edición en vivo, el tiempo
  real y el MCP); nada se manda para esconderlo en la interfaz, al revés que Foundry. Revocar es inmediato.
- **Hecho cuando**: un jugador de la campaña A lee una página con sus subpáginas y uno de la B no; ninguno recibe ni un
  byte de un secreto sin revelar; el máster revela un secreto solo a la pícara (ella recibe el aviso, los demás no lo
  ven), un pin y una entrada del compendio del mundo; los goblins salen como «Herido»; un jugador con su IA solo ve lo
  suyo.
- **Fuera**: que los jugadores escriban (salvo la página que se les deje); notas, diario y chat (módulo 7); la mesa,
  la niebla y la visión (módulo 6); una web pública sin cuenta; co-máster y espectador.

### 6. Mesa (entrevista con Enrique, 2026-11-07)

- **Se juega sobre todo en persona, con el mapa en una pantalla** («sobre todo en persona con el mapa en una pantalla
  pero en el futuro tmb online»). Las fichas las mueve casi siempre el máster desde su ordenador; los jugadores miran la
  pantalla y usan el móvil para su hoja y sus dados.
- **La pantalla es una segunda ventana** que el máster abre desde su ordenador (por HDMI), como la «Ventana de
  jugadores» del Crisol actual. Esa ventana pide su vista al servidor (la del grupo) en lugar de pintarse en la
  pestaña del máster: así sirve igual cuando se juegue online.
- **La niebla, de las dos maneras**: sola, por lo que ven todas las fichas del grupo juntas, con muros, puertas y luces
  (que llegan hechos de UVTT y de Foundry), y a mano (pincel, rectángulo) para mapas sin muros o para destapar algo de
  golpe.
- **En combate, la mesa es el centro, «como en foundry o dndbeyond»**: la ficha es el personaje o la criatura en juego
  del módulo 4 (no un dibujo suelto); al pulsarla se abre su hoja y se tira; el daño baja su barra; la iniciativa lleva
  los turnos; un encuentro pone sus criaturas en juego y al acabar se van las genéricas; en la pantalla, las criaturas
  enseñan su estado en palabras («Herida»), como en el módulo 5.
- **La escena es del mundo y el estado, de cada campaña**: se prepara una vez (con sus muros y luces), se engancha a la
  página del lugar y desde ella se abre en la mesa; cada campaña que pasa por allí tiene su niebla, sus fichas y sus
  puertas abiertas.
- **Hecho cuando**: el máster prepara una cripta (un UVTT o una escena de Foundry, con sus muros, puertas y luces)
  enganchada a su página y la abre en una campaña; en la pantalla la niebla se descubre sola por lo que ven las fichas
  y él destapa a mano una sala; pone un encuentro (tres goblins y el jefe), tira la iniciativa, ataca desde la ficha, el
  daño baja la barra y en la pantalla sale «Herido»; mide un cono y lo deja como plantilla; otra campaña abre la misma
  cripta con su propia niebla; la IA hace todo esto por el MCP.
- **Límite**: a la ventana de la pantalla no le llega nada que el grupo no vea (ni puertas secretas, ni criaturas
  ocultas, ni PG). Nada copyleft; lo de pago traído de Foundry, solo para uso privado (ADR-0014).
- **Entra**: escenas; rejilla cuadrada y hexagonal; fichas (tamaños, estados con caducidad, barras); medir y plantillas
  de área; dibujo, sellos, texto, puntero láser, imágenes; niebla a mano y automática con muros, puertas, luces y
  visión; iniciativa; widgets (contador, reloj, temporizador); instantáneas; la pantalla del máster (statblocks de la
  escena y una nota); encuentros con su formación; la biblioteca con su creador de fichas desde imágenes; UVTT y las
  escenas de un zip de Foundry.
- **Después, al ver el lienzo de la mesa** (2026-11-07): que la IA pueda **dibujar mapas por el MCP** como el de la
  cripta del lienzo («me interesa como lo creaste, para poder crear mapas con el mcp»), y que el mapa en la pantalla se
  pueda **servir entero o recortado** por lo explorado («me gusta lo de poder mostrar todo o recortar»): un ajuste de
  cada campaña.
- **Fuera**: el generador de botín (ya están las tablas del compendio), los paquetes de colección y la capa de clima
  (módulo 8); que cada jugador vea la mesa en su aparato con la visión de su ficha y mueva la suya, el chat y el sonido
  (la sala de jugadores, módulo 7; esta mesa lo deja preparado).
