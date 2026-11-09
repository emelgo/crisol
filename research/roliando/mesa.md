# La mesa de Roliando

Módulo de Crisol: 6 (mesa) y campaña alrededor de la Mesa (ADR-0019) · Fecha: 2026-11-10 · Versión estudiada:
roliando.com, mesa de la demo pública sin cuenta (`/demo`, interfaz «Tinta»: una campaña de 5e con su mapa, sus fichas y
su combate, que vive solo en el navegador)

## Pregunta

Qué tiene la mesa de Roliando aparte de los dados y el 3D (rejilla, niebla por jugador, luces, alturas, regla,
iniciativa, modos teatro y escrito, clima y hora, cartas, apps, escenas, tarjetas de daño) y qué hace distinto de Crisol.

**Límites.** Sin la cuenta de prueba (el clasificador de permisos bloqueó leer sus credenciales; ver `dados.md`), solo la
demo: un máster sin jugadores conectados, así que no se pudo ver qué recibe cada jugador. El VPS dibuja WebGL por
software: las medidas de fluidez del mapa no son representativas. Marcas: **[visto]**, **[medido]**, **[deducido]**.

## Lo que hacen

### La pantalla

- Arriba a la izquierda: volver a la campaña, nombre de la campaña y una **píldora de estado** («En vivo: los jugadores lo
  ven» o «Preparando») con el mapa o escena actual y su selector [visto].
- Arriba en el centro, **tres vistas**: Táctica (mapa), Teatro (escena ilustrada) y Escrita (chat a página entera) [visto].
- Arriba a la derecha: modo, pausa, sonido, voz y «Vista» [visto].
- Izquierda: la barra de herramientas del máster; abajo: retrato y **barra de acciones** del personaje elegido; derecha:
  un panel plegable con Chat, Combatientes, Registro y Directorio [visto].

### Cuatro modos de trabajo

La barra cambia según el modo: **Jugar**, **Dirigir**, **Construir** y **Mano** [visto].

- **Jugar/Dirigir**: mover, seleccionar, apuntar, medir, señalar, dibujar, texto, plantillas de área, niebla, revelar
  niebla, notas de sala, goma, esconder y borrar dibujos; «Añadir», «Mostrar» y ajustes de mesa; dados, pedir una tirada y
  macros [visto].
- **Construir**: muros, puertas, muros por forma, alturas, portales, agujeros, zonas de evento, caminos; luces, sonido y
  efectos; plantas; objetos, sembrar objetos, formas con textura; importar mapa, **detectar muros**, plantas y capas;
  rejilla; deshacer y rehacer [visto]. Detalle de las alturas en `mesa-3d.md`.
- Al construir se ven los **radios de todas las luces** como círculos naranjas con su icono [visto].

### «Todo lo de la mesa»

Un botón «Todo» abre un catálogo con buscador de **todas** las herramientas, **agrupadas por frecuencia de uso** y con su
atajo de una letra [visto]:

- **Cada momento**: mostrar, pedir una tirada, hablar como PNJ, momentos, música, dados, mochila, combatientes,
  directorio y módulos.
- **Cada sesión**: efectos, mezclador, escenas, clima y hora, capas de efectos, telón y velos, combate, llamar a la mesa,
  panel de escena, preparar la escena, notas, cámaras, diario, mapa del mundo, pizarra, macros, **cartas y barajas**,
  puzzles, emisión, **jugar en persona**.
- **De vez en cuando**: listas de música, **apps de mesa**, mundo, pantalla del máster, «llevar a…», **dividir la mesa**,
  sala de espera, compartir pantalla, ajustes, efectos y comodidad, personalizar el HUD, atajos, pantalla limpia.

### Vista

Menú con: pantalla limpia (H), fijar el HUD, **ver como jugador**, ver en 3D (de pago), la cámara sigue el turno, la
cámara sigue a mi personaje, **enseñar hasta dónde puede llegar mi personaje**, mover con WASD, encajar el mapa, fijar la
vista actual, **traer la vista de todos aquí**, **pausar y retener a los jugadores**, modo juego, **modo cine** y pantalla
completa [visto].

### Teatro y escrito

- **Teatro**: si el mapa no tiene escena, pide elegir una (o crearla). Al abrirla, el máster la ve a pantalla completa y un
  aviso dice «Estás viendo “Ruinas de Vhalmar”. La mesa no se ha movido», con «Volver a la mesa»: **el máster puede
  mirar otra escena sin arrastrar a los jugadores** [visto].
- **Escrito**: canales a la izquierda **agrupados por lugar** (la cripta: primer nivel, la capilla; el pueblo: la posada)
  y el chat de la mesa a página entera, con las tiradas y las tarjetas de ataque [visto].

### Combate

- Al empezar, **tira la iniciativa de las criaturas** y avisa de que los jugadores tiran la suya; la iniciativa conjunta
  sale como un aviso («Iniciativa — 7 criaturas») [visto].
- **Tira de turnos arriba en el centro**: ronda, retratos grandes de los siguientes, «+7» con los que no caben, y botones
  para retroceder y pasar; el de turno lleva «Tu turno» [visto]. La cámara se va sola a quien le toca («la cámara sigue el
  turno», activado por defecto) [visto].
- Panel **Combatientes** con dos pestañas: **Combate** (orden con asa para arrastrar, iniciativa, PG con barra, CA, menú
  por fila, «Siguiente turno») y **Personajes** (PG y percepción pasiva de cada uno) [visto].
- Al atacar: probabilidad de acertar sobre cada objetivo, círculo de alcance, aviso si está lejos («¿moverte hacia él?
  gasta movimiento»; «no te queda movimiento»), tarjeta en el chat con los pasos ataque → daño → aplicado, **número
  flotante** de daño sobre la ficha y la vida que baja sola [visto]. Las fichas muestran su CA y PG al pasar por encima
  [visto].
- El botón «Fin» del turno está en la barra de acciones del personaje [visto].

### Clima y hora

Dentro del **mezclador de sonido** (pestaña Ambiente → Clima y hora): despejado, lluvia, tormenta, nieve, niebla, brasas,
ceniza, hojas, fuego, polvo y luces feéricas; y un interruptor **«Exterior»**: la hora del día solo tiñe la luz de los
mapas de exterior, con un cielo y la hora para moverla; en interiores no cambia nada [visto].

### Ajustes de la mesa

Ventana con buscador, niveles Principiante / Estándar / Avanzado, «solo lo cambiado» con su recuento, un grupo por
desplegable y, junto a cada ajuste cambiado, un rombo y **«Restaurar»** [visto]. Los grupos y niveles ya estaban en
`otras-ideas.md`; lo nuevo es el «Restaurar» por ajuste.

### Lo que no se pudo ver

Niebla distinta por jugador (solo hay «ver como jugador»), cartas, apps de mesa, puzzles y dividir la mesa en uso, la tele
o emisión, y qué recibe cada jugador. Varias están en `crear-y-compatibilidad.md` y `otras-ideas.md` por la guía.

### Fluidez del mapa (por software)

En reposo, 52–60 fps y cero dibujo WebGL por fotograma (no redibuja si nada cambia) [medido]. Con el modo Construir
abierto y lluvia, 12 fps en reposo y ~1 fps arrastrando el mapa [medido]; sin GPU no es representativo, pero indica que
los efectos y los círculos de luz cuestan.

## Compromisos y límites

- La amplitud es enorme y está **ordenada por frecuencia**, no por tipo: lo de cada momento a mano, lo raro en un
  catálogo con buscador. Ayuda a que una barra con cuarenta cosas no abrume.
- Los modos (jugar, dirigir, construir) esconden lo que no toca: la barra de construir no estorba en partida.
- Automatizan mucho el combate 5e (probabilidad, alcance, movimiento, daño aplicado), atado a su sistema; Crisol es
  genérico (ADR-0015) y no puede suponer 5e.
- Mezclas de idioma en la demo inglesa («CRITICO»): se nota la prisa.

## Qué nos llevamos a Crisol

Crisol ya tiene: escenas, rejilla, muros y puertas, visión, niebla con lo explorado, luces, medir, plantillas, dibujos,
textos, sellos y pines, combate con iniciativa, daño a varias fichas con mitad/doble, la tele y la pantalla del máster
(`apps/web/src/tabletop/`). Lo que Roliando hace distinto y merece la pena:

1. **Mirar otra escena sin mover a la mesa**, con un aviso fijo «la mesa no se ha movido» y «volver». En Crisol el máster
   prepara escenas, pero conviene ese aviso explícito de que lo que ve no es lo que ve el grupo.
2. **Catálogo «todo lo de la mesa» por frecuencia**, con buscador y atajos de una letra. Encaja con la barra de
   herramientas de la Mesa, que crecerá.
3. **Modos de barra** (jugar / construir): que muros, luces y escena vivan en un modo «Construir» y no en la barra de
   partida.
4. **La cámara sigue el turno** (opcional) y **traer la vista de todos aquí**; en Crisol la tele sigue al máster, pero
   los jugadores no.
5. **Tira de turnos arriba** con retratos grandes y «+N», más **número flotante** de daño sobre la ficha y aviso al
   aplicar.
6. **Clima y hora** como capa de efectos: partículas sencillas (lluvia, nieve, niebla, brasas) y un tinte por hora solo en
   escenas de exterior. Crisol no tiene nada de esto; es barato en PixiJS (un contenedor de partículas encima de la luz).
7. **Escrito: canales agrupados por lugar**, útil para la campaña alrededor de la Mesa (ADR-0019).
8. «**Restaurar**» junto a cada ajuste cambiado de la campaña.
9. Probabilidad de acertar sobre cada objetivo, solo si el sistema lo define (Crisol es genérico).
