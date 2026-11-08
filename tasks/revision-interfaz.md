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
- De la segunda revisión: el título de la campaña ya sin el mundo encima; el historial sin «· web»; «Nadie ha entrado
  aún con este enlace» y la confirmación de «Nuevo enlace» flotando; «Nueva etiqueta» como última fila; «Copiar» de
  una plantilla de serie en su engranaje; los tutoriales (uno a la vez, el del mundo en todas sus páginas, textos
  nuevos); el «?» arriba en el móvil y el d20 en la esquina; el email del perfil sin su nota; los textos de «Quién la
  conoce»; «Quién ve las tiradas» en la ficha. Ya cambiadas: «Contadores» (antes «Widgets»), «Bloque de estadísticas»,
  «Decidido en esta página», la papelera de un objeto con dos toques.
- `aprobaciones.spec.ts`, ya sin `/ia` (hecho); `imagenes.spec.ts` y `escenas-foundry.spec.ts`, ya sin «Foundry»
  (hecho).

## Lo que va bien

La Mesa, la tele y el combate (072, 073, 076, 077) están a la altura del lienzo; el tema claro es coherente (300–307);
Mis mundos, Archivos, Etiquetas y las páginas del mundo siguen bien sus normas; las animaciones de entrar en un mundo
y en una campaña se ven.

---

# Segunda revisión (2026-11-08, tarde)

Otra pasada a todo, ya con lo de la primera arreglado: 137 capturas en `out/revision-2/` (las de antes y otras nuevas:
tutoriales, foco con teclado, menús, la jugadora en PC y en el móvil, el tema claro de la tele, los dados y Ajustes).
Script: `e2e/.revision/capturar2.ts [filtro]` (entra una vez por persona y empieza con los dados cerrados). Cuatro
revisores en paralelo sobre las capturas y uno sobre el código; los hallazgos graves, comprobados a ojo. Lo de la
primera que sigue o quedó a medias se dice («B12 sigue»).

**Estado (2026-11-08, noche)**: Enrique dio por buenas las propuestas de 2F1–2F6 («Vamos») y está todo arreglado en
local con sus pruebas unitarias (normas nuevas en `docs/diseno.md`), salvo lo anotado en 2D13, 2D15 y 2D16. Sigue G1
(2F7). Las e2e, al final.

## 2A. Fallos

- [x] 2A1. **Las pestañas abiertas no se leen** (B12 quedó mal; 030–045, 079): con siete, cada una enseña 2–3 letras
  («Lu…», «Ald…») y la chincheta y la × fijas ocupan más que el nombre; la de la página abierta puede quedar escondida
  tras «›» (032: ninguna subrayada); la barra (x 317–1140) es más ancha que la columna (349–1108).
- [x] 2A2. **Las páginas del mundo no tienen tutorial ni «?»** (031–045, 403): el `<Tour id="mundo">` solo se monta
  en la portada (`routes/world.tsx:67`). Norma: «Cada pantalla tiene su guía» y el «?» abajo a la derecha.
- [x] 2A3. **La ficha de dados se recuerda abierta entre cargas** (`dice/context.tsx:44`): en el móvil de la jugadora,
  la hoja con la página oscurecida tapa cada pantalla que abre (220–232 salieron tapadas); en el PC sigue encima al
  cambiar de página (087, 117). Ver 2F1.
- [x] 2A4. **La tarjeta de la IA tapa la ficha de dados** (071, 079, 085, 310): no se ven Ventaja, la tirada escrita ni
  «Tirar» mientras hay una petición. En la Mesa corta el reloj «El ritual» y pisa el borde del panel de combate (402).
  Ver 2F3.
- [x] 2A5. **La tele en tema claro: los relojes no se leen** (309): cifra blanca sobre tarjeta blanca
  (`tabletop/screen.module.css:7` fija el texto claro y `screen.tsx:287` toma el fondo del tema). La tele, siempre
  oscura.
- [x] 2A6. **El tutorial de la Mesa no tiene globo** (402): el paso 1 rodea el mapa entero (`mesa.tsx:572`, abajo) y el
  globo cae fuera de la pantalla; solo se ve el aro.
- [x] 2A7. **Dos tutoriales a la vez** (406): el de la campaña y el de los dados, con dos globos y dos aros. Además, cada
  `<Tour>` pinta su propio «?» en la misma esquina: con los dados abiertos o en un mapa hay 2–3 apilados y solo se
  alcanza el de encima (`components/tour.tsx:140`).
- [x] 2A8. **El Historial enseña nombres internos** (019, 047): «hizo un cambio (nextTurn)», «(rollInitiative)»,
  «(startCombat)», con «Deshacer» en cada turno de combate. Falta su resumen en `summaries.ts`.
- [x] 2A9. **«En juego» de una criatura del compendio enseña la fórmula con nombres** (113): «Ataque +Bonificador por
  competencia + Modificador de Fuerza · 1d6 + Modificador de Fuerza de perforante», en vez de +4 y 1d6+2 con los
  datos de la propia criatura; «de perforante» está mal construido.
- [x] 2A10. **Un hook condicional en el compendio** (`campaign/compendium.tsx:854`, `useContext` tras dos `return`):
  React avisa en la consola al abrir una entrada (113, 225).
- [x] 2A11. **La tele se queda en negro para siempre** si la conexión se rechaza o se está reconectando
  (`tabletop/screen.tsx:101`, sin `onStatus`; la Mesa sí lo dice).
- [x] 2A12. **Al imprimir, el nombre del statblock casi no se lee** (050): naranja claro en letra condensada sobre el
  pergamino (en pantalla, 037, va bien).
- [x] 2A13. **El buscador del compendio tiene dos X** (087): la del navegador y la nuestra.

## 2B. Incoherencias y normas

- [x] 2B1. **El título de la Papelera cae a otra altura** (020, 048): la ventana se centra en vertical (título en
  y≈383; en Historial, Ajustes y Perfil, 111). B4 solo lo resolvió en horizontal.
- [x] 2B2. **La campaña baja su título** (060, 071, 074, 220): el enlace del mundo encima lo pone en y≈93 (en el resto,
  65). Ver 2F4.
- [x] 2B3. **El editor de plantillas sigue con otra maqueta** (024, 051): título en una cabecera gris, fichas de los
  lados a otra altura y sin llegar abajo, «Plantilla» pegado al título en una y suelto en otra.
- [x] 2B4. **Las plantillas de serie llevan «Copiar» suelto**, sin engranaje (023); los sistemas de serie sí lo tienen.
- [x] 2B5. **«Nueva etiqueta» es un botón rojo arriba** (022); la norma: «Nuevo …» como un recuadro discontinuo más,
  tras el último.
- [x] 2B6. **«Personaje nuevo» y «Sistema nuevo» sin las esquinas cortadas** (061, 089), a diferencia de «Nuevo mundo».
- [x] 2B7. **«Máster» y «Jugador» son rectángulos con borde** (060, 220); las demás etiquetas son píldoras.
- [x] 2B8. **Los títulos de las tarjetas de Sistemas no van en mayúsculas condensadas** («5e», «En blanco»: 025).
- [x] 2B9. **La ficha: títulos de recuadros de dos tamaños** («PUNTOS DE GOLPE» grande, «ESTADOS» pequeño y gris) y la
  segunda fila de recuadros empieza a dos alturas (062, 075).
- [x] 2B10. **C6 a medias: huecos fijos bajo los campos de enlace vacíos** del panel (033, 034, 039) y lo vacío se ve
  distinto según el campo («Vacío» o nada). La jugadora ve propiedades vacías con su título y sin valor (109).
- [x] 2B11. **B2 sigue en la vista de la jugadora**: el árbol empieza en y≈137 y el panel en 177 (en el máster, los dos
  en 137); los títulos del texto, sin aire encima (102–104, 221).
- [x] 2B12. **Enlaces que no son azules**: «Valdren» sobre el título de la campaña (gris subrayado), «Volver al inicio»
  de «no existe» (blanco), la Facción y el Lugar del panel (blancos con recuadro; los de la tabla, azules), y en la
  portada de la campaña su personaje (enlace) y los de sus aliados (texto) se ven iguales (027, 060, 101, 103, 109).
- [x] 2B13. **Los títulos de los bloques del panel, de dos estilos** (109): «Lugares dentro» y «Habitantes» en
  minúscula; «Mencionado en» y «Tipo», en versalitas.
- [x] 2B14. (En la Mesa el d20 se queda fuera de su panel: dentro taparía «Acabar combate».) **El d20 y el «?» tapan el final del panel** (031–033, 109: la fila «Lugar», la cabecera de Miembros) y en
  la Mesa se meten dentro del mapa, junto a los relojes (072, 305). Que el panel deje hueco abajo.
- [x] 2B15. **«Nuevo enlace» mete su confirmación en la página** y la empuja (084). Norma: nada que empuje la página.
- [x] 2B16. **B11 sigue**: con un título largo o con emoji, el distintivo («Sesión») baja de línea y mueve las
  pestañas (035–037).
- [x] 2B17. **B8 sigue en «⋯»**: «Versiones ›» con la flecha pegada; «Imprimir y PDF ›», al borde (043).
- [x] 2B18. **E1 y E2 siguen**: VD «0,25» en En juego (066; en el compendio ya es «1/4»); «Versión 1» y «Versión 1.0»
  (025, 089).
- [x] 2B19. **El statblock**: la tabla FUE…CAR se sale unos 7 px por la derecha; «Statblock» en inglés en el menú; un
  «.» suelto entre dos tiradas («Mordisco. [1d20+4] . [2d4+2]») (037, 307).
- [x] 2B20. **Textos de tutoriales que enumeran o explican teclas** (contra «explicaciones genéricas»): el mapa de la
  Mesa (Mayús, botón central, espacio, rueda), Mis mundos («sus páginas, tus campañas y tus partidas»), escenas,
  herramientas, paneles, subir archivos, «Mover» del grupo; y «widgets» en inglés.
- [x] 2B21. **El «Siguiente» del tutorial es azul** con aro de foco rojo: el único botón principal azul de la app.
- [x] 2B22. **«claude.ai» en Ajustes** (017, 116, 311): «En tu app de IA (claude.ai u otra)». Norma: «IA».
- [x] 2B23. **La zona de peligro, apenas rojiza en el tema claro** (308): caja blanca con una raya fina.
- [x] 2B24. **La Mesa en claro: los iconos de herramientas, gris muy pálido** (305): parecen desactivados.

## 2C. Móvil de la jugadora

(Las capturas se repitieron con los dados cerrados.)

- [x] 2C1. **Abajo se juntan la llama, el d20 y el «?»** (220, 221, 233, 408): la llama tapa «Dejar la campaña» y el d20
  pisa el borde de Miembros. Ver 2F2.
- [x] 2C2. **El tutorial de la campaña empieza por los dados** (408): su paso de la campaña apunta a la barra, que en el
  móvil no está; «Los dados de tus campañas» dentro de una campaña suena raro.
- [x] 2C3. **Zonas táctiles pequeñas** en lo de la jugadora: engranaje y X de la ficha de dados (24 px), «Desglose» y
  «Repetir» (~20 px), botones del contador y de objetos de la ficha y «Mío | Del grupo» (32 px), borrar la búsqueda
  del compendio (28 px), la X del panel del pin (32 px).
- [x] 2C4. **La papelera de un objeto lo borra al momento** y va pegada al «+» de la cantidad (`play-sheet.tsx:635`):
  un toque desviado borra.
- [x] 2C5. **G2 a medias**: la hoja de dados oscurece la página pero es un `<aside>` sin `role="dialog"`; el foco no
  queda dentro y se tabula a lo de detrás (`dice/panel.tsx:118`).
- [x] 2C6. **El menú de la llama sigue navegando con botones** (`ribbon.tsx:766`, con `aria-current`): no se abre en
  otra pestaña ni con pulsación larga. G8 decía hecho.
- [x] 2C7. **Los avisos de revelado tapan el d20** (z 40, a la altura del d20 en el móvil; en PC, abajo a la derecha) y
  al cerrarlos el foco cae a `body`.
- [x] 2C8. Las pestañas de la página de la jugadora no se desplazan ni bajan de línea: con varias, la página se mueve
  a lo ancho (`campaign/world-pages.module.css:49`). «d%» cortado en la fila de dados.

## 2D. Menores

- [x] 2D1. Perfil: el email parece un campo editable, con «Aún no se puede cambiar.» debajo (018).
- [x] 2D2. Nuevo mundo y Nueva campaña: el hueco de la portada es un rectángulo gris sin nada (012, 014).
- [x] 2D3. «Pie» siempre bajo la imagen del panel (031, 032; C5 a medias).
- [x] 2D4. Historial: «· web» no se entiende; «puso el mapa de la escena «Cripta de Varn» de «Cripta de Varn»».
- [x] 2D5. La bienvenida de la portada del mundo enumera («Página nueva», `[[`, «+», `#etiqueta`) (049).
- [x] 2D6. El buscador del compendio corta su ejemplo: «Un conjuro, una cria» (064, 106).
- [x] 2D7. Grupo: «Del grupo 9» suma unidades y la lista tiene 3 filas (107).
- [x] 2D8. «Con ventaja» en la ficha y «Ventaja» en los dados; «1d20» repetido bajo el campo de la tirada (105, 112).
- [x] 2D9. Ficha: «Bonificador por competencia» en dos líneas (el +2, más bajo); «Acciones» repetido (pestaña y
  sección); «Descanso corto / largo», dos botones con borde e igual peso (C4) (105, 117).
- [x] 2D10. «Quién la conoce»: «Como su madre» (por la página madre) se lee literal en un PNJ; «Lo sabe» y «La ve toda
  la campaña» repiten; «Marcada aquí» no se entiende (057).
- [x] 2D11. Tele: los «Sin heridas» de fichas vecinas se pegan («Sin heridasSin heridas») (073, 309).
- [x] 2D12. «Han entrado 0 con este enlace» (074): mejor «Nadie ha entrado aún». Los nombres largos de la barra se
  cortan («Los Náufr…»).
- [x] 2D13. (Queda: la Biblioteca, sin tocar; es menor.) Biblioteca: «Libros» en una caja dentro de la ficha y su vacío distinto del del compendio (064, 068).
- [x] 2D14. (Las tiradas de la ficha dicen ahora «Quién ve las tiradas».) «A la vista / Oculta» y «Quién la ve: Oculta» juntos en la criatura de En juego (066).
- [x] 2D15. (Hecho salvo «Quitar» un bloque sin deshacer y abrir entradas del compendio con enlace.) Código: `who-knows.module.css:105` usa `--color-ok`, que no existe (verde fijo, 2:1 en claro); `LoadError`
  pone un h1 dentro de páginas que ya tienen el suyo (usar `SectionError`); `CharactersPanel` de la campaña
  desaparece si falla (sin «Reintentar»); la X de la ficha de dados no devuelve el foco al d20 y Escape con su menú
  abierto la cierra entera; «Quitar» un bloque del panel, sin deshacer y perdiendo el foco; «Cargando el sistema» y
  «Subiendo…» sin «…»; el compendio abre entradas con botón, no enlace.
- [x] 2D16. (Hecho el dato del lobo en `criaturas.json` —sin lista de erratas: si se regenera el SRD, vuelve—; queda «Cronología» huérfana: el paginador ya junta el título con lo siguiente, mirar por qué no en la crónica.) Datos: «las t iradas» en el lobo del SRD (`criaturas.json:72686`); «Cronología» huérfana antes de
  «Página 2» (036).

## 2F. Para decidir con Enrique (respuesta: «Vamos», todas las propuestas)

- [x] 2F1. ¿La ficha de dados se recuerda abierta? Propuesta: no; se abre con el d20 y se cierra con él (2A3).
- [x] 2F2. Móvil de la jugadora, tres botones flotantes abajo. Propuesta: el «?» sube arriba a la derecha (junto al
  título) solo en el móvil; abajo quedan la llama (centro) y el d20 (esquina), y la página deja hueco para los dos.
- [x] 2F3. La tarjeta de la IA y la ficha de dados en la misma esquina. Propuesta: con la ficha abierta, las tarjetas
  se colocan a su izquierda; en la Mesa, a la izquierda de su panel.
- [x] 2F4. El enlace al mundo sobre el título de la campaña (lo puse en la primera revisión). Propuesta: quitarlo (el
  mundo ya está en la barra) para que el título no se mueva.
- [x] 2F5. La ficha del personaje va a todo lo ancho con el título en una franja roja (062, 063): es el lienzo
  aprobado. Propuesta: dejarla.
- [x] 2F6. El aviso de licencia del SRD dice «dndbeyond.com/srd» (225): lo pide la licencia CC-BY tal cual. Propuesta:
  dejarlo (es la atribución obligatoria, no la marca en la interfaz).
- [ ] 2F7. (De la primera) G1, mover archivos con teclado.

## Lo que va bien (segunda)

Entrar, Unirse y «Este enlace no vale», centradas; el título en el mismo sitio en Mis mundos, Archivos, Etiquetas,
Plantillas, Sistemas, Personajes, Compendio, En juego, Grupo y Biblioteca; Ajustes uniforme y Perfil sin «Guardar»
fijo; el menú «/» limpio; tablas con estilo; Buscar en azul; la imagen del panel arriba; a la jugadora no se le escapa
nada del máster (ni secretos, ni peticiones de la IA, ni tiradas ocultas) y la Mesa la devuelve a su campaña; el foco
con teclado se ve; las hojas del móvil con su asa; la Mesa, el combate y la barra de iniciativa de la tele se leen
bien; el tema claro es coherente salvo la tele.
