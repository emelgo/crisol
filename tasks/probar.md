# Lo que tiene que probar Enrique

Lista viva: todo lo que haya que probar se apunta aquí y se marca cuando lo pruebe. Lo que diga va a «Lo que dijo» (al
final) y de ahí a su arreglo, o a `docs/diseno.md` si es una norma de la interfaz.

- **Staging**: https://neo.crisol.144-91-122-245.sslip.io, con las tandas 3 a 7 de la revisión desde el 2026-11-12 (PR #118) y los módulos 1 a 7: el 6 (la mesa) desde el 2026-11-07, PR #114; el 5 (lo que ven los jugadores)
  desde el 2026-11-07, PR #112; el 4 (compendio, criaturas, imágenes, tablas, grupo y biblioteca), PR #110 y #111.
- **La IA**: el conector «Neo Crisol» de claude.ai (`https://neo.crisol.144-91-122-245.sslip.io/mcp`), con la cuenta
  de propietario.
- **En local**, con los cambios al momento: http://localhost:5173 (lo arranco cuando haga falta).

## Ajustes de interfaz (ajustes tras los módulos, bloque A; rama `ajustes/tras-modulos`; 2026-11-19)

En local o en staging cuando llegue el PR de esta rama.

- [ ] **Calendario nuevo**: solo «En blanco» y «Como el nuestro»; duplicar uno sigue en el menú de su tarjeta.
- [ ] **Entrar en un mundo y salir**: al entrar, la imagen de la tarjeta crece y se posa en la franja de la portada; al
  salir por la llama, al revés: la portada se encoge y vuelve a la imagen de su tarjeta en Mis mundos, sin crecer ni
  estirarse. El título de la página va por encima de la imagen en los dos sentidos. Pruébalo con un mundo con portada,
  con otro sin ella (sin imagen, solo un fundido), desde una página que no sea la portada (no viaja nada) y con una
  campaña con portada y otra sin ella. Al acabar, el desenfoque del cristal vuelve fundiéndose.
- [ ] **Transiciones, un estándar** (`docs/diseno.md`): las pestañas de la barra, rápidas y sin fuego; otra página del
  árbol, su texto (o su mapa, o su pizarra) entra con un fundido corto, sin hueco; entrar y salir
  de un mundo o una campaña, en espejo (720 ms, con brasas al entrar y humo al salir); entrar en una plantilla o un
  sistema, su icono y su nombre al título; los cuadros y las ventanas, algo más rápidos y con menos recorrido que
  antes. ¿Te parece bien el ritmo (antes, entrar en un mundo tardaba 1,15 s)?
- [ ] **Los botones de una página sobre su portada** (a la derecha del título): en una pastilla de cristal oscuro, se
  ven con una portada clara (pruébalo con una casi blanca) y con una oscura; el título, con su degradado oscuro debajo
  (antes no salía: la imagen lo tapaba). Igual en la portada del mundo.
- [ ] **Archivos**: la miniatura de una imagen, entera y centrada (también una muy alta o muy ancha) y sin el recuadro
  gris; lo que no es imagen, con su icono en el recuadro.
- [ ] **El panel de la derecha**: al plegarlo se va entero, fundiéndose, mientras la columna del centro se ensancha; al
  desplegarlo entra ya con lo suyo. Sin saltos ni un panel vacío que luego se llena.
- [ ] **El engranaje del mundo**, a la derecha de su nombre en la ficha del árbol; ya no está encima de la portada. El
  último paso del tutorial del mundo lo señala ahí.
- [ ] **Tutoriales**: en el grafo (los filtros), en las páginas de la jugadora (su árbol) y en el editor de un calendario
  (sus partes), el globo sale al lado y no se corta arriba. En Etiquetas, sin ninguna, no hay paso de una lista vacía.
- [ ] **Calendarios**: su bodegón mira a la derecha, como los demás.
- [ ] **Revelar, solo en la campaña**: en las páginas del mundo ya no están «Quién la conoce», «Revelar la página»,
  «Revelar a…» (botón derecho en el árbol) ni el ojo de cada fila del árbol. En la Mesa de una campaña, en la ventana de
  una página, siguen. Lo mismo el «Revelar» de los secretos y el de las pestañas, y el ojo de los pines y de lo
  dibujado en los mapas: solo dentro de la campaña (Claude, 2026-11-20, por la misma razón: en el mundo se crea, no se
  juega). En la ventana de una página en la Mesa, sus pestañas se cambian dentro de ella (antes, el mapa no se abría).
- [ ] **Plantillas sin cuadro de ajustes**: en la lista de Plantillas, el botón derecho (o la tecla de menú, o el «⋯» de
  la fila) sobre una plantilla da Renombrar, Duplicar, Mover a… (sus carpetas, con buscador y «Fuera de las carpetas») y
  Borrar, como en el árbol de páginas; lo mismo en el árbol de la izquierda de una plantilla abierta. Ya no sale el
  cuadro con «Carpeta» e «Icono». Las carpetas siguen con su engranaje (nombre, carpeta, icono y color).
- [ ] **El icono, desde el título** (páginas y plantillas): escribe «:» al principio del título y parte del nombre
  («:castillo», «:dragón») → salen los iconos de la app; flechas e Intro (o el ratón) lo ponen y lo escrito se va.
  Un emoji delante del título también vale, ahora también en las páginas. Pulsar el icono puesto abre nuestros iconos
  (sin la fila de emojis) y «Quitar el icono». ¿Se entiende lo de «:» sin explicarlo, o prefieres otra forma?
- [ ] **El icono de una carpeta o de un sistema** (su ventana): un botón con el de ahora que abre nuestros iconos debajo,
  sin emojis por defecto ni «Otro».
- [ ] **Una plantilla abierta, con el esqueleto de una página del mundo**: la portada detrás del título, las pestañas
  debajo, el panel que se pliega con su botón (y se recuerda) y la ficha de la izquierda y el panel a la altura de la
  columna, con «‹ Plantillas» encima de la ficha. Abre una página de la wiki y una plantilla y alterna: la ficha de la
  izquierda, la columna y el panel no se mueven ni un píxel (medido a 1440×900 y 1920×1080), y «Tus plantillas» es el
  rótulo pequeño y gris como el nombre del mundo.
- [ ] **Renombrar sin cuadro** (páginas y plantillas): botón derecho → «Renombrar» en el árbol de páginas, en el de las
  plantillas o en la lista de Plantillas → se abre esa página (si no lo estaba) con su título elegido para escribir
  encima; Intro guarda, Escape lo deja como estaba. Ya no sale el recuadro flotante.
- [ ] **Versiones de una plantilla, en un botón**: su cabecera ya no tiene «⋯»; junto al candado, un reloj
  («Versiones») que abre su lista (también sobre una portada, en la pastilla). Duplicar, solo con el botón derecho. Ctrl+P
  no imprime.
- [ ] **El icono del título, siempre pulsable**: en una página o plantilla sin icono, delante del título sale en gris el
  de su tipo (el del árbol; en una plantilla, el de plantilla); al pulsarlo (o Tab hasta él e Intro) se abre el selector
  de nuestros iconos, sin «Quitar el icono». Puesto, igual que antes, con «Quitar el icono»; quitado, vuelve el gris.
  Con la página bloqueada, sin icono no sale nada. «:» y el emoji delante del título siguen valiendo.

## Conectores de IA: Mundos y uno por campaña (ajustes tras los módulos, bloque D; rama `ajustes/tras-modulos`; 2026-11-19)

ADR-0030. Se prueba en staging cuando llegue el PR de esta rama. Las direcciones:
`https://neo.crisol.144-91-122-245.sslip.io/mcp` (Mundos) y `https://neo.crisol.144-91-122-245.sslip.io/mcp/campanas/<id>`
(la de cada campaña, que sale en su Inicio).

- [ ] **Mundos sigue igual**: el conector que ya tienes en claude.ai (`…/mcp`) funciona sin volver a conectarlo y con
  las mismas herramientas (es el de la migración de Eana). Crisol se presenta ahora como «Crisol · Mundos».
- [ ] **El de una campaña**: en su Inicio, «Conecta tu IA a esta campaña» con su dirección y «Copiar». En claude.ai,
  Ajustes → Conectores → «Añadir conector personalizado»: pega la dirección y ponle un nombre (por ejemplo «Crisol · La
  Marca»). Al conectar, la pantalla de permiso dice «… en La Marca: solo verá esta campaña…».
- [ ] **Como máster, en ese conector**: «¿qué día es hoy?», «abre la escena del puerto», «tira iniciativa», «revela
  Varn»… sin decirle la campaña. No puede crear páginas, plantillas ni calendarios: eso, con Mundos.
- [ ] **Como jugadora** (con una cuenta de jugadora, desde su Inicio): «hazme un personaje», «tira 1d20+3», «escribe en
  el registro que entro en la taberna», «apunta en mis notas…»: lo hace. «Revela…» o «abre la escena…», no. Si juega
  en dos campañas del mismo mundo, cada conector ve solo lo que sabe la suya.
- [ ] **Tus conexiones** (Ajustes › IA): cada conexión con su conector, la app y cuándo se usó. «Quitar» (se confirma
  en la fila) la desconecta al momento: claude.ai pide volver a conectar. En el Inicio de la campaña, si ya hay una
  conectada, dice cuál y cuándo se usó.
- [ ] **Quien solo juega**, en Ajustes › IA: sin la dirección de Mundos ni el modo; ve sus conexiones y que cada campaña
  tiene la suya. Si conectara Mundos igualmente, solo vería las herramientas de leer.
- [ ] **Decisiones tomadas sin ti** (dime si alguna no te vale):
  - en Mundos, la jugadora solo lee: sus notas y la página del grupo pasan al conector de su campaña;
  - para el modo de IA de la jugadora, su personaje, sus tiradas, el registro y sus notas son «escribir» (en copiloto
    no esperan aprobación);
  - el máster en el conector de la campaña no escribe el mundo ni toca la invitación (eso, con Mundos);
  - las tiradas de la jugadora por la IA salen a la vista de todos salvo que pida otra cosa;
  - el inventario del grupo: la IA de la jugadora lo ve, pero no lo cambia;
  - «Tus conexiones» van en un orden fijo (Mundos y luego cada campaña por su nombre) y «Quitar» se confirma en la fila.

## Cronología y árbol genealógico como pestañas, y el grafo en una ventana (ajustes tras los módulos, bloque B; rama `ajustes/tras-modulos`; migraciones 0090 y 0091; 2026-11-19)

ADR-0031. En local (http://localhost:5173) ya están las dos migraciones aplicadas.

- [ ] **Tus cronologías de antes**: cada una es ahora una página nueva al final del árbol, con su nombre y una pestaña
  «Cronología» (lo que sabía cada campaña de ella, ahora de la página). Muévela adonde quieras (dentro de «Historia»…).
  Calendarios ya no las lista, y su dirección de antes lleva a su pestaña.
- [ ] **Una cronología nueva**: en una página, «+» de las pestañas › «Cronología» (o «Página nueva» › Cronología). Se
  ve con la portada, el título y las pestañas de la página, y sus herramientas (su calendario, «Hoy de…», «Ir a…» y
  «Ajustes») a la derecha de las pestañas. Sus ajustes ya no llevan el nombre: es el de la pestaña (su menú ▾).
- [ ] **La jugadora**: ve la cronología si conoce su página (y la pestaña no está oculta); «Cronologías» de su campaña
  lleva a cada una, en su página.
- [ ] **El árbol genealógico**: «+» › «Árbol genealógico» (u «Organigrama»). Vacío, «Añadir a alguien»: escribe y elige
  una página, o «Añadir «…» sin página» (sale con la raya discontinua). Pulsa a alguien: su ficha, con «Padre o madre»,
  «Pareja» e «Hijo o hija» (al hijo de alguien con pareja, los dos son sus padres), sus líneas (la × al acercarse),
  «Crear página» (una subpágina de la del árbol), «Nota» y «Quitar». Con doble clic se abre su página.
- [ ] **Empezar desde los campos**: en un personaje con «Padres» y «Pareja» (campos con papel), su árbol vacío ofrece
  «Empezar desde los campos».
- [ ] **El organigrama**: una facción con «Miembro» y «Quien lo dirige» desde la ficha del grupo.
- [ ] **El árbol cuenta en el grafo**: quien está en un árbol con página sale relacionado con su familia en el grafo,
  aunque no tenga los campos.
- [ ] **La jugadora y el árbol**: ve los nodos de las páginas que conoce y los sueltos; de los demás, nada (ni el nombre).
- [ ] **Sin pestaña «Relaciones»**. El grafo, en una ventana: el icono de la cabecera del árbol de páginas abre el del
  mundo, y el de «Mencionado en», el de esa página, sin cambiar de vista. Escape, la X, pulsar fuera o Atrás la cierran.
  El de una página, sin controles: sus relaciones directas, también lo que menciona el texto (la raya discontinua, como
  dice la leyenda); para ir más allá, pulsa otra página y, en su ficha, «Sus relaciones» las añade al grafo (sin salir
  del de la tuya). El del mundo, sin el filtro de plantillas (cada página sigue con el color de su plantilla, que dice su
  ficha); los filtros se ocultan y vuelven con el botón de panel a la izquierda de la cabecera («Ocultar filtros» /
  «Mostrar filtros»), en lugar de «‹‹ Plegar».
- [ ] **La IA**: «hazme el árbol genealógico de la casa de Varn con Ilsa, sus padres y su hija» (`crear_arbol_genealogico`)
  y «añade a la abuela, que aún no tiene página» (`editar_arbol_genealogico`).
- [ ] **Decisiones tomadas sin ti** (dime si alguna no te vale): las cronologías migradas van al primer nivel con una
  pestaña «Cronología»; la marca `chronology` ya no se usa (una cronología se enseña con su página o su pestaña); la
  tarjeta vacía del árbol usa el bodegón de los capítulos (hay prompt para uno propio en `docs/imagenes-por-hacer.md`);
  «Crear página» la pone dentro de la página del árbol; el árbol no lleva los nombres de cada generación (no hay una
  página en el centro desde la que contar); al cambiar la forma de un árbol hecho no se rehace (la forma se elige al
  crearlo).
- [ ] **Tras la crítica de diseño** (impeccable): la escala de la vista Meses dice ahora «Año · Mes · Día» (con «Meses»
  pulsado en las dos píldoras no se sabía cuál era cuál); el calendario de la cronología lleva su icono y lleva a su
  vista grande; en el móvil, la cronología de la jugadora va con la página. **Pregunta**: en el móvil, ¿el árbol de la
  jugadora «en palabras» (padres, pareja, hijos de cada uno), como la pizarra, y el lienzo al ampliar? Hoy es el lienzo en
  una caja.

## Calendarios en grande y su editor por fases (ajustes tras los módulos, bloque C; rama `ajustes/tras-modulos`; 2026-11-19)

Plan aprobado el 2026-11-19 («¿cómo creo eventos en el calendario?»). Normas en `docs/diseno.md` (Pantallas).

- [ ] **Al pulsar un calendario se ve en grande**: el título sobre la columna y «Editar calendario» a su derecha (y en
  el engranaje de su tarjeta, «Abrir» y «Editar calendario»). **Sin columna izquierda** (ni el año en pequeño ni el
  resumen, que sigue en el editor). En el centro, arriba, **Mes · Semana · Año** centrado y «Hoy de…» a la derecha;
  debajo, la vista con «‹ ›». En Mes, las lunas nuevas y llenas, la estación y la era; una festividad dentro de la
  semana sale con su franja de color y las de fuera de la semana, debajo.
- [ ] **El título de la vista lleva a otra fecha** (sin la barra «Ir a»): «Enero del año 1» lleva una flecha pequeña y
  se subraya al pasar; al pulsarlo sale un recuadro pequeño. Mes: el año y los meses (un mes lleva a él); Semana: el
  año, los meses y los días del elegido (un día lleva a su semana); Año: solo el año con «Ir». Intro aplica el año
  escrito; Esc o pulsar fuera lo cierran y el foco vuelve al título; el año no pasa del tope ni de seis cifras.
- [ ] **Semana**: sus días en columnas (con el mes junto al número del primero y de cada día 1) y todo lo que cae en
  cada uno; las fiestas de fuera de la semana que caen en medio, debajo; con la semana que empieza cada mes, no sale de
  él. Con el teclado, las flechas pasan de día y Re Pág / Av Pág de semana.
- [ ] **Año**: sus meses en pequeño (las festividades, en su color; los días con algo, subrayados; hoy y el día
  fijado, marcados); pulsar un mes lleva a él en la vista Mes.
- [ ] **La ficha del día**, a la derecha, solo cuando hace falta: **al pasar el ratón** (o el foco) por un día se ve,
  **al pulsarlo se fija** (con su «×») y **Esc la quita**; la columna del centro no se mueve. Su título lleva la era
  («Lunes, 1 de Enero de 2014 de la Era X»); debajo, la estación, el día del año, cada luna con su fase y lo que pasa
  ese día (los eventos se editan al pulsar su título; las páginas, se abren). ¿Te vale que, al ir de un día a la
  ficha, la vista previa espere un instante para no cambiar al cruzar otros días?
- [ ] **«Nuevo evento»** abre el cuadro del evento con la fecha del día: crea un evento suelto del mundo, que sale en el
  mes y en las cronologías que lo incluyan. **Salen todos los eventos y páginas con fecha del mundo**, no solo los de
  alguna cronología; lo de otros calendarios, convertido (sin correspondencia, una línea dice cuántas fechas faltan).
- [ ] **«Página con esta fecha»** crea una página «Sin título» en el primer nivel con el campo «Fecha» puesto y la abre
  para escribir el título. ¿Te vale en el primer nivel, o prefieres elegir dónde va (o con plantilla)?
- [ ] **«Hoy de…»**: con alguna campaña con fecha, se abre en su hoy, marcado en la rejilla, y «Hoy» vuelve a él.
- [ ] **El editor, por fases** (`…/editar?fase=semana`): las fases con su número y sus avisos a la izquierda; la
  elegida en el centro con la anterior y «Siguiente: …» al pie; a la derecha el año (su tira y sus cifras, al momento)
  y los problemas, cada uno con «Ir a…». Sin vista previa. «Guardar» y «Cancelar» abajo cuando hay cambios; con
  problemas, «Guardar» lleva al primero. Cambiar de fase con cambios no pregunta; salir (o «Ver calendario»), sí. Al
  crear un calendario se abre su editor.
- [ ] **Meses**: cada uno con su «Tipo» (Mes o Festividad, y una línea dice qué es una festividad); solo una festividad
  enseña «Sus días no cuentan en la semana». El número, centrado bajo «Nº», y el color en su columna.
- [ ] **Días señalados**, su propia fase (mes, día y nombre), con la línea «No son los días de la semana».
- [ ] **Semana**: «La semana empieza en» reordena los días sin cambiar el de ninguna fecha; la frase «El 1 de {mes} del
  año {N} fue {día}» dice qué día fue y, al cambiar el día, corre el de todo el calendario. Sustituye a «El año 0
  empieza en».
- [ ] **Días de más** (antes «Bisiestos»): sin reglas de serie ni atajos («Todos los años duran lo mismo.» y «+ Regla»);
  cada regla se lee como una frase: «Cada [N] años, [mes] tiene [D] días más, salvo cada [M] pero sí cada [K]» («pero
  sí cada», solo con un «salvo»). En ningún texto de calendarios sale «bisiesto». El resumen dice «365 días · 366 con
  días de más».
- [ ] **Tope de años**: en el año del título de la vista grande, escribe «-2345656»: no deja más de seis cifras y se para en -99999 (sin rango, de
  -99.999 a 99.999). En el editor, General, «Años: desde … hasta …» (opcional): con eras y «desde» vacío, propone el
  inicio de la primera («Desde el inicio de…»), sin ponerlo solo; «desde» después de «hasta», o una era que empieza
  fuera, es un problema. Con un rango, en la vista grande (Mes, Semana y Año) las flechas se apagan en el borde y el
  año escrito se queda en el extremo; lo mismo en el campo «Fecha» de una página, en el de un evento y en «Poner
  fecha» de la campaña (en «Año», los años de fuera no se eligen). Pide a la IA una fecha fuera: no la pone y dice por
  qué. **Decidido sin ti**: el tope general es de ±99.999 (cinco cifras; el campo admite seis para poder escribir); las
  fechas que ya hubiera fuera de un rango nuevo no se tocan, pero no se pueden volver a guardar sin cambiarlas; avanzar
  el «hoy» más allá del último año tampoco se deja.

## El tiempo de la campaña (módulos 8 y 10 · campaña, en local, rama `modulo-8/calendarios`; migraciones 0085-0089; 2026-11-17)

Spec: `docs/specs/modulo-8-10-campana.md` (decisiones 1-33). Lienzo aprobado «El tiempo de la campaña».

### El hoy (decisiones 1 y 5-10)
- [ ] **Inicio del máster**: el hoy grande (fecha, año, estación con su color y lunas con su fase), −1 día, +1 día,
  +1 semana (los días de la semana del calendario) y «Poner fecha» (el mes con su semana, elegir día, «Poner fecha»).
  Cada cambio saca abajo «La fecha pasa a… · Deshacer» unos 7 s; «Deshacer» la devuelve y el registro dice «Deshecho:
  la fecha vuelve a…» (el registro no se deshace: escribe su entrada).
- [ ] **Campaña sin fecha**: «Sin fecha» con «Poner fecha» y, si otra campaña del mundo tiene, «Copiar de otra campaña:
  …». El hoy va en el calendario principal (`campaigns.today`); la jugadora lo lee sin eras ocultas.
- [ ] **En la Mesa**: el chip del hoy bajo el de la escena (día, icono y grados; «A mano» o «Interior» si toca); su menú
  con la fecha entera, el clima, el sol, los botones y «Viaje…». La jugadora solo lo lee.
- [ ] **Cronologías**: desde la campaña (la jugadora, y en la Mesa desde «Cronologías» del menú del chip, en una
  ventana) la línea roja «Hoy» con la fecha y «hace / dentro de N días» bajo cada entrada (desde 2 años, en años); lo
  que viene, con borde discontinuo. En la del mundo, «Hoy de» con las campañas que llevas con fecha (y «Sin «hoy»»);
  se recuerda por mundo. **Solo en la vista Lista** (no en Meses ni Calendario).
- [ ] **Permisos**: cambiar el hoy, el clima, los viajes, la capa y la pantalla del máster es del máster
  (`table.manage`); la jugadora recibe 403 (probado en la e2e de fugas).
- [ ] El hoy y el clima a mano cuentan como **fechas en uso** del calendario: quitar ese mes avisa.

### El clima y el sol (decisiones 11-16, 27, 28 y 31)
- [ ] **Zonas**: templada, árida, fría, tropical, de montaña, de costa y polar; la zona y la latitud son de la campaña
  («Cambiar»: la lista con el clima que haría hoy en cada zona, la latitud con Norte o Sur y las horas de luz). **Los
  parámetros de las siete zonas son inventados** (la templada es el pack «General» del antiguo): ¿te cuadran?
- [ ] **Con semilla** `(mundo, zona, día)`: no cambia al recargar; dos campañas en la misma zona y día ven lo mismo.
  Las rachas se calculan en **bloques de 14 días** (puede haber un salto de tiempo entre un bloque y el siguiente).
  15 condiciones (despejado… nieve).
- [ ] **A mano**: pulsar el clima de hoy o un día de la previsión abre «Clima · día»: condición (las 15), mínima y
  máxima en °C, rumbo en una rosa de 8 (los 16 del clima se redondean al más cercano) y fuerza del viento; «Volver al
  generado». No cambia los días siguientes. El día a mano lleva un punto en la previsión. En el registro, «Clima del …
  a mano: Nieve, −1° / 3°» con «Solo tú».
- [ ] **El máster** ve hoy y los 7 días siguientes; **la jugadora**, solo hoy y el sol (sin previsión).
- [ ] **Sol**: salida, puesta, alba y anochecer, horas de luz; sol todo el día o noche polar. **Corregido**: el
  solsticio de invierno es el **primer día** de la estación «Invierno» (en un gregoriano, el 21 de diciembre); lo más
  frío del clima sigue a mitad del invierno.
- [ ] **Capa de clima** (Mesa, Mesa de la jugadora y Vista de jugadores): «Como hoy» (de entrada), «A mano» (lluvia,
  nieve, niebla o ceniza, intensidad y viento) o «Ninguna». Partículas sin estado (misma semilla en todos los
  aparatos), en la pantalla (no siguen el zoom del mapa), a 30 fotogramas. **La capa no va al historial; Interior sí**
  (es de la escena). **Interior** va primero en el menú y, encendido, la capa se apaga y sale «Interior: sin clima»
  sobre el mapa. ¿Te gustan la lluvia, la nieve, la niebla y la ceniza?

### Los viajes (decisiones 3, 17, 18 y 30)
- [ ] **Desde el recuadro de medir del mapa** (máster, en el mapa del mundo): bajo los días a pie, a caballo y en barco,
  «Viaje» con la campaña (las que llevas con fecha), medio, ritmo (×0,67 / ×1 / ×1,33) y descanso → los días (los de
  camino redondeados hacia arriba más el descanso, **repartido por el camino**), el clima de cada día, «Al llegar» (la
  zona de destino) y «Avanzar hoy · N días». Midiendo una ruta dibujada, el viaje lleva su nombre.
- [ ] **Desde la Mesa**: «Viaje…» en el menú del chip, con la distancia escrita en millas (de entrada 60, a caballo).
  **Sin mapa, las velocidades son las de por defecto** (a pie 24, a caballo 30, en barco 48 millas al día).
- [ ] Tope de **366 días**; el clima del viaje es el de **la zona de salida**. En el registro, la tarjeta del viaje:
  ruta, «118 millas a caballo, ritmo rápido · 3 días y 1 de descanso», el clima de cada día (con «descanso») y «La
  fecha pasa a … · zona De costa». Se deshace entero desde el historial.

### La actividad (decisiones 19-23 y 32)
- [ ] **«Desde tu última visita»** en el Inicio (máster y jugadora), agrupado por día real («Hoy», «Ayer», «domingo
  16»), con **«Sesión»** el día que hubo mensajes o tiradas y su línea («64 mensajes · 38 tiradas»). Al máster: notas y
  personajes de las jugadoras, lo revelado por otros o la IA y los cambios de fecha; a la jugadora: lo que le revelan,
  lo nuevo del registro que le llega y los cambios de fecha (nunca notas de otras: e2e de fugas).
- [ ] **Qué cuenta como nuevo**: lo de después de tu última visita (sin visita, desde que entraste en la campaña). Se
  marca como visto **solo con «Marcar como visto»** (✓ en el móvil); «Ver lo anterior» lo enseña otra vez hasta que
  recargues.
- [ ] **Insignia**: el número rojo sobre el icono de la campaña en la barra (su Inicio). Se refresca con el aviso en
  vivo `changed/activity` (fecha, notas y personajes) y con lo nuevo del registro, las tiradas y lo revelado.
- [ ] **Aviso en vivo**: en las demás secciones de la campaña (no en su Inicio, que ya lo enseña, ni en la Mesa), abajo
  a la derecha con «Ver» (lleva al Inicio); se va a los 10 s, salvo con el ratón encima o el foco dentro. Sin correo
  ni notificaciones del navegador. Sin las horas de la sesión (no hay datos para ellas).

### La pantalla del máster (decisiones 24, 25 y 33)
- [ ] **Cajón G** en cuatro columnas que se encienden y apagan desde su cabecera (Criaturas, Personajes, Nota, Tablas);
  **se guarda en el servidor** por campaña y escena (en otro aparato sale igual; solo en escenas ya abiertas). Lo que
  tenías antes en el navegador (nota y statblocks) se pierde: sale la página de la escena.
- [ ] **Criaturas**: la primera desplegada y las demás plegadas (×N). **Personajes de la escena**: ficha corta (PG y los
  3-4 primeros números de su ficha, la barra de vida y los estados). **Nota fijada**: «Cambiar» busca por título.
  **Tablas**: «Añadir tabla» (las del mundo), desplegar, «Tirar»: **oculta por defecto** (al registro, solo tú), con la
  casilla «A la vista de todos» (no se recuerda); se resalta la fila. El d20 también saca la tirada.
- [ ] El Kanban de reglas del antiguo no vuelve.

### La jugadora en el móvil (pantalla 8)
- [ ] Su Inicio: el hoy (fecha, estación y lunas, clima con viento y grados, sol y horas de luz), «Desde tu última
  visita» compacto con su ✓, y debajo lo de siempre.

### La IA
- [ ] Desde claude.ai: `fecha_de_hoy`, `cambiar_fecha`, `ver_clima`, `cambiar_clima`, `planear_viaje` (con o sin
  avanzar) y `actividad_campana`.

### Decisiones tomadas sin ti (porción 2)
- «Deshacer» deshace la última operación del hoy (o un viaje) de esa campaña hecha desde la web, por el historial del
  mundo.
- En la Mesa, el menú del chip lleva también las cronologías del mundo (se abren en una ventana con la línea «Hoy»).
- La línea «Hoy» solo en la vista Lista; «Hoy de» se recuerda por mundo.
- La previsión entera se edita (cada día, también hoy); la zona enseña el clima de hoy en cada zona.
- Los deslizadores de la capa se guardan al poco de moverlos; las partículas van en la pantalla, no en el mapa.
- La insignia, en el icono de la campaña de la barra; el aviso en vivo, no en su Inicio ni en la Mesa.
- El historial dice ya las operaciones nuevas («cambió la fecha de «La Marca» a…», «hizo un viaje de 4 días…»,
  «marcó la escena… como interior»…).
- Lo que flota (menús, recuadros) se corre también en vertical si no cabe ni arriba ni abajo (en toda la app).

## Relaciones y gráficos (módulo 10, en local, rama `modulo-8/calendarios`; sin migración; 2026-11-16)

- [ ] **La pestaña «Relaciones»** de una página: sale (tras las demás) si tiene alguna relación, por sus campos de
  enlace o por los enlaces de su texto; no se añade con «+» ni se guarda. Un PNJ con Padres y Pareja se abre en
  **Familia**; una facción con Líder, en **Organigrama**; si no, en **Enlaces**. El modo que elijas se recuerda para las
  páginas de esa plantilla.
- [ ] **Enlaces**: la página en el centro y sus relaciones alrededor (sin flechas); los nombres solo en las rayas del
  centro y de la elegida, leídos desde ella («Padres», «Hijos» o, sin nombre al revés, «Facción de»). «Menciona», de
  puntos; lo que sale de un secreto, discontinuo (solo tú). «Profundidad» 1–3 y «Solo campos» a la derecha de las
  pestañas; la leyenda abajo a la izquierda, el zoom abajo a la derecha (con el panel plegado, por encima del d20).
- [ ] Pulsar una página saca su ficha (arriba a la derecha) con «Abrir» y «Centrar aquí»; el doble clic la abre;
  «Centrar aquí» rehace el grafo desde ella con «‹ Volver a…» arriba. Al pasar por una propiedad de enlace del panel,
  sus rayas se marcan.
- [ ] **Familia**: filas por generación (Abuelos, Padres, Su generación, Hijos…), cada pareja junta con una raya y de
  ella la línea a sus hijos; «Generaciones ±1 ±2 ±3» (de entrada ±2). **Organigrama**: el grupo arriba, quien lo dirige
  debajo («Lo dirige») y sus miembros en una columna; cada subgrupo, en la suya. Bajo cada nombre, su primer campo de
  texto con algo. En los dos, el panel se pliega solo (su botón lo abre).
- [ ] **El grafo del mundo**: el icono nuevo de la cabecera del árbol de páginas (junto a Exportar). «‹ Páginas»,
  cuántas páginas y relaciones salen, el buscador (Intro lleva a la página y saca su ficha); a la izquierda los filtros
  (plantillas, relaciones —la apagada sale tachada—, etiquetas y «Páginas sueltas», ocultas de entrada), que se
  pliegan. Cada página, del color de su plantilla. Con 300 páginas o más se pinta en un lienzo (que se asienta solo, sin congelar la página).
- [ ] **En la plantilla**, un campo «Enlace a una página» o «Enlaces a páginas» tiene «Papel» (Ninguno; Familia: Padre o
  madre, Pareja; Organigrama: Pertenece a, Lo dirige), «Nombre al revés» (al elegir un papel se pone solo si estaba
  vacío: «Hijos», «Pareja», «Miembros», «Dirige») y «Se lee así»; el papel sale junto al nombre del campo en la lista.
- [ ] **Gráficos**: «/» → «Gráfico» pone uno de ejemplo y abre su editor en el sitio del panel: título, los seis tipos,
  datos propios (etiquetas y series en una tabla, con sus colores; en tarta, donut y área polar, por etiqueta) o «De una
  tabla» de la página, leyenda y «Ver YAML» (también se escribe). Cada cambio se guarda solo. Un ```chart que escriba la
  IA se ve igual; uno que falle dice qué falla. Al elegir el bloque (o su lápiz) sale el editor; la X lo cierra.
- [ ] **La jugadora** ve la pestaña con lo que sabe su campaña (ni lo que no conoce, ni campos ocultos, ni lo de
  secretos sin revelar) y el grafo del mundo desde el icono de su árbol. **En el móvil**: los modos arriba, el grafo en
  pequeño con «Ampliar» (a pantalla entera; la ficha sube desde abajo), en palabras debajo y la familia y el
  organigrama en filas.
- [ ] **La IA**: `relaciones_pagina` y `grafo_mundo`; al crear una plantilla con la IA, que ponga el papel a Padres,
  Pareja, Facción y Líder.

Decisiones tomadas sin ti (dime si cambias alguna):

- De la spec (5-17): la pestaña fija y calculada, como «Mencionado en»; el papel del campo (Padre o madre, Pareja,
  Pertenece a, Lo dirige) es lo que hace el árbol y el organigrama; el nombre de la relación es el del campo, con nombre
  al revés opcional; «menciona» = enlaces e incrustados del texto (no los nombres sin enlazar), sin repetir lo que ya
  está en un campo; lo de un secreto, solo para ti y discontinuo, y las notas ocultas nunca; pines, pizarra, eventos y
  subpáginas no cuentan; el grafo del mundo con sus filtros y en lienzo (la spec decía ~800; lo he bajado a 300 porque el audit vio que el
  SVG se congelaba unos segundos con 700); solo se mira (crear
  relaciones arrastrando, más adelante); se calcula en el servidor sin caché; Chart.js cargado aparte; los gráficos se
  guardan como el ```chart del antiguo.
- Qué dice cada papel: *Padre o madre* (el destino es su padre o su madre), *Pareja*, *Pertenece a* (el destino es su
  grupo) y *Lo dirige* (en el grupo, el destino es quien lo dirige). La familia llega a ±3 generaciones, con hermanos,
  tíos y primos (la pareja de cada uno sale a su lado, sin seguir por su familia); el organigrama baja 3 niveles; el
  vecindario se corta en las 500 páginas más cercanas (lo dice: «Hay más»).
- Las mías: la pestaña va **tras las demás** pestañas (como en el lienzo) y sin icono, como «Texto»; con la página
  sin relaciones no sale. Sin nombre al revés, la raya entrante se lee **«Facción de»** junto a la otra página («Facción
  de Ilsa»). Bajo el nombre, el **primer campo de texto con algo escrito** (sin los ocultos para quien mira). Sin
  icono propio, sus **iniciales** (sin numerales romanos: «Aldren IV» → «AL»), igual para ti y para la jugadora. En Familia y Organigrama **el panel se pliega
  solo**. Los colores de las plantillas, ocho nuevos del tema (a 3:1 con el fondo), por el orden de tus plantillas. En el
  grafo del mundo, los nombres de las rayas solo los de la elegida; «Centrar aquí» lleva la vista a ella. La ficha de
  la elegida: «Centrar aquí» de principal en el escritorio y «Abrir» en el móvil. La tarta, el donut y el área polar
  pintan solo la primera serie (como el antiguo); los colores elegidos van en `colors:` (clave nueva). La jugadora en
  el escritorio ve el grafo en un marco del alto de la ventana. Las tarjetas de Familia y Organigrama nunca bajan del
  85 % (si no caben, arriba y se mueve); con muchas páginas, lo que flota sobre el grafo va sin desenfoque. Tutorial
  guiado en la pestaña y en el grafo del mundo. d3 en la 3.0.1 (la que ya traía otra dependencia).
- Las siete preguntas del lienzo, decididas por el coordinador con tu permiso (2026-11-17): se abre en Familia u
  Organigrama si los hay y, si no, en Enlaces; el nombre al revés no es obligatorio, pero **al elegir un papel en la
  plantilla se rellena solo si está vacío** (Padre o madre → «Hijos», Pareja → «Pareja», Pertenece a → «Miembros», Lo
  dirige → «Dirige»), y sin él vale «Facción de Ilsa»; «Menciona» encendido de entrada, en la pestaña y en el grafo del
  mundo; el grafo del mundo, desde el icono de la cabecera del árbol (la barra sigue con Páginas · Calendarios ·
  Archivos); bajo el nombre, el primer campo de texto visible para quien mira; el editor del gráfico, en el sitio del
  panel; y el gráfico no va como bloque del panel, por ahora.

## Cronologías (módulo 8, en local, rama `modulo-8/calendarios`; migración 0084; 2026-11-16)

- [ ] **Calendarios**: bajo los calendarios, «Cronologías» con una ficha por cronología (su calendario, cuántas
  entradas y de cuándo a cuándo) y «Cronología nueva» (nombre y calendario; se abre al crearla).
- [ ] **A pantalla entera**: «‹ Calendarios», su nombre, «Ir a…», el ojo de cada campaña y «Ajustes»; abajo en el
  centro la píldora (+ · Lista · Meses · Calendario), que se recuerda; en Meses, el zoom abajo a la derecha.
- [ ] **Las páginas con fecha salen solas** (una vez por fecha, con el nombre del campo si tiene varias); un campo
  «Fuera de las líneas temporales», no.
- [ ] **Lista**: la línea con rombos (eventos) y círculos (páginas), la distancia a la anterior («312 años después»),
  la tarjeta con su color o su imagen, el grupo arriba, «Cada año» con su icono. Doble clic o el título, editar.
- [ ] **Meses**: carriles por grupo, «Páginas» y «Sin grupo»; festividades estrechas y con su color; arrastrar el
  fondo para moverse y la ventana que crece por los dos lados; arrastrar una barra la mueve; doble clic en un grupo lo
  renombra, arrastrar su nombre lo ordena, «+ Grupo».
- [ ] **Calendario**: la semana del calendario, lo de varios días seguido, lunas nuevas y llenas, lo de fuera de la
  semana debajo, «Todo el mes»; elegir un día abre su detalle («Evento en este día»); arrastrar una ficha a otro día le
  cambia la fecha; las flechas recorren la rejilla y Re Pág/Av Pág cambian de mes.
- [ ] **El cuadro del evento**: la tarjeta en vivo, la fecha con el selector, color o imagen con su encuadre, icono,
  grupo (o uno nuevo), página enlazada (o una nueva eligiendo dónde va), descripción con su cuenta, «Oculto para los
  jugadores» y el ojo de cada campaña.
- [ ] **«⋯» de un evento**: duplicar, color, mover a grupo, «Convertir en página…» (la página nace con su texto, su
  icono y su imagen, y el evento queda enlazado) y borrar; en una página, «Cambiar la fecha» y «Abrir la página».
- [ ] **Ajustes**: renombrar, otro calendario (lo de otros se convierte si tiene correspondencia; si no, «N fechas
  quedan fuera»), qué páginas salen (plantillas, etiquetas) y de qué grupos; el color de cada grupo o quitarlo.
- [ ] **Una página enlazada** dice el evento en «Mencionado en» › «En las cronologías».
- [ ] **La jugadora**: solo ve «Cronologías» en su barra si se le ha enseñado alguna (el ojo de la cabecera); dentro,
  sin lo oculto ni lo que no conoce; en el móvil, Lista y Calendario arriba (tocar un día sube su hoja).
- [ ] **La IA**: «pasa esta cronología» con `crear_eventos` (100 de una vez) y `ver_cronologia` la devuelve en orden.
- [ ] **Deshacer** desde el historial: crear o borrar una cronología, un evento o los grupos.

## Fechas en las páginas (módulo 8, en local, rama `modulo-8/calendarios`; migración 0083; 2026-11-16)

- [ ] **Una propiedad «Fecha»**: en el panel, «Añadir bloque» › «Propiedad», tipo «Fecha». Se lee como texto («12 de
  Siega de 412 RC»); al pulsarla flota el selector a la izquierda del panel.
- [ ] **El selector**: Año · Mes · Día; el mes con la semana del calendario y la festividad debajo; el año escrito a mano
  (salta milenios); flechas de mes y año; la lectura larga con el día de la semana. Con el teclado, las flechas
  recorren los días.
- [ ] **«Añadir fin»** (y elegir Inicio o Fin), **«Cada año»** (el icono de repetición junto al texto) y **«Borrar»**.
- [ ] **Varios calendarios**: se elige el suyo; de uno con correspondencia, dice la equivalencia en el principal.
- [ ] **Sin calendario**: «Este mundo aún no tiene calendario.» con el enlace a Calendarios.
- [ ] **Plantillas**: el tipo de campo «Fecha», con «Con fin» y «Fuera de las líneas temporales»; las páginas nacen con
  él vacío. Sin «Con fin», el selector no ofrece fin.
- [ ] **Calendarios con fechas**: quitar un mes con fechas no se guarda («Hay fechas en un mes que quitas»); borrar el
  calendario tampoco; acortar un mes guarda y avisa de cuántas se leen en su último día; renombrar un mes cambia cómo
  se leen sus fechas.
- [ ] **Tablas de páginas** con una columna de fecha: la enseñan como texto y ordenan por ella (por su día).
- [ ] **La búsqueda** encuentra una página por cómo se lee su fecha («Siega»).
- [ ] **Copiar** una página copia sus fechas; deshacer desde el historial las devuelve.
- [ ] **La IA**: `editar_pagina` con `{ name: 'Nacimiento', type: 'date', value: '-34-Siega-3' }` (o
  `1250-Siega-12/1250-Trilla-3`, «(cada año)», `calendar`); mal escrita, dice por qué; `leer_pagina` da `dates`.
- [ ] **La jugadora** ve la fecha en su panel, y no un campo de fecha «Oculto» (ni su IA ni la búsqueda).

## Calendarios (módulo 8, en local, rama `modulo-8/calendarios`; 2026-11-16)

- [ ] **La barra del mundo**: «Páginas · Calendarios · Archivos» (Páginas lleva a la portada, como antes el nombre).
- [ ] **Calendarios**, vacía: el bodegón (provisional, el del historial) y «Calendario nuevo».
- [ ] **«Calendario nuevo»**: en blanco, como el nuestro o copia de otro; al crearlo se abre su editor. El primero nace
  principal.
- [ ] **Las fichas**: el año dibujado (las festividades con su color, las estaciones debajo), «Principal», lunas y eras;
  el engranaje (abrir, hacer principal, duplicar, borrar); arrastrar para ordenar (o Alt y las flechas en su nombre).
- [ ] **El editor**: cada sección desde la izquierda; meses con arrastre, festividad y fuera de la semana; bisiestos;
  estaciones que se pisan (lo dice y no deja guardar); lunas con sus fases; eras (con «Cuenta los años desde su inicio» y
  «Solo del máster»); en uno que no es el principal, la correspondencia. La vista previa cambia al momento.
- [ ] **Hacer principal a otro** que tenga correspondencia: el anterior recibe la inversa (una fecha convertida no cambia).
- [ ] **Con la IA**: «crea el calendario de Eana» con una sola llamada y `describir_fecha` de «1250-Siega-18».
- [ ] **La jugadora** no ve «Calendarios» en su barra, y su IA no ve las eras solo del máster.

## Ajustes del mapa, la pizarra y la página (en local, rama `modulo-9/mapas`; 2026-11-16, tasks/ajustes-mapa-pizarra.md)

- [ ] **El «?» del tutorial**, abajo a la derecha: redondo y por encima de todo (también sobre un mapa o una pizarra).
- [ ] **Supr en el mapa**: elige un pin, una región o un texto y pulsa Supr con el foco donde sea (tras cambiar su color
  en el panel, tras pulsar un botón de la cabecera): se borra; el mapa ya no se marca con la raya roja arriba al pulsar
  una tecla. **En la pizarra**, lo mismo tras pulsar una herramienta de la píldora o «Página…».
- [ ] **Cerrar una región**: al acercarte al primer punto se agranda en rojo y pulsarlo la cierra; con doble clic se
  cierra sin dejar un punto de más.
- [ ] **«Aspecto»** de una región: al abrirlo no se deforma nada; el tamaño de letra llega a 100.
- [ ] **«Página»** de un pin o una región: el desplegable propio (las que empiezan por lo escrito primero, «Página
  nueva: …» si ninguna se llama así).
- [ ] **Las formas de pin**: cambiar de forma no mueve el pin ni cambia su tamaño.
- [ ] **El ojo** del panel de un pin o una región (en vez de «Revelar…»): «Lo conoce / No lo conoce» y se cambia al
  pulsarlo; con varias campañas, la lista con la marca de cada una. ¿Se entiende? (marca sin avisar, como el árbol).
- [ ] **El icono de un pin**: va antes que el tamaño y se elige de los iconos de rol; se ve dentro de la forma y con
  «Solo el icono».
- [ ] **Texto en el mapa**: arrastra una caja y el texto sale en su centro, a su alto; pulsar un texto lo elige, doble
  clic lo edita y Supr lo quita.
- [ ] **Medir**: su panel, arriba a la izquierda (ya no tapa la píldora).
- [ ] **Los desplegables nativos** («Se ve el nombre», los de la campaña…): la lista abierta, en oscuro.
- [ ] **La pizarra nítida al hacer zoom** (rueda con Ctrl o dos dedos): ni borrosa al alejar ni con dientes al acercar.
  Si en una pizarra muy grande el zoom va a tirones, dímelo.
- [ ] **«Tabla de páginas»** en una cuenta sin plantillas: se añade sin error y dice qué falta.
- [ ] **A 1200 px con el panel abierto**: el texto de la página con su letra de siempre (seguido, sin «Página N») y el
  título largo entero en la franja.

## Vuelve el armazón de antes, con la página como en Everlore (en local, rama `modulo-9/mapas`; 2026-11-16, ADR-0028)

- [ ] **El armazón de antes**: la barra de la app a la izquierda con el mundo, Archivos, Historial, Papelera y tu
  inicial; la ficha del árbol a la izquierda (buscador, árbol, pestañas abiertas en pequeño y marcadores); las
  pestañas abiertas encima de la página; Archivos del mundo, en su pantalla aparte. ¿Es como lo tenías?
- [ ] **Entrar y salir** de un mundo: las transiciones de siempre (la tarjeta crece hasta la portada; «Mundos» sube a la
  llama y salen los iconos del mundo; al salir, al revés, con humo).
- [ ] **Un solo buscador**: Ctrl+K pone el cursor en el de la ficha del árbol (también con el foco en una pizarra);
  escribir filtra el árbol e Intro busca en el texto de todas.
- [ ] **La portada detrás del título**: en Texto, Mapa y Pizarra, una franja baja (más baja en el portátil) con el
  título grande encima, que se lee sobre la imagen, y sus botones a la derecha; las pestañas justo debajo. Sin
  portada, la textura y «Añadir portada» al pasar.
- [ ] **La página, de cristal**: el recuadro de la página con las esquinas redondeadas y algo más translúcido (se intuye
  el fondo), igual en Texto, Mapa y Pizarra; el texto se lee bien. La ficha del árbol y el panel empiezan y acaban a su
  misma altura, con las mismas esquinas y el mismo cristal.
- [ ] **El desplazamiento, el normal**: nada baja solo. En Texto, con el ratón dentro del texto, la rueda baja suave como
  en cualquier página; al bajar, la barra pequeña de cristal se pega arriba con el título y las pestañas (cambiar de
  pestaña desde ahí) y lo de debajo no salta.
- [ ] **Mapa y Pizarra, sin desplazar**: en el portátil (1200×650) y en la pantalla grande, la cabecera y debajo el
  lienzo hasta abajo, todo a la vista; la rueda sobre el lienzo acerca y aleja.
- [ ] **El botón del panel** (tras «⋯», también en la barra pequeña): el panel se va por la derecha y el centro se
  ensancha a la vez; al volver a pulsarlo, entra. Se recuerda al cambiar de página. Junto a un mapa o una pizarra con el
  panel vacío, se pliega solo.
- [ ] **Mapa**: a sangre, sin fondo propio. Las herramientas, en una píldora abajo en el centro; el zoom (con «Ampliar el
  mapa», que deja la barra de la app a la vista) abajo a la derecha y la escala abajo a la izquierda.
- [ ] **Pizarra**: a sangre y transparente; nuestra píldora abajo con sus herramientas (la elegida marcada; su atajo al
  pasar el ratón), «⋯» (guardar como imagen, vaciarla), el zoom abajo a la derecha y deshacer y rehacer abajo a la
  izquierda. Sin «Ampliar» (la jugadora sí lo tiene).
- [ ] **Decidido sin ti**: con el panel plegado, la página llega hasta el borde derecho dejando el mismo hueco que hay
  junto a la ficha del árbol (no pegada al borde). En la barra pequeña de un portátil con el panel abierto, si no caben,
  el título se acorta con «…» y las pestañas se desplazan de lado; «Guardado» solo sale con la cabecera grande. En una
  pizarra de menos de 500 px de alto (el portátil), Excalidraw pasa a su modo de móvil: sus formas de arriba se quitan
  (están en nuestra píldora) y lo de lo elegido (propiedades, duplicar, borrar) sale en una isla encima de la píldora. Los temas de papel de la hoja (pergamino) siguen cambiando solo la
  letra en pantalla; ¿quieres que el pergamino tiña la columna entera?

## Módulo 9: la pizarra (en local, rama `modulo-9/mapas`; docs/specs/pizarra.md)

- [ ] En una página, «+» → «Pizarra»: se abre Excalidraw en español y oscuro; dibuja a mano, cajas, flechas y texto.
- [ ] «Página…» pone la tarjeta de una página (y arrastrarla desde el árbol); pulsar su título la abre; si cambias el
  título de la página, la tarjeta lo sigue.
- [ ] Pega una imagen: se sube a los archivos del mundo y se ve.
- [ ] Ábrela en otra pestaña o aparato: lo que hagas en una sale en la otra al momento.
- [ ] Elige algo y pulsa el ojo tachado de la barra («Oculto para los jugadores»): se apaga y, si es una tarjeta, sale
  con raya discontinua y el ojo. La barra no salta al elegir.
- [ ] «Página…»: escribe parte de un nombre; salen las páginas que lo contienen; flechas e Intro ponen la elegida.
- [ ] Tras cambiar algo, la barra dice «Guardado»; una pizarra vacía dice cómo empezar.
- [ ] Revela la pestaña a la campaña: la jugadora la ve sin poder tocarla, sin lo oculto ni las tarjetas de lo que no
  conoce; pulsar una tarjeta le abre su página en la campaña. En su móvil, la pizarra en palabras (páginas, notas y
  «A → B»); «Ampliar» enseña el lienzo.
- [ ] Pídele a la IA un tablero («hazme el tablero de la conspiración con estas páginas»): `cambiar_pizarra`. Lo que
  pone se ve igual de claro que lo dibujado a mano y sus flechas no tachan las cajas.
- [ ] Texto, Mapa y Pizarra: el título, sus botones y las pestañas, siempre en el mismo sitio (la misma tira arriba).
- [ ] En una página sin enlaces, propiedades ni bloques, abre su mapa o su pizarra: el panel de la derecha sale
  plegado; su botón lo abre. En Texto, abierto como siempre.
- [ ] Los dados: la primera tirada tras abrir el mundo cae bien (la escena se carga al acercarte al d20).

## Módulo 9: mapas con capas (en local, rama `modulo-9/mapas`; migración 0081)

- [ ] **Capas** (una página con mapa → «Capas» en la barra del mapa): crear una, renombrarla, ordenarlas arrastrando,
  dejar una «Solo del máster» y quitarla. El ojo la apaga solo en tu pantalla.
- [ ] **Dibujar** («Ampliar el mapa» para tener sitio): una región (R) punto a punto, una ruta (L) que empiece en un
  pin y un texto (T). Retocar: arrastrar un vértice, el «+» de un lado, botón derecho para quitarlo, arrastrar lo
  elegido entero; Supr y Ctrl+Z. En su panel: nombre, página, capa, color, relleno, borde, oculto.
- [ ] **Medir** (M): en «Ajustes del mapa», dibujar la raya de la escala y decir cuánto mide; luego medir de un sitio a
  otro y pulsar una ruta para medirla entera (distancia y días a pie, a caballo y en barco).
- [ ] **La jugadora**: no ve la capa del máster ni lo oculto; lo que lleva a una página que no conoce sale sin nombre;
  revelarle algo desde su panel («Revelar…»). Mide, también en el móvil.
- [ ] **La IA** (cuando esté en staging): «mira el mapa de Eana y dibuja los reinos en una capa Política y el camino
  real de A a B» (imagen_mapa, crear_capa, dibujar_en_mapa); luego «¿cuántos días hay de A a B a caballo?».

## Revisión, tanda 9: el MCP (en staging, rama `revision/tanda-9`)

- [ ] **Reconecta el conector** «Neo Crisol» en claude.ai (Ajustes → Conectores: desconectar y conectar), para que
  coja las herramientas nuevas; luego pídele «lista mis sistemas» y «¿qué capítulos tiene el libro X del sistema Y?».

## Revisión, tanda 8: el editor de sistemas a mano (en local)

- [ ] **A mano** (Sistemas → «Sistema nuevo» → «A mano»): con su nombre se crea y abre «Reglas» por pasos.
- [ ] **¿Qué tiene un personaje?**: añade «Varias a la vez» y «Algo que se gasta»: salen al momento en la ficha de
  ejemplo y arriba pone «Guardado» solo. Abre una fila, cambia nombres, súbela, bájala y quítala («Deshacer»). Lo que se
  calcula está en «Más» y se lee en palabras.
- [ ] **¿Cómo se tira?**: el dado de siempre y una tirada con «Añadir de la ficha»; «Se lee:» debajo y «Tirar una vez».
  Escribe algo que no existe (`@nada`): el aviso sale bajo el campo y en «Revisión», «Sin guardar» arriba, e «Ir a…» lleva
  a él.
- [ ] **Los demás pasos**: tipos de objeto con sus campos, los bloques de la ficha (ordenar, «Rehacer desde los
  campos»), los pasos del creador (lo que no se puede añadir dice por qué), los libros, y en «Lo avanzado» la
  iniciativa, los idiomas y bajar el archivo.
- [ ] **Un sistema de serie o importado de Foundry** se edita igual; si otro lo cambia a la vez, sale «Volver a cargar».

## Revisión, tanda 7: libros de texto (en local)

- [ ] **Capítulos de un libro** (un sistema tuyo → pulsa la portada de un libro → «Capítulos»): «Capítulo nuevo», escribir
  con el editor de bloques (se guarda solo: «Guardado»), un secreto con «/», cambiar el título; en «⋯», subir, bajar
  y borrar (se deshace desde el Historial).
- [ ] **Leer**: el índice de la izquierda sigue lo que lees (sus secciones se marcan al bajar); «Siguiente» al final.
- [ ] **La jugadora**: en el compendio de su campaña → «Por libro» → el libro → «Leer · N capítulos»; no ve los
  secretos. En el móvil, «Ir a…» en lugar del índice.
- [ ] **El máster**: en Libros de la campaña, la ficha de un libro con capítulos tiene «Leer».
- [ ] **La IA**: «pásame el capítulo de combate del PDF a capítulos del libro» (capitulos_libro, guardar_capitulo…).
- [ ] **Tirar desde una entrada** (compendio de la campaña → una criatura): en «En juego», «Ataque» y «Daño» de cada
  acción; caen los dados y sale el aviso. Un conjuro o un arma se tira con un personaje («Tirar con», si tienes varios).

## Revisión, tanda 6: sistemas (en local)

- [ ] **Iconos de rol**: en el icono de una página, el buscador de iconos (por nombre en español); en Ajustes de una
  carpeta, plantilla o sistema, «Más iconos». Salen en el árbol, en la búsqueda y en las tarjetas.
- [ ] **El espacio de un sistema**: al entrar, la barra cambia (su nombre, Compendio, Reglas y, abajo, Ajustes del
  sistema); la llama vuelve a Sistemas. Su Inicio, con su portada arriba (y detrás, como fondo) y su icono.
- [ ] **Icono y portada del sistema**, en sus ajustes; **color o portada de un libro**, en los ajustes del libro.
- [ ] **El compendio del sistema** (todos sus libros) y **un libro por dentro** (pulsa su portada): «← {sistema}» para
  volver; con un sistema tuyo, «Entrada nueva» guarda en ese libro.
- [ ] **Sistema nuevo**: los tres caminos (con tu IA y a mano, apagados; con el esqueleto, el de verdad).
- [ ] **Tus imágenes**: Entrar con sus 12 fondos (sin crédito), la portada nueva, el fondo de Mis mundos; las pantallas
  vacías con su bodegón en el centro y su botón; con contenido, el bodegón pequeño junto al título.

## Revisión, lo que viste el 2026-11-12 (en local)

- [ ] **El cristal, ahora sí**: el fondo se reconoce detrás (en Mundos, Plantillas, Sistemas…) y la barra, las fichas
  de los lados y las tarjetas lo desenfocan, con un brillo arriba. Los cuadros (Ajustes, Papelera, «Plantilla nueva»),
  los menús, el buscador y el botón rojo, también de cristal.
- [ ] **Sin parpadeo**: al cambiar de sección o entrar en un mundo, el fondo y la barra se quedan quietos; al pararte en
  un mundo con portada en Inicio, el fondo se funde sin destello.
- [ ] **La zona de peligro** (Ajustes de una plantilla o de un mundo): un recuadro con raya roja, no un bloque rojo.
- [ ] **«Plantilla nueva»** (en Plantillas, en el «+» del editor o en una carpeta): sale el cuadro de «Página nueva»;
  con «Mapa» y un nombre, se abre ya en su mapa; sin nombre, con el título listo para escribir.
- [ ] **El árbol del editor de plantillas**: las carpetas se pliegan; «Nueva carpeta» arriba; botón derecho en una
  plantilla → Duplicar, Ajustes, Borrar; en una carpeta → Plantilla nueva aquí, Carpeta dentro, Ajustes, Borrar.
- [ ] **«⋯» de una plantilla**: Duplicar y Ajustes con el aspecto del menú; al abrir Ajustes, el menú se cierra.
- [ ] **«Pestaña nueva»** ya no tiene «Desde plantilla». **Sistemas**, sin «Tuyos».

## Revisión, tanda 5: cristal, Entrar y la portada (en local)

- [ ] **El fondo de ambiente**: en Inicio, al pasar por un mundo con portada, detrás se ve su portada muy difuminada; en
  un mundo, la suya; sin portada, la de ambiente. La barra, las fichas y las tarjetas, de cristal; la página, una hoja
  casi opaca. Bajar una página larga va igual de suelto que antes.
- [ ] **«Sin desenfoque»** (Ajustes → Este aparato): todo opaco como antes, también en la Mesa; se recuerda en este
  navegador.
- [ ] **Entrar**: el recuadro de cristal, con las imágenes desenfocadas detrás.
- [ ] **La portada** (sin sesión): la imagen hasta arriba, «Entrar» y «Tengo una invitación» (pegar el enlace de una
  campaña lleva a ella); debajo, las tres estampas.

## Revisión, tanda 4: la página del mundo y la hoja (en local)

- [ ] **El árbol, fijo**: pulsar el mundo en la barra lleva a su portada y el árbol no se esconde nunca.
- [ ] **La columna derecha** mide lo mismo que la izquierda (cabe en la pantalla) y lo que no cabe se desplaza dentro;
  en la Mesa, en la ventana de una página, el texto y el panel se desplazan cada uno por su cuenta.
- [ ] **La hoja, a todo el ancho**: en una pantalla grande el texto crece hasta llenar la columna (la letra, hasta un
  tope de 20 px) y queda centrado. Probar si el tope te parece bien.
- [ ] **Saltos de página**: la raya va de lado a lado y dice la página que se cierra («Página 1»), también en uno puesto
  a mano.
- [ ] **Nota lateral**: a la izquierda o a la derecha (con su botón de flecha), con el texto alrededor; igual al
  imprimir. También a una columna.
- [ ] **«⋯» → «Imprimir o descargar…»**: elegir «Con colores», «Blanco y negro» o «Pergamino», el papel, la numeración
  y el pie; «Descargar PDF» e «Imprimir». La próxima vez recuerda el aspecto (la página no cambia al elegirlo).
  «Exportar», con subpáginas, se despliega con su flecha. Escape o pulsar fuera cierran «⋯»; con el teclado, las
  flechas recorren sus filas.

## Revisión, tanda 3: las plantillas como páginas (en local)

- [ ] **Tus plantillas de antes** (PNJ, Lugar…) siguen ahí como tuyas, con los mismos campos; tus páginas no cambian y
  las tablas que se llenan solas («Miembros»…) siguen igual. Al abrir una por primera vez pasa a ser una página.
- [ ] **«Plantillas», como Archivos**: carpetas con color e icono, arrastrar para meter o recolocar, Alt + flechas, la
  vista previa a la izquierda (portada, campos, pestañas y en cuántas páginas se usa), buscar; «Nueva carpeta»;
  «Carpeta» en la ventana de una plantilla; borrar una carpeta se lleva lo suyo y se deshace de una vez.
- [ ] **«Plantilla nueva»** crea «Plantilla sin título» y la abre con el título elegido; escribir «🧙 PNJ» pone el
  emoji como icono. Un nombre que ya tiene otra no se deja.
- [ ] **El editor es la página**: «‹ Plantillas» arriba a la izquierda (vuelve con la transición al revés), la marca
  «Plantilla», portada, pestañas (mapa, tabla, escena, texto), texto con «/», y en el panel sus campos y bloques; las
  demás a la izquierda, por carpetas. «⋯» → «Ajustes de la plantilla» y «Duplicar» (la copia, con los mismos campos:
  sus páginas salen en las mismas tablas). Una imagen subida al editarla sale en Archivos comunes.
- [ ] **Crear desde una plantilla** («Página nueva» → «Desde plantilla», tras la raya con «o»): la página nace con su
  portada, icono, campos, panel, texto y pestañas (los pines del mapa, sin enlazar).
- [ ] **«Pestaña nueva» → «Desde plantilla»**: elegir una y dejar marcadas las pestañas que se quieran; se añaden
  detrás de las de la página y se deshacen de una vez. Ya no hay «Aplicar plantilla» en «⋯».
- [ ] **«Duplicar»** una página (botón derecho en el árbol): copia portada, hoja, panel y pestañas, y se deshace de
  una vez.

## Revisión, tanda 2: Archivos, Etiquetas y el selector de archivos (en local)

- [ ] **Archivos sin árbol**: pulsar una carpeta la despliega; arrastrar con raya o resalte; recolocar dentro de una
  carpeta; mantener sobre una cerrada la abre sola; «Subir aquí» y «Carpeta dentro» en cada carpeta; buscar por nombre
  o #etiqueta enseña el árbol hasta lo encontrado; todo se ve movido al momento.
- [ ] **«Carpeta» en la ventana** de un archivo y de una carpeta: llevarlo a una carpeta dentro de otra cerrada (se abre
  el camino y sale iluminado); una carpeta no ofrece ni a sí misma ni a las suyas.
- [ ] **Color e icono de una carpeta**: ponerlos, verlos en la lista, la vista previa y el selector; quitarlos;
  deshacer desde el historial. Un emoji escrito en «Otro».
- [ ] **Etiquetas**: arrastrar y Alt+flechas; la vista previa a la izquierda; «Dentro de: Ninguna».
- [ ] **La portada** de un mundo (también al crearlo), de una campaña y de una página: «Subir imagen» y «Elegir de tus
  archivos» (el selector: buscar, desplegar, la elegida marcada), encuadrar arrastrando o con las flechas, acercar y
  quitar.
- [ ] **Las ventanas de ajustes**, más compactas: caben sin desplazarse en el portátil.
- [ ] **Archivos con el teclado**: Tab llega a la lista (una sola fila), flechas para recorrer y abrir carpetas, Intro
  abre, Espacio elige, Alt + flechas recolocan; la vista previa sale con el foco.
- [ ] **Lo elegido**: Mayús+clic elige un tramo; «Mover a…» y «Etiquetar» de una vez (y se deshacen de una vez desde el
  historial); la lista no se mueve al empezar a elegir; borrar dice qué se borra.
- [ ] **Etiquetas**: plegar con su flecha o con izquierda y derecha; pulsar una (o Intro) abre su ventana.
- [ ] **Portada vacía**: pulsar el hueco sube una imagen; soltar una del escritorio encima, también.

## Los sonidos del mapa (en local; módulo 7, docs/specs/sonido-mapa.md)

- [ ] **Poner**: en la Mesa, herramienta «Sonidos del mapa» (O, junto a las luces): un clic pone uno y sale su
  círculo; elegir qué suena (un audio del mundo o una pista de las listas), el radio, el volumen, «Se apaga hacia el
  borde», «Lo frenan / Lo amortiguan», «Solo a oscuras»; arrastrarlo; Supr lo quita.
- [ ] **Oírlo**: en la Mesa del máster, al mover la vista hacia él sube y al alejarla baja; «Oírlos desde el centro
  de la vista» apagado, calla. Con la vista de jugadores: acercar una ficha del grupo sube el volumen; tras un muro que
  lo frena, se corta; con «Lo amortiguan», se oye bajito. Abrir la puerta lo deja pasar.
- [ ] **La jugadora**: en su Mesa lo oye desde su ficha (no desde las de los demás).
- [ ] **Por campaña**: «Suena en esta campaña» apagado en una, sigue en otra del mismo mundo.
- [ ] **Coste**: con unos diez sonidos y muchos muros, la Mesa va igual de suelta.

## El sonido de un zip de Foundry (en local; módulo 7, docs/specs/sonido-foundry.md)

- [ ] **Traer**: en «Sistema nuevo», un módulo de aventura con música: salen sus listas junto a escenas y aventuras;
  al traer, «Subiendo sus audios…» y luego el resultado con las listas y los sonidos que no se pudieron traer (los de
  serie del programa, los que no vienen en el zip). Las listas, en la pestaña Sonido, listas para lanzar; los sonidos
  de sus escenas, en la herramienta del mapa.
- [ ] **Reimportar**: el mismo zip otra vez no duplica listas ni sonidos ni vuelve a subir los audios.
- [ ] **Duración**: las pistas del zip duran lo que dicen; las de YouTube o de una dirección, 5 min hasta cambiarlas.

## El sonido (en local; módulo 7, docs/specs/sonido.md)

- [ ] **Listas**: en la Mesa, pestaña Sonido → «Lista nueva» con un audio del mundo, otro subido y un enlace de YouTube
  (sale su reproductor mientras mide; uno que no deja insertarse se avisa y no se añade). Editar y borrar desde «…».
- [ ] **Lanzar**: una lista de ambiente, un efecto de la botonera por encima, pausa, siguiente, «Fundir y parar» y el
  volumen; las barras junto a la pausa abren la pestaña.
- [ ] **A la vez**: con la vista de jugadores y la Mesa de la jugadora abiertas (en otro aparato si puede ser), suenan
  en el mismo punto; quien entra tarde entra por donde va. Cerrar la Mesa del máster: la lista sigue pasando de pista.
- [ ] **Activar sonido**: en la vista de jugadores recién abierta sale grande en el centro; en las Mesas, en la barra.
- [ ] **YouTube**: el recuadro sale abajo a la derecha, se pliega a 200×200 y no se esconde.
- [ ] **Este aparato**: bajar ambiente y efectos y silenciar; al recargar, sigue igual.

## Libros y el espacio de la campaña (en local; ADR-0021)

- [ ] **Entrar**: desde Mis mundos, la campaña se abre en la misma pestaña, en su Inicio (ir a la Mesa, jugadores,
  libros, aventura en curso) con su barra; Ajustes se abre encima.
- [ ] **Mesa**: la sección enseña los personajes, quién está en la Mesa (activo o en otra pestaña) y cómo va la
  partida; «Abrir la Mesa» la abre en otra pestaña, a pantalla completa. Abre la Mesa desde otra cuenta (o la tele) y
  mira que salga al momento.
- [ ] **Libros**: apagar y encender libros; «Elegir contenido» quita entradas sueltas y desaparecen del compendio; la
  ficha de un libro al pulsar su portada.

## La campaña alrededor de la Mesa (en local; ADR-0019)

- [ ] **Dados fluidos**: al pulsar «Tirar», los dados empiezan a caer al momento (no tras una pausa), van suaves y
  paran en menos de 2 s con el número del registro; la primera tirada al entrar en la campaña tampoco espera.

- [ ] **Entrar**: desde Mis mundos, una campaña se abre en otra pestaña, ya en la Mesa, con la barra a la derecha.
- [ ] **La barra**: flota de cristal, plegada y desplegada; cada pestaña; al volver, la última; plegarla; un combate
  nuevo abre la suya. La campaña va sola, sin la barra de la izquierda.
- [ ] **Escenas**: las tarjetas, «Escena nueva» y «En esta escena» (ocultar al grupo, meter en el combate).
- [ ] **Compendio**: buscar por apartados, poner criaturas en el mapa, el ojo de lo que está en juego, «Libros» y
  «Abrir el compendio» (en su ventana).
- [ ] **Ventanas**: abrir dos páginas desde Páginas, moverlas, estirarlas, minimizarlas y volver a abrirlas; un enlace
  dentro abre otra; la hoja de un personaje (desde Personajes o una ficha del mapa).
- [ ] **Enseñar**: «Enseñar a los jugadores» en una página; con alguno que no la conoce, «revelar y enseñar»; a la
  jugadora se le abre (en su Mesa) o le sale «Te enseñan».
- [ ] **Revelar desde la Mesa**: un secreto de una página abierta en ventana se revela a esa campaña sin preguntar.
- [ ] **Campaña** (la pestaña del escudo): el nombre con su mundo y su sistema, los jugadores con sus personajes, quién
  aún no tiene, los miembros, el enlace de invitación y borrar la campaña.
- [ ] **La jugadora**: entra en su ficha con «Ir a la Mesa»; su Mesa ve lo que el grupo (como la tele) y su barra
  (Combate, Personajes, Compendio, Páginas); en el móvil, su ficha.
- [ ] **Del grupo**: en el inventario de la ficha, debajo de lo suyo; pasar algo arrastrando (PC) o con «Mover»
  (móvil); «Lo puso».
- [ ] **Escenas sueltas** (ADR-0020): «Escena nueva» crea la escena sin página; sin mapa, se elige o se sube allí
  mismo; botón derecho o «⋯» en una tarjeta: abrir, rejilla y ajustes (en una ventana), cambiar el nombre y borrar
  (y deshacerlo desde el historial). Las que ya están en páginas siguen igual.
- [ ] **Los dados nuevos** (lienzo «Tirar dados»): el d20 abre la columna de dados; pulsar suma, el botón derecho (o
  mantener el dedo) quita; la bandeja con el modificador, Ventaja/Desventaja (pone un d20 si no lo hay) y quién la ve
  (se recuerda); «Tirar» la vacía y la cierra; el resultado sale sobre el d20 al pararse los dados (crítico con brillo,
  pifia en rojo), con «Otra vez» y, al pulsarlo, el historial. El teclado: escribir la tirada, y la próxima vez se abre
  así. El historial, en una ventana de la Mesa (con «Aplicar»), y fuera de ella, en una ficha junto al d20; Todas/Mías.
  El «?» se aparta mientras los dados están abiertos. En el móvil, una hoja desde abajo.

## Módulo 6: escenas, fichas, combate y escenas de Foundry (en staging, PR #114)

- [ ] **Una escena**: en la página de un lugar, «Añadir pestaña» → «Escena»; subir un mapa (imagen o UVTT) o pedírselo
  a la IA («dibújame una cripta…», con `dibujar_escena`); su rejilla (cuadrada, hexagonal o sin rejilla) y alinearla
  con el mapa («Alinear con el mapa»).
- [ ] **La mesa**: «Abrir en la mesa» desde la escena, en una campaña; moverse y acercar; cambiar de escena.
- [ ] **La tele**: «Pantalla» abre la segunda ventana; «Presentar» y «Ocultar» (con fundido); las cámaras
  (seguir tu vista, fija, encuadrar al grupo); si la tele enseña otra escena, la mesa lo avisa.
- [ ] **Fichas**: ponerlas desde el panel (personajes de la campaña, el compendio, un encuentro con su formación);
  moverlas (Mayús pega a la rejilla); su tamaño, rótulo y color de bando; ocultas (la tele no las ve).
- [ ] **Al pulsar una ficha**: su hoja, sus tiradas, sus PG y sus estados (con caducidad). En la tele, su estado en
  palabras, sin PG.
- [ ] **Combate**: empezar con las fichas elegidas, tirar iniciativa (las criaturas de un grupo, juntas), pasar turnos
  y rondas, daño a varias a la vez; la tele enseña el orden sin la iniciativa de las criaturas.
- [ ] **La IA en la mesa**: abrir y presentar escenas, poner y mover fichas, combate, muros y luces, desde claude.ai.
- [ ] **Escenas de Foundry**: «Traer de Foundry» con un zip de un módulo o una aventura con escenas: elegirlas, bajo
  qué página; cada una llega con su mapa, rejilla, muros, puertas, luces y sus criaturas preparadas (salen solas la
  primera vez que la campaña la abre). Traerlo otra vez no duplica.

## Módulo 6: las herramientas de la mesa (en staging, PR #114)

- [ ] **Medir** (R): arrastrar mide de un punto a otro; un clic sin arrastrar sigue a clics, con un punto de paso por
  clic (doble clic o Escape acaba); círculo, cono y cuadrado; la distancia en pies con la regla de diagonales (panel
  «Plantillas»); arrastrar una ficha enseña lo que recorre.
- [ ] **«La tele ve lo que mides»**: con él puesto, la tele ve la medida en vivo; sin él, no.
- [ ] **Plantillas**: «Dejar como plantilla» (o Intro) o la herramienta de plantillas (A), que la deja al soltar; su
  color o la trama de su tipo de daño; moverla arrastrándola, girarla por el asa de su punta, ocultarla de la tele y
  quitarla (Supr). Las fichas de dentro llevan su aro naranja; «Elegirlas» saca el daño a varias con ellas.
- [ ] **Dibujar** (D): a mano, línea, rectángulo y círculo, con su color y su grosor; la goma borra un trozo de un
  trazo (y se deshace de una vez desde el historial); «Borrar los dibujos».
- [ ] **Texto** (T), **sellos** (S) y **pines** (P): un clic pone uno (el texto, con su campo); arrastrarlos los mueve;
  un pin lleva a una página (su panel); «Solo para mí» deja lo nuevo fuera de la tele.
- [ ] **Imágenes** (I): elegir una del mundo y pulsar en el mapa; su tamaño por las esquinas y su giro por el asa de
  arriba; encima o debajo de las fichas.
- [ ] **Láser** (X): la estela se ve en la tele un momento.
- [ ] **Widgets** (W): un contador, un reloj de progreso (pulsar sus segmentos; el botón derecho vacía uno) y un
  temporizador (en marcha, parado y reiniciado), cada uno con su ojo para la tele.
- [ ] **Instantáneas** (F): guardar una con su miniatura, mover fichas y «Volver a ella» (con aviso); se deshace desde
  el historial.
- [ ] **Pantalla del máster** (G): sube desde abajo con la hoja de cada criatura de la escena (sus ataques se tiran con
  un clic) y la nota de la página de la escena (otra, desde su panel).
- [ ] **El tutorial guiado de la mesa** tiene un paso nuevo para los paneles de abajo de la columna.

## Módulo 6: la visión en la mesa (en staging, PR #114)

- [ ] **Muros**: en la mesa, la herramienta de muros (M) dibuja muros seguidos clic a clic (Mayús, a las esquinas de
  la rejilla; Escape o doble clic acaba); un clic en un muro lo elige y lo cambia; arrastrar un extremo lo mueve.
- [ ] **Puertas**: un clic en su icono las abre y las cierra; la tele ve lo de detrás al momento (la secreta, como un
  hueco).
- [ ] **Luces**: la herramienta de luces (L) pone una con un clic; su radio, color y ángulo; la oscuridad de la escena.
- [ ] **Niebla a mano** (N): destapar y tapar con pincel, rectángulo y lazo; «Reiniciar la niebla»; la tele, con los
  bordes blandos y la luz cálida de las antorchas.
- [ ] **Ver como el grupo**: lo que ve la tele y la lista de lo que no ve.
- [ ] **Bordes en la tele**: enteros o recortados (al final del panel de la niebla).

## Módulo 5: la página que escriben los jugadores (en staging, PR #112)

- [ ] **Dejar editar**: en «Quién la conoce» de una página sin secretos, «La edita toda la campaña» (o unos
  personajes). En una con secretos, no deja y lo dice.
- [ ] **La jugadora escribe** en esa página desde su campaña, en vivo: lo ves al momento; el título, el panel y las
  pestañas siguen siendo tuyos. En el historial sale a su nombre y se deshace.
- [ ] **Sin secretos**: en una página de jugadores no te ofrece «Secreto» ni notas ocultas.
- [ ] **Su IA** escribe en ella con `editar_pagina` (y en otra página, no).

## Módulo 5: el compendio y la partida para los jugadores (en staging, PR #112)

- [ ] **En juego, la jugadora**: ve las criaturas a la vista, juntas, con su imagen y cómo están en palabras («Ilesa»,
  «Herida», «Malherida», «A punto de caer», «Fuera de combate»); ni sus PG ni su hoja.
- [ ] **En juego, el máster**: al poner en juego, «A la vista» u «Oculta»; luego, el ojo de cada una en la lista o
  «A la vista / Oculta» en su hoja. A ella le aparece o se le va al momento.
- [ ] **Ajustes del compendio** (la ruedecita junto al sistema): oculta un tipo o una sección entera; a ella no le sale
  ni al buscar ni en los estantes.
- [ ] **Una entrada del mundo**: revelada (por la IA con `revelar`, o desde «Lo que sabe el grupo» para ocultarla), le
  llega el aviso, «Leerlo» la abre en su compendio marcada «Del mundo» y la puede llevar su personaje.
- [ ] **La IA de un jugador**: `ver_a_la_vista` le da las criaturas con su estado; `buscar_contenido` no da lo oculto.

## Módulo 5: los mapas para los jugadores (en staging, PR #112)

- [ ] **Un pin oculto**: en el panel de un pin, «Oculto a los jugadores»: lo ves atenuado. En el menú (▾) de una
  pestaña, «Oculta a los jugadores».
- [ ] **La jugadora** ve el mapa de una página que conoce, sin lo oculto; un pin a una página que no conoce, con su
  nombre y sin «Abrir».
- [ ] **Revelar…** un pin o una pestaña desde su panel o su menú: le aparece y le llega el aviso.

## Módulo 5: revelar en partida (en staging, PR #112)

- [ ] **Revelar un secreto**: en el secreto, «Revelar» → elige a quién (toda la campaña o unos personajes) → «Revelar».
  Si la campaña no conoce la página, marca «Revelar también la página». La cabecera dice «Lo saben: …».
- [ ] **A la jugadora le llega**: abajo a la derecha, «Nuevo: …» con «Leerlo»; el secreto sale con «Nuevo» y en su
  barra, el número de novedades. Al abrirla deja de ser nuevo.
- [ ] **Revelar una página**: el ojo de la cabecera de la página.
- [ ] **Lo que sabe el grupo**: en la barra de la campaña, «Revelado»: lo revelado por días, con filtros; «Ocultar otra
  vez» se lo quita al momento.
- [ ] **Deshacer** una revelación desde el historial.
- [ ] **La IA**: pídele que revele algo en partida (espera tu aprobación) y que te diga lo que sabe el grupo.

## Módulo 5: lo que sabe cada campaña (en staging, PR #112)

- [ ] **Quién la conoce**: en una página, el icono de dos personas, junto a «Marcar». Sale lo que sabe el mundo y cada
  campaña, y por qué. Da a conocer una página a una campaña: sus subpáginas lo heredan (míralo en una de ellas: «Por
  «…»»). En el árbol sale un ojo gris en lo que conoce alguna campaña.
- [ ] **Por personajes**: «Lo saben…» y elige un personaje; solo su dueño la ve.
- [ ] **Lo que sabe todo el mundo**: marca una página en «El mundo»; la ven las campañas que parten del mundo y no
  una creada con «Nada».
- [ ] **Oculto**: en un campo del panel (el ojo tachado, al acercarte) y en el menú de un bloque. La jugadora no lo ve.
- [ ] **Una subpágina nueva** bajo una página que conoce una campaña nace oculta («No lo sabe nadie»).
- [ ] **Con una jugadora**: en la barra de su campaña, el nombre del mundo: las páginas que conoce, en lectura. Ni los
  secretos, ni las notas ocultas, ni lo oculto; un enlace a una página que no conoce sale como texto. Búscalo también
  con su buscador de páginas.
- [ ] **Quitársela**: con ella mirando la página, quítasela: le sale «Esta página ya no está a tu alcance».
- [ ] **Ver como**: al pie de «Quién la conoce», «Ver como» un personaje: la franja «Viendo como …» y su vista.
- [ ] **Nueva campaña**: «Al empezar, los jugadores saben…» (lo del mundo, nada o lo mismo que otra); en sus ajustes,
  «Parte de lo que sabe el mundo».
- [ ] **La IA**: pídele que dé a conocer una página a una campaña (espera tu aprobación) y que te diga quién la conoce
  y qué ve un personaje. **La IA de una jugadora**: con su cuenta, en Ajustes sale el conector; conéctala en claude.ai
  y comprueba que solo ve lo suyo y no puede escribir.

## Módulo 4: la biblioteca (en staging, PR #111)

- [ ] **Un libro de verdad**: sube a los archivos del mundo (o a los comunes) un PDF con texto, como un manual. En una
  campaña, «Biblioteca»: sale el libro «Leyendo…» y, al poco, «Se puede buscar» con sus páginas.
- [ ] **Buscar dentro**: busca una palabra que sepas que está (con o sin tildes): sale el libro con sus páginas y el
  fragmento; al pulsar una, el visor abre en esa página con la línea marcada.
- [ ] **Por significado**: busca una idea con otras palabras («cómo se recupera la vida», «qué pasa al caer a 0»): lo
  que sale solo por significado lleva «Por significado». Dime si lo que encuentra tiene sentido.
- [ ] **También en las páginas**: si la wiki habla de lo mismo, sale debajo con su enlace.
- [ ] **La IA**: pídele que busque algo en tus libros y te diga en qué página está.
- [ ] **El PDF de una hoja**, tras subir esto a staging: la imagen de la app pasa a Debian (con otro Chromium). En una
  página con hoja, «Descargar PDF» tiene que seguir funcionando.

## Módulo 4: el inventario del grupo (en staging, PR #111)

- [ ] **«Grupo» en la campaña**: en la barra de una campaña, «Grupo». Añade algo del compendio y algo escrito a mano,
  crea un contenedor («El carro») y mueve cosas entre ellos.
- [ ] **Mover a un personaje y de vuelta**: «Mover» → «A Thora» (con cuántas); en la hoja de Thora, Inventario, sale
  en «Mío»; «Mover» → «Al grupo» lo devuelve. Nada se duplica, y deshacer en el historial lo deja como estaba.
- [ ] **Las monedas**: pon monedas al grupo y, en «Gestionar», dáselas a un personaje o repártelas entre varios (lo
  que sobra se queda en el grupo).
- [ ] **Con una jugadora**: ve el grupo y lo cambia, mueve con su personaje pero no con los de otros, y no reparte.
- [ ] **La IA**: pídele que reparta el botín de la última sesión entre los personajes (espera tu aprobación).

## Módulo 4: las tablas aleatorias del compendio (en staging, PR #111)

- [ ] **Una tabla del mundo**: en el compendio de una campaña, «Nueva entrada» → En el mundo, tipo «Tabla»; escribe la
  fórmula, marca «Sin reemplazo» y unas filas. Al abrirla, pulsa el dado: sale una fila marcada, va al registro y no se
  repite hasta «Reiniciar».
- [ ] **Las tablas del dnd5e**: vuelve a traer el dnd5e con sus tablas (`tables24`); en el compendio, abre «Mysterious
  Deck» o «Standard Languages» y tira: las filas que llevan a otra entrada se abren al pulsarlas, y las que llevan a
  otra tabla la tiran también.
- [ ] **La IA**: pídele que cree una tabla de encuentros para tu mundo y que tire en ella.

## Módulo 4: las imágenes de lo traído de Foundry (en staging, PR #111)

- [ ] **Traer el dnd5e con sus imágenes**: en Sistemas → «Sistema nuevo», suelta el .zip del dnd5e; tras «Traer de
  Foundry», dice cuántas imágenes trae con cada licencia (las de uso restringido, marcadas) y «Subir N imágenes».
- [ ] **Verlas**: en el compendio de una campaña con ese sistema, la miniatura en la lista y el retrato en la entrada,
  con su crédito; en «En juego», la miniatura de cada criatura y su retrato en la hoja.
- [ ] Sin imagen (los objetos y conjuros con iconos de serie de Foundry), nada.

## Módulo 4: las criaturas en juego (en staging: PR #110)

Una criatura del compendio se pone en juego en la campaña: copias numeradas o una única (un PNJ que guarda sus PG). Hasta
el módulo 5, solo tú (el máster).
- [ ] **Poner en juego**: en el compendio de una campaña, abre una criatura (el Goblin); a la derecha, «Poner en
  juego»: 3 copias (o una tirada, `1d4+1`), o la única; PG medios o tirados.
- [ ] **«En juego»** (en la barra de la campaña): las copias juntas con su vida en barra, la única aparte con su
  estrella; malherida y fuera de combate marcadas.
- [ ] **Su hoja**: tirar un ataque y su daño (a su nombre, ocultos), bajarle los PG, «Tirar PG», «Otro máximo» y
  «Quitar de juego». Una única conserva sus PG al salir y volver a entrar.
- [ ] **Aplicar el daño** desde el registro de tiradas («Aplicar» en una tirada de daño): a varias criaturas o
  personajes, con nada, mitad, entero o doble (sus resistencias cuentan).
- [ ] **Quitar las copias** de una vez (la única se queda) y deshacerlo desde el historial.
- [ ] **Enlazar desde una página**: en la página de un PNJ, escribe `[[@gob` y elige el Goblin; al pasar el ratón
  (o al tocarlo en el móvil) sale su tarjeta, y «Abrir en el compendio» lo abre en una campaña con su sistema.
- [ ] **La IA, desde claude.ai**: «pon en juego tres goblins y un jefe único», «tira la cimitarra del Goblin 2»,
  «aplica ese daño a los otros dos, mitad al jefe».

## Módulo 4: el compendio del mundo (en staging: PR #110)

Cada mundo tiene su propio compendio, hecho para un sistema: lo ven sus campañas con ese sistema. Hasta el módulo 5,
solo tú (quien lleva el mundo).
- [ ] **Copiar al mundo**: en el compendio de una campaña, abre algo del sistema (el Goblin) y «Copiar al mundo». Se
  abre para cambiarlo, con «(copia)» en el nombre; cámbialo y guarda. Sale con «Del mundo» y, a la derecha, «Copia de
  Goblin».
- [ ] **Todo · Del sistema · Del mundo**: el selector bajo el buscador; en «Todo», lo del mundo va en su estante
  arriba.
- [ ] **Nueva entrada**: crea en el mundo (y en el sistema si lo eliges en «Dónde»).
- [ ] **El original cambia**: cambia el Goblin del sistema (por ejemplo, con la IA); la copia dice «El original ha
  cambiado». «Ver cambios» enseña cada campo (en tu copia y en el original); marca los que quieras y «Traer».
- [ ] **Llevar al sistema**: en una entrada del mundo, para usarla en otros mundos (con «Quitarla del mundo» o no).
- [ ] **Deshacer**: borrar una entrada del mundo y deshacerlo desde el historial.
- [ ] **La jugadora** no ve nada del mundo en el compendio, pero un objeto del mundo que lleve su personaje sí sale en
  su hoja.
- [ ] **La IA, desde claude.ai**: «guarda en el compendio de mi mundo una criatura…» (guardar_contenido con worldId),
  «copia el ogro al mundo y súbele los PG» (copiar_contenido), «¿qué cambió en el original?» (origen_contenido).

## Módulo 3 limpio: Crisol vacío, importar y cambiar (ADR-0015, PR #108)

Crisol ya no trae el 5e: de serie solo «En blanco». Las campañas de staging que lo usaban siguen igual, con una copia
en tu cuenta.
- [ ] **El 5e, desde su archivo**: en Sistemas → «Sistema nuevo», sube `5e.crisol-system.json` (te lo paso; también
  sale con `pnpm sistema-5e`). Sale en «Tuyos», con sus 3.170 documentos.
- [ ] **Traer de Foundry**: en «Sistema nuevo», suelta el .zip de un sistema o de un módulo de Foundry (la carpeta de
  `Data/systems/<id>`, comprimida); marca los compendios que quieras y el idioma de sus textos, y «Traer de Foundry».
  Elígelo en una campaña y mira su compendio.
- [ ] **Cambiar el compendio en la app**: en una campaña con un sistema tuyo, en Compendio, «Nueva entrada» (tipo,
  nombre, sus campos y su texto); en una entrada, «Editar» y «Borrar» (pregunta antes). Una jugadora no ve esos botones.
- [ ] **La IA, desde cero**: pídele a la IA un sistema nuevo para un juego que no esté (con su hoja, su creador de
  personajes y algo de compendio) y haz un personaje con su creador.
- [ ] **El creador pregunta antes de quitar una clase**: «¿Quitar «Bárbaro»?».

## Módulo 3: personajes (en staging: PR #100)

En una campaña con el 5e (en sus ajustes, «5e» y sus ediciones):
- [ ] **La campaña en su vista**: al entrar en ella, la barra cambia (su nombre, Personajes, Compendio, Dados); la
  llama vuelve a Mis mundos.
- [ ] **El compendio**: buscar en español o en inglés («fireball»), filtrar por tipo, leer un conjuro, una criatura y
  una clase (con lo que concede por nivel); «2014 · Legado» lleva a la otra versión. Una jugadora también lo ve.
- [ ] **Personajes**: «Personaje nuevo» (el máster elige quién lo juega); su tarjeta y su vista previa; su ventana
  (nombre, quién lo juega, borrar).
- [ ] **El creador**: elegir clase, especie y trasfondo; lo que falta sale con (!) en los pasos y a la derecha; elegir
  en el panel (las habilidades, el estilo de combate; la mejora de característica a nivel 4 y los aumentos de un
  trasfondo de 2024, con «−» y «+»); las características con sus cuatro métodos (los 4d6, en el registro de dados);
  «Terminar».
- [ ] **Subir de nivel y multiclase**: cambiar el nivel de la clase, «Añadir otra» (la que no se puede, con su
  motivo: «Necesitas Inteligencia 13»), «Confirmar el nivel N».
- [ ] **La ficha y sus versiones**: «Creado · Nivel 1» y cada nivel confirmado; «Restaurar» (se deshace desde el
  historial).
- [ ] **Lo que ve cada uno**: una jugadora ve solo los suyos; el máster, todos.
- [ ] **Las tablas aleatorias**: en una página, «+» → «Tabla»; sus filas (lo que se pisa o deja huecos, avisado), «Sin
  reemplazo», tirar en una campaña (la fila sale marcada «Ahora» y la tirada, en el registro de dados), «Reiniciar».
- [ ] **Desde claude.ai**: que la IA haga un personaje con `crear_personaje` y `elegir_personaje`, y lo suba de nivel;
  que haga una tabla y tire en ella (`tirar_en_tabla`).

## Módulo 3: la hoja en partida

En un personaje terminado, su «Ficha»:
- [ ] **Tirar a un clic**: una característica, una habilidad, la iniciativa y el ataque de un arma; arriba, «Con
  ventaja» o «Con desventaja» y quién la ve (la tirada sale en el registro de dados con su nombre: «Thora · Atletismo»).
- [ ] **Los PG**: «Cuánto» y «Daño» (primero se van los temporales), «Curar», «Temporales»; varios clics seguidos se
  suman.
- [ ] **Lo que se cambia jugando**: la inspiración, el cansancio, las salvaciones contra muerte, las monedas y las
  notas; tras recargar, sigue ahí.
- [ ] **Lo que lleva**: en «Inventario», «Añadir» del compendio, «Equipado» (un escudo sube la CA), cantidad y
  quitar; los estados (Envenenado…) arriba, con su «Añadir».
- [ ] **Usos y descansos**: gastar una Furia; «Descanso corto» (un brujo recupera la magia de pacto; los PG no) y
  «Descanso largo» (todo lleno).
- [ ] **Con el teclado**: las pestañas con las flechas, Inicio y Fin.
- [ ] **Desde claude.ai**: `partida_personaje` (daño, curación, gastar un uso, descansar) y `tirar_por_personaje`.

## Módulo 3: filtros y tablas que se tiran (PR #107)

- [ ] **Filtrar**: en el compendio, en Conjuros, «Filtrar» (escuela, clases, concentración, ritual); en Criaturas (VD,
  tamaño); en Objetos mágicos (rareza, sintonía). Las carpetas cuentan lo filtrado; «Quitar los filtros».
- [ ] **Tablas que se tiran**: en la Bolsa de trucos, Confusión o las Fichas de pluma, el dado de su tabla tira en la
  campaña (sale en el registro de dados) y marca lo que salió. Desde claude.ai, `tirar_tabla_compendio`.

## Módulo 3: el contenido, cruzado con dnd5e (PR #106)

- [ ] **Criaturas**: el Dragón rojo adulto (2024) con «Desgarro» y su «Aliento de fuego (recarga 5–6)»; el Guerrero
  goblin sin el 1d4 de más; el Asesino, «Humanoide». En el compendio, su «En juego».
- [ ] **Objetos mágicos**: la Varita de bolas de fuego lanza «Bola de fuego» (CD 15, 8d6, gasta una carga); el Bastón
  de fuego, sus tres conjuros con tu CD de conjuros. Llevarlos en la hoja de un personaje y tirarlos.

## Módulo 3: el compendio como el de Foundry (PR #105)

- [ ] **La biblioteca**: en el Compendio, sin buscar, por edición (2024 y 2014 · Legado) y, dentro, sus secciones
  (Reglas, Clases, Orígenes, Rasgos, Dotes, Conjuros, Equipo, Objetos mágicos, Criaturas) y sus carpetas (los conjuros
  por nivel, las criaturas por tipo, el equipo por categoría). Se abre y se cierra.
- [ ] **En juego**: cada entrada con mecánica dice sus acciones, sus usos, lo que cambia y cómo escala, y cuánto lo
  calcula Crisol (Bola de fuego, la Furia, la Varita de bolas de fuego).
- [ ] **La dirección**: lo abierto del compendio y «Ficha | Creador» de un personaje se pueden enlazar y recargar.
- [ ] **El creador**: al elegir, quitar o cambiar, el foco no se pierde; abrir una decisión lleva el foco a ella.

## Módulo 3: el pulido (PR #104)

- [ ] **Los tutoriales guiados** de la campaña, Personajes, un personaje, el Compendio y la pestaña Tabla: salen la
  primera vez y, para verlos otra vez, su botón de ayuda («Tutorial guiado de esta vista»).
- [ ] **Sin personajes**, la pantalla vacía con su botón grande.
- [ ] **«Reiniciar» una tabla** pregunta antes; lo que sale al tirar se anuncia.

## Módulo 3: los dados para otros juegos

- [ ] **Un Daggerheart hecho por la IA**: pídele en claude.ai que te haga un sistema de Daggerheart para una campaña
  (sus dos d12 de Esperanza y Miedo, la ventaja de +1d6, el daño con tantos dados como su competencia). Después,
  un personaje en esa campaña y tirar desde su hoja: el resultado dice «con Esperanza» o «con Miedo», los dobles son
  crítico, y «Con ventaja» suma 1d6.

## Módulo 3: srd-5e, punto de control 4 y final (todo el contenido, en staging: PR #98)

Todo el contenido de los dos SRD ya está sacado: 3170 documentos (estados, texto de las reglas, conjuros, objetos
mágicos, criaturas, especies, trasfondos, dotes y las 12 clases con su subclase), en los dos idiomas y con su página.

- [ ] **Una muestra al azar contra el PDF**: `tasks/muestra-srd-5e.md` lleva unos 20 de cada tipo (263), con su
  página en cada PDF y lo primero de su texto. Abrir el PDF en esa página y mirar que el nombre, los números y el texto
  cuadran en los dos idiomas; lo que esté mal, apuntarlo al lado. Los PDF, en `datos-locales/srd/`.
- Lo sabido, para no buscarlo: en el texto de las reglas, algún recuadro cae en la sección de al lado en un idioma (el
  PDF los coloca en otra página); las tablas grandes de armas y armaduras no van en el texto (ya son contenido).
- [ ] **Desde claude.ai, en un chat nuevo** (ya en staging): «búscame la bola de fuego del 5e y léemela», «¿qué hace el
  estado de apresado?», «hazme un bárbaro de nivel 5 y dime su CA en furia», «léeme el perfil del aboleth». Y los
  criterios de éxito de `docs/specs/srd-5e.md`.

## Módulo 3: srd-5e (fases 1 y 2, en staging: PR #97)

El 5e de serie con su contenido de las dos ediciones (de momento, todo el equipo y el guerrero con el campeón: 474
documentos). Spec: `docs/specs/srd-5e.md`.

- [ ] **Punto de control 2, en staging o en local**:
  - en «Sistemas», «De serie»: el **5e** el primero, con sus tipos, sus campos en los dos idiomas, sus tiradas, sus dos
    fuentes con su atribución y sus ajustes (reglas generales, multiclase mixta);
  - en la ventana de una campaña, elegir el **5e**: sus dos ediciones, «Lo que está en las dos» (solo con las dos
    activas), las reglas generales 2024/2014, «Así se ve al elegir» con cosas de verdad (lo de 2014, «Legado», si se
    ven las dos versiones), la atribución; sin ninguna edición avisa y no guarda.
- [ ] **Punto de control 2, desde claude.ai** (en un chat nuevo, para que salgan las herramientas nuevas): pedirle a la IA que busque en el contenido del
  5e (`buscar_contenido`, también con la campaña), que lea la cota de malla y la espada larga (`leer_contenido`) y que
  pruebe un guerrero de nivel 5 con ellas (`probar_formula`, `probar_tirada`, `probar_accion`): CA 16, PG 44, un ataque
  de +6 y Tomar aliento de 1d10 + 5. Después, que haga un sistema propio con contenido con su mecánica
  (`guardar_contenido`) y que lo pruebe.

## Módulo 3: sistemas (en staging)

Ya en staging (PR #96): todo se puede probar allí. Spec: `docs/specs/sistemas.md`.

- [ ] **Punto de control 3** (sin editor desde el 2026-11-05: los sistemas se hacen con la IA):
  - «Sistemas» en la barra de Mis mundos (y en el menú de la llama del móvil), con «5e» y «En blanco» de serie;
  - «Sistema nuevo» dice que se hacen con la IA; sube un archivo (uno roto dice qué falla, por sus nombres y con la
    ruta debajo, y no sube nada; el bueno sale en los tuyos) y baja uno vacío;
  - cada sistema abre su ventana: bajarlo y en qué campañas está; si es tuyo, también cambiarle el nombre y borrarlo
    (solo si ninguna campaña lo usa);
  - en la ventana de una campaña (y al crearla), elegir su sistema; con uno que tenga fuentes, idiomas o ajustes, sus
    opciones; y la ficha de dados de esa campaña empieza por su tirada por defecto.
- [ ] **Final, desde claude.ai** (con el conector «Neo Crisol»): pedirle a la IA un sistema
  de 2d6 + atributo. Debe leer el formato (`formato_sistemas`), crearlo, validarlo y probar una fórmula y una tirada;
  sale en «Sistemas». Después, que le cambie una tirada (por rutas) y que lo elija en una campaña. En modo asistente,
  crear y cambiar esperan tu aprobación, con el nombre del sistema en la cola; borrarlo, también.

## Módulo 3: dados (en staging)

Ya en staging (PR #95): todo se puede probar allí. Spec: `docs/specs/dados.md`.

- [ ] **Punto de control 2**: tú y una jugadora en dos navegadores, con «Dados» en la barra:
  - una tirada tuya «para todos» le llega al momento;
  - una suya «al máster» te llega marcada, y una «para mí» suya te sale como «Para sí»;
  - una «oculta» tuya no le llega;
  - el desglose, «Repetir» y la tirada explicada mientras se escribe;
  - el color de tus dados en el perfil, y la hoja de dados en el móvil (menú de la llama → «Dados»).
- [ ] **Punto de control 3**: los dados 3D: caen con tu color y quedan en lo que dice el registro; los de la jugadora
  caen en tu pantalla con el suyo; en las opciones de la ficha (el engranaje) se apaga «Ver caer los dados de los demás».
- [ ] **Lo de las revisiones** (arreglado; que lo veas tú):
  - «Repetir» en una tirada «al máster» de la jugadora: la tuya sale «oculta», no para todos;
  - `20d6` de golpe: la página no se para mientras caen;
  - pulsar muy seguido una tirada de una página: pasadas 60 en un minuto, dice «Demasiadas tiradas seguidas».
- [ ] **Final**: los criterios de éxito de `docs/specs/dados.md`:
  - tú tiras `1d20+5` y a una jugadora le caen los dados con tu color y le sale en el registro al momento;
  - ella tira «al máster»: tú lo ves marcado; una segunda jugadora no recibe nada; lo tuyo oculto, nadie más;
  - en una página escribes `` `dice: 2d6+3` ``, la pulsas y sale en el registro;
  - desde claude.ai, la IA tira en la campaña (oculta, salvo que le pidas que la vean todos) y lee las últimas;
  - con el teclado: tirar, y el total se anuncia.



Los criterios de éxito de `docs/specs/plantillas.md`, en el orden en que se usan.

### Campos

- [ ] En una página cualquiera, desde el panel: un campo de opciones, un enlace a una sola página y un reloj.
- [ ] Mandar a la papelera una página enlazada desde un campo: el aviso al borrarla cuenta también las páginas que la
  apuntan desde un campo, y el campo la enseña tachada.

### Crear desde plantilla

- [ ] «Página nueva» → «Desde plantilla» → PNJ: sale con sus campos en el panel y sus apartados en el texto. La marca
  junto al título lleva a su plantilla.
- [ ] Desde un enlace `[[…]]` a una página que aún no existe: crearla eligiendo plantilla.
- [ ] **Criterio 1**: ponerle Facción al PNJ, abrir la facción y verlo en «Miembros». Lo mismo con Lugar →
  «Habitantes», y con un Objeto cuyo Portador es el PNJ → «Lleva encima».
- ~~«⋯» → «Aplicar plantilla…» en una página ya hecha~~ (ya no está: tanda 3, ADR-0024; ahora «Pestaña nueva» →
  «Desde plantilla» añade sus pestañas).

### Plantillas propias (Mis mundos → Plantillas)

- [ ] **Criterio 2**, en este orden (Frentes apunta a Frente, así que Frente va primero):
  1. «Frente» desde cero, con Nivel, Estado, un reloj de 8 y Regiones (→ Lugar);
  2. copiar PNJ como «PNJ de Eana» (ahora: abrir PNJ, «⋯» → «Duplicar» y cambiarle el nombre) y añadirle Frentes
     (→ Frente);
  3. en Frente, la tabla «PNJ del frente» (PNJ de Eana · Frentes);
  4. crear un frente y dos PNJ de Eana con él: salen en su tabla.
- [ ] Escribir el texto de una plantilla (sus apartados) y crear una página con ella.
- [ ] **Criterio 3**: quitar un campo de «Frente»; los frentes ya hechos no cambian.
- [ ] Borrar una plantilla propia: sus páginas dicen «(borrada)» junto al título y sus tablas siguen.
- ~~Las de serie no se cambian: candado y «Copiar»~~ (ya no hay de serie: tanda 3, ADR-0024).

### Deshacer

- [ ] **Criterio 5**: desde el historial, deshacer crear una página desde plantilla y crear una plantilla.

### La IA, desde claude.ai

- [ ] **Criterio 4**: que cree en pocas llamadas 20 páginas desde plantilla (lugares, facciones y PNJ) enlazadas entre
  sí; después, que lea una facción con `leer_pagina` y reciba sus miembros.
- [ ] Que busque «PNJ cuyo Lugar es …» y que haga una plantilla propia.

### Teclado y móvil

- [ ] **Criterio 7**: elegir plantilla, rellenar campos y configurar una tabla solo con el teclado.
- [ ] Lo mismo en el móvil.

### Ya comprobado (no hace falta probarlo)

- **Criterio 6**: el 95 % de las tablas, en 43 ms con 5.000 páginas (el límite es 150 ms).
- **Criterio 7**, la parte automática: la CI en verde y sin supresiones nuevas; axe sin fallos críticos ni graves.

## Módulo 1: wiki (pendiente desde el 2026-10-30)

- [ ] **Deshacer con versiones** (punto 7 de sus pruebas). Arreglado el 2026-11-04: era el párrafo vacío que el editor
  añadía al abrir una página (punto 6), que dejaba una versión a tu nombre. Probar: que la IA añada algo al final de
  una página, abrirla y deshacer lo de la IA desde el historial.
- [ ] **Lo demás de tus pruebas, arreglado el 2026-11-04** (con la IA desde claude.ai):
  - cambiar un secreto por bloque sin su `^s-id`: conserva su id (1);
  - la fecha de la página cambia al escribir en el texto (2);
  - buscar algo de un secreto dice en qué sección está (3);
  - una nota oculta de una línea, `%%…%%`, vuelve en una línea (4);
  - abrir una página ya no le añade un párrafo vacío al final (6);
  - «Buscar en la página» (Ctrl+Alt+F) mira también dentro de los secretos y de los enlaces (8).
- [ ] **Punto 6**: el PDF de una hoja de dos columnas con statblock, nota lateral y tabla (ningún bloque partido y nada
  de la interfaz en el papel), e «Imprimir» en Chrome, Firefox y Safari.
- [ ] **Final**: los criterios de éxito de `docs/specs/wiki.md` que aún no ha probado:
  - páginas con subpáginas, todos los bloques, propiedades, etiquetas, enlaces, secretos y archivos (1);
  - la IA crea 20 páginas enlazadas y cambia una sección de una página abierta, que se ve sin recargar (3);
  - restaurar una versión anterior (4);
  - exportar el mundo a .zip (6);
  - buscar «dragon» y «dargón» encuentra «Dragón» (7);
  - el árbol, la vista previa y el editor con el teclado, y una página mediana abierta en menos de 1 s (8).

## Por arreglar antes de probarlo

Nada ahora mismo.

## Lo que dijo

(Aquí, lo que diga al probar, con la fecha.)

## Mejoras del 2026-11-13 (en local, rama `modulo-9/mapas`)

- [ ] **Formas**: en toda la app (Mis mundos, campañas, plantillas, sistemas, libros, Ajustes, zona de peligro,
  botones rojos) ya no hay esquinas cortadas: las redondeadas del cristal de la Mesa.
- [ ] **Mis mundos**: «Ver» la portada de un mundo y cerrarla → la vista previa y el fondo se van hasta que el ratón
  vuelve a la tarjeta (igual con los ajustes); al dejar la tarjeta, el fondo vuelve al de siempre con un fundido.
- [ ] **Campañas en Mis mundos**: al pasar el ratón, su vista previa a la izquierda (sistema, jugadores, tu papel) y su
  portada de fondo.
- [ ] Un mundo o campaña **sin color**: al pasar el ratón, el nombre en blanco (no en rojo).
- [ ] Una descripción larga: la tarjeta no crece (una línea con «…»); entera en la vista previa.
- [ ] **Crear campaña**: el sistema sin «Tuyos» ni «De serie», sin «Al empezar, los jugadores conocen…» ni idioma del
  contenido; la campaña nueva no conoce ninguna página. En sus ajustes ya no está «Parte de las páginas que conoce todo
  el mundo».
- [ ] **El menú de tu usuario** (la inicial, abajo en la barra) se ve entero.
- [ ] **Ajustes**: «Jugabilidad» con el color de tus dados (se guarda al momento) y «Ver caer los dados de los demás»;
  «Aspecto · Sin efecto cristal (más fluido en ordenadores lentos)». El Perfil ya no tiene los dados.
- [ ] **Archivos** (fuera de los mundos): cada mundo es una carpeta con lo suyo, sin engranaje; subir a ella deja el
  archivo en el mundo; al borrar un mundo, su carpeta se va.
- [ ] **Fondos**: en Inicio y dentro de un mundo (ya sin su portada detrás) el fondo cambia cada 45 s con un fundido
  lento; que no maree. ¿Te parece bien el ritmo?
- [ ] **Sistemas**: Reglas con el título sobre la columna del centro y los pasos y la revisión a los lados, como el
  compendio; «Avanzado»; «Sistema nuevo» y «Libro nuevo» sin camino de IA (solo una línea que lo menciona).
- [ ] **Entrar y salir de un sistema**: chispas al entrar; al salir por la llama, el icono y el nombre vuelven a su
  tarjeta, con humo.
- [ ] **Salir de un mundo** por la llama: la página se aleja entera con lo demás.
- [ ] **El tutorial de un libro** (Sistemas › un libro, la primera vez): el globo por encima de todo y sin tapar la
  barra.
- [ ] **Cambiar deprisa** entre Reglas, Compendio y el Inicio de un sistema (o entre secciones de un mundo): el
  segundo clic, en plena transición, ya vale.
- [ ] **Mapa**: tras pulsar una herramienta, Escape la deja; con un pin o un dibujo elegido, Supr lo borra (también con
  el foco en el pin). El mapa y la pizarra llegan hasta abajo de la ventana y de lado a lado de la hoja.
- [ ] **Pizarra**: lo nuevo, con trazo limpio y letra normal (también lo que dibuja la IA); dibujar, mover una
  tarjeta, salir a otra página y volver: se ve igual, con el mismo encuadre.
