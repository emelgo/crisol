# Revisión global de la interfaz (2026-11-08)

Recorrido de todas las pantallas de los módulos 0–6 con datos de muestra (un mundo con páginas de cada plantilla, mapa,
hoja y plantilla propia; una campaña con el 5e, dos jugadoras, criaturas, grupo, un libro y la cripta en la mesa), como
máster, como jugadora, la tele, el tema claro y el móvil de la jugadora. Unas 110 capturas en `out/revision/` (fuera de
git; el número de cada hallazgo es el de su captura). Se contrastó con `docs/diseno.md`, los lienzos y la skill
`web-design-guidelines` (esta última, sobre el código).

Cómo se hizo (para repetirlo): servidor aparte en 8132 con su base `crisol_revision` y Vite en 5174; los scripts, en
`e2e/.revision/` (excluidos de git en `.git/info/exclude`): `servidor.ts`, `sembrar.ts`, `capturar.ts [filtro]`.
Cuentas: `enrique@revision.test`, `lucia@revision.test`, `marcos@revision.test` (clave `una-clave-larga`).

**Decidido durante la revisión (Enrique)**: el móvil solo se cuida en la vista de la jugadora; el máster trabaja
siempre en el PC (norma en `docs/diseno.md`). Los hallazgos de móvil de pantallas del máster se descartan.

Estado (2026-11-08, noche): arreglado todo lo de A a E y G2–G9, en local (servidor de desarrollo) y con sus pruebas
unitarias; las e2e se ponen al día al final (abajo). **Queda para Enrique** G1; G11 (ampliar las pruebas de accesibilidad),
con las e2e.

## A. Fallos (algo roto o que engaña)

- [x] A1. **El máster ve los secretos sin revelar como «Secreto · revelado»** en las páginas del mundo desde la campaña
  (070). `apps/web/src/wiki/content.tsx:176`: con `readAs` puesto se da por revelado, pero el máster lo ve todo. La
  jugadora no lo ve (103): no es fuga, pero el máster puede creer que ya lo saben.
- [x] A2. **La jugadora que abre la Mesa lee «Esta campaña no existe»** (108). Debería decir que la mesa es del máster
  (o llevarla a su campaña).
- [x] A3. **API: un id de mapa que no existe da un 500 con la consulta SQL en el mensaje** (en vez de «no existe»).
  `apps/server/src/actions/maps.ts:69` (`authorizedMap` llama a `authorizedTab` con `''` antes de comprobar el mapa);
  igual `getMap` (`viewedPage` con `''`) y `authorizedPin`. También le llega así a la IA por el MCP. Mirar si el mismo
  patrón (`?? ''`) está en otras acciones.
- [x] A4. **Al imprimir (y en el PDF) las tiradas `dice:` desaparecen** y dejan la puntuación suelta: «Mordisco. ·»
  (050).
- [x] A5. **El tutorial del mapa le dice a la jugadora «Pon pines, acerca y encuadra»** (109): ella no puede poner pines.
- [x] A6. **La vista de la jugadora pide cosas del máster** en cada página: `listFiles` (404), `listAccountTags` (400),
  `listTrash` (403). Errores en la consola y peticiones de más.
- [x] A7. (A comprobar) Tras muchas cargas seguidas, un 429 del límite de peticiones dejó la sesión en «Entrar» (402).
  Si la comprobación de la sesión toma un 429 por «sin sesión», un máster con muchas pestañas podría verse fuera.

## B. Incoherencias entre módulos

- [x] B1. **El título de cada pantalla está en un sitio distinto** («el título no se mueve de una vista a otra»; la
  referencia, Ajustes): Mis mundos, Archivos y Etiquetas a una altura y margen (010, 021, 022); Plantillas y Sistemas
  más abajo, en una columna estrecha de una sola tarjeta con todo vacío a los lados (023, 025); IA y «Página no
  encontrada» más a la izquierda (026, 027); Personajes en otra (061); la campaña, dentro de una cabecera gris (060);
  Compendio, Biblioteca, En juego y Grupo, sin título de pantalla (un título pequeño dentro de su ficha: 064, 068,
  066, 067). Propuesta: un solo esqueleto de pantalla (título y columna como Mis mundos/Archivos, paneles a los lados
  fuera de la columna) para todas.
- [x] B2. **Las páginas del mundo vistas desde la campaña son otra maqueta** (069, 070, 102–104): columna más
  estrecha, títulos de sección en blanco (sin el rojo y el ocre de cada nivel), enlaces blancos subrayados (no azules),
  el árbol y el panel a distinta altura, y para la jugadora las propiedades en tabla (no el nombre pequeño encima),
  «etiquetas» en minúscula y la portada desaparece dejando un hueco vacío arriba (103, 221).
- [x] B3. **Tres colores de título en las tarjetas**: blanco (mundos y campañas), ocre (plantillas y sistemas), rojo con
  raya (personajes).
- [x] B4. **Las ventanas no ponen el título en el mismo sitio**: Ajustes y Perfil más adentro que Historial y Papelera
  (017–020).
- [x] B5. **Ajustes**: «Modo» con título grande y raya, el resto pequeños; cajas dentro de cajas (IA › Conectar, Modo)
  (017). Y la pantalla `/ia` repite lo mismo con «Últimas peticiones» (026): ¿se quita?
- [x] B6. (En parte) **Controles nativos mezclados con los propios**: desplegables del navegador (Mundo y Sistema al crear una
  campaña, Nivel en el creador, «Quién la ve», Etiqueta en Archivos y en Buscar, el bloque de imagen vacío del panel),
  casillas nativas en rojo (ediciones) y en azul (Invitaciones abiertas), radios nativos. Elegir uno y usarlo en todo.
  **Hecho**: todas las casillas y opciones del navegador, en el color de la marca. **Se quedan** los desplegables del
  navegador (accesibles y con el tema); cambiarlos todos por uno propio es mucho riesgo para lo que se gana.
- [x] B7. **Dos estilos de etiqueta de campo en el mismo cuadro** (014, 015): «Sistema», «Ediciones» y «Lo que está en
  las dos», pequeñas y grises; las demás, en negrita.
- [x] B8. **Submenús con tres flechas distintas** (043, 044): ▸ pegada al texto, ▸ al borde y ›.
- [x] B9. **La raya bajo el título de los cuadros no llega al borde** (acaba antes que los campos: 012, 013, 041).
- [x] B10. **El botón de crear** a lo ancho en «Página nueva» y a la izquierda en «Nuevo mundo» o «Nueva campaña».
- [x] B11. **La cabecera de la página cambia de alto**: con un título largo, los iconos bajan a otra línea y empujan
  las pestañas (035).
- [x] B12. **Las pestañas abiertas ocupan dos y tres filas** cuando hay muchas y empujan toda la página hacia abajo
  (036, 038, 045): el título cambia de sitio según cuántas haya. Una sola fila que se desplace o encoja.
- [x] B13. **La cabecera de la campaña no usa su portada** (060), mientras que mundos y páginas sí.

## C. Normas de `docs/diseno.md` que no se cumplen

- [x] C1. **Perfil: «Guardar» siempre a la vista** (018); la norma: solo con cambios (`components/changes.tsx`).
- [x] C2. **Rojo en lo corriente**: «Deshacer» en cada fila del Historial, «Restaurar» en la Papelera, «Expulsar» por
  jugador, las filas de ediciones del compendio en rojo oscuro (019, 020, 060, 064).
- [x] C3. **«Expulsar» y «Dejar la campaña» sueltos**, sin zona de peligro ni confirmación a la vista (060, 101).
- [x] C4. **Filas de botones con borde, todos con el mismo peso**: Daño / Curar / Temporales (062); Tirar PG / Volver
  al suyo / Quitar de juego, uno bajo otro (066); «Quitar las copias».
- [x] C5. **Textos de ayuda fijos**: los atajos al pie del menú «/» (042), «Pie (opcional)» bajo cada imagen (036),
  «Escrito a mano: se queda en el grupo» en cada objeto (067), «Panel vacío · Añade datos de toda la página:
  medidores, estrellas, notas…» (enumera; en cada página sin panel), «Campaña de Valdren. Eres su máster.» (060),
  «Los dados van como siempre: sin reglas de ningún juego.» (014).
- [x] C6. **Alrededor de la página todo pesa**: en el panel, cada campo de enlace vacío enseña siempre «Enlazar una
  página…» y «Todas las páginas» (Padres, Pareja…: 031); el bloque de imagen vacío, un desplegable y «Subir una
  imagen» (033). Que salgan al acercarse, como el tipo y la × de las propiedades.
- [x] C7. **Las tarjetas de Sistemas no tienen engranaje** (025): la norma pone las acciones en el engranaje, siempre a
  la vista (Plantillas sí lo tiene).
- [x] C8. **Los dados, en un botón flotante con forma de d20** (Enrique, 2026-11-08; norma nueva en `docs/diseno.md`):
  fuera de la barra, en una esquina, y la ficha se abre junto a él. Resuelve lo que se vio: **«Dados» tapa el contenido fuera de las páginas** (071, 072, 075): la cabecera de la campaña, «Quién la ve»
  y Versiones en la ficha, la barra de la Mesa. Y el «?» se monta encima de sus botones. La norma: en el sitio del
  panel, sin tapar.
- [x] C9. **Género en la tele**: «Ilesa» bajo criaturas que nombra el máster (073); mejor «Sin heridas» (y revisar el
  resto de estados).
- [x] C10. **`docs/diseno.md` no recoge «toda página es una hoja»** (aprobado el 2026-11-03): aún dice «con la hoja
  puesta» y que los bloques de hoja solo salen en «/» en las páginas con hoja. Hoy salen en todas («Maquetación»,
  042) y las páginas largas llevan «Página 2» (036). Actualizar la norma.
- [x] C11. **Pantallas de cuenta**: Unirse y «Este enlace no vale» van a la izquierda; Entrar, centrada (la norma:
  centradas, 000–003). En Entrar, el enlace «Entrar» de arriba sobra.

## D. Móvil de la jugadora

- [x] D1. **El «?» flota sobre el contenido junto a la llama** (220–222): tapa filas y botones.
- [x] D2. **La página de la jugadora sin portada deja un hueco vacío arriba** (221; es B2 en el móvil).
- [x] D3. Revisar en el móvil de la jugadora lo que no se capturó: el grupo, el compendio con una entrada abierta, lo
  revelado y el diario escribiendo. **Hecho**: el panel de la página bajaba a media anchura; ahora, a lo ancho.

## E. Menores (textos, formato, detalles)

- [x] E1. Valor de desafío «0.25» (066): en D&D, «1/4»; y en español, coma decimal donde toque.
- [x] E2. «Población 12000» sin separador de miles (032); «Versión 1» y «Versión 1.0» (025).
- [x] E3. Los errores de Entrar dicen «Rellena este campo.» (001). **Se queda**: ya es un mensaje propio bajo el campo,
  como pide la norma; decir qué falta obligaría a poner género a cada campo.
- [x] E4. Historial: un pin que lleva a una página sale como «Pin sin nombre» (019); en el de la cuenta no dice de qué
  mundo es cada cosa.
- [x] E5. La campaña dice lo mismo tres veces: «2 Jugadores», «2 Han entrado» y «Han entrado 2 con este enlace» (060).
- [x] E6. Buscar: las casillas de una lista salen pegadas en el extracto («…Puerto Gris Encontrar la entrada…»), y los
  títulos de los resultados en blanco, no en azul (045).
- [x] E7. Plantilla de serie: sus desplegables están desactivados pero parecen activos (024).
- [x] E8. En un secreto, «Revelar» (pequeño y apagado) y «Convertir en texto normal» (negrita) juntos con estilos
  distintos (031).
- [x] E9. Compendio: un `?ver=` que no existe deja la ficha en blanco sin decir nada (065).
- [x] E10. Las tablas de Markdown no tienen estilo (sin bordes ni cabecera marcada): se leen mal (035).
- [x] E11. Statblock en la hoja: la fila de características descuadrada (037).
- [x] E12. (Se queda, decisión tomada) El título tras `> [!aviso] Rumores` pasa a primer párrafo y no se distingue del resto (036, 049). Es una
  decisión documentada (`packages/editor/src/markdown/syntax.ts:56`); ¿al menos en negrita?

## F. Para decidir con Enrique

- [x] F1. La portada de la campaña para la jugadora solo tiene los miembros (101). ¿Se deja para el módulo 7 (la sala
  de jugadores)? **Enrique: sí** (ahora ya enseña los personajes del grupo, F2).
- [x] F2. En Personajes, la jugadora solo ve los suyos, no los del resto del grupo (111). ¿Así? **Enrique: sí, pero en
  la campaña ve a sus aliados aunque no pueda abrirlos**: hecho (`listCharacters.allies`, «Personajes» en la portada).
- [x] F3. En el panel de un PNJ, el retrato queda debajo de siete propiedades (031). ¿La imagen, arriba del todo?
  **Enrique: donde se vea mejor**: si el panel empieza por una imagen, va antes que las propiedades («Mencionado en»
  sigue arriba del todo).
- [x] F4. ¿Se quita `/ia` (B5)? **Enrique: sí**: quitada (el conector y el modo, en Ajustes).
- [x] F5. Con el móvil solo para la jugadora, ¿se quita lo del móvil que es solo del máster (el menú de la llama
  dentro de un mundo, Archivos en el móvil…) o se deja como está sin cuidarlo? **Enrique: quitarlo**: el menú de la
  llama solo tiene lo de la jugadora; Archivos, sin su selector de carpeta, sus hojas ni «Elegir».

## G. Del código (accesibilidad, con `web-design-guidelines`)

Un agente revisor leyendo el código (rutas en `apps/web/src/`). Bien: todo pasa por i18n, los botones de solo icono
tienen nombre, las ventanas son `<dialog>`, hay enlace de salto, el zoom no se bloquea.

- [ ] G1. (Propuesta: por ahora no; si un día se vende, «Mover a…» en el engranaje del archivo) **Mover un archivo de
  carpeta solo se puede arrastrando** (`wiki/files.tsx:495`): sin teclado (WCAG 2.1.1).
  Choca con la norma («Mover es arrastrar»): ¿«Mover a…» también en el engranaje o el botón derecho?
- [x] G2. **La ficha de dados en el móvil** (la de la jugadora) es una hoja con fondo oscurecido pero no se porta como
  ventana: el foco no entra, Escape no la cierra, se tabula a lo de detrás (`dice/panel.tsx:64`).
- [x] G3. **Atajos de una letra en la Mesa** escuchados en toda la ventana, sin apagarse (`tabletop/mesa.tsx:298`):
  que solo valgan con el foco en el lienzo.
- [x] G4. **El menú del botón derecho del mapa** no recibe el foco ni se mueve con flechas, y Escape dentro no lo
  cierra (`wiki/map/map-tab.tsx:367`, `:524`). Poner y mover pines, solo con el ratón.
- [x] G5. **Foco casi invisible** en opciones de menús y listas (solo cambia el fondo): `wiki/field-controls.module.css:78`,
  `wiki/tree-menu.module.css:41`, `wiki/page-links.module.css:93`, `templates/editor.module.css:405`. Y el título de
  una página bloqueada no marca el foco (`wiki/wiki.module.css:610`).
- [x] G6. **Contraste**: la etiqueta «Nuevo» con `#e9b872` fijo (1,8:1 en el tema claro; `wiki/content.module.css:80`,
  `campaign/world-pages.module.css:140`); blanco sobre `--color-danger` en el tema oscuro (2,8:1;
  `characters/characters.module.css:51`); la estrella llena `#d39b22` (2,5:1; `wiki/panel-blocks.module.css:523`).
- [x] G7. **Pistas solo en `title`** (no las ven el táctil ni el lector): la del buscador del árbol (`wiki/wiki.tsx:260`),
  «No está entre las opciones», «Lo nuevo no se ve en la tele».
- [x] G8. **Para la jugadora en el móvil**: la X del aviso de revelado mide unos 24 px
  (`components/reveal-notices.module.css:59`), la casilla de 20 px de la ficha (`characters/play-sheet.module.css:384`),
  el menú de la llama navega con botones, no enlaces (`components/ribbon.tsx:670`), y el viewport sin
  `viewport-fit=cover` deja sin efecto los márgenes de la zona segura (`apps/web/index.html:5`).
- [x] G9. Menores: el tutorial solo se cierra con Escape si el foco está en el globo (`components/tour.tsx:171`); el
  pie de una imagen se lee dos veces (`campaign/world-pages.tsx:395`); buscadores sin `autoComplete="off"` (el
  autorrelleno tapa su lista); imágenes del texto sin dimensiones (el texto salta al cargar: `wiki/file-embed.tsx:159`,
  `wiki/panel-blocks.tsx:675`); la portada de página y la imagen de una ficha solo se encuadran arrastrando (la del
  mundo acepta flechas).
- [x] G10. **Sale «Foundry» en la interfaz** (Enrique: quitarlo; ahora «otra mesa virtual», «Traer el sistema») (`i18n.ts:1349`, `:1365`, `:1374`, `:2430`, `:2618`, `:2944`): CLAUDE.md lo
  prohíbe y el ADR-0015 lo usa para «Traer de Foundry». ¿Se queda o se dice de otra forma?
- [ ] G11. Las pruebas de accesibilidad (`e2e/tests/a11y.spec.ts`) no pasan por la página y su editor, Archivos, la
  ficha, el compendio, la mesa ni los dados: ampliarlas al arreglar.

## Pruebas por poner al día al final

Las e2e no se pasan mientras se pule (se ponen al día al acabar, antes de la CI):

- `dados.spec.ts`, `compendio.spec.ts`: «Dados» ya no está en la barra («Secciones»); es el botón flotante (el d20,
  `aria-expanded`), fuera de la barra y del menú de la llama.
- Las que miraban la franja de la campaña («Jugadores», «Han entrado» como cifras) o «Eres su máster».
- Las que abrían una ventana de la barra y medían su contenido (ahora, en la columna de Ajustes).
- Las del máster en el móvil (F5): `wiki.spec.ts` (el menú de la llama dentro de un mundo), `vista-previa.spec.ts`
  (Archivos en el móvil), `dados.spec.ts` (los dados desde el menú): quitarlas o pasarlas a la jugadora.
- `aprobaciones.spec.ts`, ya sin `/ia` (hecho); `imagenes.spec.ts` y `escenas-foundry.spec.ts`, ya sin «Foundry»
  (hecho).

## Lo que va bien

La Mesa, la tele y el combate (072, 073, 076, 077) están a la altura del lienzo; el tema claro es coherente (300–307);
Mis mundos, Archivos, Etiquetas y las páginas del mundo siguen bien sus normas; las animaciones de entrar en un mundo
y en una campaña se ven.
