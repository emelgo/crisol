# Criaturas en partida, monstruos propios e inventario del grupo en D&D Beyond

Módulo de Crisol: 4. Compendios, bestiario y biblioteca · Fecha: 2026-11-06 · Versión estudiada: web de dndbeyond.com
consultada el 2026-11-06 con la sesión de Enrique (Chromium 156), su centro de ayuda oficial y su registro de cambios
hasta el 30 de octubre de 2026

## Pregunta

Para el módulo 4, Enrique quiere que las criaturas del compendio se jueguen «como en Foundry o D&D Beyond». En concreto:

1. **El monstruo en partida**: qué se tira desde su statblock y adónde va la tirada, y cómo se llevan sus PG en los
   encuentros, el combate o la mesa virtual que existen hoy.
2. **Copias e instancias**: varias copias del mismo monstruo con sus PG por separado, cómo se distinguen, PG fijos o
   tirados, y si un PNJ conserva su estado de una sesión a otra.
3. **Monstruos propios**: crearlos a partir de uno existente, y cómo se comparten con una campaña.
4. **El inventario del grupo**: qué guarda, quién lo ve y lo cambia, y cómo pasan objetos y monedas entre el grupo y un
   personaje.
5. **Buscar dentro de los libros**, por si ha cambiado desde `contenido-y-enlaces.md`.

No se repite lo que ya está en `contenido-y-enlaces.md` (el lector de libros, el statblock como lectura, la búsqueda,
el formulario de criatura propia), `contenido-5e-y-mecanica.md` (las marcas de tirada del texto de un monstruo) ni
`creador-y-hoja.md` (la hoja y su inventario personal).

Grado de certeza:

- **[O]**: observado en vivo con la sesión de Enrique.
- **[I]**: lo que dicen la ayuda oficial o el registro de cambios, sin haberlo visto: [I, ayuda], [I, cambios].

## Lo que hacen

### 1. El monstruo en partida

**Hoy hay tres sitios para jugar un monstruo**:

| Sitio | Estado | Para qué |
|---|---|---|
| **Encuentros** (el creador de encuentros con el gestor de combate dentro) | Beta congelada: «no hay cambios previstos», sigue con la guía de encuentros de 2014; las cuentas gratuitas, como mucho 8 encuentros [I, ayuda] | Montar un encuentro con su dificultad y jugarlo en una lista de iniciativa |
| **Maps** (su mesa virtual, en beta) | Donde va todo lo nuevo de 2025 y 2026 [I, cambios] | Fichas en el mapa, encuentro de combate con iniciativa, PG, estados y la hoja dentro |
| **La página del monstruo** | Solo lectura [O] | Leer el statblock, la ilustración y la ambientación |

**La página del monstruo no tira** [O]:

- Los números del statblock llevan ya sus **marcas de tirada** en el HTML: la fórmula, la clase de tirada (ataque o
  daño), la acción a la que pertenecen y el tipo de daño. Pero en la página se ven como texto normal, sin botón.
- Arriba solo hay tres accesos: las reglas de los monstruos, crear un monstruo y el homebrew. **No hay «añadir a un
  encuentro» ni «poner en el mapa»** desde la página.

**Dónde sí se tira** [I, ayuda y cambios]:

- **En Maps**, al elegir un monstruo de la lista de iniciativa sale un panel rápido con sus pruebas de característica y
  sus salvaciones. Desde ahí se abre el statblock entero, en la barra lateral o en otra pestaña, y en él se tiran los
  ataques, el daño, las recargas y cualquier otra expresión de dados. El statblock también se abre desde el menú de la
  ficha del mapa.
- **En el gestor de combate de Encuentros** (2021), lo mismo: se pulsa el recuadro de la tirada. Con el botón derecho
  (o con una pulsación larga) se elige ventaja o desventaja en ataques, pruebas y salvaciones, o crítico en el daño. Se
  tiran también **los PG**: se tiran sus dados de golpe y el resultado pasa a ser el máximo de esa copia.
- **Funciona también con los monstruos propios**: los PG, las pruebas y las salvaciones salen de sus datos; los ataques,
  de las marcas que lleven en el texto.

**Adónde va la tirada** [I, ayuda y cambios]:

- Al **registro de la campaña** («Game Log»). Ahí llegan las tiradas de la hoja (web y app), del bot de Discord, del
  creador de encuentros y del gestor de combate. Cada tirada se despliega para ver el detalle.
- Las del máster con sus monstruos **solo las ve él** (desde 2021). Prometieron una opción para enseñarlas que no se ha
  visto.
- Desde febrero de 2026, los **dados 3D se comparten**: los demás ven rodar los dados de quien tira, en Maps y en la
  hoja.

**Cómo se llevan los PG en Maps** [I, ayuda y cambios]:

- Se pulsa el botón con los PG actuales (en la lista de iniciativa o en el menú de la ficha) y se abre un panel con:
  - una cantidad con «+ Curar» y «− Daño»;
  - los **PG temporales**: el daño los gasta primero, la curación no los repone y un valor nuevo sustituye al anterior;
  - **otro máximo** («Override Max HP»), porque por defecto el máximo es la media del statblock.
- Desde agosto de 2026, las fichas de monstruo se marcan solas como **malheridas al 50 % y muertas al 0 %**. El máster
  decide si lo ven los jugadores; por defecto lo ven.
- Desde septiembre de 2026, la ficha enseña la **CA en combate y los iconos de sus estados**. Una tirada puede aplicarse
  a los PG (el registro de cambios arregla que no se aplicaba con los dados 3D apagados), pero no se ve cómo se elige el
  objetivo.
- Los jugadores pueden cambiar los PG de su propia ficha (septiembre de 2026), y el máster los de los personajes en el
  combate, como con los monstruos (30 de octubre de 2026).
- Si un jugador cambia sus PG en la hoja, el combate se actualiza solo. La hoja entera se abre dentro de Maps (abril de
  2026), y el máster puede tirar por un jugador desde ella.

**El encuentro de combate en Maps** [I, ayuda]:

- Se llena con «añadir todas las fichas» del mapa, o ficha a ficha con un botón [+]. Lo separa en tres bandos: el grupo
  (con los compañeros), los PNJ y los enemigos. Una criatura cambia de bando desde su menú.
- La iniciativa empieza en la puntuación de iniciativa de cada criatura; se puede tirar en bloque por bando o
  escribirla. La ventaja o desventaja suma o resta 5 a la puntuación, o se aplica a la tirada.
- Abajo, la **dificultad** del encuentro según la guía de 2024, que cambia al añadir o quitar criaturas.
- «Empezar combate» ordena la iniciativa; «siguiente» avanza, con el contador de asaltos y turnos y un botón para
  volver atrás.
- Los jugadores ven el orden como imágenes arriba de la pantalla, **sin las criaturas ocultas**: si el turno pasa a una
  oculta, la vista de los jugadores se queda en la anterior.
- Una criatura derrotada se quita del combate sin borrar su ficha del mapa, para marcar dónde cayó. Las que llegan a
  mitad de combate esperan en «pendientes» hasta tirar su iniciativa.
- «Terminar combate» vacía el orden.

### 2. Copias e instancias

- **Cada ficha del mapa es una copia con sus PG** [I, ayuda]. Se añaden tres goblins pulsando tres veces [+]; cada uno
  aparece en un hueco libre y con el tamaño que le toca en la rejilla.
- **Cómo se distinguen** [I, ayuda]:
  - al empezar el combate, los repetidos reciben **una letra de la A a la Z**, en la lista y en la ficha del mapa;
  - si llega otro a mitad de combate, el que ya estaba pasa a ser «A» y el nuevo, «B»;
  - **los ocultos no cuentan** para las letras, así su número no delata que hay más;
  - al terminar el combate se quitan las letras.
- **Agrupar** [I, ayuda]: varias fichas del mismo monstruo se agrupan para moverlas y tratarlas a la vez. En el
  encuentro, un grupo se puede **desagrupar** para llevar cada una por separado.
- **PG fijos o tirados**: en Maps, la media, con «otro máximo» a mano [I, ayuda]; en el gestor de combate antiguo,
  también tirados con sus dados de golpe [I, cambios 2021].
- **Un PNJ que conserva su estado entre sesiones**: no existe como concepto [I].
  - Lo más cercano es que la ficha siga en el mapa: el mapa guarda su estado, y terminar el combate solo vacía el orden
    y las letras [I, inferido de la ayuda].
  - La otra salida es que el máster haga el PNJ como un personaje de la campaña, con su hoja: la ayuda del inventario
    del grupo nombra a «los másteres que tienen PNJ como personajes en la campaña» [I, ayuda].
- **Compañeros** [I, cambios]: las criaturas que un jugador lleva en «Extras» de su hoja (una montura, un familiar) se
  ponen en el mapa desde su propia pestaña, con su statblock y sus PG. Pero sus PG solo se cambian en la hoja, no en el
  mapa.

### 3. Monstruos propios

- **«Crear un monstruo» empieza preguntando la plantilla** [O]: «usar un monstruo existente como plantilla», con un
  filtro por tipo de criatura y un desplegable con **los monstruos a los que tiene acceso la cuenta** (1.153 en la de
  Enrique, agrupados por categoría de fuente: reglas básicas y ampliadas de cada edición, los de las «Drops» y los de
  un socio). La otra opción es «crear desde cero». No se envió el formulario.
- **Lo que se edita** es el formulario ya descrito en `contenido-y-enlaces.md` § 3: campos estructurados más ocho
  editores de texto, uno por sección. La copia hereda las marcas de tirada del texto, así que sus ataques se siguen
  tirando [I, cambios 2021].
- **Compartirlo con la campaña** [I, ayuda]:
  - lo creado entra solo en la colección de homebrew de la cuenta, que funciona como un libro más;
  - quien está en una campaña con ese homebrew lo ve y lo usa, sin publicarlo;
  - publicar es mandarlo a moderación para que lo vea todo el mundo; una vez publicado ya no se puede cambiar ni quitar,
    y la ayuda aconseja no hacerlo si no se quiere compartir con el público.
- **En la mesa virtual** [I, ayuda]:
  - solo el máster con la suscripción más cara ve sus monstruos propios en el buscador de fichas;
  - la ficha toma la imagen pequeña que se subió al monstruo propio y, si no hay, una genérica de su tipo de criatura.

### 4. El inventario del grupo

**Dónde está** [O]: en la hoja de cada personaje de una campaña, la pestaña Inventario tiene dos subpestañas, «Mi
inventario» y «Del grupo».

**Qué enseña la pestaña del grupo** [O]:

- **La cabecera**: el nombre de la campaña y las monedas del grupo, por tipo.
- **La lista**: un buscador, un filtro y «Gestionar inventario». Debajo, filtros rápidos (todo, o cada contenedor) y la
  misma tabla que el inventario propio (activo, nombre, peso, cantidad, coste y notas), por contenedores. El primero,
  «Equipo del grupo», viene de serie.
- **Los objetos**: los del compendio y los propios, con sus cargas.
- **La sintonía**: la sección de sintonía de la hoja añade un apartado propio para los objetos del grupo que la piden.

**Un objeto del grupo**, al abrirlo [O]:

- dónde está («en Equipo del grupo»), sus cargas, «Personalizar», el peso, el coste, el libro de origen y su texto;
- al final, la cantidad y dos botones: **Mover** y **Borrar**.

**«Gestionar inventario»** [O] abre un panel lateral con:

- añadir objetos del compendio (con filtros por tipo, por común, mágico o contenedor, y por fuente) o uno propio;
- los contenedores propios y los del grupo, cada uno con su peso;
- enlaces al equipo inicial, las monedas y la carga.

**Las monedas** [O]: el panel «Gestionar monedas» separa «Mis monedas» (con los gastos de estilo de vida) de «Monedas
del grupo», cada una con su total. Hay unos ajustes para guardar las monedas dentro de cada contenedor, también en los
del grupo [I, ayuda].

**Reglas** [I, ayuda]:

- **Quién**: los jugadores con un personaje activo en la campaña y el máster si lleva PNJ como personajes.
- **Equipar desde el grupo**: cualquiera puede equipar un objeto del grupo y gana sus efectos, y se ve quién lo lleva.
- **Mover o borrar**: se puede mover o borrar cualquier objeto del grupo que no lleve equipado otro personaje. Se mueve
  entre los contenedores propios y los del grupo (la ayuda pone de ejemplo una cuerda que pasa de la mochila de un
  personaje a la bolsa de contención del grupo).
- **El atasco conocido**: si sacan de la campaña a quien lleva equipado un objeto del grupo, nadie más puede moverlo.
  Para eso, el máster puede borrar cualquier objeto del grupo desde cualquier hoja.
- **Objetos de artífice**: los imbuidos o replicados van al grupo y los demás los pueden equipar, pero no pasar a su
  hoja.
- **El botón de la campaña** en la cabecera abre una barra con el enlace a la campaña, la mesa virtual y los personajes
  activos.

### 5. Buscar dentro de los libros

- El 30 de octubre de 2026 estrenaron una **búsqueda nueva en todo el sitio** [I, cambios]. Sus resultados [O] filtran
  por edición, editor, categoría, **libro de origen** y «solo lo mío y lo compartido conmigo».
- Las secciones de los libros salen como categoría «Biblioteca», junto a las entidades. Siguen los duplicados: la
  misma dote sale como dote y como sección del libro.
- **El lector de un libro sigue sin buscador propio** [O]: la única caja de búsqueda de la página es la del sitio.
  Acotar a un libro es usar el filtro de libro de origen, como ya decía `contenido-y-enlaces.md`.
- No hay PDF de los libros: el libro digital es HTML con enlaces, y sin comprarlo solo se ve el índice [I, ayuda].

## Compromisos y límites

**Lo que ganan**:

- **Un statblock, tres usos**: el mismo statblock se lee en la página, se tira en el combate y se abre desde la ficha
  del mapa.
- **Copias sin pensar en ellas**: cada ficha es una copia con sus PG, y las letras salen solas al empezar el combate,
  sin delatar las ocultas.
- **El panel de PG** resuelve lo de cada turno en un sitio: daño, curación, temporales y otro máximo.
- **El inventario del grupo es parte de la hoja**, no una pantalla aparte: se mueve con el mismo gesto que entre
  contenedores propios, y el objeto equipado da sus efectos a quien lo lleva.

**Lo que pierden**:

- **Dos herramientas de combate** con reglas distintas: los encuentros antiguos, congelados con la guía de 2014, y Maps
  con la de 2024.
- **No hay PNJ único con estado propio**: un PNJ es o una ficha de monstruo que se pierde al quitarla del mapa, o una
  hoja de personaje entera.
- **Los ataques de un monstruo propio son texto marcado**: si cambia una característica, su bono no se mueve
  (`contenido-5e-y-mecanica.md`).
- **Desde la página del monstruo no se puede jugar ni prepararlo**: no hay «añadir al encuentro» ni tirada.
- **Los monstruos propios en la mesa piden la suscripción más cara**.
- **El inventario del grupo se atasca** cuando sale de la campaña quien lleva algo equipado, y lo arregla el máster a
  mano.
- **El lector no busca dentro del libro**.

## Qué nos llevamos a Crisol

### Criaturas en partida

1. **El compendio es para leer; se juega con lo que está en juego.** Como en D&D Beyond, la entrada del compendio no
   lleva registro ni estado: su botón es «Poner en juego» en una campaña. Las tiradas y los PG van en la copia, que es
   la que lleva la hoja de criatura.
2. **Cada copia con sus PG, y la letra al ponerla en juego**, no al empezar el combate: «Goblin A», «Goblin B»… Así se
   distinguen también fuera de la mesa (el módulo 6 aún no existe). Sin contar las ocultas cuando lleguen los jugadores
   (módulo 5).
3. **PG: la media por defecto**, con «tirar PG» (sus dados de golpe, por la fórmula del sistema) y «otro máximo»;
   temporales con la regla de D&D (el daño los gasta primero, un valor nuevo sustituye). Que el sistema diga qué campos
   son PG y temporales, como ya hace la hoja.
4. **Un panel rápido por copia**: CA, PG con curar y dañar, estados, y sus pruebas y salvaciones a un clic; el
   statblock entero para los ataques, el daño, las recargas y las legendarias. Malherida al 50 % y muerta al 0 %, como
   marca visible.
5. **Las tiradas, al registro de la campaña, ocultas por defecto** para el máster, con «que lo vean todos» (ya lo hace
   `tirar_dados`), y con ventaja, desventaja y crítico como en la hoja.
6. **El PNJ único, mejor que ellos**: una copia marcada como única, que conserva sus PG, sus usos y sus estados entre
   sesiones hasta que el máster la quite o la reinicie (y descansa como un personaje). Es lo que D&D Beyond no tiene.
7. **Agrupar copias** para dañarlas o tirar su iniciativa a la vez, y separarlas después, cuando llegue la mesa
   (módulo 6). En el 4 basta con poner varias de una vez («Poner en juego × 3»).

### Monstruos propios

8. **«Copiar a…» desde cualquier entrada** (del sistema a la cuenta o al mundo), con un selector agrupado por
   procedencia, como su plantilla. La copia lleva la mecánica como datos, no como texto marcado, así que al cambiar una
   característica cambia el bono de ataque. Es donde mejor les ganamos.
9. **La imagen de la ficha**: el retrato de la criatura, y si no tiene, una imagen genérica por tipo de criatura del
   sistema. Que sirva también para lo traído de Foundry.

### Inventario del grupo

10. **En la hoja, «Mío | Del grupo»**, con sus contenedores (uno de serie) y sus monedas, y el mismo «Mover» que entre
    contenedores propios. Equipar desde el grupo da los efectos a quien lo lleva y enseña quién lo tiene.
11. **Sin atascos**: si un personaje deja la campaña, lo que llevaba equipado del grupo vuelve al grupo. El máster
    puede mover o borrar cualquier cosa.
12. **Las monedas del grupo** separadas de las de cada personaje, y pasar monedas de uno a otro en los dos sentidos.

### Biblioteca

13. **Buscar dentro de un libro y en todos**, con el filtro de libro. Abrir el PDF en la página, y los resultados de
    libros aparte de los del compendio para no duplicar. Es justo lo que su lector no tiene.

## Cómo se hizo

- **La sesión de Enrique seguía viva.**
- **El navegador**: una sonda propia en el scratchpad. Con `playwright-core` (Apache-2.0, ya en el VPS) lanzaba el
  Chromium 156 de craft-anything con el perfil de Enrique, **por tubería, sin ningún puerto**, y en un Xvfb sin TCP.
- **Nada de escrituras**:
  - la sonda paraba por CDP toda petición que no fuera GET, HEAD u OPTIONS, salvo:
    - la renovación del token de sesión y del token de verificación;
    - la comprobación antibots de la web;
    - las dos consultas de banderas de funciones;
  - descartaba todo lo que la página mandara por WebSocket;
  - solo se bloquearon envíos de telemetría, del consentimiento de cookies (sin aceptarlo ni rechazarlo) y de
    analítica; la página no intentó escribir nada;
  - no se pulsó ninguna tirada ni «Mover», «Borrar» o «Crear»: solo pestañas y paneles de lectura.
- **Lo que no se pudo ver en vivo**:
  - **Encuentros** sale en blanco desde el VPS: el cortafuegos de su API rechaza las consultas previas de CORS (403)
    desde esta dirección, y no se intentó saltarlo;
  - **Maps** pide aceleración gráfica, que este servidor no tiene.

  Lo de esas dos herramientas sale de la ayuda oficial (leída por su API pública) y del registro de cambios.
- **Privacidad**: se abrió como máster la hoja de un jugador de una campaña de Enrique solo para ver la estructura del
  inventario del grupo. De los jugadores y sus objetos no se apunta nada. No se leyeron cookies ni tokens.
- **Las capturas y los textos** quedaron en el scratchpad de la sesión, fuera del repo, y se borraron al acabar.

### Sin ver

- Cómo se elige el objetivo de una tirada de daño que se aplica a los PG en Maps.
- Si el gestor de combate antiguo guarda los PG de cada copia entre sesiones (los encuentros se guardan, pero no se
  pudo abrir).
- Qué ofrece «Mover» en un objeto del grupo (a qué contenedores) y cómo se ve quién lleva equipado un objeto.
- Si un PNJ hecho como personaje del máster sale en el inventario del grupo y en el combate como los de los jugadores.

## Fuentes

- Ayuda, «Combat Encounters on Maps» (2026-02-27):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps
- Ayuda, «Encounters!» (2025-09-15): https://dndbeyond-support.wizards.com/hc/en-us/articles/7747237485716-Encounters
- Ayuda, «Adding Tokens» (2026-02-27): https://dndbeyond-support.wizards.com/hc/en-us/articles/46385049945492-Adding-Tokens
- Ayuda, «Select and Group» (2026-02-27):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/46385317058580-Select-and-Group
- Ayuda, «Game Log» (2026-02-27): https://dndbeyond-support.wizards.com/hc/en-us/articles/46385444116372-Game-Log
- Ayuda, «Shared Party Inventory FAQ» (2025-09-09):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/40964522619540-Shared-Party-Inventory-FAQ
- Ayuda, «Homebrew Creation and Collection Basics» (2025-09-29):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/7747238519700-Homebrew-Creation-and-Collection-Basics
- Ayuda, «Sharing and Publishing Homebrew Content» (2025-09-29):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/7747210455828-Sharing-and-Publishing-Homebrew-Content
- Ayuda, monstruos propios como fichas (2026-02-16):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/46363769831444
- Ayuda, «Digital Sourcebooks» (2025-06-16):
  https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209667476-Digital-Sourcebooks
- Registro de cambios (hasta el 30 de octubre de 2026): https://www.dndbeyond.com/changelog
- Nota de cambios antigua, «Monster Dice Rolling for the Encounter Builder / Combat Tracker» (2021-04-08):
  https://www.dndbeyond.com/old-changelog/966-monster-dice-rolling-for-the-encounter-builder
