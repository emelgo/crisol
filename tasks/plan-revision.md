# Plan: revisión de la app (2026-11-11) y módulos 8, 9 y 10

## Contexto

Enrique ha revisado la app (portada, Entrar, Inicio, Sistemas y el mundo) y ha traído unos cuarenta puntos: fallos,
cosas que no convencen, piezas que faltan y una petición que cruza todo (llevar el cristal de la Mesa al resto). Se
arreglan **uno por uno, con calma**: cada tanda se enseña en local, él da el visto bueno, se pasan las pruebas y sube a
`main`. **La campaña queda fuera**, para una revisión propia más adelante. En el mismo plan entran los módulos 8, 9 y
10; **el 11 (pagos) se descarta**: Crisol es una herramienta propia, gratuita y de uso privado.

Este archivo es el plan maestro. Al empezar a ejecutarlo se copia a `tasks/plan-revision.md` (con su
`tasks/todo-revision.md` de casillas) y se apunta en `docs/modulos.md` § «Dónde estamos».

## Cómo se trabaja cada tanda

1. Rama `revision/<tanda>`. Cambios en el servidor de desarrollo (`pnpm dev`) para que Enrique los vea al momento.
2. Lo que es un fallo, con su prueba primero (TDD). Lo que cambia una pantalla de forma visible, antes un prototipo
   (`/impeccable shape`) o capturas, que él aprueba.
3. Visto bueno de Enrique → `/impeccable critique` y `audit` de las pantallas tocadas → `pnpm lint`, `pnpm typecheck`,
   `pnpm test` y las e2e de lo tocado, todo en local.
4. PR a `main` con `[skip ci]` y `scripts/desplegar-staging.sh`. La CI de GitHub, una sola vez al cerrar un bloque
   (tras las tandas 5, 9 y cada módulo), no en cada PR.
5. **Lo que se encuentre de paso** (un fallo o una mejora posible que no estaba en la lista) se le avisa a Enrique y se
   arregla en la misma tanda si es de esa zona; si es de otra, se apunta en la tanda que le toca. Queda anotado en
   `tasks/todo-revision.md` § «Encontrado de paso».
6. Al cerrar: lo que le toca probar a `tasks/probar.md`, las normas nuevas a `docs/diseno.md`, las decisiones a su ADR,
   las herramientas MCP y sus instrucciones al día, y «Dónde estamos» actualizado.

## Lo que se repite: se hace una vez y se usa en todas partes

| Pieza común | Resuelve | Dónde más se usa |
|---|---|---|
| **Árbol común** (`components/tree`): fila = elegir, flecha = desplegar, raíz visible, soltar antes / dentro / después | Archivos de Inicio y del mundo, mover a la raíz | Etiquetas (ordenar), carpetas de plantillas, árbol del libro |
| **Selector de archivos** (árbol + filtro por tipo + subir) | Portada al crear un mundo | Portada de campaña, plantilla, sistema, libro y página; imagen de escena |
| **Portada, icono y color** (lo de los mundos, suelto) | Sistemas y libros sin portada | Plantillas |
| **Recuadro «Nuevo…»** único, de línea continua | «Nuevo mundo», «Nueva campaña» | Plantilla, etiqueta, sistema y libro nuevos |
| **Contador en `Field`** («123 / 280») | Descripción del mundo | Campaña, sistema, libro |
| **Espacios de la barra, declarados** (`ribbon.tsx`) y **volver** | El sistema con su espacio | Libro, plantilla; lo que venga |
| **Registro de tipos de pestaña** | «Pestaña nueva» y «Página nueva» coherentes | Plantillas por tipo; pizarra, línea temporal, árbol (módulos 8–10) |
| **Menú desplegable común** (`floating` + `useDismiss`) | «Exportar» que no parece desplegable | «⋯» de la página y demás menús |
| **Ficha de una entrada del compendio**, una sola | Libro del sistema | Compendio de la campaña, incrustada en una página, ventana flotante en el mundo; lleva las tiradas |
| **Validación con mensajes** (`validateFile` + `ProblemList`) | Subir el esqueleto relleno | Editor manual, en vivo |
| **Efectos como tokens** (colores de brasas, humo y chispas) | Se tocan en un sitio | Cualquier efecto nuevo |
| **Cristal fuera de la Mesa** (superficies + fondo de ambiente + «sin desenfoque») | Entrar, Inicio, Sistemas, Mundo | Todo lo que venga |

## Lo que preguntas

- **¿LaTeX para escribir?** Lo complicaría, y mucho. El texto se guarda como un documento vivo (TipTap sobre Yjs): de
  ahí salen escribir a la vez, los secretos por documento, el historial, lo que escribe la IA y la hoja paginada. Con
  LaTeX se pierde escribir viendo el resultado y habría que rehacer todo eso. Lo que LaTeX da de bueno (maquetación al
  imprimir) ya lo hace el paginador de la hoja, y lo que falla ahí se arregla en la tanda 4. Si algún día hacen falta
  fórmulas, un bloque de fórmula dentro del editor.
- **Plantillas de mapa, cronológicas, etc.** Una plantilla pasa a ser «una página guardada como modelo»: lleva lo
  mismo que una página (portada, icono, campos, panel, texto y **sus pestañas**). Crear desde ella es duplicarla. Así
  no hay «plantillas de mapa»: hay plantillas cuya pestaña es un mapa, y lo mismo valdrá para pizarra y línea temporal
  cuando existan. Lo que guarda cada pestaña de una plantilla es la **estructura y el estilo, no lo que apunta a
  páginas concretas**: en un mapa, su escala y sus pines o regiones de ejemplo sin enlazar (y sus capas, cuando
  lleguen con el módulo 9); en una línea temporal, su calendario, sus eras y sus carriles, sin eventos; en una pizarra,
  su disposición inicial (marcos y rótulos). Ejemplos: «Ciudad» = texto + mapa con capas Distritos / Comercios /
  Secretos; «Dinastía» = texto + línea temporal + árbol familiar. No hay «tipo de plantilla»: se ve qué pestañas trae.
- **Navegación de Sistemas.** El sistema tendrá su propio espacio, como el mundo y la campaña: al entrar, la barra
  cambia (la llama vuelve a Inicio) y enseña lo suyo: Inicio del sistema, Libros, Compendio y Reglas (el editor). Un
  libro se abre dentro, con el esqueleto de tres columnas.
- **Libros de texto (como 5etools).** Un libro tendrá dos partes en su árbol: **Capítulos** (texto, con el editor de
  bloques de las páginas) y **Compendio** (sus entradas por tipo, todos los tipos del sistema a la vista aunque estén
  vacíos, cada uno con su «+»). En un capítulo se incrusta o se enlaza una entrada, igual que en una página del mundo.
  Los capítulos viajan con el archivo del sistema al bajarlo y subirlo.
- **Crear una entrada del compendio desde el mundo.** Sin salir de la página: en «/» y en Ctrl+K, «Entrada nueva del
  compendio» → sistema, libro y tipo (se recuerdan) → se abre su ficha en una ventana flotante, como las de la Mesa, y
  queda enlazada donde estaba el cursor. Con eso no hace falta cambiar la navegación del mundo.

## Pista de imágenes (en paralelo desde el primer día)

Norma nueva (a `docs/diseno.md`): **donde convenga una imagen de la app, Claude da el prompt** y Enrique la genera con
ChatGPT, al estilo de Foundry VTT, Roliando o LegendKeeper. Solo las de la app: las portadas de mundos, campañas,
sistemas y libros son del usuario (Enrique, 2026-11-11).

1. **Buscar el estilo.** Seis variaciones de fantasía épica pintada, cada una con las **mismas dos escenas de prueba**
   (un paisaje para Entrar y la ilustración de una pantalla vacía) para poder compararlas. En `docs/imagenes.md`.
2. Enrique elige → **guía de estilo** (frase base, paleta, lo que nunca sale) y **el resto de prompts**: fondos de
   Entrar (unos 12–16, apaisados, con el centro tranquilo para el recuadro y un tinte anotado), la portada pública,
   fondo de ambiente de Inicio y pantallas vacías.
3. Según lleguen: a `apps/web/public/`, fuera las 24 actuales (`account/backdrops.ts`, `public/fondos/`), y su origen
   en `docs/terceros.md`.

## Tanda 1 — Inicio: arreglos rápidos

- **Chispas y humo en claro.** Los colores están fijos y pensados para oscuro (`styles/base.css:299-394`,
  `components/ribbon.module.css:157-191,301-327`). Pasan a tokens con su versión clara (brasas más saturadas y humo
  oscuro) en `styles/tokens.css`; se comprueba en los dos temas.
- **Iconos que se van más deprisa de lo que llegan.** Entrar acaba hacia 1,8 s y salir hacia 0,6 s
  (`ribbon.module.css:437-445`, desmontaje a 650 ms en `ribbon.tsx:188`). Salir será el espejo de entrar (mismo paso
  entre iconos y misma duración) y «Mundos» saldrá cuando hayan subido.
- **Recuadros «Nuevo…» con línea continua.** `routes/world-card.module.css:326` (`dashed` → continua), igual en
  `templates/screen.module.css:238` y `wiki/tags.module.css:242`; se saca un `NewCard` común. Cambia la norma de
  `docs/diseno.md` («borde discontinuo»).
- **Descripción con límite y contador.** El límite ya es 280 (contrato). `Field` gana un contador («123 / 280») que
  sale al escribir; la descripción pasa a un cuadro de varias líneas. Mundos y campañas.
- **Orden de la barra:** Mundos, Plantillas, Etiquetas, Sistemas y **Archivos el último** (`ribbon.tsx:211-296`), con
  el tutorial en el mismo orden (`routes/worlds.tsx:86-109`; de paso, «Nueva campaña» a su sitio).

## Tanda 2 — Árbol común, Archivos, Etiquetas y selector de archivos

- **Archivos comunes no deja mover nada.** `moveInto` (`wiki/files.tsx:473`) compara mal el ámbito cuando no hay
  carpeta «Comunes» (la pantalla de Inicio) y corta todos los movimientos. Prueba que falla primero (unitaria y e2e en
  comunes: hoy solo se prueba en un mundo), luego el arreglo. El aviso de «no se puede» se verá, no solo se oirá.
- **Archivos sin árbol a la izquierda: la lista del centro es el árbol** (Enrique, 2026-11-11, al revisar la
  tanda 1). Pulsar una carpeta la despliega ahí mismo con lo de dentro sangrado, en vez de entrar en ella; al arrastrar
  un archivo y mantenerlo sobre una carpeta cerrada, se despliega sola (como en un explorador). La vista previa del
  archivo o la carpeta, **a la izquierda**, donde estaba el árbol. Antes, prototipo: queda por ver la vista de
  tarjetas (si se queda y cómo se despliega en ella) y dónde se suelta para llevar algo a lo más alto (una fila
  «Todos» arriba). Con ello se van los fallos del árbol de ahora (`files.tsx:815`, `:842`).
- **Árbol común** (`components/tree/`): la lista con despliegue de Archivos, con zonas antes / dentro / después y
  teclado (flechas, Alt + flechas), y el despliegue solo al mantener encima al arrastrar. La lógica de mover se saca
  del árbol de páginas (`wiki/tree.tsx:215-310`) a funciones con sus pruebas; **el árbol de páginas no se reescribe**,
  solo las importa. Sirve después para Etiquetas, las carpetas de plantillas y el árbol del libro. En el móvil, Archivos
  sigue con su selector.
- **Etiquetas: ordenar.** Hoy solo se anidan (el orden es alfabético y no hay campo). Migración: `tags.position`
  (clave fraccionaria, `packages/domain/src/order.ts`; se rellena al primer reordenar), la jerarquía sigue en el nombre
  y la lista pasa al árbol común. Nota en un ADR (retoca el 0006). **Su vista previa, a la izquierda**, como en
  Archivos (Enrique, 2026-11-11).
- **Selector de archivos** (`components/file-picker`): el explorador con su árbol, filtrado por tipo, en una ventana.
  En el cuadro del mundo, dos botones con su texto debajo: «Subir imagen» y «Elegir de tus archivos»; fuera las
  miniaturas sueltas (`routes/world-cover.tsx`). Sustituye también al selector viejo de la portada de página
  (`wiki/cover.tsx`).

## Tanda 3 — Plantillas

En este orden, cada paso se ve y se comprueba por separado:

1. **«Duplicar» de verdad**: una acción del servidor (`copyPage`) que copia portada, hoja, panel y pestañas de una vez
   y se deshace de una vez (hoy son cuatro pasos sueltos en el navegador, `wiki/tree-menu.tsx:99-123`, y se dejan la
   portada, la hoja y las pestañas). Cada tipo de pestaña aporta su forma de copiarse. Es la base de todo lo demás.
2. **La plantilla como página-modelo**: cada plantilla es una página de verdad en un espacio oculto de la cuenta (no
   sale en Mundos ni admite campañas); `page_templates` se queda como su ficha (carpeta, orden, linaje). El editor de
   plantilla es la misma vista de página (`EntryView`, `wiki/wiki.tsx:740`) en modo plantilla: con portada, icono en el
   título, pestañas, panel y texto; sin «quién la conoce», marcadores ni «Mencionado en», y con el editor de campos en
   lugar de sus valores. Lo que se suba al editarla va a los archivos comunes. ADR nuevo (sustituye parte del 0009).
3. **Crear desde plantilla = duplicarla** en el mundo, soltando los enlaces a páginas concretas.
4. **Fuera las de serie** y todo lo suyo (`BUILT_IN_TEMPLATES` en `packages/domain/src/templates.ts`, servidor, web,
   i18n, tutorial, MCP, pruebas). Antes, un barrido convierte en personales las que estén en uso, con los mismos ids
   de campo y el linaje, para que las tablas automáticas («Miembros», «Habitantes») den lo mismo antes y después.
5. **Carpetas de plantillas** (tabla `template_folders`), con el árbol común, a la izquierda.

Y con ello:
- **Volver**, arriba a la izquierda del editor, a la lista de plantillas con la transición al revés.
- **«Desde plantilla», la última y centrada** en «Página nueva» (`wiki/new-page.tsx:20-27`), y **también en «Pestaña
  nueva»** (`wiki/tabs/page-tabs.tsx`): añade a la página las pestañas de la plantilla.
- **Fuera «Aplicar plantilla»** de «⋯» (`wiki.tsx:611`, `wiki/apply-template.tsx`).
- **Registro de tipos de pestaña**: hoy están escritos a mano en siete sitios; un registro único (nombre, icono,
  componente, si admite plantilla) deja listo el sitio para pizarra, línea temporal y árbol.

## Tanda 4 — El mundo: la página y la hoja

- **La columna izquierda no se esconde** al pulsar el mundo (`wiki/panel.tsx:59`, `wiki.module.css:102`).
- **El panel derecho, fijo y con su desplazamiento**, como el izquierdo: sale de `.entry` y pasa a ser hermano del
  árbol (`wiki.tsx:761-784`, `wiki.module.css:417-438`). En la ventana de la Mesa, cada columna con el suyo
  (`tabletop/page-window.module.css`).
- **El ancho del texto.** La hoja se queda en ~725 px pegada a la izquierda (`wiki/sheet/paged.tsx:272-287`,
  `MAX_SCALE`). Propuesta, a probar con él en local: centrada siempre; a dos columnas crece hasta llenar el hueco; a
  una, hasta un ancho de línea cómodo. **Las rayas de salto de página y de columna, de lado a lado** de la columna del
  centro, y el rótulo dice **la página que se cierra** («Página 1» al acabar la 1; `paged.tsx:214`), también en un
  salto puesto a mano.
- **Nota lateral izquierda / derecha.** Hoy el lado no llega a pintarse (ni al escribir ni al leer) y al imprimir va
  siempre a la derecha (`wiki/sheet-blocks.tsx:80-102`, `sheet/sheet.module.css:145`). El paginador tratará la nota y
  el bloque siguiente como una pieza, con el texto rodeándola por el lado elegido, igual en pantalla y en papel.
- **Descargar e imprimir: preguntar cómo.** Hoy el tema por defecto es gris; se añade «Con colores» (los de la app
  sobre blanco) junto a «Blanco y negro» y «Pergamino», en un cuadro al descargar, que recuerda lo elegido.
- **«Exportar», un desplegable de verdad** (flecha y panel flotante), con el menú común; «⋯» pasa a usarlo.
- **Archivos del mundo**: ya arreglado con el árbol común; se repasa aquí.
- **«Página nueva» y «Pestaña nueva»**: comprobación final con la tanda 3.

## Tanda 5 — Cristal, Entrar y la portada

El lienzo se prepara desde la tanda 1 (necesita su visto bueno y el estilo de las imágenes); se construye aquí.

- **Estudio.** El cristal solo luce con algo detrás. Fuera de la Mesa no hay mapa, así que hace falta un **fondo de
  ambiente**: en Entrar, las imágenes; en Inicio, una imagen de ambiente o la portada del mundo sobre el que está el
  ratón; en un mundo, su portada, muy difuminada y tenue; en un sistema, la suya. Encima, de cristal lo que enmarca
  (barra lateral, fichas de los lados, cabeceras, tarjetas, cuadros); **lo que se lee o se escribe, casi opaco**, como
  en la Mesa. Hay que resolver el rendimiento (el tema claro ya no existe: solo oscuro desde la tanda 1).
- **Lienzo «Crisol, con cristal»**: Entrar, Inicio, una página del mundo y Sistemas, antes y
  después.
- **Construcción**: superficies como tokens (`--surface-glass`, `--surface-read`) sobre los `--glass-*` que ya hay
  (`styles/tokens.css:98-116`); componente de ambiente a partir de `components/backdrop.tsx`; el respaldo sin
  desenfoque en los seis sitios donde falta; interruptor «Sin desenfoque» en Ajustes; y la norma de `docs/diseno.md`
  al día (hoy dice que la barra derecha de la Mesa es opaca y es de cristal).
- **Entrar y crear la cuenta**: el recuadro de cristal sobre las imágenes nuevas.
- **La portada pública** (`routes/home.tsx`): sencilla. Imagen a toda pantalla, la llama, una frase, «Entrar» y «Tengo
  una invitación»; debajo, tres o cuatro estampas de lo que hay dentro (el mundo, la mesa, la ficha).

## Tanda 6 — Sistemas: su espacio, sus portadas y sus libros

- **Los espacios de la barra, declarados** (`components/spaces.ts`: mundo, campaña y sistema, cada uno con sus
  secciones y su vuelta), primero sin cambio visible. La animación de entrar y salir de la barra
  (`ribbon.tsx:139-190`) es delicada: se cubre con e2e antes de tocarla.
- **El espacio del sistema**: su Inicio (portada y libros), Compendio (todos sus libros), Reglas (tanda 8) y Ajustes en
  ventana. La llama vuelve a Sistemas con la transición de salir; dentro de un libro, «← {sistema}» en la cabecera.
  Fuera el icono fijo y la palabra «Sistema» (`systems/system.tsx:51-62`).
- **Icono y portada del sistema**, al crearlo y en sus ajustes (formato, contrato y MCP: `packages/systems/src/format.ts`,
  `contracts/systems.ts`). **Libros: portada o, si no, color** elegido (hoy sale de un cálculo); la portada se elige
  desde la app con el selector de archivos.
- **El libro por dentro**, con el esqueleto de tres columnas: a la izquierda su árbol (por tipo, con buscador), en el
  centro la entrada y a la derecha sus datos. **«Entrada nueva»** pide el tipo (criatura, conjuro, objeto…: los que
  define el sistema) y abre su formulario, que ya existe (`campaign/entry-editor.tsx`) pero hoy solo se alcanza desde
  una campaña y no guarda el libro. El árbol, la ficha y el buscador del compendio (`campaign/compendium.tsx`) dejan de
  depender de una campaña para servir a las dos pantallas; en el servidor faltan las lecturas del compendio de un
  sistema por libro.
- **Crear un sistema: tres caminos** en el cuadro. «Con tu IA» (gris, no se pulsa: conecta el MCP y créalo con su
  ayuda); «Con el esqueleto» (bajarlo, rellenarlo y subirlo: la comprobación ya existe y da mensajes por nombre; se
  mejora la lista para que diga qué falta, dónde y un ejemplo; sigue admitiendo un zip de Foundry); «A mano» (tanda 8).

## Tanda 7 — Libros de texto y el compendio desde el mundo

- **Capítulos** en los libros (tabla propia, `system_chapters`, en Markdown; se exportan e importan con el archivo del
  sistema y tienen sus herramientas MCP): se escriben con el editor de bloques, como las notas del jugador; índice a la
  izquierda que sigue la lectura, anterior / siguiente. En la campaña, la jugadora lee los de los libros elegidos, y
  bien en el móvil. Estudio previo: el lector de D&D Beyond ya está en `research/dndbeyond/contenido-y-enlaces.md`; se
  mira 5etools. ADR nuevo.
- **Incrustar una entrada** en una página o en un capítulo (`![[@Nombre]]`: su ficha) además del enlace `[[@…]]` que
  ya hay; el bloque «statblock» manual se queda para lo escrito a mano. Si el mundo tiene campañas con sistemas
  distintos, o ninguna, pregunta de cuál y lo recuerda. **Entra en la prueba de fugas**: una jugadora solo ve la ficha
  incrustada si su campaña ve esa entrada.
- **«Entrada nueva del compendio»** desde el mundo («/» y al final de las sugerencias de `[[@`), en ventana flotante:
  el gestor de ventanas de la Mesa (`tabletop/windows.tsx`) pasa a `components/` y se monta también en el mundo.
- **Las tiradas, en las entradas**: hoy las acciones de una entrada se pintan como texto y no se tiran
  (`campaign/compendium.tsx:1209`); ganan su botón y su acción en el servidor.
- **Los dados salen de la wiki**, en este orden para no perder nada: dejar de ofrecer `dice:` → convertir los que haya
  a texto en código (al cargar cada documento y al restaurar versiones) → barrido → quitar el nodo
  (`packages/editor/src/nodes/dice-roll.ts`, su vista, i18n, MCP, pruebas). Consecuencia: al pasar Eana, sus `dice:`
  llegarán como texto; lo que deba tirarse irá a una entrada del compendio.

## Tanda 8 — El editor de sistemas a mano

- **Estudio** con craft-anything de los creadores de Roliando (ya hay cuenta y notas en
  `research/roliando/crear-y-compatibilidad.md`) y de Roll20, dirigido a: cómo explican cada cosa, en qué orden, qué
  esconden y cómo enseñan el resultado mientras se edita.
- **Base**: el editor que se quitó se recupera de git (`b2a5d14^`, unas 4.400 líneas con «Probar») como punto de
  partida; le faltan la hoja, el creador de personajes, el compendio y la mecánica.
- **Diseño** (lienzo, lo aprueba Enrique): por pasos y con palabras de mesa («¿Qué tiene un personaje?», «¿Cómo se
  tira?»), sin tecnicismos; cada campo con su «?» pequeño que abre una explicación con un ejemplo real; a un lado, la
  ficha que va saliendo y «Probar»; la revisión siempre a la vista con los mismos mensajes del esqueleto. Las fórmulas
  y lo avanzado, al fondo.
- Cambia la norma «los sistemas se hacen con la IA» y un punto del ADR-0015.

## Tanda 9 — Repaso del MCP

Cada tanda ya deja sus herramientas al día. Aquí se repasa entero (`apps/server/src/mcp/tools.ts`): la lista
(`tools.test.ts` comprueba la exacta), las descripciones de los contratos y las instrucciones (hoy hablan de plantillas
de serie, de `dice:` en las páginas y de que no hay editor de sistemas), con una prueba nueva que vigile que las
instrucciones no nombran lo que ya no existe. Se prueba de verdad con el conector Neo Crisol.

## Después: módulos 9, 8 y 10

Cada uno con su ciclo completo (entrevista frente a `docs/inventario.md`, estudio, spec, lienzo, plan, construcción,
revisión e impeccable). Nacen ya sobre el registro de pestañas, las plantillas-modelo y el cristal.

- **Módulo 9 — Pizarras y mapas con capas** (inventario § 8 y § 9). La pizarra, como pestaña de una página; los mapas
  ganan regiones, rutas, textos y capas (la base de datos ya los guarda: `map_elements`), escala y medir.
- **Módulo 8, parte del mundo — Calendarios y líneas temporales** (§ 7): calendarios del mundo con su editor, eventos,
  y la línea temporal como pestaña.
- **Módulo 10, parte del mundo** (§ 10): grafo de relaciones y árbol familiar, tableros, gráficos y generador de
  nombres.

## Más adelante: la revisión de la campaña

Con ella, lo de los módulos 8 y 10 que es de la campaña: el «hoy» de cada campaña, el clima y los viajes, el centro de
actividad y la pantalla del máster. **Módulo 11 (pagos): descartado.**

## Encontrado de paso al preparar el plan

Ya entran en su tanda:

- **Archivos comunes**: no es solo la carpeta nueva; no se mueve ningún archivo a ninguna carpeta, y el aviso solo lo
  oye un lector de pantalla (tanda 2).
- **Cristal sin respaldo** en seis piezas de la Mesa (sala, escenas, sonido, herramientas del máster, carpetas de
  actores y los menús del editor): sin desenfoque se quedan translúcidas y cuesta leerlas (tanda 5).
- **`docs/diseno.md` y el código no coinciden**: la barra derecha de la Mesa figura como opaca y es de cristal (tanda 5).
- **Tutorial de Inicio**: el paso de «Nueva campaña» está colado entre Historial y Papelera (tanda 1).
- **Menú móvil fuera de un mundo**: solo enseña «Mundos» (se revisa con la vista de la jugadora).
- **«Página N» tras un salto puesto a mano** no sale; y **al imprimir, la nota lateral va siempre a la derecha** (tanda 4).
- **«Duplicar» una página** se deja la portada, la hoja y las pestañas, y son cuatro pasos que no se deshacen de una
  vez (tanda 3).
- **Las acciones de una entrada del compendio no se pueden tirar**: salen como texto (tanda 7).
- **Mapas**: regiones, rutas y textos se guardan pero no se pintan (módulo 9).
- **Subir un sistema encima de otro** (reemplazarlo) existe en el servidor y no en la app (tanda 6).
- **No hay menú común**: cada desplegable lleva su propio código, de ahí que se comporten distinto (tanda 4).
- **Sin registro de cuenta desde la portada**: hoy solo se crea cuenta con una invitación; para uso privado es lo que
  toca, y la portada lo dirá así («Tengo una invitación»).

## Documentos que se tocan al empezar

- `docs/modulos.md`: «Dónde estamos», la tabla (11 descartado; 8–10 partidos en mundo y campaña) y este orden.
- `docs/diseno.md`: imágenes con prompt; cristal en toda la app; «Nuevo…» con línea continua; orden de la barra; el
  sistema con su espacio; el editor manual vuelve; sin plantillas de serie.
- ADR nuevos: plantillas como páginas-modelo; libros con capítulos; el cristal y el fondo de ambiente; sin pagos.

## Cómo se comprueba

- Por tanda: pruebas unitarias de lo tocado, `pnpm lint`, `pnpm typecheck`, `pnpm test`, las e2e afectadas
  (`archivos`, `plantillas`, `hoja`, `exportar`, `wiki`, `editor`, `bloques`, `sistemas`, `dados`, `fugas`) y, donde
  haya migración, aplicada en local al crearla.
- Lo visible: capturas con el navegador de pruebas (solo hay tema oscuro), y Enrique en `localhost`.
- Efectos y transiciones: grabados con Playwright en los dos temas.
- MCP: `tools.test.ts` y una pasada real con el conector.
- Al cerrar un bloque: `pnpm e2e` entero, una CI y staging.
