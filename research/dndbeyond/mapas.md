# La mesa virtual de D&D Beyond (Maps)

Módulo de Crisol: 6. Mesa · Fecha: 2026-11-07 · Versión estudiada: Maps en beta (web de dndbeyond.com), según su ayuda
oficial (artículos de febrero a julio de 2026), su registro de cambios hasta el 6 de noviembre de 2026 y su hoja de ruta
pública del 2026-11-07; con la sesión de Enrique (Chromium 156) solo se abrió la portada de Maps

## Pregunta

Para el módulo 6, Enrique quiere que en combate la mesa sea el centro «como en Foundry o D&D Beyond», y juega sobre
todo en persona, con una segunda ventana en la tele. De la mesa de D&D Beyond queríamos saber:

1. **Escenas y mapas**: cómo se sube y se calibra un mapa, la rejilla y los mapas de las aventuras ya preparados.
2. **Fichas**: de personajes y de monstruos, tamaños, estados, barras y PG.
3. **Niebla**: a mano o por visión, y si hay muros, líneas de visión o luces.
4. **Iniciativa**: su enlace con los encuentros y con las hojas, y las tiradas desde la hoja.
5. **Lo que ven los jugadores** y cómo entran; si hay una vista para una segunda pantalla.
6. **Medir, plantillas de área, dibujo y señales.**
7. **Qué hace bien o mal frente a Foundry**: quejas de usuarios y límites.

No se repite lo que ya está en `criaturas-y-grupo.md` § 1 y § 2: el panel de PG de un monstruo (curar, dañar,
temporales y otro máximo), el encuentro de combate por dentro (bandos, iniciativa, dificultad, pendientes, letras de la A
a la Z sin contar las ocultas) y agrupar copias. Aquí solo se añade lo que cambia o lo que importa para la mesa.

Grado de certeza:

- **[O]**: observado en vivo con la sesión de Enrique.
- **[I]**: lo que dicen la ayuda oficial, el registro de cambios o la hoja de ruta, sin haberlo visto: [I, ayuda],
  [I, cambios], [I, hoja de ruta]. **[F]**: lo que dicen usuarios en sus foros, sin confirmar.

## Lo que hacen

### Qué es y cómo ha crecido

Maps es su mesa virtual en 2D, en el navegador, dentro de la campaña. Salió en alfa en septiembre de 2023, solo para la
suscripción más cara; pasó a beta en octubre de 2024 con el combate dentro, y desde septiembre de 2025 la usa cualquier
cuenta. La suscripción más cara solo hace falta para subir mapas propios (10 GB) y para usar los monstruos propios
[I, cambios]. Sigue en beta y se mejora casi cada semana. Su línea, dicha por ellos, es que sea fácil de usar para
cualquiera antes que potente [I, hoja de ruta 2026]. Su mesa en 3D (Sigil) se cerró a finales de octubre de 2026
[I, ayuda].

Lo que ha ido llegando, en resumen [I, cambios]:

| Cuándo | Qué |
|---|---|
| 2023 | Fichas, niebla a mano, escalar el mapa al subirlo, registro de tiradas; regla; ocultar fichas y aros de color; pantalla completa; pincel de niebla con forma y tamaño; puntero |
| 2024 | Dibujo, quién está conectado, **vista de espectador** (para la tele); permisos de los jugadores; plantillas de área; **combate con iniciativa** (beta); PG de los personajes al momento; PG y statblock de los monstruos |
| 2025 | Ventaja y desventaja; PG desde la ficha; bloquear y agrupar; iniciativa desde la hoja; pegatinas (objetos y decorado); **mapas listos para jugar**; gratis para todos; imágenes para enseñar |
| 2026 | Niebla por polígono; copiar y pegar; ocultar el nombre de una ficha; dados 3D compartidos; **la hoja dentro de Maps**; diario de la sesión; cambiar el tamaño de las fichas; **estados en las fichas, sincronizados con la hoja**; malherido y muerto solos; **notas de escena en el mapa**; CA en la ficha; arte propio para fichas y pegatinas |

**Lo que no tiene ni anuncia**: muros, puertas, luces, visión de las fichas ni rejilla visible o hexagonal. En la hoja de
ruta pública de noviembre de 2026 no sale nada de eso ni en «ahora» ni en «después»: lo que hay en marcha son
herramientas del máster que sirvan sin mapa, el motor nuevo de reglas y los marcadores de la preparación
[I, hoja de ruta].

### 1. Escenas y mapas

- **No hay «escenas» como objeto**: hay una lista de mapas por campaña. El máster abre el explorador de mapas, añade
  los que quiera a la lista y elige cuál está activo; cambiar de mapa es elegir otro de la lista [I, ayuda].
- **Procedencia de los mapas** [I, ayuda y cambios]:
  - unos mapas básicos gratis (prados, caminos…), con su versión animada;
  - los de los libros y aventuras compradas, ya configurados: ellos van metiendo el catálogo antiguo y los libros
    nuevos salen con sus mapas;
  - los subidos por el máster (solo con la suscripción más cara): imagen jpg, png o webp, o vídeo mp4 o webm para mapas
    animados (vídeo de 100 MB como mucho), con 10 GB en total por cuenta. Los foros hablan de un tope de unos 10 MB por
    imagen y de que imágenes muy grandes en píxeles no suben [F].
- **Mapas listos para jugar** (desde junio de 2025): al añadir un mapa de una aventura se elige entre el mapa solo o la
  versión que ya trae **las fichas de los monstruos colocadas, la niebla puesta, pegatinas y la dificultad del
  encuentro**. Desde 2026 son la opción por defecto cuando existen [I, cambios].
- **Calibrar un mapa subido** [I, ayuda]: tras subirlo, una pantalla enseña encima un círculo del tamaño de una
  criatura mediana con las líneas y las esquinas de una casilla. Se arrastra el círculo hasta que una esquina coincide
  con una del mapa y se estira con un asa hasta que las líneas casan con su rejilla; si el mapa no tiene rejilla, se
  ajusta a ojo al tamaño que debe tener una ficha. Se puede volver a editar después.
- **La rejilla es invisible**: existe para colocar y mover fichas (con las flechas se mueve casilla a casilla), pero no
  se dibuja y no hay rejilla hexagonal. Es una de las peticiones más repetidas; su equipo responde que poner una rejilla
  es fácil pero que quede bien ajustada no [F, mayo de 2026].
- **Notas de escena** (desde agosto de 2026) [I, cambios y anuncio]: el máster pone en el mapa **chinchetas que solo
  ve él**, cada una una escena posible en esa zona, y al pulsarla se abre un panel lateral con sus notas (una plantilla
  propuesta, que se puede cambiar, con encabezados y menciones a otras escenas del mismo mapa). Sirve también sin
  mapa táctico: hay un mapa «organizador» para el teatro de la mente y para jugar en persona.
- **Diario** (desde junio de 2026): uno del máster y otro del grupo, dentro de Maps [I, ayuda].

### 2. Fichas

- **Tres pestañas para poner fichas** [I, ayuda]: monstruos (con buscador y filtros por tipo, tamaño, VD y libro),
  personajes de la campaña (con el retrato de su hoja) y compañeros (lo que el jugador lleva en «Extras» de su hoja).
  Cada pulsación pone una ficha en un hueco libre, **del tamaño que le toca** por la escala del mapa (un ogro ocupa
  2×2). Desde junio de 2026 se puede cambiar el tamaño.
- **Menú de la ficha** [I, ayuda y cambios]: ocultar o enseñar (solo el máster; la oculta se ve desaturada), renombrar
  (o esconder el nombre, para no delatar a un PNJ), aro de color, borrar; para los monstruos, sus PG, su statblock en la
  barra lateral y enseñar su ilustración a los jugadores; añadir al combate.
- **Estados** (desde julio de 2026): en todas las fichas, sincronizados en los dos sentidos con la hoja del personaje.
  Avisan de que a veces hay que recargar la hoja para verlos, por la plataforma vieja [I, cambios]. Desde septiembre,
  la ficha enseña los iconos de sus estados y, en combate, la CA del monstruo.
- **Malherido y muerto** (desde agosto de 2026, también en los personajes desde noviembre): la ficha cambia de aspecto
  sola al 50 % y al 0 % de PG; por defecto lo ven los jugadores y el máster puede ocultarlo [I, cambios].
- **Barra de PG**: no se ve barra en la ficha; los PG salen como número en su menú y en la lista de iniciativa
  [I, ayuda; inferido de las capturas descritas].
- **Quién mueve qué**: por defecto, **cualquiera que mire el mapa mueve cualquier ficha**; el máster puede quitar a los
  jugadores las fichas de monstruos, el dibujo, el puntero, las señales y bloquear o agrupar [I, ayuda].
- **Bloquear, agrupar, copiar y pegar** fichas, plantillas y pegatinas, también entre mapas (se reescala) [I, cambios].

### 3. Niebla

**Solo a mano** [I, ayuda y cambios]:

- Cubrir todo, destapar todo, pintar niebla y borrarla con un pincel redondo o cuadrado. Los **tamaños del pincel son
  las categorías de tamaño de las criaturas** (de diminuto a gargantuesco): el mediano destapa justo un pasillo de
  5 pies.
- Desde enero de 2026, **por polígono**: se pincha punto a punto y se cierra la forma, para destapar salas enteras sin
  pasar el ratón.
- El máster ve a través de la niebla; los jugadores no ven nada debajo, ni fichas ni terreno. El puntero sí se ve por
  encima de la niebla, para llamar la atención sobre algo que pasa fuera de la vista; los dibujos quedan aunque los
  tape la niebla.
- Los mapas listos para jugar traen la niebla ya puesta.

**Sin muros, puertas, luces ni visión**: no existen, y es la queja más repetida de quien viene de Foundry o Roll20
(«destapar a mano es lento», «niebla tipo programa de dibujo»). Otros prefieren que siga simple [F, 2025–2026].

### 4. Iniciativa, encuentros y hojas

- **Dos herramientas de combate**: el creador de encuentros antiguo, congelado, y el combate de Maps, donde va todo lo
  nuevo (ver `criaturas-y-grupo.md`) [I, ayuda]. Cada mapa puede tener **su encuentro preparado** en la campaña,
  listo para tirar iniciativa [I, cambios 2024]. No hay un «enviar encuentro al mapa» desde el creador antiguo: el
  encuentro de Maps se llena con las fichas que haya en el mapa («añadir todas») o una a una.
- **Lo nuevo de 2026 en la iniciativa** [I, cambios]: si un jugador tira iniciativa desde su hoja, su puesto se pone al
  día aunque el combate ya haya empezado; el máster corrige una iniciativa en la lista y el orden se recoloca solo; el
  máster cambia también los PG de los personajes desde el combate (octubre de 2026).
- **La hoja dentro de Maps** (abril de 2026) [I, ayuda y cambios]: al pulsar su ficha, el jugador abre su hoja entera
  en la barra lateral (tirar, inventario, conjuros, acciones), sincronizada con la hoja normal. El máster abre la de
  cualquiera desde el combate y puede tirar por él. Cada jugador decide si los demás ven su hoja.
- **Las tiradas** de la hoja (web o app), del bot de Discord, del creador de encuentros y del combate van al registro de
  la campaña, que se ve en Maps; desde febrero de 2026 los dados 3D se ven rodar en las pantallas de todos [I, ayuda].
- **Compañeros**: salen en el combate con su statblock y sus PG, pero sus PG solo se cambian en la hoja [I, cambios].

### 5. Lo que ven los jugadores y la segunda pantalla

- **Cómo entran** [I, ayuda]: tienen que estar en la campaña. El máster copia el enlace del mapa y se lo pasa, o
  entran desde su hoja. Como mucho 13 en una sesión, contando al máster. Se ve quién está conectado y con qué personaje.
- **Mostrar u ocultar el mapa**: hasta que el máster no lo enseña, los jugadores ven un mensaje de espera (con
  consejos que van rotando); al ocultarlo, otra vez la espera. Antes era empezar, pausar y terminar sesión; desde mayo
  de 2026 es solo mostrar u ocultar, pensado para cambiar de mapa sin que lo vean a medias [I, ayuda y cambios].
- **Lo que no ven**: lo que está bajo la niebla; las fichas, pegatinas y plantillas ocultas; las ocultas en la fila de
  iniciativa (y si el turno pasa a una oculta, su fila se queda en la anterior); la regla del máster [I, ayuda].
- **Lo que ven**: la fila de iniciativa como retratos arriba, con el nombre al pasar el ratón; dibujos, puntero y
  señales; malherido y muerto; las imágenes que el máster enseña (ilustraciones de los libros, del monstruo de una
  ficha o del retrato de un personaje, también animadas) [I, ayuda y cambios].
- **Vista de espectador** (desde febrero de 2024) [I, ayuda]: el máster abre, desde el menú de información, **otra
  pestaña del navegador con el mapa como lo ven los jugadores**: niebla, fichas ocultas fuera, señales y dibujos. No
  tiene el explorador de mapas ni la niebla, pero sí las fichas y el dibujo. Sigue al máster cuando cambia de mapa. Se
  arrastra a otra pantalla (tele, proyector, mesa digital) y se pone a pantalla completa. Un aviso de inactividad
  impide que la sesión se cierre sola (a los 55 minutos sin uso) cuando el mapa está en otra pantalla y nadie lo toca.
- **No se sabe** si la vista de espectador encuadra por su cuenta o sigue la cámara del máster, ni si el servidor deja
  de mandarle lo oculto o se lo manda y lo esconde la pestaña (Foundry hace lo segundo:
  `research/foundry/sincronizacion-e-historial.md`).

### 6. Medir, plantillas, dibujo y señales

- **Regla** [I, ayuda]: distancia en línea recta, en pies, según la escala del mapa. **Solo la ve quien mide**, para
  no delatar al máster. No se dice cómo cuenta las diagonales.
- **Plantillas de área** (desde junio de 2024) [I, ayuda]: cuadrado o cubo, círculo (esfera, cilindro), cono y línea
  (siempre de 5 pies de ancho). Al dibujarlas enseñan su medida en pies; luego se mueven, giran y estiran. Llevan
  color y **una trama por tipo de daño o efecto** (fuego, frío, necrótico, curación, oscuridad… quince en total), para
  distinguir un silencio de una oscuridad. Se pueden **ocultar** (una trampa que aún no ha saltado) y bloquear.
- **Dibujo**: lápiz con cinco grosores y doce colores, goma y borrar todo; queda en el mapa al cambiar de mapa. La
  ayuda dice que solo dibuja el máster, pero los ajustes dejan dibujar a los jugadores [I, ayuda; contradicción suya].
- **Puntero** (un rastro que ven todos, también encima de la niebla) y **señal** (un aviso muy visible en un punto)
  [I, ayuda].
- **Pegatinas**: objetos, decorado y símbolos (números, letras, chinchetas) que se ponen, giran y escalan, se ocultan
  a los jugadores (recordatorios para el máster) y, desde octubre de 2026, se suben arrastrándolas (2048 px como
  mucho) [I, cambios].

## Compromisos y límites

**Lo que ganan**:

- **Todo está unido**: la ficha es el personaje o el monstruo de su biblioteca; al pulsarla salen su hoja o su
  statblock; los PG y los estados van y vienen entre la hoja y el mapa; las tiradas van al mismo registro. Es lo que
  más se alaba frente a otras mesas [F].
- **Preparar poco**: los mapas de las aventuras llegan calibrados, y los listos para jugar con sus monstruos y su
  niebla. Copiar y pegar fichas acelera los cambios a mitad de partida.
- **Lo oculto no se escapa por los bordes**: ni en la fila de iniciativa, ni en las letras de las copias, ni en el
  nombre de la ficha.
- **La tele resuelta sin más**: la vista de espectador es una pestaña sin herramientas del máster que sigue sus cambios
  de mapa, y mostrar u ocultar el mapa evita que la mesa vea el cambio a medias.
- **Detalles de reglas bien pensados**: el pincel de niebla por tamaños de criatura, las tramas por tipo de daño, la
  línea de 5 pies, la regla privada.

**Lo que pierden**:

- **Sin muros ni visión** la niebla es trabajo del máster en cada sala, y es lo que más piden los que vienen de
  Foundry. En mapas grandes (mazmorras) se nota más.
- **Sin rejilla visible ni hexagonal**, y medir solo en línea recta.
- **Sin escenas**: los mapas son una lista de cada campaña; no se ve cómo se comparte la preparación de un mismo mapa entre dos campañas
  (inferido: cada campaña lo añade a su lista y prepara el suyo).
- **Por defecto todos mueven todo**, y los permisos son por herramienta, no por ficha.
- **Beta frágil**: el registro de cambios va lleno de arreglos del registro de tiradas, fugas de memoria, cuelgues con
  ciertos mapas y dados 3D que no ruedan. Pide aceleración gráfica: sin ella, Maps no abre [O, ver «Cómo se hizo»].
  No está pensado para el móvil ni está en la app.
- **Subir mapas y usar monstruos propios exige la suscripción más cara.**
- **Solo D&D 5e**, y la dificultad, con las reglas de 2024.
- **Herramientas atadas al mapa**: hay quien se queja de que el creador de encuentros nuevo vive dentro de Maps y no se
  puede usar fuera; su hoja de ruta lo reconoce y lo está separando [I, hoja de ruta; F].

**Frente a Foundry** (de lo que ya sabemos, `research/foundry/`): Foundry tiene escenas con muros, puertas, luces y
visión, rejillas cuadradas y hexagonales y todo lo que añadan los módulos, pero manda el mundo entero a cada jugador y
oculta en la interfaz (`sincronizacion-e-historial.md`, `usuarios-y-permisos.md`), y la ficha no enlazada pierde su
estado al borrarla (`criaturas-y-capas.md`). D&D Beyond va al revés: poca mesa y mucha unión con la hoja y el contenido.
En `research/foundry/` aún no hay una nota de escenas, visión y niebla.

## Qué nos llevamos a Crisol

### La pantalla de la tele

1. **La ventana de la tele, como su vista de espectador pero mejor hecha**: una ventana que el máster abre y arrastra a
   la tele, sin herramientas, que sigue la escena que el máster muestre. La diferencia: en Crisol **la pide al
   servidor como la vista del grupo**, y al servidor no le llega a mandarle nada que el grupo no vea (ellos no dicen
   cómo lo hacen). Así es la misma vista que tendrá un jugador online.
2. **Mostrar u ocultar la escena** en la tele (una pantalla de espera con el nombre de la campaña), para preparar o
   cambiar de escena sin que la mesa lo vea a medias. Y ninguna sesión que se cierre sola por inactividad.
3. **Encuadre de la tele**: como no se sabe qué hacen ellos, mantener lo del Crisol actual (seguir al máster, fija,
   encuadrar al grupo).
4. **Enseñar una imagen en la tele** (el retrato de una criatura, una ilustración de la biblioteca) encima del mapa,
   como sus imágenes para enseñar.

### Niebla, muros y luces

5. **Niebla a mano con sus herramientas**: cubrir todo, destapar todo, pincel redondo o cuadrado con **los tamaños de
   las criaturas del sistema** como tamaños de pincel, rectángulo y polígono. Es lo que les funciona.
6. **Y la automática que ellos no tienen**: muros, puertas y luces de UVTT y de Foundry y la visión de las fichas del
   grupo. Es lo que más les piden; es donde les ganamos.
7. **Escena preparada con su niebla inicial y sus criaturas colocadas**, como sus mapas listos para jugar: que la
   escena guarde una formación de encuentro y la niebla de partida, y cada campaña empiece desde ahí.

### Combate

8. **Lo oculto, igual que ellos**: fuera de la fila de iniciativa de la tele, el turno visible se queda en la última
   criatura visible, las letras no cuentan las ocultas y el nombre de la ficha se puede esconder.
9. **Iniciativa viva**: la tirada de la hoja de un jugador (desde su móvil) entra en la fila aunque el combate haya
   empezado, y el orden se recoloca solo; corregir una iniciativa a mano en la fila; las que llegan a mitad, en
   pendientes; quitar del combate sin quitar la ficha.
10. **La ficha abre su hoja** en una barra lateral, con su panel de PG (curar, dañar, temporales), sus estados y su CA
    a la vista en la ficha; malherido y muerto solos, que en la tele salen en palabras («Herido»), como en el módulo 5.
11. **Plantillas de área con tramas por tipo de daño** (del sistema), ocultas para trampas, bloqueables, con su medida
    al dibujarlas y la línea de 5 pies de ancho por defecto. La regla, privada del máster salvo que quiera enseñarla en
    la tele.

### Preparación

12. **Notas de escena enganchadas a la wiki**: sus chinchetas de notas, solo del máster, son nuestros pines del mapa
    que llevan a páginas. En una escena, pines solo del máster que abren la página de una sala o un PNJ.
13. **Calibrar una imagen sin rejilla con una ficha mediana de muestra** y las esquinas de una casilla, como ellos,
    para los mapas que no vienen de UVTT ni de Foundry. Con rejilla visible y hexagonal, que ellos no tienen.

### Qué haremos distinto

- **La escena es del mundo y el estado, de cada campaña**: preparar una vez y jugar en varias, cada una con su niebla y
  sus puertas. Ellos atan el mapa a la campaña.
- **Lo que mueve cada uno, por ficha** (la suya, en su turno, ninguna), cuando lleguen los jugadores online (módulo 7);
  en persona, el máster.
- **Que funcione sin aceleración gráfica** o, al menos, que la tele no la necesite para ver la escena.
- **Cualquier sistema**, no solo 5e: los tamaños, las tramas y los estados vienen del sistema de la campaña.

## Cómo se hizo

- **La sesión de Enrique seguía viva** [O]: la portada de Maps saludaba a su cuenta.
- **El navegador**: una sonda propia en el scratchpad, con `playwright-core` (Apache-2.0, ya en el VPS), que lanzó el
  Chromium 156 con el perfil de Enrique **por tubería, sin abrir ningún puerto**, en un Xvfb sin TCP. Antes se comprobó
  que no había otro Chromium usando el perfil; se cerró al acabar.
- **Nada de escrituras**: la sonda paraba toda petición que no fuera GET, HEAD u OPTIONS y no dejaba conectar ningún
  WebSocket. Solo se bloquearon cuatro envíos: tres del aviso de cookies (sin aceptarlo ni rechazarlo) y uno de
  analítica. No se pulsó nada.
- **Maps no abre en este servidor** [O]: la portada avisa de que no hay aceleración gráfica. El servidor no tiene GPU, y
  el WebGL por software no pasa su comprobación (no se ofrece un contexto sin aviso de bajo rendimiento). No se intentó
  saltar. Por eso todo lo de dentro de Maps sale de la ayuda (leída por su API pública), del registro de cambios, de la
  hoja de ruta, de sus anuncios y de sus foros.
- **Privacidad**: no se leyeron cookies, tokens ni datos de campañas; la captura de la portada se borró al acabar.

### Sin ver

- Si la vista de espectador tiene su propio encuadre o sigue la cámara del máster.
- Si el servidor filtra lo oculto para los jugadores o lo esconde su navegador.
- Cómo cuenta la regla las diagonales, y si hay movimiento con medida al arrastrar una ficha.
- Si un mismo mapa preparado (pegatinas, notas de escena, encuentro) se comparte entre campañas del mismo máster.
- Qué ve un jugador de las notas de escena (la ayuda solo dice que las chinchetas son del máster).

## Fuentes

- Ayuda oficial de Maps (la sección «Maps» y su FAQ, actualizadas entre febrero y julio de 2026), leída por su API
  pública: https://dndbeyond-support.wizards.com/hc/en-us/articles/46363122030868-What-is-Maps y siguientes, en
  especial:
  - «Uploading and Scaling a Map»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46363324655508
  - «Adding Tokens»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385049945492
  - «Controlling Tokens»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385107476116
  - «Fog of War»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385202659732
  - «Spectator View»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385447642004
  - «Overlays»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385298657556
  - «Ruler, Point, and Ping»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385180954772
  - «Draw»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385172032788
  - «Session Controls»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385384993428
  - «Game Settings»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385423678356
  - «Inviting Players to View the Map»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385404580756
  - «Combat Encounters on Maps»: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164
  - «Character Sheets in Maps»: https://dndbeyond-support.wizards.com/hc/en-us/articles/48753225063828
  - «Maps Requires Browsers to have Hardware Acceleration Enabled»:
    https://dndbeyond-support.wizards.com/hc/en-us/articles/36427177679636
  - Formatos y almacenamiento: https://dndbeyond-support.wizards.com/hc/en-us/articles/46363725057556
  - Jugadores por sesión: https://dndbeyond-support.wizards.com/hc/en-us/articles/46363705015188
  - Cierre de Sigil: https://dndbeyond-support.wizards.com/hc/en-us/articles/26423004178196
- Registro de cambios (de septiembre de 2023 al 6 de noviembre de 2026): https://www.dndbeyond.com/changelog
- Hoja de ruta pública (consultada el 2026-11-07): https://www.dndbeyond.com/en/roadmap
- Hoja de ruta de 2026 (2026-02-19): https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap
- Revisión de mitad de año: https://www.dndbeyond.com/posts/2223-mid-year-update-d-d-beyonds-2026-development
- Notas de escena (2026-08-31): https://www.dndbeyond.com/posts/2236-how-to-use-scene-prep-d-d-beyonds-new-prep-tool
- Foro, rejilla (mayo de 2026):
  https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/239564-can-you-still-not-add-a-grid-in-the-maps-vtt
- Foro, hoja de ruta de 2025 retrasada:
  https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/232269-maps-roadmap-2025-off-track
- Comentarios de la hoja de ruta sobre muros e iluminación:
  https://www.dndbeyond.com/posts/2120-the-road-ahead-join-our-journey-to-improve-the
- Comparativas de usuarios (EN World y r/VTT, 2025): https://www.enworld.org/goto/post?id=9739732
