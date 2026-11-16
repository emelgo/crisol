# Lo que tiene que probar Enrique

Lista viva: todo lo que haya que probar se apunta aquí y se marca cuando lo pruebe. Lo que diga va a «Lo que dijo» (al
final) y de ahí a su arreglo, o a `docs/diseno.md` si es una norma de la interfaz.

- **Staging**: https://neo.crisol.144-91-122-245.sslip.io, con las tandas 3 a 7 de la revisión desde el 2026-11-12 (PR #118) y los módulos 1 a 7: el 6 (la mesa) desde el 2026-11-07, PR #114; el 5 (lo que ven los jugadores)
  desde el 2026-11-07, PR #112; el 4 (compendio, criaturas, imágenes, tablas, grupo y biblioteca), PR #110 y #111.
- **La IA**: el conector «Neo Crisol» de claude.ai (`https://neo.crisol.144-91-122-245.sslip.io/mcp`), con la cuenta
  de propietario.
- **En local**, con los cambios al momento: http://localhost:5173 (lo arranco cuando haga falta).

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
